import type { EnemyKind } from './looks';

export type ThemeId = 'streets' | 'subway' | 'industrial' | 'beach' | 'night' | 'court' | 'chinatown' | 'underground' | 'rooftop' | 'arena';
export type PropKind =
  | 'trash' | 'crate' | 'barrel' | 'chair' | 'table' | 'car' | 'barrier' | 'umbrella' | 'surfboard' | 'stall' | 'cone' | 'hydrant'
  | 'machine' | 'bench' | 'ballrack' | 'tank' | 'antenna' | 'dumpster' | 'pot' | 'speaker'
  | 'pallet' | 'tire' | 'spool' | 'crates' | 'vending' | 'moto' | 'bike';
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
  { n: 1, name: 'A QUADRA DA CIDADE', theme: 'streets', length: 2900, gang: 'BRIGÃO DE RUA', palette: { a: '#3d6b35', b: '#34495e', c: '#f1c40f' },
    enemies: [{ kind: 'thug', w: 6 }, { kind: 'runner', w: 3 }], props: ['trash', 'crate', 'hydrant', 'dumpster', 'pallet', 'tire', 'bike'], hazards: [], waves: 4, boss: 0 },
  { n: 2, name: 'O GINÁSIO', theme: 'subway', length: 3100, gang: 'TURMA DO GINÁSIO', palette: { a: '#16a085', b: '#2c3e50', c: '#ecf0f1' },
    enemies: [{ kind: 'thug', w: 4, name: 'TURMA DO GINÁSIO' }, { kind: 'shooter', w: 3 }, { kind: 'runner', w: 3 }], props: ['bench', 'ballrack', 'crate', 'cone', 'vending'], hazards: [], waves: 5, boss: 1 },
  { n: 3, name: 'O CALÇADÃO', theme: 'industrial', length: 3200, gang: 'TURMA DO CALÇADÃO', palette: { a: '#d35400', b: '#4a4f57', c: '#f39c12' },
    enemies: [{ kind: 'heavy', w: 3 }, { kind: 'defender', w: 3 }, { kind: 'thug', w: 4 }], props: ['bench', 'trash', 'hydrant', 'cone', 'bike', 'moto'], hazards: [], waves: 5, boss: 2 },
  { n: 4, name: 'O COLISEU', theme: 'beach', length: 3300, gang: 'GLADIADORES', palette: { a: '#e84393', b: '#0984e3', c: '#ffeaa7' },
    enemies: [{ kind: 'thug', w: 4, name: 'GLADIADOR' }, { kind: 'runner', w: 3 }, { kind: 'biker', w: 2 }], props: ['crate', 'barrel', 'crates', 'pallet', 'spool'], hazards: [], waves: 5, boss: 3 },
  { n: 5, name: 'A CIDADE DO FUTURO', theme: 'night', length: 3400, gang: 'GANGUE NEON', palette: { a: '#8e44ad', b: '#2d3436', c: '#00cec9' },
    enemies: [{ kind: 'thug', w: 3, name: 'GANGUE NEON' }, { kind: 'shooter', w: 2 }, { kind: 'thief', w: 3 }, { kind: 'gangster', w: 2 }], props: ['barrier', 'cone', 'vending', 'machine', 'car', 'moto'], hazards: ['traffic'], waves: 6, boss: 4 },
  { n: 6, name: 'O PALÁCIO', theme: 'court', length: 3400, gang: 'GUARDAS DO PALÁCIO', palette: { a: '#6c5ce7', b: '#2d3436', c: '#ffffff' },
    enemies: [{ kind: 'baller', w: 4 }, { kind: 'defender', w: 3, name: 'GUARDA DO PALÁCIO' }, { kind: 'heavy', w: 2 }], props: ['pot', 'bench', 'table', 'chair', 'crate'], hazards: [], waves: 6, boss: 5 },
  { n: 7, name: 'O ARMAZÉM', theme: 'chinatown', length: 3500, gang: 'TURMA DO ARMAZÉM', palette: { a: '#1e6f5c', b: '#2d3436', c: '#fdcb6e' },
    enemies: [{ kind: 'thug', w: 3, name: 'TURMA DO ARMAZÉM' }, { kind: 'runner', w: 2 }, { kind: 'shooter', w: 2 }, { kind: 'knife', w: 3 }], props: ['barrel', 'crate', 'pallet', 'spool', 'crates', 'machine', 'tire'], hazards: ['steam'], waves: 6, boss: 6 },
  { n: 8, name: 'O TEMPLO', theme: 'underground', length: 3600, gang: 'GUARDIÕES DO TEMPLO', palette: { a: '#636e72', b: '#2d3436', c: '#fab1a0' },
    enemies: [{ kind: 'thug', w: 2, name: 'GUARDIÃO DO TEMPLO' }, { kind: 'biker', w: 3 }, { kind: 'heavy', w: 2 }, { kind: 'gangster', w: 2 }, { kind: 'knife', w: 2 }], props: ['pot', 'table', 'stall', 'crate', 'barrel'], hazards: [], waves: 7, boss: 7 },
  { n: 9, name: 'O TERRAÇO', theme: 'rooftop', length: 3600, gang: 'LUTADORES DE ELITE', palette: { a: '#2d3436', b: '#6c5ce7', c: '#dfe6e9' },
    enemies: [{ kind: 'defender', w: 3, name: 'LUTADOR DE ELITE' }, { kind: 'shooter', w: 3 }, { kind: 'baller', w: 3, name: 'RIVAL DO BASQUETE' }, { kind: 'runner', w: 2 }, { kind: 'knife', w: 2 }], props: ['antenna', 'tank', 'crate', 'speaker', 'machine', 'spool'], hazards: ['gap'], waves: 7, boss: 8 },
  { n: 10, name: 'O PORTO', theme: 'arena', length: 3200, gang: 'GUARDA REAL', palette: { a: '#ffcf33', b: '#1e1e2a', c: '#ffffff' },
    enemies: [{ kind: 'baller', w: 3, name: 'GUARDA REAL' }, { kind: 'defender', w: 3, name: 'GUARDA DE ELITE' }, { kind: 'heavy', w: 2 }, { kind: 'runner', w: 2 }, { kind: 'shooter', w: 2 }, { kind: 'thief', w: 1 }, { kind: 'gangster', w: 2 }, { kind: 'knife', w: 1 }],
    props: ['crates', 'barrel', 'spool', 'pallet', 'tire', 'crate'], hazards: [], waves: 6, boss: 9 },
];
