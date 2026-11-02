import type { EnemyKind } from './looks';

export type BossMove = 'melee' | 'combo' | 'dash' | 'volley' | 'slam' | 'teleport' | 'summon';
export type ProjKind = 'ball' | 'bolt' | 'fire' | 'rocket' | 'star' | 'can' | 'clipboard';

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
  /** Arte de corpo inteiro (public/sprites/bosses) */
  sprite: string;
  /** Para onde a arte olha: 1 direita, −1 esquerda, 0 de frente (nunca espelha, para o número da camisa não inverter) */
  face: 1 | -1 | 0;
  /** Chance de dar um toco (bloquear) em arremessos rápidos */
  block?: number;
  /** Raio da onda de choque da enterrada (multiplicador) */
  slamPower?: number;
  /** Golpes em giro (chutes acrobáticos) */
  spin?: boolean;
  /** Escolhe golpes ao acaso, sem padrão (imprevisível) */
  chaos?: boolean;
}

export const BOSSES: BossDef[] = [
  // 1. ala agressivo: avança e enterra
  { name: 'RAZOR', title: 'O Brigão · ala agressivo', sprite: 'razor', face: -1, hp: 360, scale: 1.12, speed: 1.3, dmg: 13, moves: { combo: 4, dash: 3, slam: 3 }, projectile: 'ball', volley: { count: 1, spread: 0, speed: 6 }, dodge: 0.05, armor: 0, slamPower: 1, rage: 1.35, line: 'Vou enterrar você no asfalto!' },
  // 2. pivô gigante: dá toco e esmaga
  { name: 'TITAN', title: 'O Gigante · pivô', sprite: 'titan', face: 0, hp: 460, scale: 1.32, speed: 0.8, dmg: 16, moves: { melee: 4, slam: 4, dash: 1 }, projectile: 'can', volley: { count: 1, spread: 0, speed: 5 }, dodge: 0, armor: 0.35, armorBreaks: true, block: 0.45, slamPower: 1.25, rage: 1.3, line: 'Aqui no garrafão ninguém passa.' },
  // 3. veloz: dribles e chutes acrobáticos
  { name: 'VIPER', title: 'A Ágil · dribles e chutes', sprite: 'viper', face: 1, hp: 430, scale: 1.04, speed: 2.2, dmg: 11, moves: { combo: 5, dash: 3, teleport: 2 }, projectile: 'star', volley: { count: 1, spread: 0, speed: 6 }, dodge: 0.4, armor: 0, spin: true, rage: 1.4, line: 'Tenta me acompanhar!' },
  // 4. treinador: prancheta e bolas como armas, chama os jogadores
  { name: 'COACH', title: 'O Técnico · prancheta e bolas', sprite: 'coach', face: 1, hp: 480, scale: 1.1, speed: 1.1, dmg: 12, moves: { volley: 5, melee: 2, summon: 1 }, projectile: 'clipboard', volley: { count: 3, spread: 24, speed: 6 }, dodge: 0.1, armor: 0.1, summon: ['baller', 'defender'], rage: 1.3, line: 'Tempo! Hora da lição.' },
  // 5. enterradas devastadoras
  { name: 'DUNKER', title: 'O Rival · enterradas devastadoras', sprite: 'dunker', face: -1, hp: 560, scale: 1.12, speed: 1.4, dmg: 16, moves: { slam: 6, dash: 2, combo: 2 }, projectile: 'ball', volley: { count: 1, spread: 0, speed: 7 }, dodge: 0.1, armor: 0.1, slamPower: 1.5, rage: 1.35, line: 'Sente o aro tremer?' },
  // 6. arremessador de bolas rápidas
  { name: 'SHOTGUN', title: 'O Atirador · bolas rápidas', sprite: 'shotgun', face: 0, hp: 520, scale: 1.1, speed: 1.3, dmg: 12, moves: { volley: 7, dash: 1, melee: 1 }, projectile: 'ball', volley: { count: 5, spread: 20, speed: 9 }, dodge: 0.15, armor: 0, rage: 1.3, line: 'Não erro um arremesso.' },
  // 7. mestre dos dribles e fintas
  { name: 'ACE', title: 'O Armador · dribles e fintas', sprite: 'ace', face: 1, hp: 580, scale: 1.06, speed: 2.1, dmg: 13, moves: { teleport: 5, combo: 3, volley: 2 }, projectile: 'ball', volley: { count: 2, spread: 22, speed: 7 }, dodge: 0.5, armor: 0, rage: 1.4, line: 'Você nem vai ver a finta.' },
  // 8. pivô de força extrema
  { name: 'THE BIG', title: 'O Pivô · força extrema', sprite: 'big', face: 0, hp: 820, scale: 1.42, speed: 0.75, dmg: 20, moves: { melee: 5, slam: 4, combo: 2 }, projectile: 'can', volley: { count: 1, spread: 0, speed: 5 }, dodge: 0, armor: 0.45, armorBreaks: true, block: 0.3, slamPower: 1.6, rage: 1.25, line: 'EU. VOU. ESMAGAR.' },
  // 9. jogador de rua imprevisível
  { name: 'HOOPS', title: 'O Estiloso · imprevisível', sprite: 'hoops', face: 0, hp: 680, scale: 1.1, speed: 1.9, dmg: 14, moves: { combo: 3, dash: 3, volley: 3, slam: 2, teleport: 3 }, projectile: 'fire', volley: { count: 3, spread: 26, speed: 6.5 }, dodge: 0.3, armor: 0, chaos: true, spin: true, rage: 1.4, line: 'Nem eu sei o que vou fazer!' },
  // 10. o rei do basquete
  { name: 'KING BALL', title: 'O Chefão · rei do basquete', sprite: 'king', face: 0, hp: 1250, scale: 1.3, speed: 1.6, dmg: 16, moves: { volley: 4, melee: 3, combo: 3, dash: 3, slam: 3, summon: 1, teleport: 1 }, projectile: 'ball', volley: { count: 3, spread: 24, speed: 7.5 }, dodge: 0.2, armor: 0.1, block: 0.15, slamPower: 1.3, summon: ['baller', 'defender', 'runner'], rage: 1.45, line: 'Ajoelhe-se diante do rei!' },
];
