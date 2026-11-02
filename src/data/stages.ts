import type { EnemyKind } from './looks';

export type ThemeId = 'streets' | 'subway' | 'industrial' | 'beach' | 'night' | 'court' | 'chinatown' | 'underground' | 'rooftop' | 'arena';
export type PropKind =
  | 'trash' | 'crate' | 'barrel' | 'chair' | 'table' | 'car' | 'barrier' | 'umbrella' | 'surfboard' | 'stall' | 'cone' | 'hydrant'
  | 'machine' | 'bench' | 'ballrack' | 'tank' | 'antenna' | 'dumpster' | 'pot' | 'speaker';
export type HazardKind = 'train' | 'steam' | 'traffic' | 'gap';

export interface StageDef {
  n: number;
  name: string;
  theme: ThemeId;
  length: number;
  gang: string;
  palette: { a: string; b: string; c: string };
  /** Tipos de inimigo e peso de sorteio; o nome aparece na barra do inimigo */
  enemies: { kind: EnemyKind; w: number; name?: string }[];
  props: PropKind[];
  hazards: HazardKind[];
  waves: number;
  boss: number;
}

export const STAGES: StageDef[] = [
  { n: 1, name: 'THE OLD STREETS', theme: 'streets', length: 2900, gang: 'STREET THUG', palette: { a: '#c0392b', b: '#34495e', c: '#f1c40f' },
    enemies: [{ kind: 'thug', w: 6 }, { kind: 'runner', w: 3 }], props: ['trash', 'crate', 'hydrant', 'dumpster'], hazards: [], waves: 4, boss: 0 },
  { n: 2, name: 'THE SUBWAY', theme: 'subway', length: 3100, gang: 'SUBWAY GANG', palette: { a: '#16a085', b: '#2c3e50', c: '#ecf0f1' },
    enemies: [{ kind: 'thug', w: 4, name: 'SUBWAY GANG' }, { kind: 'shooter', w: 3 }, { kind: 'runner', w: 3 }], props: ['barrier', 'trash', 'bench', 'crate'], hazards: ['train'], waves: 5, boss: 1 },
  { n: 3, name: 'THE INDUSTRIAL ZONE', theme: 'industrial', length: 3200, gang: 'FACTORY CREW', palette: { a: '#d35400', b: '#4a4f57', c: '#f39c12' },
    enemies: [{ kind: 'heavy', w: 3 }, { kind: 'defender', w: 3 }, { kind: 'thug', w: 4 }], props: ['barrel', 'crate', 'machine', 'barrel'], hazards: ['steam'], waves: 5, boss: 2 },
  { n: 4, name: 'THE BEACH', theme: 'beach', length: 3300, gang: 'BEACH FIGHTERS', palette: { a: '#e84393', b: '#0984e3', c: '#ffeaa7' },
    enemies: [{ kind: 'thug', w: 4, name: 'BEACH FIGHTER' }, { kind: 'runner', w: 3 }, { kind: 'biker', w: 2 }], props: ['umbrella', 'chair', 'surfboard', 'crate'], hazards: [], waves: 5, boss: 3 },
  { n: 5, name: 'THE NIGHT CITY', theme: 'night', length: 3400, gang: 'NIGHT GANG', palette: { a: '#8e44ad', b: '#2d3436', c: '#00cec9' },
    enemies: [{ kind: 'thug', w: 3, name: 'NIGHT GANG' }, { kind: 'shooter', w: 3 }, { kind: 'thief', w: 3 }], props: ['car', 'dumpster', 'trash', 'cone'], hazards: ['traffic'], waves: 6, boss: 4 },
  { n: 6, name: 'THE BASKETBALL COURT', theme: 'court', length: 3400, gang: 'COURT RIVALS', palette: { a: '#e17055', b: '#2d3436', c: '#ffffff' },
    enemies: [{ kind: 'baller', w: 4 }, { kind: 'defender', w: 3 }, { kind: 'heavy', w: 2 }], props: ['bench', 'ballrack', 'crate', 'cone'], hazards: [], waves: 6, boss: 5 },
  { n: 7, name: 'THE CHINATOWN', theme: 'chinatown', length: 3500, gang: 'CHINATOWN FIGHTERS', palette: { a: '#d63031', b: '#2d3436', c: '#fdcb6e' },
    enemies: [{ kind: 'thug', w: 4, name: 'CHINATOWN FIGHTER' }, { kind: 'runner', w: 3 }, { kind: 'shooter', w: 3 }], props: ['table', 'stall', 'pot', 'crate'], hazards: [], waves: 6, boss: 6 },
  { n: 8, name: 'THE UNDERGROUND', theme: 'underground', length: 3600, gang: 'UNDERGROUND GANG', palette: { a: '#636e72', b: '#2d3436', c: '#fab1a0' },
    enemies: [{ kind: 'thug', w: 3, name: 'UNDERGROUND GANG' }, { kind: 'biker', w: 3 }, { kind: 'heavy', w: 3 }], props: ['car', 'barrier', 'barrel', 'cone'], hazards: ['traffic'], waves: 7, boss: 7 },
  { n: 9, name: 'THE ROOFTOP', theme: 'rooftop', length: 3600, gang: 'ELITE FIGHTERS', palette: { a: '#2d3436', b: '#6c5ce7', c: '#dfe6e9' },
    enemies: [{ kind: 'defender', w: 3, name: 'ELITE FIGHTER' }, { kind: 'shooter', w: 3 }, { kind: 'baller', w: 3, name: 'BASKETBALL RIVAL' }, { kind: 'runner', w: 2 }], props: ['antenna', 'tank', 'crate', 'speaker'], hazards: ['gap'], waves: 7, boss: 8 },
  { n: 10, name: 'THE FINAL ARENA', theme: 'arena', length: 3200, gang: 'ROYAL GUARD', palette: { a: '#ffcf33', b: '#1e1e2a', c: '#ffffff' },
    enemies: [{ kind: 'baller', w: 3, name: 'ROYAL GUARD' }, { kind: 'defender', w: 3, name: 'ELITE GUARD' }, { kind: 'heavy', w: 2 }, { kind: 'runner', w: 2 }, { kind: 'shooter', w: 2 }, { kind: 'thief', w: 1 }],
    props: ['ballrack', 'speaker', 'bench', 'crate'], hazards: [], waves: 6, boss: 9 },
];
