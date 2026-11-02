import { FLOOR_TOP, H, W } from '../core/config';
import { rng, shade, type Rng } from '../core/math';
import type { ThemeId } from '../data/stages';
import { drawSprite, sprites } from './sprites';

/** Fator de paralaxe da camada do fundo */
export const FAR_PARALLAX = 0.35;
const R = 2; // resolução interna dos cenários (nítidos em telas grandes)

export interface StageArt {
  far: HTMLCanvasElement;
  near: HTMLCanvasElement;
  /** Desenho animado por cima do cenário (neon piscando, holofotes, helicóptero…) */
  live?: (ctx: CanvasRenderingContext2D, camX: number, t: number) => void;
  /** Cenário vindo do painel do modelo (sem camada de fundo separada) */
  panel?: boolean;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * R);
  c.height = Math.ceil(h * R);
  const ctx = c.getContext('2d')!;
  ctx.scale(R, R);
  return { c, ctx };
}

const grad = (ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) => {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
};

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

function skyline(ctx: CanvasRenderingContext2D, r: Rng, width: number, base: number, color: string, minH: number, maxH: number, windows?: string, density = 0.25) {
  let x = -10;
  while (x < width + 10) {
    const w = r.range(26, 70);
    const h = r.range(minH, maxH);
    ctx.fillStyle = color;
    ctx.fillRect(x, base - h, w, h + 2);
    if (r.chance(0.3)) ctx.fillRect(x + w * 0.4, base - h - r.range(6, 18), 2, r.range(6, 18));
    if (windows) {
      ctx.fillStyle = windows;
      for (let wy = base - h + 6; wy < base - 6; wy += 7) for (let wx = x + 4; wx < x + w - 5; wx += 6) if (r.chance(density)) ctx.fillRect(wx, wy, 2.5, 3);
    }
    x += w + r.range(-4, 6);
  }
}

function brickWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string, r: Rng) {
  rect(ctx, x, y, w, h, base);
  ctx.fillStyle = shade(base, -0.18);
  for (let by = y; by < y + h; by += 6) {
    ctx.fillRect(x, by, w, 1);
    const off = ((by - y) / 6) % 2 ? 6 : 0;
    for (let bx = x + off; bx < x + w; bx += 12) ctx.fillRect(bx, by, 1, 6);
  }
  for (let i = 0; i < w * h / 600; i++) {
    ctx.fillStyle = r.chance(0.5) ? shade(base, 0.12) : shade(base, -0.1);
    ctx.fillRect(x + r.range(0, w - 10), y + Math.floor(r.range(0, h / 6)) * 6 + 1, 11, 5);
  }
}

function windowsGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glass: string, frame: string, r: Rng, lit?: string) {
  for (let wy = y; wy + 16 < y + h; wy += 26) {
    for (let wx = x + 8; wx + 14 < x + w - 4; wx += 24) {
      rect(ctx, wx - 1, wy - 1, 16, 18, frame);
      ctx.fillStyle = lit && r.chance(0.35) ? lit : glass;
      ctx.fillRect(wx, wy, 14, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(wx + 1, wy + 1, 4, 14);
      rect(ctx, wx - 2, wy + 16, 18, 2, shade(frame, 0.2));
    }
  }
}

function graffiti(ctx: CanvasRenderingContext2D, x: number, y: number, r: Rng, palette: string[]) {
  const words = ['SLAM', 'DUNK', 'RAW', 'BALL', 'KING', 'HOOP', 'REP', 'STREET', 'ZONE', 'FLY'];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(r.range(-0.12, 0.08));
  ctx.font = `bold ${r.int(14, 20)}px "Bungee", "Arial Black", sans-serif`;
  const word = r.pick(words);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#111';
  ctx.strokeText(word, 0, 0);
  ctx.fillStyle = r.pick(palette);
  ctx.fillText(word, 0, 0);
  ctx.lineWidth = 1;
  ctx.strokeStyle = r.pick(palette);
  ctx.strokeText(word, 1, -1);
  ctx.restore();
}

/** Chão: faixa da calçada + piso; `tile` desenha juntas inclinadas (efeito de perspectiva) */
function floor(ctx: CanvasRenderingContext2D, w: number, top: string, bottom: string, opts: { curb?: string; curbH?: number; tile?: number; lines?: string; dash?: string; dashY?: number; noise?: string } = {}, r?: Rng) {
  ctx.fillStyle = grad(ctx, FLOOR_TOP, H, [[0, top], [1, bottom]]);
  ctx.fillRect(0, FLOOR_TOP, w, H - FLOOR_TOP);
  if (opts.curb) {
    rect(ctx, 0, FLOOR_TOP, w, opts.curbH ?? 10, opts.curb);
    ctx.fillStyle = shade(opts.curb, -0.3);
    ctx.fillRect(0, FLOOR_TOP + (opts.curbH ?? 10), w, 2);
  }
  if (opts.tile) {
    ctx.strokeStyle = opts.lines ?? 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    const y0 = FLOOR_TOP + (opts.curbH ?? 0);
    for (let x = -100; x < w + 100; x += opts.tile) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x - (H - y0) * 0.55, H);
      ctx.stroke();
    }
    for (let y = y0 + 12, step = 12; y < H; step += 3, y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }
  if (opts.dash) {
    ctx.fillStyle = opts.dash;
    for (let x = 0; x < w; x += 70) ctx.fillRect(x, opts.dashY ?? 300, 38, 3);
  }
  if (opts.noise && r) {
    ctx.fillStyle = opts.noise;
    for (let i = 0; i < w / 4; i++) ctx.fillRect(r.range(0, w), r.range(FLOOR_TOP + 4, H), r.range(1, 3), 1);
  }
}

function lampPost(ctx: CanvasRenderingContext2D, x: number, glow = '#ffe9a8') {
  rect(ctx, x - 2, 90, 4, FLOOR_TOP - 86, '#2b2f36');
  rect(ctx, x - 2, 90, 22, 4, '#2b2f36');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x + 18, 96, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x + 18, 100, 2, x + 18, 120, 60);
  g.addColorStop(0, 'rgba(255,233,168,0.35)');
  g.addColorStop(1, 'rgba(255,233,168,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 50, 96, 140, 140);
}

function sign(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, bg: string, fg: string, glow?: string, size = 11) {
  ctx.font = `bold ${size}px "Bungee", "Arial Black", sans-serif`;
  const w = ctx.measureText(text).width + 12;
  rect(ctx, x, y, w, size + 8, bg, '#111');
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = fg;
  ctx.fillText(text, x + 6, y + size + 3);
  ctx.shadowBlur = 0;
  return w;
}


// ─── Arquitetura menos "quadrada" ───────────────────────────────────────────

