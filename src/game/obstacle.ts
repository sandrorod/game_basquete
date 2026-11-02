import { PROP_SIZE } from '../render/props';
import type { PropKind } from '../data/stages';
import type { PickupKind } from '../render/props';

export class Obstacle {
  kind: PropKind;
  x: number;
  y: number;
  hp: number;
  breakable: boolean;
  solid: boolean;
  broken = false;
  hitT = 0;
  flash = 0;
  accent: string;
  id = Math.random();

  constructor(kind: PropKind, x: number, y: number, accent: string) {
    const s = PROP_SIZE[kind];
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.hp = s.hp;
    this.breakable = s.hp > 0;
    this.solid = s.solid;
    this.accent = accent;
  }

  get size() {
    return PROP_SIZE[this.kind];
  }

  /** Pegada no chão: retângulo [x−fw/2, x+fw/2] × [y−fd, y] */
  footprint() {
    const s = this.size;
    return { x0: this.x - s.fw / 2, x1: this.x + s.fw / 2, y0: this.y - s.fd, y1: this.y + 2 };
  }
}

export class Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  t = 0;
  taken = false;
  constructor(kind: PickupKind, x: number, y: number) {
    this.kind = kind;
    this.x = x;
    this.y = y;
  }
}

/** Empurra um personagem para fora dos obstáculos sólidos (raio rx no x, ry na profundidade). */
export function resolveObstacles(a: { x: number; y: number; z: number }, obstacles: Obstacle[], rx = 8, ry = 4) {
  for (const o of obstacles) {
    if (o.broken || !o.solid || a.z > o.size.h * 0.8) continue;
    const f = o.footprint();
    const left = a.x + rx - f.x0, right = f.x1 - (a.x - rx), up = a.y + ry - f.y0, down = f.y1 - (a.y - ry);
    if (left <= 0 || right <= 0 || up <= 0 || down <= 0) continue;
    const m = Math.min(left, right, up, down);
    if (m === left) a.x -= left;
    else if (m === right) a.x += right;
    else if (m === up) a.y -= up;
    else a.y += down;
  }
}
