import type { EnemyKind } from './looks';

export interface EnemyDef {
  hp: number;
  speed: number;
  dmg: number;
  /** Alcance do golpe corpo a corpo */
  reach: number;
  scale: number;
  score: number;
  /** Distância que prefere manter do jogador */
  range: [number, number];
  /** Golpes rápidos não interrompem (só arremesso forte/especial) */
  armor?: boolean;
  attack: 'punch' | 'kick' | 'shoot' | 'ride' | 'steal' | 'dash';
  projectile?: 'can' | 'ball';
  blockChance?: number;
  dodgeChance?: number;
  windup: number;
  cooldown: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  thug: { hp: 30, speed: 1.15, dmg: 7, reach: 30, scale: 1, score: 200, range: [24, 34], attack: 'punch', windup: 22, cooldown: 60 },
  runner: { hp: 22, speed: 2.4, dmg: 6, reach: 30, scale: 0.96, score: 250, range: [26, 40], attack: 'dash', dodgeChance: 0.18, windup: 16, cooldown: 50 },
  heavy: { hp: 85, speed: 0.7, dmg: 15, reach: 40, scale: 1.12, score: 500, range: [28, 40], armor: true, attack: 'punch', windup: 34, cooldown: 85 },
  thief: { hp: 26, speed: 2, dmg: 4, reach: 26, scale: 0.95, score: 300, range: [18, 26], attack: 'steal', windup: 10, cooldown: 70 },
  shooter: { hp: 28, speed: 1.1, dmg: 8, reach: 30, scale: 1, score: 300, range: [170, 240], attack: 'shoot', projectile: 'can', windup: 30, cooldown: 110 },
  defender: { hp: 55, speed: 0.95, dmg: 9, reach: 34, scale: 1.06, score: 400, range: [26, 36], attack: 'punch', blockChance: 0.55, windup: 24, cooldown: 70 },
  biker: { hp: 40, speed: 4.6, dmg: 10, reach: 30, scale: 1, score: 450, range: [0, 0], attack: 'ride', windup: 40, cooldown: 160 },
  baller: { hp: 40, speed: 1.4, dmg: 9, reach: 32, scale: 1.02, score: 400, range: [130, 210], attack: 'shoot', projectile: 'ball', dodgeChance: 0.1, windup: 26, cooldown: 120 },
};
