import type { Difficulty } from './config';

export interface SaveData {
  unlocked: number;
  best: number;
  music: boolean;
  sfx: boolean;
  difficulty: Difficulty;
  touch: 'auto' | 'on' | 'off';
}

const KEY = 'street-basketball-fight:v1';
const DEFAULTS: SaveData = { unlocked: 1, best: 0, music: true, sfx: true, difficulty: 'normal', touch: 'auto' };

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
