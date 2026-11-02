/** Prêmios que saem dos tambores, caixas e lixeiras (art/items-sheet.png). */
export type PickupKind =
  | 'burger' | 'fries' | 'pizza' | 'soda' | 'star'
  | 'coin' | 'diamond' | 'heart' | 'lightning' | 'trophy'
  | 'gift' | 'medkit' | 'potion_blue' | 'potion_purple' | 'crown'
  | 'rocket' | 'glove' | 'mushroom' | 'shield' | 'magnet';

export interface PickupDef {
  /** Nome mostrado ao pegar */
  label: string;
  /** Altura na tela (unidades lógicas) */
  size: number;
  /** Peso no sorteio do drop (0 = nunca sai sozinho) */
  w: number;
  heal?: number;
  money?: number;
  points?: number;
  power?: number;
  /** Efeito temporário (quadros) */
  buff?: 'shield' | 'glove' | 'rocket' | 'magnet';
  buffT?: number;
  oneUp?: boolean;
  continueToken?: boolean;
  random?: boolean;
  color: string;
}

export const PICKUPS: Record<PickupKind, PickupDef> = {
  burger: { label: 'HAMBÚRGUER', size: 18, w: 14, heal: 30, color: '#7cff6b' },
  fries: { label: 'BATATA FRITA', size: 18, w: 14, heal: 18, color: '#7cff6b' },
  pizza: { label: 'PIZZA', size: 18, w: 12, heal: 24, color: '#7cff6b' },
  soda: { label: 'REFRIGERANTE', size: 18, w: 14, heal: 12, power: 0.1, color: '#7cff6b' },
  star: { label: 'ESTRELA', size: 18, w: 8, points: 1000, power: 0.3, color: '#ffd23f' },
  coin: { label: 'MOEDA', size: 15, w: 22, money: 10, color: '#ffd23f' },
  diamond: { label: 'DIAMANTE', size: 15, w: 4, money: 50, color: '#38f6ff' },
  heart: { label: 'CORAÇÃO', size: 17, w: 5, heal: 50, color: '#ff6b6b' },
  lightning: { label: 'RAIO', size: 18, w: 6, power: 0.5, color: '#ffd23f' },
  trophy: { label: 'TROFÉU', size: 19, w: 3, points: 3000, money: 25, color: '#ffd23f' },
  gift: { label: 'PRESENTE', size: 18, w: 4, random: true, color: '#ff8ad8' },
  medkit: { label: 'KIT MÉDICO', size: 17, w: 3, heal: 100, color: '#7cff6b' },
  potion_blue: { label: 'POÇÃO AZUL', size: 19, w: 3, buff: 'shield', buffT: 360, color: '#38f6ff' },
  potion_purple: { label: 'POÇÃO ROXA', size: 19, w: 3, power: 1, color: '#c9b6ff' },
  crown: { label: 'FICHA DE CONTINUE', size: 18, w: 0.6, continueToken: true, color: '#ffd23f' },
  rocket: { label: 'TURBO', size: 20, w: 2, buff: 'rocket', buffT: 600, color: '#ff9f1c' },
  glove: { label: 'LUVA DE FORÇA', size: 18, w: 2, buff: 'glove', buffT: 600, color: '#ff4d4d' },
  mushroom: { label: '1UP', size: 18, w: 1, oneUp: true, color: '#7cff6b' },
  shield: { label: 'ESCUDO', size: 19, w: 2, buff: 'shield', buffT: 480, color: '#7cff6b' },
  magnet: { label: 'ÍMÃ', size: 18, w: 2, buff: 'magnet', buffT: 900, color: '#ff6b6b' },
};

/** Sorteia um prêmio pelos pesos */
export function rollPickup(r = Math.random()): PickupKind {
  const list = Object.entries(PICKUPS) as [PickupKind, PickupDef][];
  const total = list.reduce((a, [, d]) => a + d.w, 0);
  let x = r * total;
  for (const [k, d] of list) {
    x -= d.w;
    if (x <= 0) return k;
  }
  return 'coin';
}
