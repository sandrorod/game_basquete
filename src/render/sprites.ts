/**
 * Sprites recortados dos modelos (art/*.png → public/sprites, ver tools/slice_*.py).
 * Cada quadro tem a imagem, uma silhueta branca (efeito de golpe) e o centro dos pés (âncora).
 */
export interface Frame {
  img: CanvasImageSource;
  white: HTMLCanvasElement;
  w: number;
  h: number;
  footX: number;
  /** Distância do topo do quadro até a linha do chão do modelo (pés no ar ficam acima dela) */
  base: number;
  /** Drible: [x da bola, altura da mão acima do chão, raio], em pixels do quadro (tools/dribble_ball.py) */
  ball?: [number, number, number];
}

interface FrameInfo { file: string; w: number; h: number; footX: number; base?: number; ball?: [number, number, number] }

const BASE = `${import.meta.env.BASE_URL}sprites/`;

export const sprites = {
  hero: {} as Record<string, Frame[]>,
  enemies: {} as Record<string, Frame[]>,
  props: {} as Record<string, Frame>,
  /** Arte de corpo inteiro dos chefes (art/bosses-sheet.png) */
  bosses: {} as Record<string, Frame>,
  /** Desenho grande do herói (tela inicial) */
  heroFull: null as HTMLImageElement | null,
  /** Prêmios (art/items-sheet.png) */
  items: {} as Record<string, Frame>,
  /** Cenários das 10 fases (art/stages-sheet.png) */
  stages: {} as Record<number, HTMLImageElement>,
  /** Variações de cor (chefes), por chave */
  variants: {} as Record<string, Frame[]>,
  loaded: false,
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite não carregou: ${src}`));
    img.src = src;
  });
}

function whiteOf(img: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, w, h);
  return c;
}

async function frame(dir: string, f: FrameInfo): Promise<Frame> {
  const img = await loadImage(`${BASE}${dir}/${f.file}`);
  return { img, white: whiteOf(img, f.w, f.h), w: f.w, h: f.h, footX: f.footX ?? f.w / 2, base: f.base ?? f.h, ball: f.ball };
}

export async function loadSprites() {
  const [hero, enemies, props, bosses, items] = await Promise.all(
    ['hero/hero.json', 'enemies/enemies.json', 'props/props.json', 'bosses/bosses.json', 'items/items.json'].map((p) => fetch(`${BASE}${p}`).then((r) => r.json())),
  );
  await Promise.all([
    ...Object.entries(hero as Record<string, FrameInfo[]>).map(async ([k, list]) => (sprites.hero[k] = await Promise.all(list.map((f) => frame('hero', f))))),
    ...Object.entries(enemies as Record<string, FrameInfo[]>).map(async ([k, list]) => (sprites.enemies[k] = await Promise.all(list.map((f) => frame('enemies', f))))),
    ...Object.entries(props as Record<string, FrameInfo>).map(async ([k, f]) => (sprites.props[k] = await frame('props', f))),
    ...Object.entries(bosses as Record<string, FrameInfo>).map(async ([k, f]) => (sprites.bosses[k] = await frame('bosses', f))),
    ...Object.entries(items as Record<string, FrameInfo>).map(async ([k, f]) => (sprites.items[k] = await frame('items', { ...f, base: f.h }))),
  ]);
  await Promise.all(
    Array.from({ length: 10 }, (_, i) => loadImage(`${BASE}stages/stage_${i + 1}.jpg`).then((img) => (sprites.stages[i + 1] = img)).catch(() => undefined)),
  );
  sprites.heroFull = await loadImage(`${BASE}hero/hero_full.png`).catch(() => null);
  sprites.loaded = true;
}

/** Recolore quadros (matiz/saturação/brilho), preservando tons de pele. Usado para os chefes. */
export interface Zones {
  /** Matiz (0–360) do vermelho da faixa da cabeça (parte de cima), −1 = preto */
  head?: number;
  /** Matiz do uniforme (meio) */
  body?: number;
  /** Matiz do tênis (parte de baixo) */
  feet?: number;
}

/**
 * Recolore só o vermelho do uniforme do herói, por faixa de altura do quadro: cabeça (faixa), corpo (camiseta e
 * calção) e pés (tênis). Pele, bola e branco ficam como estão.
 */
export function zoneVariant(key: string, base: Frame[], z: Zones) {
  if (sprites.variants[key]) return sprites.variants[key];
  const out = base.map((f) => {
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    const x = c.getContext('2d')!;
    x.drawImage(f.img, 0, 0);
    const data = x.getImageData(0, 0, f.w, f.h);
    const d = data.data;
    const top = f.base - f.h * 0; // linha do chão do quadro
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      // só o vermelho forte do uniforme (a pele mais escura também puxa para o vermelho, mas é menos saturada)
      if (!((h < 8 || h > 338) && s > 0.58 && l > 0.18 && l < 0.82)) continue;
      const py = Math.floor(i / 4 / f.w);
      // altura relativa ao chão do quadro (0 = pés, 1 = topo da cabeça), para funcionar também agachado
      const rel = (top - py) / f.base;
      const target = rel < 0.13 ? z.feet : rel > 0.8 ? z.head : z.body;
      if (target === undefined) continue;
      const [r, g, b] = target < 0 ? hslToRgb(0, 0, l * 0.35) : hslToRgb(target, s, l);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    x.putImageData(data, 0, 0);
    return { img: c, white: f.white, w: f.w, h: f.h, footX: f.footX, base: f.base, ball: f.ball };
  });
  sprites.variants[key] = out;
  return out;
}

export function variant(key: string, base: Frame[], o: { hue?: number; sat?: number; bright?: number; keepSkin?: boolean; redOnly?: boolean }) {
  if (sprites.variants[key]) return sprites.variants[key];
  const out = base.map((f) => {
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    const x = c.getContext('2d')!;
    x.drawImage(f.img, 0, 0);
    const data = x.getImageData(0, 0, f.w, f.h);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      let [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      const skin = o.keepSkin !== false && h > 10 && h < 45 && s > 0.2 && s < 0.75 && l > 0.25 && l < 0.85;
      // redOnly: só o vermelho do uniforme muda de cor (pele, bola e tênis ficam)
      const red = (h < 12 || h > 335) && s > 0.3;
      if (o.redOnly && !red) continue;
      if (!skin) {
        h = (h + (o.hue ?? 0) + 360) % 360;
        s = Math.min(1, s * (o.sat ?? 1));
      }
      l = Math.min(1, l * (o.bright ?? 1));
      const [r, g, b] = hslToRgb(h, s, l);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    x.putImageData(data, 0, 0);
    return { img: c, white: f.white, w: f.w, h: f.h, footX: f.footX, base: f.base, ball: f.ball };
  });
  sprites.variants[key] = out;
  return out;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Desenha um quadro com os pés em (x, y). `scale` em unidades lógicas por pixel do sprite.
 * Sprites olham para a direita; facing −1 espelha. `rot` gira em torno dos pés (quedas).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  x: number,
  y: number,
  scale: number,
  o: { facing?: number; flash?: boolean; alpha?: number; rot?: number; lift?: number } = {},
) {
  const facing = o.facing ?? 1;
  ctx.save();
  ctx.translate(x, y - (o.lift ?? 0));
  if (o.rot) ctx.rotate(o.rot * facing);
  ctx.scale(facing * scale, scale);
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(f.img, -f.footX, -f.base, f.w, f.h);
  if (o.flash) {
    ctx.globalAlpha = (o.alpha ?? 1) * 0.75;
    ctx.drawImage(f.white, -f.footX, -f.base, f.w, f.h);
  }
  ctx.restore();
}
