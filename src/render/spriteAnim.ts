import { SIZE } from '../core/config';
import type { EnemyKind } from '../data/looks';
import { drawBall } from './fighter';
import { drawSprite, sprites, variant, type Frame } from './sprites';

/** Altura do herói na tela (unidades lógicas) */
export const HERO_HEIGHT = 88 * SIZE;

/** Quadros do herói com a cor da camiseta equipada */
let heroSet: Record<string, Frame[]> | null = null;

/** Troca a cor do uniforme do herói (camiseta da mochila); sem matiz = uniforme original */
export function setHeroOutfit(hue?: number) {
  heroSet = hue == null ? null : Object.fromEntries(Object.entries(sprites.hero).map(([k, list]) => [k, variant(`hero-${hue}-${k}`, list, { hue, sat: 1.05, redOnly: true })]));
}

const cyc = (list: Frame[], t: number, every: number) => list[Math.floor(t / every) % list.length];

export interface HeroPoseInput {
  state: string;
  st: number;
  t: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hasBall: boolean;
  quick: boolean;
  hp: number;
  /** Quadros parado com a bola (depois de 10 s, faz truques) */
  idleT?: number;
}

/** Parado por 10 s com a bola: começa a sequência de truques */
export const TRICK_AFTER = 600;
const LEGS_PASS = 36;
const LEGS_TOTAL = LEGS_PASS * 3;
const SPIN_IN = 35, SPIN_HOLD = 150;
export const TRICK_CYCLE = LEGS_TOTAL + SPIN_IN * 2 + SPIN_HOLD + 60;

/** Truque da vez: passagem entre as pernas (3 vezes), depois a bola girando no dedo; repete */
function trickFrame(H: Record<string, Frame[]>, idleT: number): Frame | null {
  if (!H.legs?.length || !H.spin?.length) return null;
  const t = (idleT - TRICK_AFTER) % TRICK_CYCLE;
  if (t < LEGS_TOTAL) return H.legs[Math.floor(((t % LEGS_PASS) / LEGS_PASS) * H.legs.length)];
  const u = t - LEGS_TOTAL;
  const n = H.spin.length;
  if (u < SPIN_IN) return H.spin[Math.min(n - 3, Math.floor((u / SPIN_IN) * (n - 2)))];
  // bola girando no dedo: alterna os dois últimos quadros
  if (u < SPIN_IN + SPIN_HOLD) return H.spin[n - 2 + (Math.floor((u - SPIN_IN) / 8) % 2)];
  if (u < SPIN_IN * 2 + SPIN_HOLD) return H.spin[Math.max(0, n - 3 - Math.floor(((u - SPIN_IN - SPIN_HOLD) / SPIN_IN) * (n - 2)))];
  return null;
}

/** Quadro do herói para o estado atual (os quadros do modelo olham para a direita) */
export function heroFrame(p: HeroPoseInput): { f: Frame; rot?: number; ball?: boolean; trick?: boolean } {
  const H = heroSet ?? sprites.hero;
  const s = p.st;
  switch (p.state) {
    case 'walk':
      return Math.abs(p.vy) > Math.abs(p.vx) * 1.2 ? { f: cyc(H.walkv, p.t, 7), ball: true } : { f: cyc(H.walk, p.t, 6), ball: true };
    case 'run':
      return { f: cyc(H.run, p.t, 4), ball: true };
    case 'windup': {
      const frames = p.quick ? [3, 4, 5] : [0, 1, 2, 3, 4, 5];
      const dur = p.quick ? 5 : 13;
      return { f: H.windup[frames[Math.min(frames.length - 1, Math.floor((s / dur) * frames.length))]] };
    }
    case 'charge':
      return { f: H.windup[5] };
    case 'throw':
      return { f: H.throw[Math.min(5, Math.floor(s / (p.quick ? 1.6 : 2.4)))] };
    case 'super':
      return s < 18 ? { f: H.windup[5] } : { f: H.throw[Math.min(5, Math.floor((s - 18) / 2.5))] };
    case 'shove':
      return { f: H.throw[s < 6 ? 0 : 1] };
    case 'hurt':
      return { f: H.hurt[Math.min(5, 3 + Math.floor(s / 6))] };
    case 'fall':
    case 'falling':
      return { f: H.pushed[Math.min(4, 1 + Math.floor(s / 4))] };
    case 'down':
      return { f: p.hp <= 0 ? H.ko[5] : H.pushed[5] };
    case 'getup':
      return { f: H.ko[Math.max(0, 4 - Math.floor((s / 24) * 5))] };
    case 'ko':
      return { f: H.ko[Math.min(5, 3 + Math.floor(s / 10))] };
    case 'respawn':
      return { f: H.celebrate[3] };
    case 'celebrate':
      return { f: cyc(H.celebrate, p.t, 8) };
    default: {
      // parado há mais de 10 s com a bola: truques (os quadros já trazem a bola)
      const tf = p.hasBall && (p.idleT ?? 0) >= TRICK_AFTER ? trickFrame(H, p.idleT!) : null;
      if (tf) return { f: tf, trick: true };
    }
      // parado: alterna as duas poses de frente
      return { f: H.idle[Math.floor(p.t / 40) % 2 === 0 ? 0 : 3], ball: true };
  }
}

export function heroScale() {
  return HERO_HEIGHT / sprites.hero.idle[0].h;
}

