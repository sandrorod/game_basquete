// Inimigos atacam continuamente (não param depois dos primeiros golpes).
// Uso: npm run dev e depois `node tests/e2e/attack.mjs`
import { chromium } from 'playwright-core';

const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#ui .btn');
const r = await p.evaluate(() => {
  const g = window.__game;
  g.newGame(0);
  for (let i = 0; i < 140; i++) g.update();
  const w = g.world;
  w.waves.forEach((x) => { x.spawned = true; x.cleared = true; x.queue = []; });
  // sem invencibilidade (para os golpes contarem); a energia é reposta durante o teste
  let hits = 0;
  const orig = w.player.takeDamage.bind(w.player);
  w.player.takeDamage = (...a) => { const ok = orig(...a); if (ok) hits++; return ok; };
  for (const k of ['thug', 'thug', 'heavy']) w.spawnEnemy(k, 1);
  const perWindow = [];
  for (let s = 0; s < 6; s++) {
    const before = hits;
    for (let i = 0; i < 300; i++) { if (i % 30 === 0) w.player.hp = 100; g.update(); } // 5 s
    perWindow.push(hits - before);
  }
  return { perWindow, holders: w.tokens.holders.size, max: w.tokens.max, attackers: w.enemies.map((e) => [e.kind, e.state, e.hasToken]) };
});
const ok = r.perWindow.slice(2).every((n) => n > 0);
console.log(JSON.stringify(r));
console.log(ok ? '✓ inimigos continuam atacando' : '✗ inimigos pararam de atacar', errs);
await b.close();
process.exit(ok ? 0 : 1);
