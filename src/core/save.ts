import type { Difficulty } from './config';
import type { Slot } from '../data/shop';

export interface RankEntry {
  name: string;
  score: number;
  stage: number;
}

export interface SaveData {
  unlocked: number;
  best: number;
  music: boolean;
  sfx: boolean;
  difficulty: Difficulty;
  touch: 'auto' | 'on' | 'off';
  /** Dinheiro juntado (moedas, inimigos, chefes, bônus) */
  money: number;
  /** Itens comprados na loja (mochila) */
  owned: string[];
  /** O que o herói está usando, por parte do corpo */
  equipped: Partial<Record<Slot, string>>;
  /** Fichas de continue (coroa ou loja) */
  continues: number;
  /** 10 maiores placares */
  ranking: RankEntry[];
}

const KEY = 'street-basketball-fight:v1';
const DEFAULTS: SaveData = { unlocked: 1, best: 0, music: true, sfx: true, difficulty: 'normal', touch: 'auto', money: 0, owned: [], equipped: {}, continues: 0, ranking: [] };

/** Progresso e opções no navegador (sobrevive a recarregar a página). */
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* armazenamento indisponível: o jogo continua, só não lembra */
  }
}

/** Posição que o placar ocuparia no ranking (−1 se não entra entre os 10) */
export function rankPosition(save: SaveData, score: number) {
  if (score <= 0) return -1;
  const i = save.ranking.findIndex((r) => score > r.score);
  if (i >= 0) return i;
  return save.ranking.length < 10 ? save.ranking.length : -1;
}

export function addRank(save: SaveData, entry: RankEntry) {
  save.ranking = [...save.ranking, entry].sort((a, b) => b.score - a.score).slice(0, 10);
  save.best = Math.max(save.best, entry.score);
  writeSave(save);
}
