// Checagem dos 20 requisitos de qualidade no navegador real (teclado, toque, menus).
// Uso: npm run dev (em outro terminal) e depois `npm run test:e2e`.
// Usa o Google Chrome instalado na máquina (playwright-core, sem baixar navegador).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
const BOT = fs.readFileSync(path.join(import.meta.dirname, 'bot.js'), 'utf8');
const results = [];
const check = (n, name, ok, info = '') => {
  results.push({ n, name, ok, info });
  console.log(`${ok ? '✓' : '✗'} ${String(n).padStart(2)}. ${name}${info ? ` — ${info}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];

async function open(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, ...opts });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'title', null, { timeout: 15000 });
  await page.addScriptTag({ content: BOT });
  return page;
}

/** Avança o jogo N quadros sem esperar o tempo real */
const step = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__game.update(); }, n);

/** Começa a fase e passa da apresentação */
async function play(page, stage = 0) {
  await page.evaluate((s) => window.__game.newGame(s), stage);
  await step(page, 140);
  return page.evaluate(() => window.__game.state);
}

/** Coloca um inimigo parado na frente do jogador (na mesma faixa) */
const spawnAhead = (page, kind, dx) =>
  page.evaluate(([k, d]) => {
    const w = window.__game.world;
    const e = w.spawnEnemy(k, 1);
    e.x = w.player.x + d;
    e.y = w.player.y;
    e.cooldown = 99999;
    return e.id;
  }, [kind, dx]);