/** Cornija com frisos no alto do prédio */
function cornice(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = shade(color, 0.12);
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + w + 6, y);
  ctx.lineTo(x + w + 3, y + 7);
  ctx.lineTo(x - 3, y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, -0.3);
  ctx.fillRect(x - 3, y + 7, w + 6, 2);
  ctx.fillStyle = shade(color, -0.15);
  for (let dx = x; dx < x + w; dx += 7) ctx.fillRect(dx, y + 9, 4, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x - 6, y, w + 12, 1.5);
}

/** Toldo listrado com borda ondulada */
function awning(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  const n = Math.max(3, Math.round(w / 14));
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? '#f6efe2' : color;
    ctx.beginPath();
    ctx.moveTo(x + i * sw + 3, y);
    ctx.lineTo(x + (i + 1) * sw + 3, y);
    ctx.lineTo(x + (i + 1) * sw, y + 14);
    ctx.quadraticCurveTo(x + (i + 0.5) * sw, y + 22, x + i * sw, y + 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 3, y);
  ctx.lineTo(x + w + 3, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, y + 20, w, 4);
}

/** Janelas em arco (algumas fachadas) */
function archWindows(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rows: number, glass: string, frame: string, r: Rng, lit?: string) {
  for (let row = 0; row < rows; row++) {
    for (let wx = x + 10; wx + 16 < x + w - 4; wx += 26) {
      const wy = y + row * 30;
      ctx.fillStyle = frame;
      ctx.beginPath();
      ctx.moveTo(wx - 2, wy + 22);
      ctx.lineTo(wx - 2, wy + 7);
      ctx.arc(wx + 8, wy + 7, 10, Math.PI, 0);
      ctx.lineTo(wx + 18, wy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = lit && r.chance(0.35) ? lit : glass;
      ctx.beginPath();
      ctx.moveTo(wx, wy + 20);
      ctx.lineTo(wx, wy + 7);
      ctx.arc(wx + 8, wy + 7, 8, Math.PI, 0);
      ctx.lineTo(wx + 16, wy + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(wx + 2, wy + 4, 3, 15);
      ctx.fillStyle = shade(frame, 0.2);
      ctx.fillRect(wx - 4, wy + 21, 24, 2.5);
    }
  }
}

/** Guia da calçada com volume (face inclinada + brilho) */
function curb(ctx: CanvasRenderingContext2D, w: number, y: number, color: string) {
  const g = ctx.createLinearGradient(0, y, 0, y + 7);
  g.addColorStop(0, shade(color, 0.15));
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, y, w, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, y, w, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < w; x += 46) ctx.fillRect(x, y, 1, 7);
}

/** Rachaduras e poças no asfalto */
function cracks(ctx: CanvasRenderingContext2D, w: number, r: Rng, puddle?: string) {
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < w / 160; i++) {
    let x = r.range(0, w), y = r.range(FLOOR_TOP + 20, H - 6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += r.range(4, 12);
      y += r.range(-4, 4);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (puddle) {
    for (let i = 0; i < w / 500; i++) {
      ctx.fillStyle = puddle;
      ctx.beginPath();
      ctx.ellipse(r.range(0, w), r.range(FLOOR_TOP + 40, H - 10), r.range(14, 30), r.range(3, 6), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Elementos do modelo espalhados pelo cenário ─────────────────────────────

type Decor = { name: string; h: number; y: number; every: [number, number]; chance?: number; flat?: boolean; glow?: string };

const DECOR: Partial<Record<ThemeId, Decor[]>> = {
  streets: [
    { name: 'lamp', h: 118, y: FLOOR_TOP + 4, every: [380, 460], glow: 'rgba(255,233,168,0.32)' },
    { name: 'traffic_light', h: 74, y: FLOOR_TOP + 6, every: [700, 950] },
    { name: 'sign_stop', h: 62, y: FLOOR_TOP + 4, every: [600, 900], chance: 0.7 },
    { name: 'sign_oneway', h: 58, y: FLOOR_TOP + 4, every: [700, 1000], chance: 0.7 },
    { name: 'ac_unit', h: 26, y: 150, every: [260, 420], chance: 0.8 },
    { name: 'bike_red', h: 32, y: FLOOR_TOP + 2, every: [600, 900], chance: 0.8 },
    { name: 'hydrant_post', h: 30, y: FLOOR_TOP + 8, every: [500, 800], chance: 0.6 },
    { name: 'bollard', h: 20, y: FLOOR_TOP + 13, every: [90, 140], chance: 0.5 },
    { name: 'manhole', h: 12, y: 316, every: [420, 640], flat: true },
  ],
  subway: [
    { name: 'electric_box', h: 46, y: 210, every: [500, 800], chance: 0.8 },
    { name: 'vending', h: 64, y: 212, every: [600, 900] },
    { name: 'bollard', h: 20, y: FLOOR_TOP + 42, every: [120, 200], chance: 0.5 },
  ],
  industrial: [
    { name: 'pallet', h: 22, y: FLOOR_TOP + 2, every: [300, 520] },
    { name: 'spool', h: 30, y: FLOOR_TOP + 2, every: [500, 800], chance: 0.8 },
    { name: 'crates_stack', h: 40, y: FLOOR_TOP + 2, every: [500, 800], chance: 0.8 },
    { name: 'electric_box', h: 46, y: FLOOR_TOP + 2, every: [600, 900], chance: 0.7 },
    { name: 'pole_a', h: 140, y: FLOOR_TOP + 2, every: [700, 1000] },
  ],
  beach: [
    { name: 'umbrella_red', h: 58, y: 236, every: [500, 800], chance: 0.8 },
    { name: 'umbrella_blue', h: 58, y: 236, every: [600, 900], chance: 0.8 },
    { name: 'bike_green', h: 30, y: 234, every: [600, 900], chance: 0.7 },
    { name: 'sign_ped', h: 52, y: 234, every: [800, 1100], chance: 0.6 },
  ],
  night: [
    { name: 'lamp', h: 118, y: FLOOR_TOP + 4, every: [360, 440], glow: 'rgba(190,240,255,0.3)' },
    { name: 'traffic_light', h: 74, y: FLOOR_TOP + 6, every: [700, 950] },
    { name: 'vending', h: 62, y: FLOOR_TOP + 2, every: [600, 900], chance: 0.8 },
    { name: 'moto_black', h: 38, y: FLOOR_TOP + 4, every: [600, 900], chance: 0.8 },
    { name: 'pole_b', h: 150, y: FLOOR_TOP + 4, every: [800, 1100] },
    { name: 'manhole', h: 12, y: 318, every: [420, 640], flat: true },
    { name: 'grate', h: 12, y: 290, every: [500, 800], flat: true, chance: 0.7 },
  ],
  court: [
    { name: 'vending', h: 62, y: FLOOR_TOP + 2, every: [700, 1000] },
    { name: 'bike_red', h: 32, y: FLOOR_TOP + 2, every: [500, 800], chance: 0.8 },
    { name: 'bike_green', h: 32, y: FLOOR_TOP + 2, every: [600, 900], chance: 0.6 },
  ],
  chinatown: [
    { name: 'bike_green', h: 32, y: FLOOR_TOP + 2, every: [500, 800], chance: 0.8 },
    { name: 'crates_stack', h: 38, y: FLOOR_TOP + 2, every: [500, 800], chance: 0.8 },
    { name: 'ac_unit', h: 24, y: 96, every: [260, 420], chance: 0.7 },
    { name: 'hydrant', h: 26, y: FLOOR_TOP + 6, every: [700, 1000], chance: 0.6 },
  ],
  underground: [
    { name: 'electric_box', h: 46, y: 196, every: [500, 800], chance: 0.8 },
    { name: 'sign_oneway', h: 56, y: 198, every: [700, 1000] },
    { name: 'bollard', h: 22, y: FLOOR_TOP + 4, every: [110, 180], chance: 0.6 },
    { name: 'grate', h: 12, y: 310, every: [500, 800], flat: true },
  ],
  rooftop: [
    { name: 'ac_unit', h: 40, y: 208, every: [300, 520], chance: 0.9 },
    { name: 'electric_box', h: 44, y: 208, every: [600, 900], chance: 0.7 },
  ],
};

function decorate(ctx: CanvasRenderingContext2D, theme: ThemeId, length: number, r: Rng) {
  if (!sprites.loaded) return;
  for (const d of DECOR[theme] ?? []) {
    const f = sprites.props[d.name];
    if (!f) continue;
    const s = d.h / f.h;
    for (let x = r.range(60, 200); x < length - 40; x += r.range(d.every[0], d.every[1])) {
      if (d.chance !== undefined && !r.chance(d.chance)) continue;
      if (d.glow) {
        const g = ctx.createRadialGradient(x + 18, d.y - d.h + 10, 2, x + 18, d.y - d.h + 40, 70);
        g.addColorStop(0, d.glow);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 60, d.y - d.h - 10, 160, 170);
      }
      if (d.flat) {
        // peças no chão (bueiro, grelha): achatadas pela perspectiva
        ctx.save();
        ctx.translate(x, d.y);
        ctx.scale(1, 0.55);
        drawSprite(ctx, f, 0, 0, s * 1.6);
        ctx.restore();
      } else drawSprite(ctx, f, x, d.y, s);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Altura (fração do painel) onde começa o chão em cada cenário do modelo */
const PANEL_GROUND: Record<number, number> = { 1: 0.86, 2: 0.78, 3: 0.8, 4: 0.8, 5: 0.7, 6: 0.8, 7: 0.82, 8: 0.64, 9: 0.76, 10: 0.8 };
const THEME_STAGE: Record<ThemeId, number> = { streets: 1, subway: 2, industrial: 3, beach: 4, night: 5, court: 6, chinatown: 7, underground: 8, rooftop: 9, arena: 10 };
/** Linha (unidades lógicas) onde o chão do painel encontra a rua jogável */
const PANEL_GROUND_Y = FLOOR_TOP + 6;

/**
 * Cenário a partir do painel do modelo: a parte de cima vai até o início da rua; o chão do painel é
 * esticado em perspectiva até a base da tela. O painel se repete ao longo da fase com emenda suave.
 */
function buildPanelArt(img: HTMLImageElement, n: number, length: number): StageArt {
  const g = PANEL_GROUND[n] ?? 0.8;
  const pw = img.width, ph = img.height;
  const groundSrc = ph * g;
  const k = PANEL_GROUND_Y / groundSrc; // escala da parte de cima
  const tileW = pw * k;
  const overlap = 70;
  // pinta o painel (parte de cima + chão esticado em perspectiva) a partir de x
  const paint = (t: CanvasRenderingContext2D, x: number) => {
    t.imageSmoothingEnabled = true;
    t.imageSmoothingQuality = 'high';
    t.drawImage(img, 0, 0, pw, groundSrc, x, 0, tileW, PANEL_GROUND_Y);
    const slices = 18;
    const srcH = ph - groundSrc;
    for (let i = 0; i < slices; i++) {
      const a0 = i / slices, a1 = (i + 1) / slices;
      const dy0 = PANEL_GROUND_Y + (H - PANEL_GROUND_Y) * a0 * a0;
      const dy1 = PANEL_GROUND_Y + (H - PANEL_GROUND_Y) * a1 * a1;
      t.drawImage(img, 0, groundSrc + srcH * a0, pw, srcH / slices, x, dy0, tileW, dy1 - dy0 + 0.6);
    }
  };
  // repetição com a borda esquerda em degradê (emenda suave com a anterior)
  const tile = canvas(tileW, H);
  paint(tile.ctx, 0);
  tile.ctx.save();
  tile.ctx.globalCompositeOperation = 'destination-in';
  // uma única pintura: com destination-in, cada fillRect apaga tudo fora dele
  const grd = tile.ctx.createLinearGradient(0, 0, tileW, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(overlap / tileW, 'rgba(0,0,0,1)');
  grd.addColorStop(1, 'rgba(0,0,0,1)');
  tile.ctx.fillStyle = grd;
  tile.ctx.fillRect(0, 0, tileW, H);
  tile.ctx.restore();

  const near = canvas(length, H);
  const nctx = near.ctx;
  paint(nctx, 0);
  for (let x = tileW - overlap; x < length; x += tileW - overlap) nctx.drawImage(tile.c, 0, 0, tile.c.width, tile.c.height, x, 0, tileW, H);
  const far = canvas(1, 1);
  return { far: far.c, near: near.c, live: n === 10 ? arenaLights : undefined, panel: true };
}

function arenaLights(ctx: CanvasRenderingContext2D, _camX: number, t: number) {
  // holofotes varrendo a quadra
  for (let i = 0; i < 3; i++) {
    const a = Math.sin(t * 0.012 + i * 2.1) * 0.6;
    ctx.save();
    ctx.translate(120 + i * 200, -10);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,250,220,0.22)');
    g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.lineTo(70, H + 20);
    ctx.lineTo(-70, H + 20);
    ctx.fill();
    ctx.restore();
  }
}

export function buildStageArt(theme: ThemeId, length: number, seed: number): StageArt {
  const panel = sprites.stages[THEME_STAGE[theme]];
  if (panel) return buildPanelArt(panel, THEME_STAGE[theme], length);
  const farW = W + (length - W) * FAR_PARALLAX + 4;
  const far = canvas(farW, FLOOR_TOP);
  const near = canvas(length, H);
  const r = rng(seed);
  const f = far.ctx, n = near.ctx;
  let live: StageArt['live'];

  switch (theme) {
    case 'streets': {
      f.fillStyle = grad(f, 0, FLOOR_TOP, [[0, '#2b2d5c'], [0.55, '#e0745a'], [1, '#ffc27a']]);
      f.fillRect(0, 0, farW, FLOOR_TOP);
      f.fillStyle = 'rgba(255,220,150,0.9)';
      f.beginPath();
      f.arc(farW * 0.6, 120, 26, 0, Math.PI * 2);
      f.fill();
      skyline(f, r, farW, 170, '#5a3a55', 50, 120, '#ffcf8a', 0.15);
      skyline(f, r, farW, 190, '#3d2740', 30, 80);
      // prédios de tijolos com lojas fechadas
      let x = 0;
      const bricks = ['#8e3b2e', '#a0522d', '#7a3b2e', '#6e4a3a', '#9c4a36'];
      while (x < length) {
        const w = r.range(150, 230);
        const top = r.range(30, 70);
        const c = r.pick(bricks);
        brickWall(n, x, top, w, FLOOR_TOP - top, c, r);
        cornice(n, x, top - 8, w, '#cdbfa6');
        if (r.chance(0.45)) archWindows(n, x + 6, top + 14, w - 12, 3, '#3b4a5e', '#d8cdb8', r, '#ffd98a');
        else windowsGrid(n, x + 6, top + 12, w - 12, 90, '#3b4a5e', '#d8cdb8', r, '#ffd98a');
        // loja com porta de aço
        const sx = x + 14, sw = w - 28;
        rect(n, sx, 168, sw, FLOOR_TOP - 168, '#6c7380', '#2a2a2a');
        n.fillStyle = '#596070';
        for (let ly = 172; ly < FLOOR_TOP; ly += 5) n.fillRect(sx + 2, ly, sw - 4, 2);
        awning(n, sx - 6, 150, sw + 12, r.pick(['#2d6a4f', '#9d0208', '#1d3557', '#6a4c93', '#e76f51']));
        if (r.chance(0.8)) graffiti(n, sx + r.range(4, sw - 70), r.range(196, 222), r, ['#ff5d8f', '#4cc9f0', '#f9c74f', '#90be6d', '#f3722c']);
        // escada de incêndio
        if (r.chance(0.5)) {
          n.strokeStyle = '#1c1c1c';
          n.lineWidth = 1.5;
          for (let fy = top + 40; fy < 150; fy += 34) {
            n.strokeRect(x + w * 0.55, fy, 46, 2);
            n.beginPath();
            n.moveTo(x + w * 0.55, fy);
            n.lineTo(x + w * 0.55 + 46, fy + 34);
            n.stroke();
          }
        }
        x += w;
      }
      floor(n, length, '#8a8d92', '#3c3f45', { curb: '#a9acb1', curbH: 14, tile: 46, dash: '#e9c46a', dashY: 304, noise: 'rgba(0,0,0,0.2)' }, r);
      curb(n, length, FLOOR_TOP + 14, '#a9acb1');
      cracks(n, length, r, 'rgba(60,70,90,0.35)');
      break;
    }
    case 'subway': {
      f.fillStyle = grad(f, 0, FLOOR_TOP, [[0, '#0d1117'], [1, '#1c2330']]);
      f.fillRect(0, 0, farW, FLOOR_TOP);
      for (let x = 0; x < farW; x += 90) {
        f.fillStyle = 'rgba(255,240,180,0.08)';
        f.fillRect(x, 0, 30, FLOOR_TOP);
      }
      // parede de azulejos com painéis
      rect(n, 0, 0, length, 40, '#20262e');
      for (let x = 0; x < length; x += 200) {
        n.fillStyle = '#fff7d6';
        n.shadowColor = '#fff2b0';
        n.shadowBlur = 12;
        n.fillRect(x + 60, 30, 80, 4);
        n.shadowBlur = 0;
      }
      n.fillStyle = '#e8efe8';
      n.fillRect(0, 40, length, 170);
      n.strokeStyle = '#c3cdc4';
      n.lineWidth = 1;
      for (let y = 40; y < 210; y += 8) {
        n.beginPath();
        n.moveTo(0, y);
        n.lineTo(length, y);
        n.stroke();
      }
      for (let x = 0; x < length; x += 8) {
        n.beginPath();
        n.moveTo(x, 40);
        n.lineTo(x, 210);
        n.stroke();
      }
      rect(n, 0, 120, length, 10, '#2a9d8f');
      for (let x = 40; x < length; x += 300) {
        // pilares
        rect(n, x, 40, 22, 196, '#3d4652', '#1b1f24');
        rect(n, x - 4, 40, 30, 8, '#535d6b');
        // placa da estação + cartazes
        sign(n, x + 60, 64, `LINE ${r.int(1, 9)}  ▸  ${r.pick(['CENTRAL', 'DOWNTOWN', 'HARBOR', 'MARKET ST', 'UPTOWN'])}`, '#1d3557', '#ffffff');
        rect(n, x + 70, 140, 70, 50, r.pick(['#e76f51', '#f4a261', '#264653', '#8338ec']), '#111');
        n.fillStyle = 'rgba(255,255,255,0.8)';
        n.font = 'bold 9px Arial';
        n.fillText(r.pick(['HOOPS NIGHT', 'NEW KICKS', 'SODA POP', 'CITY CUP']), x + 74, 160);
        rect(n, x + 160, 150, 60, 40, '#2b2d42', '#111');
        n.fillStyle = '#ffb703';
        n.fillText('EXIT ▸', x + 168, 174);
      }
      // trilhos na faixa de trás (onde o trem passa)
      floor(n, length, '#575c63', '#2e3238', { tile: 40, noise: 'rgba(255,255,255,0.08)' }, r);
      rect(n, 0, FLOOR_TOP, length, 28, '#2a2520');
      for (let x = 0; x < length; x += 12) rect(n, x, FLOOR_TOP + 4, 7, 20, '#4a3b2d');
      rect(n, 0, FLOOR_TOP + 7, length, 3, '#9aa0a6');
      rect(n, 0, FLOOR_TOP + 19, length, 3, '#9aa0a6');
      rect(n, 0, FLOOR_TOP + 28, length, 6, '#f2c94c');
      for (let x = 0; x < length; x += 24) rect(n, x, FLOOR_TOP + 28, 12, 6, '#2a2a2a');
      break;
    }
    case 'industrial': {
      f.fillStyle = grad(f, 0, FLOOR_TOP, [[0, '#59606b'], [0.6, '#a39b8b'], [1, '#c9b79c']]);
      f.fillRect(0, 0, farW, FLOOR_TOP);
      for (let x = 30; x < farW; x += r.range(90, 160)) {
        rect(f, x, 60, 14, 120, '#4b4f56');
        f.fillStyle = 'rgba(220,220,220,0.35)';
        for (let i = 0; i < 4; i++) {
          f.beginPath();
          f.arc(x + 7 + i * 6, 50 - i * 12, 8 + i * 3, 0, Math.PI * 2);
          f.fill();
        }
      }
      skyline(f, r, farW, 200, '#5d5a52', 30, 70);
      let x = 0;
      while (x < length) {
        const w = r.range(170, 260);
        const c = r.pick(['#7d8590', '#8a7f6e', '#6e7a72', '#7a6e66']);
        // galpão de metal ondulado
        rect(n, x, 50, w, FLOOR_TOP - 50, c);
        n.fillStyle = shade(c, -0.15);
        for (let gx = x; gx < x + w; gx += 6) n.fillRect(gx, 50, 2, FLOOR_TOP - 50);
        n.fillStyle = shade(c, -0.4);
        n.beginPath();
        n.moveTo(x - 4, 52);
        n.lineTo(x + w / 2, 26);
        n.lineTo(x + w + 4, 52);
        n.fill();
        rect(n, x + w / 2 - 40, 140, 80, FLOOR_TOP - 140, '#3b3f45', '#1e1e1e');
        n.fillStyle = '#f2c94c';
        for (let i = 0; i < 8; i++) {
          n.save();
          n.beginPath();
          n.rect(x + w / 2 - 40, 132, 80, 8);
          n.clip();
          n.fillRect(x + w / 2 - 40 + i * 12, 132, 6, 8);
          n.restore();
        }
        rect(n, x + w / 2 - 40, 132, 80, 8, 'rgba(0,0,0,0)', '#111');
        sign(n, x + 12, 70, r.pick(['DANGER', 'ZONE 7', 'HIGH VOLTAGE', 'NO ENTRY', 'WAREHOUSE B']), '#f2c94c', '#111');
        x += w;
      }
      // tubulações
      for (let i = 0; i < 3; i++) {
        const py = 100 + i * 22;
        n.fillStyle = grad(n, py, py + 8, [[0, '#a7b0ba'], [0.5, '#d9dee3'], [1, '#6c757d']]);
        n.fillRect(0, py, length, 8);
        for (let px = r.range(0, 200); px < length; px += r.range(150, 300)) rect(n, px, py - 2, 8, 12, '#5c636a');
      }
      floor(n, length, '#8b8f94', '#4a4e54', { tile: 60, noise: 'rgba(0,0,0,0.25)' }, r);
      for (let sx = 0; sx < length; sx += r.range(200, 400)) {
        n.fillStyle = 'rgba(30,20,10,0.25)';
        n.beginPath();
        n.ellipse(sx, r.range(270, 340), r.range(20, 50), r.range(6, 12), 0, 0, Math.PI * 2);
        n.fill();
      }
      for (let x2 = 0; x2 < length; x2 += 40) {
        rect(n, x2, FLOOR_TOP, 20, 6, '#f2c94c');
        rect(n, x2 + 20, FLOOR_TOP, 20, 6, '#222');
      }
      break;
    }
    case 'beach': {
      f.fillStyle = grad(f, 0, 160, [[0, '#4facfe'], [1, '#bde4ff']]);
      f.fillRect(0, 0, farW, 160);
      f.fillStyle = '#fff6c2';
      f.beginPath();
      f.arc(farW * 0.3, 55, 22, 0, Math.PI * 2);
      f.fill();
      for (let i = 0; i < 8; i++) {
        f.fillStyle = 'rgba(255,255,255,0.85)';
        const cx = r.range(0, farW), cy = r.range(20, 80);
        for (let k = 0; k < 4; k++) {
          f.beginPath();
          f.arc(cx + k * 12, cy + (k % 2) * 4, 10, 0, Math.PI * 2);
          f.fill();
        }
      }
      f.fillStyle = '#6d8fa6';
      f.beginPath();
      f.moveTo(0, 160);
      for (let x = 0; x <= farW; x += 40) f.lineTo(x, 150 - Math.abs(Math.sin(x * 0.01)) * 18);
      f.lineTo(farW, 160);
      f.fill();
      f.fillStyle = grad(f, 160, FLOOR_TOP, [[0, '#1e88c7'], [1, '#48c6e0']]);
      f.fillRect(0, 160, farW, FLOOR_TOP - 160);
      // calçadão: grade, coqueiros e quiosques
      n.fillStyle = grad(n, 150, FLOOR_TOP, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
      for (let x = 60; x < length; x += r.range(160, 260)) {
        // coqueiro
        n.strokeStyle = '#8b5a2b';
        n.lineWidth = 7;
        n.beginPath();
        n.moveTo(x, FLOOR_TOP);
        n.quadraticCurveTo(x + 18, 150, x + 6, 70);
        n.stroke();
        n.strokeStyle = '#6b4220';
        n.lineWidth = 1;
        for (let ty = 80; ty < FLOOR_TOP; ty += 10) {
          n.beginPath();
          n.moveTo(x - 2, ty);
          n.lineTo(x + 12, ty + 2);
          n.stroke();
        }
        n.fillStyle = '#2d9a4e';
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          n.beginPath();
          n.ellipse(x + 6 + Math.cos(a) * 18, 70 + Math.sin(a) * 8, 22, 6, a, 0, Math.PI * 2);
          n.fill();
        }
        if (r.chance(0.5)) {
          const kx = x + 60;
          rect(n, kx, 180, 70, 56, '#f4e1c1', '#5a3a1a');
          n.fillStyle = '#e63946';
          n.beginPath();
          n.moveTo(kx - 8, 182);
          n.lineTo(kx + 35, 160);
          n.lineTo(kx + 78, 182);
          n.fill();
          sign(n, kx + 6, 192, r.pick(['ICE', 'COCO', 'SURF', 'JUICE']), '#2a9d8f', '#fff', undefined, 9);
        }
      }
      rect(n, 0, 214, length, 4, '#ffffff');
      for (let x = 0; x < length; x += 22) rect(n, x, 214, 3, 22, '#ffffff');
      // tábuas do calçadão em cima, areia embaixo
      floor(n, length, '#c79a63', '#a77a45', {}, r);
      n.strokeStyle = 'rgba(80,50,20,0.5)';
      for (let y = FLOOR_TOP + 6; y < 286; y += 6) {
        n.beginPath();
        n.moveTo(0, y);
        n.lineTo(length, y);
        n.stroke();
      }
      n.fillStyle = grad(n, 286, H, [[0, '#f1d9a6'], [1, '#e6c588']]);
      n.fillRect(0, 286, length, H - 286);
      n.fillStyle = 'rgba(160,120,60,0.25)';
      for (let i = 0; i < length / 3; i++) n.fillRect(r.range(0, length), r.range(290, H), 2, 1);
      live = (ctx, camX, t) => {
        // brilho das ondas no mar (camada do fundo)
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 12; i++) {
          const x = ((i * 97 + t * 0.4) % (W + 60)) - 30;
          const y = 175 + (i % 4) * 12 + Math.sin(t * 0.05 + i) * 2;
          ctx.fillRect(x - (camX * FAR_PARALLAX) % 7, y, 14, 1.5);
        }
      };
      break;
    }
    case 'night': {
      f.fillStyle = grad(f, 0, FLOOR_TOP, [[0, '#06061a'], [1, '#2b1650']]);
      f.fillRect(0, 0, farW, FLOOR_TOP);
      f.fillStyle = '#ffffff';
      for (let i = 0; i < 120; i++) f.fillRect(r.range(0, farW), r.range(0, 120), 1, 1);
      skyline(f, r, farW, 210, '#140f2c', 90, 190, '#ffd76a', 0.35);
      let x = 0;
      const neons: { x: number; y: number; text: string; color: string }[] = [];
      while (x < length) {
        const w = r.range(160, 240);
        const c = r.pick(['#1f1b33', '#2a1f3d', '#1b2433', '#2b1b2b']);
        rect(n, x, 40, w, FLOOR_TOP - 40, c);
        cornice(n, x, 32, w, '#4a4266');
        if (r.chance(0.4)) archWindows(n, x + 6, 52, w - 12, 3, '#14102a', '#3a3352', r, '#ffcf6b');
        else windowsGrid(n, x + 6, 50, w - 12, 100, '#14102a', '#3a3352', r, '#ffcf6b');
        rect(n, x + 10, 170, w - 20, FLOOR_TOP - 170, '#0f0c1d', '#000');
        const text = r.pick(['CLUB 88', 'HOTEL', 'BAR', 'LIVE', 'DISCO', 'PIZZA', 'ARCADE', 'OPEN 24H']);
        const color = r.pick(['#ff3fd2', '#38f6ff', '#ffe14d', '#7cff6b', '#ff6b3d']);
        neons.push({ x: x + 20, y: 148, text, color });
        x += w;
      }
      for (const ne of neons) sign(n, ne.x, ne.y, ne.text, '#0a0814', ne.color, ne.color, 12);
      floor(n, length, '#2c2f3a', '#14151c', { curb: '#3e4252', curbH: 12, dash: '#f2f2f2', dashY: 308 }, r);
      curb(n, length, FLOOR_TOP + 12, '#3e4252');
      cracks(n, length, r, 'rgba(120,160,255,0.12)');
      // reflexos na rua molhada
      for (const ne of neons) {
        n.fillStyle = ne.color + '33';
        n.fillRect(ne.x, 262 + r.range(0, 50), 50, 3);
        n.fillRect(ne.x + 10, 280 + r.range(0, 50), 30, 2);
      }
      live = (ctx, camX, t) => {
        // neon piscando
        for (const ne of neons) {
          const sx = ne.x - camX;
          if (sx < -80 || sx > W + 10) continue;
          if (Math.sin(t * 0.21 + ne.x) > 0.93) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(sx, ne.y, 70, 20);
          }
        }
      };
      break;
    }
    case 'court': {
      f.fillStyle = grad(f, 0, FLOOR_TOP, [[0, '#7fc8f8'], [1, '#f9e0a8']]);
      f.fillRect(0, 0, farW, FLOOR_TOP);
      skyline(f, r, farW, 150, '#8aa1b1', 40, 110, '#dbe8f0', 0.2);
      for (let x = 0; x < farW; x += r.range(20, 40)) {
        f.fillStyle = r.pick(['#3a7d44', '#2f6b3a', '#4a8f50']);
        f.beginPath();
        f.arc(x, 160, r.range(14, 24), 0, Math.PI * 2);
        f.fill();
      }
      rect(f, 0, 165, farW, FLOOR_TOP - 165, '#4a8f50');
      // muro grafitado + arquibancada + alambrado
      for (let x = 0; x < length; x += 260) {
        brickWall(n, x, 120, 260, FLOOR_TOP - 120, '#7a6f8f', r);
        graffiti(n, x + r.range(10, 150), r.range(160, 200), r, ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607']);
        if (r.chance(0.6)) {
          for (let row = 0; row < 4; row++) rect(n, x + 150, 190 + row * 11, 100, 6, '#9aa5b1', '#4b5563');
        }
      }
      n.strokeStyle = 'rgba(40,40,40,0.75)';
      n.lineWidth = 0.8;
      for (let x = 0; x < length; x += 7) {
        n.beginPath();
        n.moveTo(x, 40);
        n.lineTo(x + 70, 110);
        n.moveTo(x + 70, 40);
        n.lineTo(x, 110);
        n.stroke();
      }
      for (let x = 0; x < length; x += 140) rect(n, x, 36, 4, FLOOR_TOP - 36, '#3d3d3d');
      rect(n, 0, 36, length, 4, '#3d3d3d');
      // cestas
      for (let x = 350; x < length; x += 700) {
        rect(n, x, 70, 5, FLOOR_TOP - 70, '#444');
        rect(n, x - 26, 60, 56, 38, '#ffffff', '#222');
        rect(n, x - 8, 72, 20, 14, 'rgba(0,0,0,0)', '#e63946');
        n.strokeStyle = '#ff6b00';
        n.lineWidth = 2;
        n.beginPath();
        n.ellipse(x + 2, 99, 11, 3, 0, 0, Math.PI * 2);
        n.stroke();
        n.strokeStyle = '#ffffff';
        n.lineWidth = 0.7;
        for (let k = -9; k <= 9; k += 4) {
          n.beginPath();
          n.moveTo(x + 2 + k, 100);
          n.lineTo(x + 2 + k * 0.6, 114);
          n.stroke();
        }
      }
      floor(n, length, '#c0604a', '#9c4a3a', {}, r);
      rect(n, 0, FLOOR_TOP, length, 6, '#f1f1f1');
      n.strokeStyle = '#f1f1f1';
      n.lineWidth = 2.5;
      for (let x = 350; x < length; x += 700) {
        n.beginPath();
        n.ellipse(x, FLOOR_TOP + 6, 150, 70, 0, 0, Math.PI);
        n.stroke();
        n.strokeRect(x - 34, FLOOR_TOP + 6, 68, 70);
        n.fillStyle = 'rgba(30,60,140,0.35)';
        n.fillRect(x - 34, FLOOR_TOP + 6, 68, 70);
      }
      break;
    }
    case 'chinatown': {
      f.fillStyle = grad(f, 0, FLOOR_TOP, [[0, '#3b1d5a'], [0.6, '#c2456b'], [1, '#f6a26b']]);
      f.fillRect(0, 0, farW, FLOOR_TOP);
      for (let x = 20; x < farW; x += r.range(80, 140)) {
        const h = r.range(60, 120);
        rect(f, x, 200 - h, 50, h + 10, '#4a2040');
        for (let k = 0; k < 3; k++) {
          f.fillStyle = '#2d1428';
          f.beginPath();
          f.moveTo(x - 10 + k * 3, 200 - h + k * 26);
          f.quadraticCurveTo(x + 25, 200 - h - 14 + k * 26, x + 60 - k * 3, 200 - h + k * 26);
          f.lineTo(x + 50, 200 - h + 8 + k * 26);
          f.lineTo(x, 200 - h + 8 + k * 26);
          f.fill();
        }
      }
      let x = 0;
      const lanterns: { x: number; y: number }[] = [];
      while (x < length) {
        const w = r.range(150, 220);
        const c = r.pick(['#8c1c13', '#1d5c4a', '#7a2e1a', '#5a1a2e']);
        rect(n, x, 50, w, FLOOR_TOP - 50, c);
        windowsGrid(n, x + 6, 70, w - 12, 70, '#2b1b10', '#d4a017', r, '#ffb347');
        // telhado curvo
        n.fillStyle = '#2a1712';
        n.beginPath();
        n.moveTo(x - 8, 56);
        n.quadraticCurveTo(x + w / 2, 30, x + w + 8, 56);
        n.lineTo(x + w, 62);
        n.lineTo(x, 62);
        n.fill();
        // toldo de restaurante
        const ac = r.pick(['#e63946', '#f4a261', '#2a9d8f']);
        for (let k = 0; k < (w - 20) / 14; k++) rect(n, x + 10 + k * 14, 150, 14, 18, k % 2 ? ac : '#fff5e1');
        rect(n, x + 14, 168, w - 28, FLOOR_TOP - 168, '#2b1b10', '#111');
        sign(n, x + 20, 112, r.pick(['DRAGON HOUSE', 'TEA ROOM', 'NOODLES', 'LUCKY STAR', 'JADE GARDEN']), '#d4a017', '#5a0a0a', undefined, 10);
        lanterns.push({ x: x + w * 0.3, y: 140 }, { x: x + w * 0.75, y: 140 });
        x += w;
      }
      n.strokeStyle = '#2a1712';
      n.lineWidth = 1;
      n.beginPath();
      n.moveTo(0, 128);
      for (let lx = 0; lx < length; lx += 40) n.quadraticCurveTo(lx + 20, 138, lx + 40, 128);
      n.stroke();
      for (let lx = 20; lx < length; lx += 40) {
        n.fillStyle = '#e63946';
        n.shadowColor = '#ff8a5c';
        n.shadowBlur = 8;
        n.beginPath();
        n.ellipse(lx, 140, 6, 8, 0, 0, Math.PI * 2);
        n.fill();
        n.shadowBlur = 0;
        rect(n, lx - 3, 131, 6, 2, '#d4a017');
        rect(n, lx - 3, 147, 6, 2, '#d4a017');
      }
      floor(n, length, '#7d7068', '#4e4540', { tile: 28, lines: 'rgba(0,0,0,0.3)', curb: '#9a8c82', curbH: 8 }, r);
      curb(n, length, FLOOR_TOP + 8, '#9a8c82');
      cracks(n, length, r);
      break;
    }
    case 'underground': {
      f.fillStyle = '#15171b';
      f.fillRect(0, 0, farW, FLOOR_TOP);
      for (let x = 0; x < farW; x += 60) rect(f, x, 30, 18, FLOOR_TOP - 30, '#22252b');
      rect(n, 0, 0, length, 34, '#2a2d33');
      rect(n, 0, 34, length, 6, '#1d1f24');
      rect(n, 0, 40, length, FLOOR_TOP - 40, '#5b5f66');
      n.fillStyle = '#4e5259';
      for (let y = 60; y < FLOOR_TOP; y += 30) n.fillRect(0, y, length, 1);
      rect(n, 0, 196, length, 40, '#46494f');
      for (let x = 0; x < length; x += 30) rect(n, x, 196, 15, 6, '#f2c94c');
      for (let x = 30; x < length; x += 220) {
        rect(n, x, 34, 34, FLOOR_TOP - 34, '#8a8e95', '#2a2a2a');
        rect(n, x, 120, 34, 26, '#f2c94c');
        n.fillStyle = '#111';
        n.font = 'bold 16px "Arial Black", Arial';
        n.fillText(`${String.fromCharCode(65 + ((x / 220) | 0) % 6)}${((x / 220) | 0) % 9 + 1}`, x + 4, 139);
        // luz fluorescente
        n.fillStyle = '#eaffff';
        n.shadowColor = '#bff7ff';
        n.shadowBlur = 14;
        n.fillRect(x + 80, 36, 70, 3);
        n.shadowBlur = 0;
        n.fillStyle = 'rgba(200,250,255,0.06)';
        n.beginPath();
        n.moveTo(x + 80, 40);
        n.lineTo(x + 40, FLOOR_TOP);
        n.lineTo(x + 190, FLOOR_TOP);
        n.lineTo(x + 150, 40);
        n.fill();
      }
      // canos
      n.fillStyle = grad(n, 44, 52, [[0, '#7c8188'], [1, '#3e4248']]);
      n.fillRect(0, 44, length, 8);
      floor(n, length, '#5f6369', '#34373c', { noise: 'rgba(0,0,0,0.25)' }, r);
      cracks(n, length, r, 'rgba(40,50,60,0.35)');
      n.strokeStyle = '#e8e8e8';
      n.lineWidth = 2;
      for (let x = 0; x < length; x += 90) {
        n.beginPath();
        n.moveTo(x, FLOOR_TOP + 4);
        n.lineTo(x - 20, 290);
        n.stroke();
      }
      rect(n, 0, 296, length, 3, '#f2c94c');
      break;
    }
    case 'rooftop': {
      f.fillStyle = grad(f, 0, FLOOR_TOP, [[0, '#0b1d3a'], [0.5, '#5a3e85'], [1, '#ff8c69']]);
      f.fillRect(0, 0, farW, FLOOR_TOP);
      skyline(f, r, farW, FLOOR_TOP, '#26214a', 100, 200, '#ffd56b', 0.3);
      skyline(f, r, farW, FLOOR_TOP, '#1b1838', 40, 120, '#ffb46b', 0.2);
      // parapeito e equipamentos
      for (let x = 0; x < length; x += r.range(120, 200)) {
        if (r.chance(0.5)) {
          // caixa d'água
          rect(n, x, 120, 50, 60, '#8b5e3c', '#3a2414');
          n.fillStyle = '#5a3a22';
          for (let k = 0; k < 4; k++) n.fillRect(x, 128 + k * 14, 50, 2);
          n.fillStyle = '#3a2414';
          n.beginPath();
          n.moveTo(x - 4, 120);
          n.lineTo(x + 25, 104);
          n.lineTo(x + 54, 120);
          n.fill();
          for (let k = 0; k < 3; k++) rect(n, x + 4 + k * 20, 180, 3, 30, '#3a2414');
        } else {
          // antena
          n.strokeStyle = '#9aa0a6';
          n.lineWidth = 2;
          n.beginPath();
          n.moveTo(x + 20, 210);
          n.lineTo(x + 20, 70);
          n.stroke();
          n.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            n.beginPath();
            n.moveTo(x + 6 + k * 3, 90 + k * 18);
            n.lineTo(x + 34 - k * 3, 90 + k * 18);
            n.stroke();
          }
          n.fillStyle = '#ff3355';
          n.fillRect(x + 18, 66, 4, 4);
        }
      }
      rect(n, 0, 206, length, 30, '#7a7f87');
      n.fillStyle = '#5f646b';
      for (let x = 0; x < length; x += 30) n.fillRect(x, 206, 2, 30);
      rect(n, 0, 202, length, 6, '#9aa0a6');
      floor(n, length, '#5a5d63', '#3a3c41', { tile: 70, noise: 'rgba(255,255,255,0.08)' }, r);
      live = (ctx, camX, t) => {
        // helicóptero distante cruzando o céu
        const hx = ((t * 0.5) % (W + 200)) - 100;
        const hy = 60 + Math.sin(t * 0.02) * 6;
        ctx.save();
        ctx.translate(hx - (camX * 0.05) % 20, hy);
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-26, -1.5, 16, 3);
        ctx.fillRect(-28, -5, 3, 7);
        ctx.fillRect(-14, -8, 28 * Math.abs(Math.sin(t * 0.9)), 1.5);
        ctx.fillStyle = Math.sin(t * 0.3) > 0 ? '#ff3355' : '#33ff88';
        ctx.fillRect(10, 1, 2, 2);
        ctx.restore();
      };
      break;
    }
    case 'arena': {
      f.fillStyle = grad(f, 0, FLOOR_TOP, [[0, '#07070f'], [1, '#1d1a33']]);
      f.fillRect(0, 0, farW, FLOOR_TOP);
      // público nas arquibancadas
      for (let row = 0; row < 12; row++) {
        const y = 70 + row * 12;
        rect(f, 0, y + 8, farW, 4, '#2a2540');
        for (let x = (row % 2) * 5; x < farW; x += 10) {
          f.fillStyle = r.pick(['#e63946', '#ffcf33', '#ffffff', '#3a86ff', '#8338ec', '#ff006e', '#2a2a40']);
          f.beginPath();
          f.arc(x, y + 3, 3.4, 0, Math.PI * 2);
          f.fill();
          f.fillStyle = r.pick(['#f1c7a0', '#8a5432', '#5e3a24', '#d9a074']);
          f.beginPath();
          f.arc(x, y - 2, 2.4, 0, Math.PI * 2);
          f.fill();
        }
      }
      // telões
      // telões no meio da arquibancada (abaixo do placar do HUD)
      for (let x = 230; x < farW; x += 420) {
        rect(f, x, 84, 120, 52, '#111', '#555');
        f.fillStyle = '#ffcf33';
        f.font = 'bold 13px "Bungee", "Arial Black"';
        f.fillText('KING BALL', x + 14, 108);
        f.fillStyle = '#38f6ff';
        f.font = 'bold 9px Arial';
        f.fillText('VS  STREET PLAYER', x + 16, 124);
      }
      // placas de LED na beira da quadra
      for (let x = 0; x < length; x += 160) {
        rect(n, x, 196, 160, 40, '#0b0b14', '#2b2b3d');
        n.font = 'bold 15px "Bungee", "Arial Black"';
        n.fillStyle = r.pick(['#ffcf33', '#38f6ff', '#ff3fd2', '#7cff6b']);
        n.shadowColor = n.fillStyle as string;
        n.shadowBlur = 8;
        n.fillText(r.pick(['STREET KING', 'FINAL', 'SLAM!', 'CHAMPION', 'ARENA']), x + 12, 222);
        n.shadowBlur = 0;
      }
      // quadra de madeira
      n.fillStyle = grad(n, FLOOR_TOP, H, [[0, '#d9a066'], [1, '#b97a45']]);
      n.fillRect(0, FLOOR_TOP, length, H - FLOOR_TOP);
      n.strokeStyle = 'rgba(120,70,30,0.35)';
      n.lineWidth = 1;
      for (let y = FLOOR_TOP + 6; y < H; y += 7) {
        n.beginPath();
        n.moveTo(0, y);
        n.lineTo(length, y);
        n.stroke();
      }
      for (let x = 0; x < length; x += 60) {
        for (let y = FLOOR_TOP; y < H; y += 14) {
          n.beginPath();
          n.moveTo(x + ((y / 14) % 2) * 30, y);
          n.lineTo(x + ((y / 14) % 2) * 30, y + 7);
          n.stroke();
        }
      }
      n.strokeStyle = '#ffffff';
      n.lineWidth = 2.5;
      const mid = length - 330;
      n.beginPath();
      n.ellipse(mid, 292, 70, 34, 0, 0, Math.PI * 2);
      n.stroke();
      n.fillStyle = 'rgba(255,207,51,0.35)';
      n.fill();
      n.fillStyle = '#ffcf33';
      n.font = 'bold 22px "Bungee", "Arial Black"';
      n.fillText('♛', mid - 10, 300);
      live = (ctx, _camX, t) => {
        // holofotes varrendo
        for (let i = 0; i < 3; i++) {
          const a = Math.sin(t * 0.012 + i * 2.1) * 0.6;
          const sx = 120 + i * 200;
          ctx.save();
          ctx.translate(sx, -10);
          ctx.rotate(a);
          const g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, 'rgba(255,250,220,0.32)');
          g.addColorStop(1, 'rgba(255,250,220,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(-6, 0);
          ctx.lineTo(6, 0);
          ctx.lineTo(70, H + 20);
          ctx.lineTo(-70, H + 20);
          ctx.fill();
          ctx.restore();
        }
      };
      break;
    }
  }
  decorate(n, theme, length, r);
  return { far: far.c, near: near.c, live };
}

export { R as ART_SCALE };
