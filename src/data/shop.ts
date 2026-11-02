/**
 * Loja de artigos de basquete (aparece depois de cada fase).
 * Os preços cabem no que o jogador junta: ~R$ 250–450 por fase (moedas, inimigos, chefe e bônus da fase).
 */
export type Slot = 'tenis' | 'camiseta' | 'bola' | 'munhequeira' | 'bone';

export const SLOT_NAMES: Record<Slot, string> = {
  tenis: 'TÊNIS',
  camiseta: 'CAMISETA',
  bola: 'BOLA',
  munhequeira: 'MUNHEQUEIRA',
  bone: 'BONÉ',
};

/** Bônus de equipamento (somados) */
export interface GearStats {
  /** +% de dano das bolas */
  dmg: number;
  /** % de dano recebido a menos */
  def: number;
  /** +% de velocidade */
  speed: number;
  /** +% de ganho da barra de poder */
  power: number;
  /** +% de dinheiro */
  money: number;
  /** Energia máxima extra */
  hp: number;
}

export const NO_GEAR: GearStats = { dmg: 0, def: 0, speed: 0, power: 0, money: 0, hp: 0 };

export interface ShopItem {
  id: string;
  slot: Slot;
  name: string;
  price: number;
  stats: Partial<GearStats>;
  /** Cor da camiseta (matiz aplicado ao uniforme do herói) */
  hue?: number;
  /** Item de uso único (não vai para a mochila como equipamento) */
  consumable?: 'continue' | 'life';
}

export const SHOP: ShopItem[] = [
  { id: 'tenis1', slot: 'tenis', name: 'Tênis Street', price: 150, stats: { speed: 0.08 } },
  { id: 'tenis2', slot: 'tenis', name: 'Tênis Pro Runner', price: 450, stats: { speed: 0.15, def: 0.05 } },
  { id: 'tenis3', slot: 'tenis', name: 'Tênis Air Lenda', price: 1100, stats: { speed: 0.25, dmg: 0.1 } },
  { id: 'camisa1', slot: 'camiseta', name: 'Regata de Treino', price: 120, stats: { def: 0.1 }, hue: 200 },
  { id: 'camisa2', slot: 'camiseta', name: 'Camisa Pro', price: 400, stats: { def: 0.2 }, hue: 120 },
  { id: 'camisa3', slot: 'camiseta', name: 'Jersey Lendária', price: 1000, stats: { def: 0.3, hp: 20 }, hue: 45 },
  { id: 'bola1', slot: 'bola', name: 'Bola de Couro', price: 180, stats: { dmg: 0.15 } },
  { id: 'bola2', slot: 'bola', name: 'Bola Oficial Pro', price: 500, stats: { dmg: 0.3 } },
  { id: 'bola3', slot: 'bola', name: 'Bola de Fogo', price: 1300, stats: { dmg: 0.5, power: 0.15 } },
  { id: 'munhe1', slot: 'munhequeira', name: 'Munhequeira Simples', price: 100, stats: { power: 0.2 } },
  { id: 'munhe2', slot: 'munhequeira', name: 'Munhequeira Pro', price: 350, stats: { power: 0.4, def: 0.05 } },
  { id: 'bone1', slot: 'bone', name: 'Boné de Rua', price: 90, stats: { money: 0.15 } },
  { id: 'bone2', slot: 'bone', name: 'Boné de Ouro', price: 300, stats: { money: 0.35 } },
  { id: 'vida', slot: 'bone', name: 'Vida Extra (1UP)', price: 250, stats: {}, consumable: 'life' },
  { id: 'ficha', slot: 'bone', name: 'Ficha de Continue', price: 400, stats: {}, consumable: 'continue' },
];

export const itemById = (id: string) => SHOP.find((i) => i.id === id);

/** Texto curto dos bônus de um item */
export function describe(s: Partial<GearStats>) {
  const out: string[] = [];
  if (s.dmg) out.push(`+${Math.round(s.dmg * 100)}% dano`);
  if (s.def) out.push(`-${Math.round(s.def * 100)}% dano sofrido`);
  if (s.speed) out.push(`+${Math.round(s.speed * 100)}% velocidade`);
  if (s.power) out.push(`+${Math.round(s.power * 100)}% poder`);
  if (s.money) out.push(`+${Math.round(s.money * 100)}% dinheiro`);
  if (s.hp) out.push(`+${s.hp} energia`);
  return out.join(' · ');
}

/** Soma os bônus do que está equipado */
export function gearStats(equipped: Partial<Record<Slot, string>>): GearStats {
  const g = { ...NO_GEAR };
  for (const id of Object.values(equipped)) {
    const it = id ? itemById(id) : undefined;
    if (!it) continue;
    for (const [k, v] of Object.entries(it.stats) as [keyof GearStats, number][]) g[k] += v;
  }
  return g;
}

export const money = (n: number) => `R$ ${n.toLocaleString('pt-BR')}`;
