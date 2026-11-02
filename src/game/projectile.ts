import type { ProjKind } from '../data/bosses';
import type { Power } from './actor';

export class Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy = 0;
  vz = 0;
  kind: ProjKind;
  fromPlayer: boolean;
  dmg: number;
  power: Power;
  pierce = false;
  /** Bola do jogador voltando para a mão */
  returning = false;
  /** É a bola principal do jogador (as do SUPER não voltam) */
  mainBall = false;
  life = 0;
  maxLife: number;
  range: number;
  startX: number;
  hits = new Set<number>();
  /** Inimigos atingidos na volta (cada um só uma vez) */
  returnHits = new Set<number>();
  remove = false;
  spin = 0;
  glow?: string;
  /** Altura do alvo para acertar (largura da "faixa" da rua) */
  laneTol: number;
  homing = 0;
  ownerId = 0;
  /** Inimigos que já decidiram se esquivam desta bola */
  judged = new Set<number>();
  id = Math.random();

  constructor(o: { x: number; y: number; z: number; vx: number; kind: ProjKind; fromPlayer: boolean; dmg: number; power: Power; range?: number; laneTol?: number; maxLife?: number }) {
    this.x = o.x;
    this.y = o.y;
    this.z = o.z;
    this.vx = o.vx;
    this.kind = o.kind;
    this.fromPlayer = o.fromPlayer;
    this.dmg = o.dmg;
    this.power = o.power;
    this.range = o.range ?? 300;
    this.startX = o.x;
    this.laneTol = o.laneTol ?? 13;
    this.maxLife = o.maxLife ?? 160;
  }

  get radius() {
    return this.power === 'super' ? 9 : this.power === 'special' ? 8 : 6;
  }
}
