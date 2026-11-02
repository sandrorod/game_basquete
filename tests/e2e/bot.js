// Robô jogador (roda dentro da página). Uso: window.__runBot({ god, maxStages, maxFramesPerStage })
window.__runBot = function ({ god = false, startStage = 0, maxStages = 10, maxFramesPerStage = 60 * 60 * 6 } = {}) {
  const g = window.__game;
  const inp = g.input;
  const acts = ['up', 'down', 'left', 'right', 'throw', 'strong', 'special', 'run', 'confirm'];
  g.newGame(startStage);
  const report = [];
  let stuck = 0, lastX = 0, stageFrames = 0, stage = g.stageIdx, livesAtStart = g.lives, dodgeT = 0, dodgeDir = 'up';
  let detour = 0, detourDir = 'up';
  for (let f = 0; f < maxStages * maxFramesPerStage; f++) {
    for (const a of acts) inp.release(a);
    const w = g.world;
    if (g.state === 'gameover') { report.push({ stage: stage + 1, result: 'GAME OVER', frames: stageFrames }); break; }
    if (g.state === 'victory') { report.push({ stage: stage + 1, result: 'VICTORY', frames: stageFrames, livesLost: livesAtStart - g.lives }); break; }
    if (g.stageIdx !== stage) {
      report.push({ stage: stage + 1, result: 'clear', frames: stageFrames, livesLost: livesAtStart - (g.lives - 0), score: g.score });
      stage = g.stageIdx; stageFrames = 0; livesAtStart = g.lives;
      if (report.length >= maxStages) break;
    }
    stageFrames++;
    if (stageFrames > maxFramesPerStage) { report.push({ stage: stage + 1, result: 'TIMEOUT', frames: stageFrames, boss: w && w.bossPhase, px: w && Math.round(w.player.x), waves: w && w.waves.map((x) => x.cleared) }); break; }
    if (w && g.state === 'play') {
      const p = w.player;
      p.god = god;
      const foes = w.enemies.filter((e) => !e.dead && e.state !== 'ko' && e.state !== 'flee' && e.state !== 'rideWait' && !(e.isBoss && e.state === 'intro'));
      const incoming = w.projectiles.filter((pr) => !pr.fromPlayer && (p.x - pr.x) * Math.sign(pr.vx) > 0 && Math.abs(p.x - pr.x) < 240);
      const bikeWarn = w.enemies.find((e) => e.kind === 'biker' && e.state === 'rideWait' && e.st >= 30 && Math.abs(e.laneY - p.y) < 18);
      const threat = bikeWarn ? { y: e => 0 } && { y: bikeWarn.laneY, x: p.x - 1, vx: 1 } : w.projectiles.find((pr) => !pr.fromPlayer && Math.abs(pr.y - p.y) < 18 && (p.x - pr.x) * Math.sign(pr.vx) > 0 && Math.abs(p.x - pr.x) < 170);
      const boss = foes.find((e) => e.isBoss);
      if (threat && dodgeT <= 0) { dodgeT = 14; dodgeDir = p.y > 292 ? 'up' : 'down'; }
      if (dodgeT > 0) { dodgeT--; inp.press(dodgeDir); }
      else if (boss && boss.state === 'jump') {
        // foge da marca de pouso
        inp.press(p.x < boss.target.x ? 'left' : 'right');
        inp.press(p.y < boss.target.y ? 'up' : 'down');
      } else if (foes.length) {
        foes.sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 3 - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y) * 3));
        const e = foes[0];
        const dy = e.y - p.y, dx = e.x - p.x;
        const close = Math.abs(dx) < (e.isBoss ? 70 : 46);
        const laneBusy = (y) => incoming.some((pr) => Math.abs(pr.y - y) < 20);
        if (Math.abs(dy) > 4 && !close && !laneBusy(e.y)) inp.press(dy > 0 ? 'down' : 'up');
        if (close) { inp.press(dx > 0 ? 'left' : 'right'); inp.press(p.y > 292 ? 'up' : 'down'); }
        else if (Math.abs(dx) > 230) inp.press(dx > 0 ? 'right' : 'left');
        else if ((dx > 0) !== (p.facing > 0)) inp.press(dx > 0 ? 'right' : 'left');
        if (Math.abs(dy) < 11 && (dx > 0) === (p.facing > 0) && !close) {
          if (p.ball === 'hand') inp.press(p.sp >= 1 ? 'special' : f % 4 === 0 ? 'strong' : 'throw');
        }
        if (p.ball === 'stolen' && Math.abs(dy) < 10) { inp.press(dx > 0 ? 'right' : 'left'); inp.press('throw'); }
      } else {
        // anda para a direita; contorna obstáculos
        if (detour > 0) { detour--; inp.press(detourDir); inp.press('right'); }
        else {
          // vão do telhado à frente: vai para a outra metade da rua antes de passar
          const gap = w.gaps.find((gp) => gp.x0 - p.x < 170 && gp.x1 + 20 > p.x);
          const safeY = gap ? (gap.y0 < 260 ? 322 : 258) : null;
          if (safeY !== null && Math.abs(p.y - safeY) > 6) { inp.press(p.y < safeY ? 'down' : 'up'); if (gap.x0 - p.x > 50) inp.press('right'); }
          else inp.press('right');
          if (Math.abs(p.x - lastX) < 0.3 && p.state !== 'windup') stuck++; else stuck = 0;
          if (stuck > 20) { detour = 40; detourDir = p.y > 292 ? 'up' : 'down'; stuck = 0; }
          // quebra o que estiver na frente
          const ob = w.obstacles.find((o) => !o.broken && o.breakable && Math.abs(o.y - p.y) < 14 && o.x > p.x && o.x - p.x < 120);
          if (ob && p.ball === 'hand') inp.press('throw');
        }
      }
      lastX = p.x;
      // pega comida próxima quando ferido
      const food = w.pickups.find((k) => Math.abs(k.x - p.x) < 140);
      if (food && p.hp < 70 && !foes.length) { inp.release('right'); inp.press(food.x > p.x ? 'right' : 'left'); inp.press(food.y > p.y ? 'down' : 'up'); }
    } else if (g.state === 'intro' || g.state === 'clear') {
      if (stageFrames % 20 === 0) inp.press('confirm');
    }
    g.update();
  }
  return { report, finalState: g.state, score: g.score, lives: g.lives };
};
