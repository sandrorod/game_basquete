import { FLOOR_BOTTOM, FLOOR_TOP } from '../core/config';
import { clamp } from '../core/math';
import type { Look } from '../render/fighter';

export type Power = 'quick' | 'strong' | 'special' | 'super' | 'melee' | 'hazard';

/** Base de todos os personagens: posição no chão (x, profundidade y), altura z e estado com contador. */
export abstract class Actor {
  x: number;
  y: number;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  facing: 1 | -1 = 1;
  hp: number;
  maxHp: number;
  /** Rastro da barra (desce devagar depois do dano) */
  trail = 1;
  state = 'idle';
  st = 0;
  scale = 1;
  look: Look;
  invuln = 0;
  flash = 0;
  dead = false;
  remove = false;
  name = '';
  static nextId = 1;
  id = Actor.nextId++;

  constructor(x: number, y: number, hp: number, look: Look) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.look = look;
  }

  /** Meia-largura do corpo para colisão */
  get halfW() {
    return 10 * this.scale;
  }
  get height() {
    return 70 * this.scale;
  }

  setState(s: string) {
    if (this.state !== s) {
      this.state = s;
      this.st = 0;
    }
  }

  /** Movimento com gravidade e limites da rua */
  physics(minX: number, maxX: number) {
    this.x += this.vx;
    this.y = clamp(this.y + this.vy, FLOOR_TOP + 4, FLOOR_BOTTOM);
    if (this.z > 0 || this.vz > 0) {
      this.z += this.vz;
      this.vz -= 0.45;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
      }
    }
    this.x = clamp(this.x, minX, maxX);
  }

  tickTimers() {
    this.st++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    const target = this.hp / this.maxHp;
    this.trail = this.trail > target ? Math.max(target, this.trail - 0.006) : target;
  }
}

/** Distância no plano do chão, com a profundidade pesando mais (fileiras da rua são "mais longe") */
export const laneDist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) * 2);