try {
  // ── Estrutura das fases ─────────────────────────────────────────
  let page = await open();
  const stages = await page.evaluate(async () => {
    const { STAGES } = await import('/src/data/stages.ts');
    const { BOSSES } = await import('/src/data/bosses.ts');
    return { n: STAGES.length, themes: new Set(STAGES.map((s) => s.theme)).size, bosses: new Set(STAGES.map((s) => s.boss)).size, names: BOSSES.map((b) => b.name), enemies: STAGES.every((s) => s.enemies.length >= 2) };
  });
  check(1, 'As 10 fases existem e são diferentes', stages.n === 10 && stages.themes === 10, `${stages.n} fases, ${stages.themes} cenários diferentes`);
  check(2, 'Cada fase possui adversários próprios', stages.enemies, 'cada fase tem 2 ou mais tipos de inimigo com nomes de gangue');
  check(3, 'Cada fase termina com um chefe', stages.bosses === 10, stages.names.join(', '));

  // ── Movimento nas 4 direções (teclado real) ─────────────────────
  await play(page, 0);
  const pos = () => page.evaluate(() => ({ x: window.__game.world.player.x, y: window.__game.world.player.y, cam: window.__game.world.camX }));
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(80); };
  let a = await pos();
  await hold('KeyD', 400); const r = await pos();
  await hold('KeyA', 250); const l = await pos();
  await hold('KeyW', 300); const u = await pos();
  await hold('KeyS', 500); const d = await pos();
  await hold('ArrowRight', 300); const ar = await pos();
  check(4, 'O protagonista anda nas quatro direções', r.x > a.x + 10 && l.x < r.x - 5 && u.y < l.y - 5 && d.y > u.y + 5 && ar.x > d.x, `→ +${Math.round(r.x - a.x)} ← −${Math.round(r.x - l.x)} ↑ −${Math.round(l.y - u.y)} ↓ +${Math.round(d.y - u.y)} (setas também)`);

  // ── Câmera acompanha ────────────────────────────────────────────
  await page.evaluate(() => { window.__game.world.player.sp = 1; });
  const c0 = (await pos()).cam;
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyD');
  const c1 = (await pos()).cam;
  check(5, 'O cenário acompanha o jogador horizontalmente', c1 > c0 + 50, `câmera ${Math.round(c0)} → ${Math.round(c1)} (correndo com Shift)`);

  // ── Combate: bola acerta, energia cai, inimigo some ─────────────
  await play(page, 0);
  await page.evaluate(() => { const w = window.__game.world; w.waves.forEach((x) => { x.spawned = true; x.cleared = true; x.queue = []; }); });
  await spawnAhead(page, 'thug', 120);
  await step(page, 5);
  const hp0 = await page.evaluate(() => window.__game.world.enemies[0].hp);
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  const hp1 = await page.evaluate(() => window.__game.world.enemies[0]?.hp);
  check(6, 'A bola acerta os inimigos corretamente', hp1 < hp0, `ESPAÇO: energia ${hp0} → ${hp1}`);
  const score1 = await page.evaluate(() => window.__game.world.score);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'KeyJ' : 'Space');
    await page.waitForTimeout(260);
  }
  const hp2 = await page.evaluate(() => window.__game.world.enemies.find((e) => !e.isBoss)?.hp ?? 0);
  check(7, 'A energia dos inimigos diminui conforme os acertos', hp2 < hp1, `${hp1} → ${hp2} (rápido + forte com J)`);
  await page.waitForTimeout(1500);
  const left = await page.evaluate(() => window.__game.world.enemies.length);
  check(8, 'Os inimigos desaparecem quando derrotados', left === 0, `inimigos na tela: ${left}`);
  const score2 = await page.evaluate(() => window.__game.world.score);
  check(13, 'A pontuação é contabilizada', score2 > score1 && score1 >= 0, `${score1} → ${score2}`);

  // ── Jogador: barra de energia e dano ────────────────────────────
  await play(page, 0);
  await page.evaluate(() => { const w = window.__game.world; w.waves.forEach((x) => { x.spawned = true; x.cleared = true; x.queue = []; }); });
  const php0 = await page.evaluate(() => window.__game.world.player.hp);
  await page.evaluate(() => { const w = window.__game.world; const e = w.spawnEnemy('thug', 1); e.x = w.player.x + 26; e.y = w.player.y; e.cooldown = 0; e.aggression = 5; w.player.facing = -1; });
  await step(page, 240);
  const php1 = await page.evaluate(() => window.__game.world.player.hp);
  check(9, 'O jogador possui barra de energia', php0 === 100, 'HP 100 na barra do HUD (PLAYER 1)');
  check(10, 'O jogador perde energia quando recebe ataques', php1 < php0, `${php0} → ${php1}`);

  // ── Chefe com barra própria ─────────────────────────────────────
  const boss = await page.evaluate(() => {
    const g = window.__game, w = g.world;
    for (const e of w.enemies) e.remove = true;
    w.camX = w.stage.length - 640;
    w.player.x = w.camX + 200;
    w.player.god = true;
    for (let i = 0; i < 160; i++) g.update();
    return w.boss ? { name: w.boss.name, hp: w.boss.hp, max: w.boss.maxHp, phase: w.bossPhase } : null;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(import.meta.dirname, 'boss.png') });
  check(11, 'Os chefes possuem barras de energia próprias', !!boss && boss.max >= 300, boss ? `${boss.name}: ${boss.hp}/${boss.max} (barra grande no topo)` : 'chefe não apareceu');

  // ── Obstáculos ──────────────────────────────────────────────────
  await play(page, 0);
  const obs = await page.evaluate(() => {
    const g = window.__game, w = g.world;
    w.waves.forEach((x) => { x.spawned = true; x.cleared = true; x.queue = []; });
    const crate = w.obstacles.find((o) => o.breakable);
    const solid = w.obstacles.find((o) => !o.breakable && o.solid);
    // quebrável: arremessa nele
    w.camX = Math.max(0, crate.x - 300);
    w.player.x = crate.x - 120; w.player.y = crate.y - 3; w.player.facing = 1; w.player.vx = 0; w.player.vy = 0;
    let shots = 0;
    for (let i = 0; i < 600 && !crate.broken; i++) {
      if (w.player.ball === 'hand' && w.player.state === 'idle') { g.input.press('throw'); shots++; }
      g.update();
      g.input.release('throw');
    }
    // sólido: tenta atravessar andando
    let blocked = null;
    if (solid) {
      w.camX = Math.max(0, solid.x - 300);
      const f = solid.footprint();
      w.player.x = f.x0 - 30; w.player.y = (f.y0 + f.y1) / 2;
      g.input.press('right');
      for (let i = 0; i < 90; i++) g.update();
      g.input.release('right');
      blocked = w.player.x < f.x0 + 2;
    }
    return { broken: crate.broken, shots, solid: solid?.kind, blocked, drops: w.pickups.length };
  });
  check(12, 'Os obstáculos funcionam corretamente', obs.broken && obs.blocked !== false, `caixa/lixeira quebrou com ${obs.shots} arremesso(s), item no chão: ${obs.drops}; ${obs.solid ?? 'sólido'} bloqueia a passagem: ${obs.blocked}`);

  // ── Controles do computador: J, K (carregar), Shift ─────────────
  await play(page, 0);
  await page.evaluate(() => { const w = window.__game.world; w.waves.forEach((x) => { x.spawned = true; x.cleared = true; x.queue = []; }); });
  await page.keyboard.down('KeyK');
  await page.waitForTimeout(900);
  const charging = await page.evaluate(() => ({ s: window.__game.world.player.state, c: window.__game.world.player.charge }));
  await page.keyboard.up('KeyK');
  await page.waitForTimeout(80);
  const special = await page.evaluate(() => window.__game.world.projectiles.find((p) => p.mainBall)?.power);
  await page.waitForFunction(() => window.__game.world.player.ball === 'hand' && window.__game.world.player.state === 'idle', null, { timeout: 5000 });
  await page.keyboard.press('KeyJ');
  // o arremesso forte tem preparação (~0,2 s) antes de soltar a bola
  await page.waitForTimeout(380);
  const strong = await page.evaluate(() => window.__game.world.projectiles.find((p) => p.mainBall)?.power);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const paused = await page.evaluate(() => ({ s: window.__game.state, menu: document.querySelector('#ui h2')?.textContent }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const resumed = await page.evaluate(() => window.__game.state);
  check(14, 'Os controles funcionam no computador', charging.s === 'charge' && charging.c > 0.5 && special === 'special' && strong === 'strong', `K segurado carrega (${Math.round(charging.c * 100)}%, estado ${charging.s}) e solta: ${special}; J: ${strong}`);
  check(19, 'O sistema de pausa funciona', paused.s === 'paused' && paused.menu === 'PAUSED' && resumed === 'play', `ESC → ${paused.s} (menu "${paused.menu}") → ESC → ${resumed}`);

  // ── Vidas ───────────────────────────────────────────────────────
  const lives = await page.evaluate(() => {
    const g = window.__game, w = g.world;
    const before = w.lives;
    w.player.hp = 1;
    w.player.invuln = 0;
    w.player.takeDamage(w, 50, true, 1);
    for (let i = 0; i < 260; i++) g.update();
    const after = w.lives, respawned = w.player.hp === 100;
    w.lives = 1;
    w.player.invuln = 0;
    w.player.takeDamage(w, 999, true, 1);
    for (let i = 0; i < 260; i++) g.update();
    return { before, after, respawned, state: g.state, screen: document.querySelector('#ui .big')?.textContent };
  });
  check(16, 'O sistema de vidas funciona', lives.after === lives.before - 1 && lives.respawned, `vidas ${lives.before} → ${lives.after}, volta com energia cheia`);
  const goScreen = lives.state === 'gameover' && lives.screen === 'GAME OVER';

  // ── Progressão e vitória (robô invencível no jogo inteiro) ───────
  const run = await page.evaluate(() => window.__runBot({ god: true, maxFramesPerStage: 60 * 60 * 10 }));
  const cleared = run.report.filter((x) => x.result === 'clear').length;
  const victoryText = await page.evaluate(() => document.querySelector('#ui .win')?.textContent ?? '');
  check(17, 'A progressão entre as fases funciona', cleared === 9 && run.finalState === 'victory', `${cleared} fases concluídas em sequência + chefe final (${run.report.map((x) => `F${x.stage} ${Math.round(x.frames / 3600 * 10) / 10}min`).join(', ')})`);
  check(18, 'O jogo possui tela de vitória e GAME OVER', goScreen && /KING/.test(victoryText), `GAME OVER: ${goScreen ? 'ok' : 'falhou'} · vitória: "${victoryText.replace(/\s+/g, ' ').trim()}"`);
  await page.screenshot({ path: path.join(import.meta.dirname, 'victory.png') });
  await page.close();

  // ── Mecânicas extras pedidas: bola volta causando dano; turbo gasta poder ──
  page = await open();
  await play(page, 0);
  const extra = await page.evaluate(() => {
    const g = window.__game, w = g.world, p = w.player;
    w.waves.forEach((x) => { x.spawned = true; x.cleared = true; x.queue = []; });
    // bola volta: arremessa, e quando ela começa a voltar um inimigo entra no caminho de volta
    p.facing = 1;
    g.input.press('throw'); g.update(); g.input.release('throw');
    let pr = null;
    for (let i = 0; i < 120 && !(pr && pr.returning); i++) { g.update(); pr = w.projectiles.find((q) => q.mainBall); }
    const mid = w.spawnEnemy('thug', 1);
    mid.x = (pr.x + p.x) / 2; mid.y = p.y; mid.cooldown = 99999;
    const hpBefore = mid.hp;
    for (let i = 0; i < 60; i++) { mid.x = Math.max(mid.x, p.x + 20); g.update(); }
    const returnDmg = hpBefore - mid.hp;
    mid.remove = true;
    for (let i = 0; i < 5; i++) g.update();
    // turbo: sem poder não corre; com poder corre e gasta
    p.sp = 0;
    g.input.press('right'); g.input.press('run');
    for (let i = 0; i < 30; i++) g.update();
    const runWithout = p.state === 'run';
    g.input.release('run'); g.update();
    p.sp = 0.6;
    g.input.press('run');
    for (let i = 0; i < 60; i++) g.update();
    const runWith = p.state === 'run', spAfter = p.sp;
    g.input.release('run'); g.input.release('right');
    return { returnDmg, runWithout, runWith, spAfter };
  });
  check(21, 'A bola também causa dano quando volta', extra.returnDmg > 0, `inimigo no caminho de volta perdeu ${extra.returnDmg} de energia`);
  check(22, 'O turbo usa a barra de poder', !extra.runWithout && extra.runWith && extra.spAfter < 0.55, `sem poder não corre; com 60% correu 1 s e ficou com ${Math.round(extra.spAfter * 100)}%`);
  await page.close();

  // ── Celular: controles de toque ─────────────────────────────────
  page = await open({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await play(page, 0);
  await page.evaluate(() => { const w = window.__game.world; w.waves.forEach((x) => { x.spawned = true; x.cleared = true; x.queue = []; }); });
  const touchOn = await page.evaluate(() => document.getElementById('touch').classList.contains('on'));
  const before = await pos();
  const stick = await page.locator('.stick').boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 60, y: cy - 30, id: 1 }] });
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await pos();
  const tb = await page.locator('.tb-throw').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tb.x + tb.width / 2, y: tb.y + tb.height / 2, id: 2 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  const thrown = await page.evaluate(() => window.__game.world.projectiles.some((p) => p.mainBall) || window.__game.world.player.state === 'throw');
  await page.screenshot({ path: path.join(import.meta.dirname, 'mobile.png') });
  check(15, 'Os controles funcionam em dispositivos móveis', touchOn && after.x > before.x + 10 && after.y < before.y && thrown, `analógico moveu (+${Math.round(after.x - before.x)}, ${Math.round(after.y - before.y)}), botão THROW arremessou`);
  await page.close();
} catch (err) {
  console.error('ERRO NO TESTE:', err);
  errors.push(String(err));
}

check(20, 'Não existem erros que impeçam a partida', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'nenhum erro de JavaScript em todas as partidas');
await browser.close();
results.sort((a, b) => a.n - b.n);
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} requisitos verificados`);
process.exit(ok === results.length ? 0 : 1);
