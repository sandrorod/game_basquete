import { PICKUPS, type PickupKind } from '../data/items';
import { SIZE } from '../core/config';
import { shade } from '../core/math';
import type { ProjKind } from '../data/bosses';
import type { PropKind } from '../data/stages';
import { drawSprite, sprites } from './sprites';

const OUT = '#15121c';

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** Tamanho visual de cada obstáculo (largura, altura) e da "pegada" no chão (w, profundidade) */
export const PROP_SIZE: Record<PropKind, { w: number; h: number; fw: number; fd: number; hp: number; solid: boolean }> = {
  trash: { w: 30, h: 46, fw: 26, fd: 12, hp: 12, solid: true },
  crate: { w: 36, h: 34, fw: 34, fd: 14, hp: 14, solid: true },
  barrel: { w: 30, h: 42, fw: 28, fd: 12, hp: 18, solid: true },
  chair: { w: 30, h: 40, fw: 26, fd: 10, hp: 8, solid: true },
  table: { w: 60, h: 42, fw: 56, fd: 14, hp: 14, solid: true },
  car: { w: 140, h: 66, fw: 132, fd: 24, hp: 0, solid: true },
  barrier: { w: 56, h: 46, fw: 54, fd: 12, hp: 0, solid: true },
  umbrella: { w: 90, h: 104, fw: 10, fd: 6, hp: 10, solid: false },
  surfboard: { w: 16, h: 52, fw: 14, fd: 6, hp: 10, solid: true },
  stall: { w: 56, h: 50, fw: 54, fd: 14, hp: 20, solid: true },
  cone: { w: 22, h: 32, fw: 18, fd: 10, hp: 4, solid: true },
  hydrant: { w: 20, h: 38, fw: 16, fd: 10, hp: 0, solid: true },
  machine: { w: 52, h: 68, fw: 48, fd: 16, hp: 0, solid: true },
  bench: { w: 76, h: 40, fw: 70, fd: 12, hp: 12, solid: true },
  ballrack: { w: 40, h: 30, fw: 40, fd: 10, hp: 12, solid: true },
  tank: { w: 44, h: 50, fw: 42, fd: 16, hp: 0, solid: true },
  antenna: { w: 20, h: 70, fw: 12, fd: 8, hp: 0, solid: true },
  dumpster: { w: 62, h: 36, fw: 60, fd: 16, hp: 0, solid: true },
  pot: { w: 22, h: 24, fw: 20, fd: 10, hp: 8, solid: true },
  speaker: { w: 30, h: 44, fw: 28, fd: 12, hp: 16, solid: true },
  pallet: { w: 54, h: 28, fw: 50, fd: 14, hp: 14, solid: true },
  tire: { w: 44, h: 26, fw: 40, fd: 12, hp: 10, solid: true },
  spool: { w: 50, h: 46, fw: 46, fd: 14, hp: 16, solid: true },
  crates: { w: 48, h: 48, fw: 44, fd: 14, hp: 20, solid: true },
  vending: { w: 42, h: 86, fw: 40, fd: 16, hp: 0, solid: true },
  moto: { w: 84, h: 52, fw: 78, fd: 14, hp: 0, solid: true },
  bike: { w: 74, h: 46, fw: 68, fd: 10, hp: 10, solid: true },
};
// tudo 20% maior (SIZE), inclusive a área que bloqueia a passagem
for (const s of Object.values(PROP_SIZE)) {
  s.w = Math.round(s.w * SIZE);
  s.h = Math.round(s.h * SIZE);
  s.fw = Math.round(s.fw * SIZE);
  s.fd = Math.round(s.fd * SIZE);
}

/**
 * Obstáculos desenhados com os sprites do modelo: variações e altura na tela.
 * Proporcional ao herói (88 de altura ≈ 1,90 m → ~46 por metro).
 */
