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
  bone: 'FAIXA',
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
  /** Cor do item: na loja e no herói durante o jogo (camiseta, tênis, faixa, bola, brilho da munhequeira) */
  color?: string;
  /** Matiz da cor (0–360) usado para recolorir o uniforme, o tênis e a faixa do herói */
  hue?: number;
  /** Item de uso único (não vai para a mochila como equipamento) */
  consumable?: 'continue' | 'life';
}

export const SHOP: ShopItem[] = [
  { id: 'tenis1', slot: 'tenis', name: 'Tênis Street Azul', price: 150, stats: { speed: 0.08 }, color: '#2d7dff', hue: 215 },
  { id: 'tenis2', slot: 'tenis', name: 'Tênis Pro Runner Verde', price: 450, stats: { speed: 0.15, def: 0.05 }, color: '#2ee86a', hue: 135 },
  { id: 'tenis3', slot: 'tenis', name: 'Tênis Air Lenda Dourado', price: 1100, stats: { speed: 0.25, dmg: 0.1 }, color: '#ffcf33', hue: 45 },
  { id: 'camisa1', slot: 'camiseta', name: 'Regata de Treino Azul', price: 120, stats: { def: 0.1 }, color: '#2d7dff', hue: 215 },
  { id: 'camisa2', slot: 'camiseta', name: 'Camisa Pro Verde', price: 400, stats: { def: 0.2 }, color: '#2ee86a', hue: 135 },
  { id: 'camisa3', slot: 'camiseta', name: 'Jersey Lendária Dourada', price: 1000, stats: { def: 0.3, hp: 20 }, color: '#ffcf33', hue: 45 },
  { id: 'bola1', slot: 'bola', name: 'Bola de Couro Marrom', price: 180, stats: { dmg: 0.15 }, color: '#8b5a2b' },
  { id: 'bola2', slot: 'bola', name: 'Bola Oficial Pro Azul', price: 500, stats: { dmg: 0.3 }, color: '#2d7dff' },
  { id: 'bola3', slot: 'bola', name: 'Bola de Fogo Vermelha', price: 1300, stats: { dmg: 0.5, power: 0.15 }, color: '#ff3b1f' },
  { id: 'munhe1', slot: 'munhequeira', name: 'Munhequeira Amarela', price: 100, stats: { power: 0.2 }, color: '#ffd23f' },
  { id: 'munhe2', slot: 'munhequeira', name: 'Munhequeira Pro Roxa', price: 350, stats: { power: 0.4, def: 0.05 }, color: '#a45cff' },
  { id: 'bone1', slot: 'bone', name: 'Faixa de Rua Preta', price: 90, stats: { money: 0.15 }, color: '#2a2a2a', hue: -1 },
  { id: 'bone2', slot: 'bone', name: 'Faixa de Ouro', price: 300, stats: { money: 0.35 }, color: '#ffcf33', hue: 45 },
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

/** Cores do que está equipado (visual do herói durante o jogo) */
export function gearLook(equipped: Partial<Record<Slot, string>>) {
  const it = (slot: Slot) => (equipped[slot] ? itemById(equipped[slot]!) : undefined);
  return { shirt: it('camiseta')?.hue, shoes: it('tenis')?.hue, head: it('bone')?.hue, ball: it('bola')?.color, wrist: it('munhequeira')?.color };
}

export const money = (n: number) => `R$ ${n.toLocaleString('pt-BR')}`;
