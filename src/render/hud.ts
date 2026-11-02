import { H, W } from '../core/config';
import { drawFighter } from './fighter';
import { HERO } from '../data/looks';
import { poseFor } from './poses';

export const FONT = '"Press Start 2P", monospace';

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', outline = 3) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  if (outline) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = '#000';
    ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

/** Barra com "rastro" amarelo do dano recente */
export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, trail: number, colors: [string, string]) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#3a0d12';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x, y, w * Math.max(0, trail), h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * Math.max(0, value), h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, w * Math.max(0, value), Math.max(1, h / 3));
}

export interface HudData {
  hp: number;
  hpTrail: number;
  sp: number;
  score: number;
  lives: number;
  stage: number;
  stageName: string;
  combo: number;
  comboT: number;
  boss?: { name: string; hp: number; trail: number; enraged: boolean };
  ballReady: boolean;
  charge: number;
  turbo: boolean;
  go: boolean;
  t: number;
}

export function drawHud(ctx: CanvasRenderingContext2D, d: HudData) {
  // painel do jogador
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(4, 4, 238, 46);
  // retrato
  ctx.save();
  ctx.beginPath();
  ctx.rect(8, 8, 32, 38);
  ctx.fillStyle = '#8a1520';
  ctx.fill();
  ctx.clip();
  drawFighter(ctx, 22, 116, HERO, poseFor('idle', d.t, { expr: d.hp < 0.25 ? 'hurt' : 'normal' }), { facing: 1, scale: 1.45 });
  ctx.restore();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, 32, 38);
  text(ctx, 'PLAYER 1', 46, 16, 7, '#ffd23f');
  bar(ctx, 46, 20, 150, 9, d.hp, d.hpTrail, d.hp < 0.25 && Math.floor(d.t / 8) % 2 ? ['#ff6b6b', '#c92a2a'] : ['#7cff6b', '#1f9d3a']);
  // barra especial (SP)
  bar(ctx, 46, 33, 100, 5, d.sp, d.sp, d.sp >= 1 && Math.floor(d.t / 6) % 2 ? ['#ffffff', '#38f6ff'] : ['#38f6ff', '#1e63d6']);
  text(ctx, d.turbo ? 'TURBO' : d.sp >= 1 ? 'SUPER!' : 'POWER', 150, 39, 5, d.turbo ? '#ffd23f' : d.sp >= 1 ? '#38f6ff' : '#9fdcff');
  // vidas
  for (let i = 0; i < Math.min(d.lives, 6); i++) {
    ctx.fillStyle = '#f07818';
    ctx.beginPath();
    ctx.arc(205 + i * 7, 25, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  text(ctx, `x${d.lives}`, 202, 40, 6, '#ffffff');
  // bola disponível
  ctx.globalAlpha = d.ballReady ? 1 : 0.3;
  ctx.fillStyle = '#f07818';
  ctx.beginPath();
  ctx.arc(234, 41, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // pontuação e fase
  text(ctx, 'SCORE', W - 8, 14, 7, '#ffd23f', 'right');
  text(ctx, String(d.score).padStart(8, '0'), W - 8, 26, 9, '#ffffff', 'right');
  text(ctx, `STAGE ${d.stage}`, W - 8, 40, 7, '#38f6ff', 'right');
  text(ctx, d.stageName, W - 8, 50, 5, '#cfe9ff', 'right');

  // barra do chefe
  if (d.boss) {
    const bw = 260, bx = (W - bw) / 2, by = 60;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 6, by - 14, bw + 12, 28);
    text(ctx, d.boss.name, bx, by - 3, 7, d.boss.enraged && Math.floor(d.t / 10) % 2 ? '#ff4d4d' : '#ffd23f');
    if (d.boss.enraged) text(ctx, 'RAGE', bx + bw, by - 3, 6, '#ff4d4d', 'right');
    bar(ctx, bx, by + 1, bw, 9, d.boss.hp, d.boss.trail, ['#ff5d5d', '#a4161a']);
  }

  // combo
  if (d.combo >= 2 && d.comboT > 0) {
    const s = 1 + Math.max(0, d.comboT - 70) / 30;
    ctx.save();
    ctx.translate(W - 70, 92);
    ctx.scale(s, s);
    text(ctx, `${d.combo} HITS`, 0, 0, 11, '#ffd23f', 'center');
    text(ctx, 'COMBO!', 0, 12, 7, '#ff8a3d', 'center');
    ctx.restore();
  }

  // carga do arremesso especial
  if (d.charge > 0) {
    bar(ctx, W / 2 - 40, H - 22, 80, 6, d.charge, d.charge, d.charge >= 1 ? ['#ffffff', '#ffd23f'] : ['#ffd23f', '#ff8a3d']);
    text(ctx, d.charge >= 1 ? 'MAX!' : 'CHARGE', W / 2, H - 26, 6, '#ffd23f', 'center');
  }

  // GO ▸
  if (d.go && Math.floor(d.t / 20) % 2 === 0) {
    text(ctx, 'GO', W - 60, H / 2 - 20, 18, '#ffd23f', 'center', 4);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W - 42, H / 2 - 4);
    ctx.lineTo(W - 22, H / 2 + 8);
    ctx.lineTo(W - 42, H / 2 + 20);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
}

/** Barrinha de energia acima de cada inimigo */
export function enemyBar(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, trail: number, name: string, show: boolean) {
  if (!show) return;
  const w = 34;
  bar(ctx, x - w / 2, y, w, 3.5, hp, trail, ['#ff6b6b', '#c92a2a']);
  ctx.font = `4.5px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeText(name, x, y - 2);
  ctx.fillText(name, x, y - 2);
  ctx.textAlign = 'left';
}