export const PROP_SPRITES: Partial<Record<PropKind, { names: string[]; h: number[] }>> = {
  trash: { names: ['trash_metal', 'trash_green'], h: [46, 44] },
  crate: { names: ['crate_a', 'crate_b', 'crate_c'], h: [34, 32, 32] },
  barrel: { names: ['barrel_red', 'barrel_blue', 'barrel_yellow'], h: [42, 42, 42] },
  chair: { names: ['chair_plastic'], h: [40] },
  table: { names: ['table_set'], h: [42] },
  car: { names: ['car_red', 'car_blue'], h: [66, 66] },
  barrier: { names: ['barrier_a', 'barrier_b'], h: [46, 46] },
  umbrella: { names: ['umbrella_red', 'umbrella_blue'], h: [104, 104] },
  cone: { names: ['cone_a', 'cone_b'], h: [32, 32] },
  hydrant: { names: ['hydrant'], h: [38] },
  machine: { names: ['electric_box', 'ac_unit'], h: [68, 40] },
  bench: { names: ['bench_a', 'bench_b'], h: [40, 40] },
  pallet: { names: ['pallet'], h: [28] },
  tire: { names: ['tire'], h: [26] },
  spool: { names: ['spool'], h: [46] },
  crates: { names: ['crates_stack'], h: [48] },
  vending: { names: ['vending'], h: [86] },
  moto: { names: ['moto_red', 'moto_black'], h: [52, 52] },
  bike: { names: ['bike_red', 'bike_green'], h: [46, 46] },
};

/** Desenha o obstáculo com sprite (quando existe); devolve false para usar o desenho antigo */
export function drawPropSprite(ctx: CanvasRenderingContext2D, kind: PropKind, x: number, y: number, flash: boolean, dmg: number, seed: number) {
  const def = PROP_SPRITES[kind];
  if (!def || !sprites.loaded) return false;
  const i = Math.abs(Math.floor(seed * 1000)) % def.names.length;
  const f = sprites.props[def.names[i]];
  if (!f) return false;
  const s = (def.h[i] * SIZE) / f.h;
  drawSprite(ctx, f, x + (dmg > 0 ? Math.sin(dmg * 9) * dmg * 1.5 : 0), y, s, { flash });
  return true;
}

