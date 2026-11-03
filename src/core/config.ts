/** Resolução lógica do jogo (16:9). Tudo é desenhado nessas coordenadas e escalado para a tela. */
export const W = 640;
export const H = 360;
/** Faixa do chão onde os personagens andam (profundidade): topo = fundo da rua, base = perto da câmera */
/** Linha do chão desenhada no cenário (pé das fachadas) */
export const ART_FLOOR = 236;
/** Topo da área onde se anda: 10% da tela abaixo do pé das fachadas, para ninguém passar por cima das partes fixas do cenário */
export const FLOOR_TOP = ART_FLOOR + Math.round(H * 0.1);
export const FLOOR_BOTTOM = 348;
export const STEP = 1 / 60;
/** Tamanho de personagens e objetos do cenário (1 = original; 1,2 = 20% maiores) */
export const SIZE = 1.2;
/** O jogador principal é 10% maior que os outros personagens */
export const HERO_SIZE = SIZE * 1.1;

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY: Record<Difficulty, { enemyHp: number; enemyDmg: number; aggression: number; lives: number }> = {
  easy: { enemyHp: 0.8, enemyDmg: 0.6, aggression: 0.75, lives: 5 },
  normal: { enemyHp: 1, enemyDmg: 1, aggression: 1, lives: 3 },
  hard: { enemyHp: 1.25, enemyDmg: 1.35, aggression: 1.3, lives: 2 },
};