/** Desenha o herói (com a bola quicando quando está com ela e se movendo/parado) */
export function drawHeroSprite(ctx: CanvasRenderingContext2D, x: number, y: number, p: HeroPoseInput, o: { flash?: boolean; alpha?: number; scale?: number } = {}) {
  const r = heroFrame(p);
  // os truques já foram reduzidos para a mesma resolução dos quadros do herói (tools/slice_tricks.py)
  const s = heroScale() * (o.scale ?? 1);
  drawSprite(ctx, r.f, x, y, s, { facing: p.facing, flash: o.flash, alpha: o.alpha });
  if (r.ball && p.hasBall) {
    // drible: a bola sobe e desce ao lado do corpo
    const cyc2 = (p.t % 30) / 30;
    const k = cyc2 < 0.5 ? cyc2 * 2 : 2 - cyc2 * 2;
    const top = y - 34 * SIZE * (o.scale ?? 1);
    drawBall(ctx, x + p.facing * 15 * SIZE * (o.scale ?? 1), top + (y - 6 - top) * k, 5.5 * SIZE * (o.scale ?? 1), p.t * 0.3);
  }
}

// ───────────────────────────── inimigos ─────────────────────────────

interface EnemyMap { idle: number[]; walk: number[]; run?: number[]; windup: number; attack: number; shoot?: number; block?: number; ride?: number }

/** Índices dos quadros do modelo (1–4 = quadros da mesma escala; a pose grande 0 não entra na animação) */
export const ENEMY_MAP: Record<EnemyKind, EnemyMap> = {
  thug: { idle: [1], walk: [1, 2], windup: 3, attack: 4 },
  runner: { idle: [1], walk: [1, 2], run: [3, 4], windup: 3, attack: 4 },
  heavy: { idle: [1], walk: [1, 2], windup: 3, attack: 4 },
  thief: { idle: [1], walk: [1, 2], run: [3, 4], windup: 3, attack: 3 },
  shooter: { idle: [1], walk: [1, 2], windup: 3, attack: 4, shoot: 4 },
  defender: { idle: [1], walk: [1, 2], windup: 3, attack: 4, block: 1 },
  biker: { idle: [3], walk: [3, 1], windup: 3, attack: 3, ride: 3 },
  baller: { idle: [1], walk: [1, 3], windup: 3, attack: 4, shoot: 2 },
  gangster: { idle: [1], walk: [1, 2], windup: 4, attack: 3 },
  knife: { idle: [1], walk: [1, 2], windup: 4, attack: 3 },
};

export interface EnemyPoseInput {
  kind: EnemyKind;
  state: string;
  st: number;
  t: number;
  moving: boolean;
  fast: boolean;
  hp: number;
  frames?: Frame[];
}

/** Quadro + rotação (queda) do inimigo */
export function enemyFrame(e: EnemyPoseInput): { idx: number; rot: number } {
  const m = ENEMY_MAP[e.kind];
  const pickWalk = (list: number[], every: number) => list[Math.floor(e.t / every) % list.length];
  switch (e.state) {
    case 'approach':
    case 'think':
    case 'retreat':
    case 'align':
    case 'dodge':
      return { idx: e.moving ? (e.fast && m.run ? pickWalk(m.run, 5) : pickWalk(m.walk, 9)) : m.idle[0], rot: 0 };
    case 'dashSteal':
    case 'flee':
    case 'dash':
      return { idx: m.run ? pickWalk(m.run, 4) : m.attack, rot: 0 };
    case 'windup':
    case 'punchWind':
    case 'dashWind':
    case 'jumpWind':
    case 'shootWind':
      return { idx: m.windup, rot: 0 };
    case 'attack':
    case 'combo':
      return { idx: e.state === 'combo' && Math.floor(e.st / 16) === 1 ? m.windup : m.attack, rot: 0 };
    case 'shoot':
    case 'volley':
      return { idx: m.shoot ?? m.attack, rot: 0 };
    case 'block':
      return { idx: m.block ?? m.windup, rot: 0 };
    case 'ride':
    case 'rideWait':
      return { idx: m.ride ?? m.idle[0], rot: 0 };
    case 'hurt':
    case 'stagger':
      return { idx: m.walk[0], rot: -0.18 };
    case 'fall':
      return { idx: m.walk[0], rot: -Math.min(1.5, (e.st / 14) * 1.5) };
    case 'down':
    case 'ko':
      return { idx: m.walk[0], rot: -1.5 };
    case 'getup':
      return { idx: m.walk[0], rot: -1.5 * Math.max(0, 1 - e.st / 14) };
    case 'jump':
      return { idx: m.windup, rot: 0 };
    case 'intro':
    case 'summon':
      return { idx: m.idle[0], rot: 0 };
    default:
      return { idx: m.idle[0], rot: 0 };
  }
}

/**
 * Escala de cada quadro: no modelo, alguns quadros (corrida, ataque) foram desenhados menores que os outros.
 * Todos ficam do tamanho do maior quadro do personagem; o limite de 1,45× evita esticar poses agachadas demais.
 */
export function enemyScale(frames: Frame[], idx: number, height: number, normalize = true) {
  const ref = frames.slice(1, 5).reduce((a, f) => (f.h > a.h ? f : a), frames[1]);
  const base = height / ref.base;
  const f = frames[idx] ?? ref;
  return normalize ? base * Math.min(1.45, Math.max(1, ref.h / f.h)) : base;
}

export function enemyFrames(kind: EnemyKind) {
  return sprites.enemies[kind];
}