export function drawProp(ctx: CanvasRenderingContext2D, kind: PropKind, x: number, y: number, flash: boolean, dmg: number, accent: string) {
  const s = PROP_SIZE[kind];
  const L = x - s.w / 2;
  const T = y - s.h;
  const F = (c: string) => (flash ? '#ffffff' : c);
  ctx.save();
  // tremida quando danificado
  if (dmg > 0) ctx.translate(Math.sin(dmg * 9) * dmg * 1.5, 0);
  switch (kind) {
    case 'trash': {
      ctx.fillStyle = F('#7d8a8c');
      ctx.beginPath();
      ctx.moveTo(L + 2, T + 4);
      ctx.lineTo(L + s.w - 2, T + 4);
      ctx.lineTo(L + s.w - 4, y);
      ctx.lineTo(L + 4, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.strokeStyle = F('#5d686a');
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(L + 5 + i * 4, T + 7);
        ctx.lineTo(L + 6 + i * 4, y - 2);
        ctx.stroke();
      }
      box(ctx, L, T, s.w, 5, F('#9aa5a7'));
      break;
    }
    case 'crate':
      box(ctx, L, T, s.w, s.h, F('#b07a3c'));
      ctx.strokeStyle = F('#7a5023');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(L + 3, T + 3);
      ctx.lineTo(L + s.w - 3, y - 3);
      ctx.moveTo(L + s.w - 3, T + 3);
      ctx.lineTo(L + 3, y - 3);
      ctx.stroke();
      ctx.strokeRect(L + 3, T + 3, s.w - 6, s.h - 6);
      break;
    case 'barrel': {
      const g = ctx.createLinearGradient(L, 0, L + s.w, 0);
      g.addColorStop(0, F(shade(accent, -0.35)));
      g.addColorStop(0.45, F(shade(accent, 0.2)));
      g.addColorStop(1, F(shade(accent, -0.45)));
      ctx.fillStyle = g;
      ctx.fillRect(L, T + 2, s.w, s.h - 2);
      ctx.strokeStyle = OUT;
      ctx.strokeRect(L, T + 2, s.w, s.h - 2);
      ctx.fillStyle = F('#333');
      ctx.fillRect(L, T + 9, s.w, 2);
      ctx.fillRect(L, y - 10, s.w, 2);
      ctx.fillStyle = F(shade(accent, 0.1));
      ctx.beginPath();
      ctx.ellipse(x, T + 2, s.w / 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = F('#111');
      ctx.font = 'bold 8px Arial';
      ctx.fillText('☢', x - 4, T + 22);
      break;
    }
    case 'chair':
      box(ctx, L + 2, T, 4, s.h, F('#e9c46a'));
      box(ctx, L + 2, y - 12, s.w - 4, 4, F('#e76f51'));
      box(ctx, L + s.w - 6, y - 12, 3, 12, F('#e9c46a'));
      box(ctx, L + 2, y - 8, 3, 8, F('#e9c46a'));
      break;
    case 'table':
      box(ctx, L, T, s.w, 5, F('#8b2d2d'));
      box(ctx, L + 4, T + 5, 4, s.h - 5, F('#5a1d1d'));
      box(ctx, L + s.w - 8, T + 5, 4, s.h - 5, F('#5a1d1d'));
      box(ctx, x - 5, T - 6, 10, 6, F('#f1f1f1'));
      break;
    case 'car': {
      ctx.fillStyle = F(accent);
      ctx.beginPath();
      ctx.moveTo(L + 4, y - 10);
      ctx.lineTo(L + 4, y - 26);
      ctx.lineTo(L + 28, y - 28);
      ctx.lineTo(L + 42, T);
      ctx.lineTo(L + 88, T);
      ctx.lineTo(L + 102, y - 28);
      ctx.lineTo(L + s.w - 2, y - 24);
      ctx.lineTo(L + s.w - 2, y - 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = F('#9fd3ff');
      ctx.fillRect(L + 46, T + 4, 18, 13);
      ctx.fillRect(L + 68, T + 4, 18, 13);
      ctx.fillStyle = F('#ffe066');
      ctx.fillRect(L + s.w - 8, y - 22, 5, 4);
      ctx.fillStyle = F('#e63946');
      ctx.fillRect(L + 5, y - 22, 4, 4);
      for (const wx of [L + 26, L + s.w - 26]) {
        ctx.fillStyle = F('#111');
        ctx.beginPath();
        ctx.arc(wx, y - 8, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = F('#9aa0a6');
        ctx.beginPath();
        ctx.arc(wx, y - 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'barrier':
      box(ctx, L, T + 6, s.w, s.h - 6, F('#e0e0e0'));
      ctx.fillStyle = F('#e63946');
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(L, T + 6, s.w, 10);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(L + i * 14 - 4, T + 16);
        ctx.lineTo(L + i * 14 + 4, T + 6);
        ctx.lineTo(L + i * 14 + 11, T + 6);
        ctx.lineTo(L + i * 14 + 3, T + 16);
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'umbrella':
      ctx.fillStyle = F('#ddd');
      ctx.fillRect(x - 1, T + 10, 2, s.h - 10);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = F(i % 2 ? '#ffffff' : accent);
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(L + (i * s.w) / 6, T + 14);
        ctx.lineTo(L + ((i + 1) * s.w) / 6, T + 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = OUT;
      ctx.beginPath();
      ctx.moveTo(L, T + 14);
      ctx.lineTo(x, T);
      ctx.lineTo(L + s.w, T + 14);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'surfboard':
      ctx.fillStyle = F(accent);
      ctx.beginPath();
      ctx.ellipse(x, y - s.h / 2, s.w / 2, s.h / 2, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.fillStyle = F('#ffffff');
      ctx.fillRect(x - 1, T + 6, 2, s.h - 12);
      break;
    case 'stall':
      box(ctx, L + 2, T + 16, s.w - 4, s.h - 16, F('#7a4b2a'));
      for (let i = 0; i < 6; i++) box(ctx, L + (i * s.w) / 6, T + 6, s.w / 6, 12, F(i % 2 ? '#fff5e1' : '#d62828'));
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = F(['#f4a261', '#e9c46a', '#90be6d', '#e76f51'][i]);
        ctx.beginPath();
        ctx.arc(L + 12 + i * 11, T + 24, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'cone':
      ctx.fillStyle = F('#ff7b00');
      ctx.beginPath();
      ctx.moveTo(x, T);
      ctx.lineTo(L + s.w - 2, y - 3);
      ctx.lineTo(L + 2, y - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.stroke();
      box(ctx, L, y - 3, s.w, 3, F('#ff7b00'));
      ctx.fillStyle = F('#fff');
      ctx.fillRect(x - 3, T + 8, 6, 3);
      break;
    case 'hydrant':
      box(ctx, L + 2, T + 4, s.w - 4, s.h - 4, F('#d62828'));
      box(ctx, L, T + 9, s.w, 4, F('#a4161a'));
      ctx.fillStyle = F('#d62828');
      ctx.beginPath();
      ctx.arc(x, T + 4, 5, Math.PI, 0);
      ctx.fill();
      break;
    case 'machine': {
      box(ctx, L, T + 8, s.w, s.h - 8, F('#6d7480'));
      box(ctx, L + 6, T + 14, 22, 16, F('#1f2a2e'));
      ctx.fillStyle = F('#7cff6b');
      ctx.fillRect(L + 9, T + 18, 10, 2);
      ctx.fillRect(L + 9, T + 23, 15, 2);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = F(['#e63946', '#ffcf33', '#38f6ff'][i]);
        ctx.beginPath();
        ctx.arc(L + 38 + i * 7, T + 20, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      box(ctx, L + 10, T, 8, 10, F('#4b5563'));
      for (let i = 0; i < 6; i++) box(ctx, L + i * 10, y - 8, 10, 8, F(i % 2 ? '#222' : '#f2c94c'));
      break;
    }
    case 'bench':
      box(ctx, L, T, s.w, 5, F('#8d6e4f'));
      box(ctx, L, T + 8, s.w, 4, F('#8d6e4f'));
      box(ctx, L + 4, T + 12, 4, s.h - 12, F('#333'));
      box(ctx, L + s.w - 8, T + 12, 4, s.h - 12, F('#333'));
      break;
    case 'ballrack': {
      box(ctx, L, T + 10, s.w, 3, F('#444'));
      box(ctx, L, y - 4, s.w, 3, F('#444'));
      box(ctx, L + 2, T + 10, 3, s.h - 10, F('#444'));
      box(ctx, L + s.w - 5, T + 10, 3, s.h - 10, F('#444'));
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = F('#f07818');
        ctx.beginPath();
        ctx.arc(L + 7 + i * 9, T + 6, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(L + 7 + i * 9, y - 9, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'tank':
      box(ctx, L, T, s.w, s.h - 6, F('#9aa3ad'));
      ctx.fillStyle = F('#c4ccd6');
      ctx.fillRect(L + 4, T + 4, 6, s.h - 14);
      box(ctx, L + 4, y - 6, 6, 6, F('#555'));
      box(ctx, L + s.w - 10, y - 6, 6, 6, F('#555'));
      break;
    case 'antenna':
      ctx.strokeStyle = F('#9aa0a6');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, T);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 9 + i * 2, T + 10 + i * 12);
        ctx.lineTo(x + 9 - i * 2, T + 10 + i * 12);
        ctx.stroke();
      }
      box(ctx, x - 6, y - 4, 12, 4, F('#555'));
      break;
    case 'dumpster':
      box(ctx, L, T + 6, s.w, s.h - 6, F('#2d6a4f'));
      box(ctx, L - 2, T, s.w + 4, 7, F('#1b4332'));
      ctx.fillStyle = F('#1b4332');
      for (let i = 1; i < 4; i++) ctx.fillRect(L + i * 15, T + 9, 2, s.h - 12);
      break;
    case 'pot':
      ctx.fillStyle = F('#c1440e');
      ctx.beginPath();
      ctx.ellipse(x, y - 9, s.w / 2, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.fillStyle = F('#2d9a4e');
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(x - 8 + i * 4, T + 4, 3, 7, (i - 2) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'speaker':
      box(ctx, L, T, s.w, s.h, F('#1e1e26'));
      for (const cy of [T + 12, T + 31]) {
        ctx.fillStyle = F('#3a3a48');
        ctx.beginPath();
        ctx.arc(x, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = F('#111');
        ctx.beginPath();
        ctx.arc(x, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
  ctx.restore();
}

/** Prêmio no chão: sprite do modelo, flutuando e brilhando (pisca antes de sumir) */
export function drawPickup(ctx: CanvasRenderingContext2D, kind: PickupKind, x: number, y: number, t: number, left = 900) {
  const f = sprites.items[kind];
  if (!f) return;
  if (left < 150 && Math.floor(t / 5) % 2) return;
  const d = PICKUPS[kind];
  const bob = Math.sin(t * 0.1) * 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = d.color;
  ctx.shadowBlur = 6 + Math.sin(t * 0.2) * 3;
  const s = (d.size * SIZE) / Math.max(f.w, f.h);
  ctx.drawImage(f.img, x - (f.w * s) / 2, y - 4 + bob - f.h * s, f.w * s, f.h * s);
  ctx.restore();
}

/**
 * Jato d'água do hidrante aberto: coluna subindo (sobe aos poucos ao abrir), gotas caindo em arco
 * para os dois lados e uma poça que cresce no chão.
 */
export function drawWaterJet(ctx: CanvasRenderingContext2D, x: number, groundY: number, topY: number, t: number) {
  const grow = Math.min(1, t / 20);
  const jetH = (78 + Math.sin(t * 0.3) * 6) * SIZE * grow;
  const nozzle = topY + 4;
  ctx.save();
  // poça
  const pool = Math.min(1, t / 240);
  ctx.fillStyle = 'rgba(120,190,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, groundY + 2, (16 + 34 * pool) * SIZE, (4 + 7 * pool) * SIZE, 0, 0, Math.PI * 2);
  ctx.fill();
  // coluna principal (balança um pouco)
  const sway = Math.sin(t * 0.17) * 2;
  const g = ctx.createLinearGradient(0, nozzle, 0, nozzle - jetH);
  g.addColorStop(0, 'rgba(230,245,255,0.95)');
  g.addColorStop(0.7, 'rgba(160,215,255,0.8)');
  g.addColorStop(1, 'rgba(160,215,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 5 * SIZE, nozzle);
  ctx.quadraticCurveTo(x - 8 * SIZE + sway, nozzle - jetH * 0.6, x - 15 * SIZE + sway, nozzle - jetH);
  ctx.lineTo(x + 15 * SIZE + sway, nozzle - jetH);
  ctx.quadraticCurveTo(x + 8 * SIZE + sway, nozzle - jetH * 0.6, x + 5 * SIZE, nozzle);
  ctx.closePath();
  ctx.fill();
  // gotas: sobem com o jato e caem em arco
  for (let i = 0; i < 44; i++) {
    const life = 46;
    const k = ((t + i * 7) % life) / life;
    const side = i % 2 ? 1 : -1;
    const spread = (0.6 + ((i * 37) % 10) / 10) * SIZE;
    const dx = side * spread * k * 34;
    const dy = -jetH * (1.9 * k - 1.3 * k * k) * 0.95;
    const yy = nozzle + dy;
    if (yy > groundY) continue;
    ctx.fillStyle = i % 3 ? 'rgba(200,232,255,0.9)' : 'rgba(255,255,255,0.95)';
    ctx.fillRect(x + dx + sway * (1 - k), yy, 2.5 * SIZE, 3.5 * SIZE);
  }
  // espuma no topo
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(x + sway + Math.sin(t * 0.4 + i * 1.7) * 11 * SIZE, nozzle - jetH + 2 + Math.cos(t * 0.5 + i) * 3, 3.5 * SIZE, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Projéteis dos inimigos (a bola de basquete usa drawBall) */
export function drawProjectile(ctx: CanvasRenderingContext2D, kind: ProjKind, x: number, y: number, t: number, dirX: number) {
  ctx.save();
  ctx.translate(x, y);
  switch (kind) {
    case 'can':
      ctx.rotate(t * 0.4);
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(-3, -5, 6, 10);
      ctx.fillStyle = '#2a9d8f';
      ctx.fillRect(-3, -2, 6, 4);
      break;
    case 'bolt':
      ctx.shadowColor = '#7df9ff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#e0ffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9 * dirX, -3);
      ctx.lineTo(-2 * dirX, 2);
      ctx.lineTo(2 * dirX, -2);
      ctx.lineTo(9 * dirX, 3);
      ctx.stroke();
      break;
    case 'fire': {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 9);
      g.addColorStop(0, '#fff6a8');
      g.addColorStop(0.4, '#ff9f1c');
      g.addColorStop(1, 'rgba(230,57,70,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 9 + Math.sin(t * 0.8) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,120,40,0.5)';
      ctx.beginPath();
      ctx.ellipse(-8 * dirX, 0, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rocket':
      ctx.scale(dirX, 1);
      ctx.fillStyle = '#c4ccd6';
      ctx.fillRect(-8, -3, 14, 6);
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.moveTo(6, -3);
      ctx.lineTo(11, 0);
      ctx.lineTo(6, 3);
      ctx.fill();
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(-14 - Math.random() * 4, 0);
      ctx.lineTo(-8, 2);
      ctx.fill();
      break;
    case 'star':
      ctx.rotate(t * 0.6);
      ctx.fillStyle = '#c9d1d9';
      ctx.strokeStyle = '#111';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? 2 : 7;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'clipboard':
      // prancheta do COACH girando
      ctx.rotate(t * 0.5);
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(-7, -9, 14, 18);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-5, -6, 10, 13);
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(-3, -10, 6, 3);
      ctx.strokeStyle = '#2b6cff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(3, 3);
      ctx.moveTo(3, -3);
      ctx.lineTo(-3, 3);
      ctx.stroke();
      break;
    case 'ball':
      break;
  }
  ctx.restore();
}

/** Moto do BIKER (o piloto é desenhado por cima) */
export function drawBike(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, t: number, color: string, flash: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const F = (c: string) => (flash ? '#ffffff' : c);
  for (const wx of [-17, 17]) {
    ctx.fillStyle = F('#111');
    ctx.beginPath();
    ctx.arc(wx, -9, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = F('#777');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(wx, -9, 5, t * 0.6, t * 0.6 + Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = F(color);
  ctx.beginPath();
  ctx.moveTo(-20, -14);
  ctx.lineTo(-6, -22);
  ctx.lineTo(10, -22);
  ctx.lineTo(18, -14);
  ctx.lineTo(6, -10);
  ctx.lineTo(-12, -10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = F('#c0c0c0');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, -18);
  ctx.lineTo(17, -9);
  ctx.moveTo(12, -22);
  ctx.lineTo(10, -30);
  ctx.lineTo(4, -31);
  ctx.stroke();
  ctx.fillStyle = F('#555');
  ctx.fillRect(-22, -12, 10, 3);
  ctx.restore();
}

/** Trem do metrô passando na faixa de trás (proporcional: bem mais alto que o jogador) */
export const TRAIN_CAR = Math.round(340 * SIZE);
export function drawTrain(ctx: CanvasRenderingContext2D, x: number, y: number, length: number) {
  const Hh = 170 * SIZE;
  for (let i = 0; i < length; i += TRAIN_CAR) {
    const cx = x + i;
    const front = i === 0;
    const L = cx + (front ? 0 : 6), R = cx + TRAIN_CAR - 6;
    const top = y - Hh;
    // carroceria com teto arredondado
    const g = ctx.createLinearGradient(0, top, 0, y);
    g.addColorStop(0, '#e8ecf2');
    g.addColorStop(0.55, '#c3cad4');
    g.addColorStop(1, '#8d96a3');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L + (front ? 26 : 0), top + 12);
    ctx.quadraticCurveTo(L + (front ? 26 : 0), top, L + (front ? 40 : 12), top);
    ctx.lineTo(R - 12, top);
    ctx.quadraticCurveTo(R, top, R, top + 12);
    ctx.lineTo(R, y - 14);
    ctx.lineTo(L, y - 14);
    if (front) {
      ctx.lineTo(L, y - 70);
      ctx.quadraticCurveTo(L + 2, top + 20, L + 26, top + 12);
    } else ctx.lineTo(L, top + 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    // faixas da companhia
    ctx.fillStyle = '#2a9d8f';
    ctx.fillRect(L + (front ? 6 : 0), y - 52, R - L - (front ? 6 : 0), 12);
    ctx.fillStyle = '#e9c46a';
    ctx.fillRect(L + (front ? 6 : 0), y - 38, R - L - (front ? 6 : 0), 4);
    // janelas com passageiros e portas
    for (let k = 0; k < 4; k++) {
      const wx = L + 52 + k * 60;
      if (wx + 40 > R) break;
      if (k % 2 === 1) {
        // porta dupla
        ctx.fillStyle = '#9aa3ad';
        ctx.fillRect(wx - 4, top + 18, 44, Hh - 34);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(wx - 4, top + 18, 44, Hh - 34);
        ctx.beginPath();
        ctx.moveTo(wx + 18, top + 18);
        ctx.lineTo(wx + 18, y - 16);
        ctx.stroke();
        ctx.fillStyle = '#1d3557';
        ctx.fillRect(wx + 1, top + 26, 13, 44);
        ctx.fillRect(wx + 22, top + 26, 13, 44);
      } else {
        ctx.fillStyle = '#16233a';
        ctx.fillRect(wx, top + 24, 40, 48);
        ctx.fillStyle = 'rgba(255,240,200,0.18)';
        ctx.fillRect(wx, top + 24, 40, 48);
        // silhuetas de passageiros
        ctx.fillStyle = '#0b1220';
        for (let p = 0; p < 2; p++) {
          ctx.beginPath();
          ctx.arc(wx + 10 + p * 18, top + 44, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(wx + 4 + p * 18, top + 50, 12, 22);
        }
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(wx, top + 24, 40, 48);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(wx + 3, top + 27, 6, 40);
      }
    }
    if (front) {
      // para-brisa, farol e número da linha
      ctx.fillStyle = '#16233a';
      ctx.beginPath();
      ctx.moveTo(L + 8, y - 78);
      ctx.quadraticCurveTo(L + 10, top + 30, L + 32, top + 22);
      ctx.lineTo(L + 40, top + 22);
      ctx.lineTo(L + 40, y - 78);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff7b0';
      ctx.shadowColor = '#fff7b0';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(L + 12, y - 28, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e63946';
      ctx.fillRect(L + 40, top + 6, 26, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Arial';
      ctx.fillText('L5', L + 46, top + 15);
    }
    // rodas e engates
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(L + 4, y - 14, R - L - 8, 8);
    for (const wx of [L + 40, L + 76, R - 76, R - 40]) {
      ctx.fillStyle = '#1b1d22';
      ctx.beginPath();
      ctx.arc(wx, y - 6, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7d848f';
      ctx.beginPath();
      ctx.arc(wx, y - 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!front) {
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(cx - 6, y - 70, 12, 40);
    }
  }
}

/** Carro passando (perigo das fases noturna/subterrânea) */
export function drawTrafficCar(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const carSprite = sprites.loaded ? sprites.props.car_blue : undefined;
  if (carSprite) drawSprite(ctx, carSprite, 0, 0, (66 * SIZE) / carSprite.h);
  else drawProp(ctx, 'car', 0, 0, false, 0, color);
  // farol aceso
  const g = ctx.createLinearGradient(58, -18, 160, -18);
  g.addColorStop(0, 'rgba(255,240,170,0.55)');
  g.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(58, -22);
  ctx.lineTo(160, -40);
  ctx.lineTo(160, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
