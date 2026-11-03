import { HERO_SIZE, SIZE } from '../core/config';
import type { EnemyKind } from '../data/looks';
import { drawBall } from './fighter';
import { drawSprite, sprites, zoneVariant, type Frame, type Zones } from './sprites';

/** Altura do herói na tela (unidades lógicas) */
export const HERO_HEIGHT = 88 * HERO_SIZE;

/** Cor da bola do herói (mochila) */
let ballColor: string | undefined;
export function setBallColor(c?: string) {
  ballColor = c;
}

/** Quadros do herói com a cor da camiseta equipada */
let heroSet: Record<string, Frame[]> | null = null;

/** Cores do herói conforme a mochila: camiseta, tênis e faixa da cabeça; nada equipado = uniforme original */
export function setHeroOutfit(z: Zones = {}) {
  const none = z.body === undefined && z.feet === undefined && z.head === undefined;
  const key = `${z.head}-${z.body}-${z.feet}`;
  heroSet = none ? null : Object.fromEntries(Object.entries(sprites.hero).map(([k, list]) => [k, zoneVariant(`hero-${key}-${k}`, list, z)]));
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

/** Duração (quadros) de um quique completo: mão → chão → mão */
export const DRIBBLE = { idle: 30, walk: 26, run: 20 };

/** Bola do drible: da mão até o chão e de volta (sai da mão acelerando e volta freando) */
function drawDribbleBall(ctx: CanvasRenderingContext2D, x: number, y: number, f: Frame, s: number, facing: number, t: number, period: number) {
  const [bx, hand, r] = f.ball!;
  const ph = (t % period) / period;
  const down = 1 - (2 * ph - 1) ** 2; // 0 na mão, 1 no chão
  const top = hand - r, floor = r;
  const cy = y - (top - (top - floor) * down) * s;
  // perto do corpo: no máximo 1/3 da altura à frente dos pés (na folha a bola às vezes vai longe)
  const cx = x + Math.min(bx - f.footX, f.base * 0.3) * s * facing;
  // sombra no chão (fica mais escura quando a bola chega perto)
  ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.2 * down})`;
  ctx.beginPath();
  ctx.ellipse(cx, y + 1, r * s * (0.6 + 0.4 * down), r * s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  drawBall(ctx, cx, cy, r * s, t * 0.25 * facing, undefined, ballColor);
}

/** Parado por 10 s com a bola: começa a sequência de truques */
export const TRICK_AFTER = 600;
/** Partes da sequência (quadros): olha para a câmera batendo bola, entre as pernas (3 vezes), bola no dedo */
const LOOK = 72;
const LEGS_PASS = 36;
const LEGS = LEGS_PASS * 3;
const SPIN_IN = 20, SPIN_HOLD = 160, SPIN_OUT = 20, REST = 30;
export const TRICK_CYCLE = LOOK + LEGS + SPIN_IN + SPIN_HOLD + SPIN_OUT + REST;
/** Trechos da sequência em que a bola quica no chão (som do drible) */
export const trickBouncing = (u: number) => u < LOOK + LEGS;

/**
 * Truques (parado há 10 s, folha art/hero-tricks-sheet.png): olha para a câmera batendo bola,
 * passa a bola entre as pernas 3 vezes, sobe a bola e roda no dedo; repete.
 */
function trickFrame(H: Record<string, Frame[]>, idleT: number): Frame | null {
  if (!H.look?.length || !H.legs?.length || !H.spin?.length) return null;
  const t = (idleT - TRICK_AFTER) % TRICK_CYCLE;
  if (t < LOOK) return cyc(H.look, t, 6);
  let u = t - LOOK;
  if (u < LEGS) return H.legs[Math.floor(((u % LEGS_PASS) / LEGS_PASS) * H.legs.length)];
  u -= LEGS;
  if (u < SPIN_IN) return H.spin[Math.min(1, Math.floor(u / 10))];
  u -= SPIN_IN;
  // bola girando no dedo: quadros 2–5 em ciclo
  if (u < SPIN_HOLD) return H.spin[2 + (Math.floor(u / 5) % 4)];
  u -= SPIN_HOLD;
  if (u < SPIN_OUT) return H.spin[1 - Math.min(1, Math.floor(u / 10))];
  return H.dribble ? cyc(H.dribble, t, 6) : null;
}

/** Quadro do herói para o estado atual (folha art/hero-sheet.png; os quadros olham para a direita) */
export function heroFrame(p: HeroPoseInput): { f: Frame; trick?: boolean; dribble?: number } {
  const H = heroSet ?? sprites.hero;
  const s = p.st;
  const at = (list: Frame[], dur: number) => list[Math.min(list.length - 1, Math.floor((s / dur) * list.length))];
  switch (p.state) {
    case 'walk':
      // andando batendo bola (a bola já vem desenhada); sem bola: os passos da corrida, mais devagar
      return p.hasBall ? { f: cyc(H.walk, p.t, 5), dribble: DRIBBLE.walk } : { f: cyc(H.run, p.t, 6) };
    case 'run':
      // correndo: com a bola, drible baixo; sem bola, corrida
      return p.hasBall ? { f: cyc(H.rundrib, p.t, 3), dribble: DRIBBLE.run } : { f: cyc(H.run, p.t, 3) };
    case 'windup':
      return { f: p.quick ? at(H.windup.slice(2), 5) : at(H.windup, 13) };
    case 'charge':
      // carregando o turbo: corpo armado, balançando entre os dois últimos quadros da preparação
      return { f: H.windup[3 + (Math.floor(p.t / 6) % 2)] };
    case 'throw':
      return { f: at(H.throw, p.quick ? 9 : 14) };
    case 'super':
      return { f: s < 18 ? H.windup[4] : H.shoot[Math.min(1, Math.floor((s - 18) / 6))] };
    case 'shove':
      return { f: H.throw[s < 6 ? 0 : 1] };
    case 'hurt':
      return { f: H.ko[Math.min(1, Math.floor(s / 8))] };
    case 'fall':
    case 'falling':
      return { f: H.ko[Math.min(4, 2 + Math.floor(s / 5))] };
    case 'down':
      return { f: p.hp <= 0 ? H.ko[6] : H.ko[5] };
    case 'getup':
      return { f: H.ko[Math.max(0, 5 - Math.floor((s / 24) * 6))] };
    case 'ko':
      return { f: H.ko[Math.min(6, 3 + Math.floor(s / 10))] };
    case 'respawn':
      return { f: H.celebrate[3] };
    case 'celebrate':
      return { f: cyc(H.celebrate, p.t, 10) };
    default: {
      // parado há mais de 10 s com a bola: truques
      const tf = p.hasBall && (p.idleT ?? 0) >= TRICK_AFTER ? trickFrame(H, p.idleT!) : null;
      if (tf) return { f: tf, trick: true };
      // parado com a bola: bate bola na frente do corpo; sem bola: parado de lado
      if (p.hasBall) return { f: cyc(H.dribble, p.t, DRIBBLE.idle / H.dribble.length), dribble: DRIBBLE.idle };
      return { f: H.walknb[0] };
    }
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
  if (r.dribble && r.f.ball) drawDribbleBall(ctx, x, y, r.f, s, p.facing, p.t, r.dribble);
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
