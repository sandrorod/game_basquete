import type { EnemyKind } from './looks';

export type BossMove = 'melee' | 'combo' | 'dash' | 'volley' | 'slam' | 'teleport' | 'summon';
export type ProjKind = 'ball' | 'bolt' | 'fire' | 'rocket' | 'star' | 'can';

export interface BossDef {
  name: string;
  title: string;
  hp: number;
  scale: number;
  speed: number;
  dmg: number;
  moves: Partial<Record<BossMove, number>>;
  projectile: ProjKind;
  /** Quantos projéteis por rajada e espalhamento em profundidade */
  volley: { count: number; spread: number; speed: number };
  /** Chance de esquivar de arremessos */
  dodge: number;
  /** Redução de dano de arremessos rápidos (0..1) */
  armor: number;
  /** Armadura cai quando a vida passa da metade */
  armorBreaks?: boolean;
  summon?: EnemyKind[];
  /** Fúria abaixo de 35%: mais rápido e agressivo */
  rage: number;
  line: string;
}

export const BOSSES: BossDef[] = [
  { name: 'BIG MIKE', title: 'O dono da rua', hp: 360, scale: 1.45, speed: 0.95, dmg: 14, moves: { melee: 4, combo: 2, dash: 2, slam: 1 }, projectile: 'can', volley: { count: 1, spread: 0, speed: 5 }, dodge: 0, armor: 0.15, rage: 1.3, line: 'Esta rua é MINHA!' },
  { name: 'TRAIN MASTER', title: 'Rei dos trilhos', hp: 400, scale: 1.25, speed: 1.35, dmg: 11, moves: { dash: 4, volley: 3, melee: 2 }, projectile: 'bolt', volley: { count: 3, spread: 22, speed: 6 }, dodge: 0.1, armor: 0, rage: 1.35, line: 'Próxima parada: DERROTA!' },
  { name: 'IRON JACK', title: 'Muralha de aço', hp: 520, scale: 1.4, speed: 0.75, dmg: 16, moves: { melee: 4, slam: 3, dash: 1 }, projectile: 'can', volley: { count: 1, spread: 0, speed: 5 }, dodge: 0, armor: 0.6, armorBreaks: true, rage: 1.3, line: 'Seus arremessos não me arranham.' },
  { name: 'SHARK', title: 'Predador da areia', hp: 460, scale: 1.12, speed: 1.9, dmg: 11, moves: { slam: 4, dash: 3, combo: 3 }, projectile: 'star', volley: { count: 1, spread: 0, speed: 6 }, dodge: 0.32, armor: 0, rage: 1.35, line: 'Sinto cheiro de medo...' },
  { name: 'NEON KING', title: 'Lenda das quadras noturnas', hp: 500, scale: 1.15, speed: 1.5, dmg: 12, moves: { volley: 5, dash: 2, summon: 1 }, projectile: 'ball', volley: { count: 3, spread: 26, speed: 6.5 }, dodge: 0.18, armor: 0, summon: ['shooter', 'thief'], rage: 1.3, line: 'Bem-vindo ao meu show!' },
  { name: 'DUNK MASTER', title: 'Gigante do garrafão', hp: 640, scale: 1.65, speed: 0.85, dmg: 18, moves: { slam: 5, volley: 2, melee: 3 }, projectile: 'ball', volley: { count: 1, spread: 0, speed: 7.5 }, dodge: 0, armor: 0.25, rage: 1.3, line: 'Vou te enterrar!' },
  { name: 'DRAGON', title: 'Punho de fogo', hp: 600, scale: 1.12, speed: 1.8, dmg: 13, moves: { combo: 4, volley: 3, dash: 3 }, projectile: 'fire', volley: { count: 2, spread: 18, speed: 5.5 }, dodge: 0.3, armor: 0, rage: 1.4, line: 'O dragão nunca dorme.' },
  { name: 'THE MACHINE', title: 'Protótipo de combate', hp: 760, scale: 1.5, speed: 0.8, dmg: 17, moves: { volley: 4, dash: 3, melee: 2, summon: 1 }, projectile: 'rocket', volley: { count: 2, spread: 30, speed: 4.5 }, dodge: 0, armor: 0.35, summon: ['heavy', 'biker'], rage: 1.25, line: 'ALVO IDENTIFICADO.' },
  { name: 'SHADOW', title: 'Ninguém o vê chegar', hp: 640, scale: 1.08, speed: 2.2, dmg: 13, moves: { teleport: 4, combo: 3, volley: 3 }, projectile: 'star', volley: { count: 3, spread: 20, speed: 7 }, dodge: 0.5, armor: 0, rage: 1.35, line: '...' },
  { name: 'THE KING', title: 'O maior rival', hp: 1250, scale: 1.3, speed: 1.6, dmg: 15, moves: { volley: 4, melee: 3, combo: 3, dash: 3, slam: 3, summon: 1, teleport: 1 }, projectile: 'ball', volley: { count: 3, spread: 24, speed: 7 }, dodge: 0.2, armor: 0.1, summon: ['baller', 'defender', 'runner'], rage: 1.45, line: 'Só pode existir UM rei da quadra.' },
];
