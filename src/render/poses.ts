import { BASE_POSE, type Expr, type Pose } from './fighter';

/** Poses animadas. `t` = quadros (60 por segundo) desde o início do estado. */
export type Anim =
  | 'idle' | 'walk' | 'walkBack' | 'walkUp' | 'walkDown' | 'run' | 'windup' | 'throw' | 'charge' | 'hurt' | 'pushed'
  | 'fall' | 'down' | 'getup' | 'celebrate' | 'ko' | 'punch' | 'punchWind' | 'kick' | 'kickWind' | 'block' | 'ride'
  | 'shootWind' | 'shoot' | 'jump' | 'slam' | 'taunt' | 'dash' | 'guard';

const p = (o: Partial<Pose>): Pose => ({ ...BASE_POSE, ...o });
const sin = Math.sin;

export function poseFor(anim: Anim, t: number, opts: { ball?: Pose['ball']; expr?: Expr; spin?: number; progress?: number } = {}): Pose {
  const ball = opts.ball ?? 'none';
  const spin = opts.spin ?? t * 0.15;
  const pr = opts.progress ?? 0;
  const base = { ball, ballSpin: spin, expr: opts.expr ?? 'normal' };
  switch (anim) {
    case 'idle': {
      const br = sin(t * 0.08);
      // Drible: bola desce e sobe (0 = mão, 1 = chão)
      const cyc = (t % 40) / 40;
      const dr = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
      return p({
        ...base,
        lean: 0.12 + br * 0.02,
        aF: ball === 'dribble' ? 0.55 + dr * 0.35 : 0.35,
        eF: ball === 'dribble' ? -0.2 + dr * 0.3 : 0.7,
        aB: -0.25 + br * 0.04,
        eB: 0.9,
        lF: 0.28, kF: 0.42 + br * 0.04,
        lB: -0.22, kB: 0.36 + br * 0.04,
        dribble: dr,
      });
    }
    case 'walk':
    case 'walkBack':
    case 'walkUp':
    case 'walkDown': {
      const s = t * (anim === 'walkBack' ? -0.2 : 0.2);
      const a = anim === 'walkUp' || anim === 'walkDown' ? 0.32 : 0.5;
      const cyc = (t % 30) / 30;
      const dr = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
      return p({
        ...base,
        lean: 0.1 + (anim === 'walkBack' ? -0.06 : 0),
        lF: sin(s) * a, kF: 0.25 + Math.max(0, -sin(s)) * 0.75,
        lB: -sin(s) * a, kB: 0.25 + Math.max(0, sin(s)) * 0.75,
        aF: ball === 'dribble' ? 0.6 + dr * 0.3 : -sin(s) * 0.45 + 0.15, eF: ball === 'dribble' ? -0.15 + dr * 0.3 : 0.55,
        aB: sin(s) * 0.45 - 0.1, eB: 0.6,
        lift: Math.abs(sin(s)) * 1.2,
        dribble: dr,
      });
    }
    case 'run': {
      const s = t * 0.32;
      const cyc = (t % 20) / 20;
      const dr = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
      return p({
        ...base,
        lean: 0.35,
        lF: sin(s) * 0.9, kF: 0.4 + Math.max(0, -sin(s)) * 1.3,
        lB: -sin(s) * 0.9, kB: 0.4 + Math.max(0, sin(s)) * 1.3,
        aF: ball === 'dribble' ? 0.75 + dr * 0.25 : -sin(s) * 0.9, eF: ball === 'dribble' ? -0.1 : 1.3,
        aB: sin(s) * 0.9, eB: 1.3,
        lift: Math.abs(sin(s)) * 3,
        dribble: dr,
      });
    }
    case 'windup':
      return p({ ...base, ball: ball === 'none' ? 'none' : 'hand', lean: -0.12 - pr * 0.1, aF: -2.3 - pr * 0.4, eF: -1.3, aB: 0.6, eB: 0.4, lF: 0.35, kF: 0.25, lB: -0.38, kB: 0.5, expr: 'focus' });
    case 'charge': {
      const sh = sin(t * 1.3) * 0.03;
      return p({ ...base, ball: 'overhead', lean: -0.08 + sh, aF: -2.9, eF: -0.4, aB: -2.7, eB: -0.5, lF: 0.4, kF: 0.6, lB: -0.4, kB: 0.6, expr: 'focus' });
    }
    case 'throw':
      return p({ ...base, ball: 'none', lean: 0.32, aF: 1.45 - pr * 0.4, eF: 0.05, aB: -0.8, eB: 0.6, lF: 0.55, kF: 0.4, lB: -0.5, kB: 0.25, expr: 'angry' });
    case 'shootWind':
      return p({ ...base, lean: -0.15, aF: -2.6, eF: -1.1, aB: -0.4, eB: 1, lF: 0.25, kF: 0.4, lB: -0.3, kB: 0.4, expr: 'angry' });
    case 'shoot':
      return p({ ...base, lean: 0.3, aF: 1.5, eF: 0.1, aB: -0.6, eB: 0.6, lF: 0.5, kF: 0.4, lB: -0.45, kB: 0.25, expr: 'angry' });
    case 'hurt':
      return p({ ...base, ball: 'none', lean: -0.38, head: -0.25, aF: -0.8, eF: 1.4, aB: -1.1, eB: 1.2, lF: 0.15, kF: 0.4, lB: -0.35, kB: 0.25, expr: 'hurt' });
    case 'pushed':
      return p({ ...base, ball: 'none', lean: -0.55, head: -0.3, aF: -1.6, eF: 0.5, aB: -1.9, eB: 0.4, lF: 0.45, kF: 0.2, lB: -0.15, kB: 0.5, lift: 3, expr: 'hurt' });
    case 'fall':
      return p({ ...base, ball: 'none', lean: -0.4, head: -0.3, aF: -2.2, eF: 0.4, aB: -2.4, eB: 0.4, lF: 0.9, kF: 0.6, lB: 0.5, kB: 0.8, rot: -Math.min(1.45, pr * 1.6), lift: 0, expr: 'hurt' });
    case 'down':
      return p({ ...base, ball: 'none', lean: 0, head: -0.1, aF: -2.6, eF: 0.3, aB: -2.8, eB: 0.2, lF: 0.15, kF: 0.25, lB: 0.05, kB: 0.5, rot: -1.5, expr: opts.expr ?? 'ko' });
    case 'ko':
      return p({ ...base, ball: 'none', lean: 0, head: -0.2, aF: -2.9, eF: 0.1, aB: -2.6, eB: 0.4, lF: 0.1, kF: 0.1, lB: 0.2, kB: 0.6, rot: -1.55, expr: 'ko' });
    case 'getup': {
      const k = 1 - pr;
      return p({ ...base, ball: 'none', lean: 0.6 * k, aF: 0.9 * k, eF: 0.4, aB: 0.6 * k, eB: 0.4, lF: 0.9 * k + 0.1, kF: 1.6 * k + 0.2, lB: -0.2, kB: 1.4 * k + 0.2, rot: -1.5 * Math.max(0, 1 - pr * 2.2) });
    }
    case 'celebrate': {
      const j = Math.abs(sin(t * 0.12));
      return p({ ...base, ball: ball === 'none' ? 'none' : 'overhead', lean: -0.05, aF: -2.8 + sin(t * 0.24) * 0.15, eF: -0.3, aB: -2.7, eB: -0.4, lF: 0.2 + j * 0.3, kF: 0.4 + j * 0.6, lB: -0.15, kB: 0.4 + j * 0.6, lift: j * 10, expr: 'happy' });
    }
    case 'taunt':
      return p({ ...base, lean: -0.05, aF: -0.5 + sin(t * 0.3) * 0.4, eF: -1.6, aB: 0.6, eB: -1.8, lF: 0.3, kF: 0.2, lB: -0.3, kB: 0.2, expr: 'angry' });
    case 'punchWind':
      return p({ ...base, lean: -0.1, aF: -0.9, eF: 2.1, aB: 0.5, eB: 1.4, lF: 0.3, kF: 0.4, lB: -0.35, kB: 0.4, expr: 'angry' });
    case 'punch':
      return p({ ...base, lean: 0.3, aF: 1.55, eF: 0, aB: -0.3, eB: 1.6, lF: 0.55, kF: 0.4, lB: -0.45, kB: 0.25, expr: 'angry' });
    case 'kickWind':
      return p({ ...base, lean: -0.2, aF: 0.5, eF: 1.4, aB: -0.6, eB: 1.2, lF: 0.9, kF: 1.7, lB: -0.05, kB: 0.25, expr: 'angry' });
    case 'kick':
      return p({ ...base, lean: -0.45, aF: -0.4, eF: 1.2, aB: -1, eB: 1, lF: 1.65, kF: 0.05, lB: -0.05, kB: 0.2, expr: 'angry' });
    case 'block':
    case 'guard':
      return p({ ...base, lean: 0.05, aF: 2.0, eF: -2.4, aB: 1.6, eB: -2.1, lF: 0.35, kF: 0.5, lB: -0.35, kB: 0.5, expr: 'focus' });
    case 'ride':
      return p({ ...base, lean: 0.55, aF: 1.25, eF: 0.15, aB: 1.15, eB: 0.2, lF: 1.45, kF: 1.9, lB: 1.2, kB: 1.7, lift: 14, expr: 'angry' });
    case 'jump':
      return p({ ...base, lean: -0.1, aF: -2.7, eF: -0.3, aB: -2.5, eB: -0.3, lF: 0.9, kF: 1.6, lB: 0.2, kB: 1.4, expr: 'angry' });
    case 'slam':
      return p({ ...base, lean: 0.55, aF: 1.1, eF: 0.4, aB: 0.9, eB: 0.5, lF: 0.6, kF: 1.2, lB: -0.6, kB: 1.1, expr: 'angry' });
    case 'dash':
      return p({ ...base, lean: 0.6, aF: 1.2, eF: 0.3, aB: -1.2, eB: 0.5, lF: 0.9, kF: 0.8, lB: -0.9, kB: 0.4, lift: 2, expr: 'angry' });
  }
}
