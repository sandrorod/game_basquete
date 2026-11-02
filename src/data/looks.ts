import { BUILDS, type Look } from '../render/fighter';

/** STREET PLAYER — o protagonista */
export const HERO: Look = {
  skin: '#8d5a36', hair: '#1a110c', hairStyle: 'dreads', top: '#d81f2a', trim: '#ffffff', topStyle: 'tank', number: '23',
  bottom: '#d81f2a', bottomStyle: 'shorts', shoe: '#f4f4f4', shoeAccent: '#d81f2a', sock: '#ffffff',
  build: { sw: 11.2, hw: 7.2, armR: 3.8, legR: 4, belly: 0, tall: 1.05 }, headband: '#e11d2a', wrist: '#1a1a1a',
};

const SKINS = ['#f1c7a0', '#d9a074', '#b5754a', '#8a5432', '#5e3a24', '#e9b98f'];
const HAIRS = ['#1b1210', '#3a2416', '#6b4423', '#b88a3a', '#d8d0c0', '#20202a'];

export type EnemyKind = 'thug' | 'runner' | 'heavy' | 'thief' | 'shooter' | 'defender' | 'biker' | 'baller';

/** Visual base de cada tipo de inimigo; cada fase troca as cores (gangues diferentes). */
export function enemyLook(kind: EnemyKind, palette: { a: string; b: string; c: string }, seed: number): Look {
  const skin = SKINS[seed % SKINS.length];
  const hair = HAIRS[(seed * 7) % HAIRS.length];
  const common = { skin, hair, shoe: '#2a2a2a', sock: '#dddddd' };
  switch (kind) {
    case 'thug':
      return { ...common, hairStyle: (['short', 'buzz', 'spiky'] as const)[seed % 3], top: palette.a, trim: palette.c, topStyle: 'tee', bottom: '#2b3445', bottomStyle: 'pants', build: BUILDS.normal, bandana: seed % 2 ? palette.c : undefined };
    case 'runner':
      return { ...common, hairStyle: 'mohawk', hair: palette.c, top: palette.b, trim: palette.a, topStyle: 'tank', bottom: '#1e1e26', bottomStyle: 'shorts', build: BUILDS.slim, shoe: palette.c, wrist: palette.a };
    case 'heavy':
      return { ...common, hairStyle: 'bald', top: palette.a, trim: palette.b, topStyle: 'vest', bottom: '#3b2f2a', bottomStyle: 'pants', build: BUILDS.huge, beard: true, chain: true, gloves: '#2b2b2b' };
    case 'thief':
      return { ...common, hairStyle: 'short', top: '#2c2c36', trim: palette.c, topStyle: 'jacket', bottom: '#22222a', bottomStyle: 'pants', build: BUILDS.slim, cap: palette.c, capBack: true, gloves: '#111111' };
    case 'shooter':
      return { ...common, hairStyle: 'long', top: palette.b, trim: palette.a, topStyle: 'jacket', bottom: '#2a3140', bottomStyle: 'pants', build: BUILDS.normal, shades: '#111111' };
    case 'defender':
      return { ...common, hairStyle: 'buzz', top: palette.c, trim: '#ffffff', topStyle: 'tee', bottom: palette.a, bottomStyle: 'pants', build: BUILDS.big, gloves: palette.a, armor: '#6d7480' };
    case 'biker':
      return { ...common, hairStyle: 'long', top: '#1b1b1f', trim: palette.a, topStyle: 'jacket', bottom: '#26262e', bottomStyle: 'pants', build: BUILDS.normal, bandana: palette.a, shades: '#222222', gloves: '#111111' };
    case 'baller':
      return { ...common, hairStyle: (['afro', 'topknot', 'short'] as const)[seed % 3], top: palette.a, trim: palette.c, topStyle: 'tank', number: String(10 + (seed % 89)), bottom: palette.a, bottomStyle: 'shorts', build: BUILDS.athletic, headband: palette.c, sock: '#ffffff', shoe: palette.b };
  }
}

/** Os 10 chefes, cada um com aparência própria */
export const BOSS_LOOKS: Look[] = [
  // 1 BIG MIKE
  { skin: '#e2a77a', hair: '#5a3418', hairStyle: 'bald', top: '#c8341f', trim: '#f1e2c2', topStyle: 'vest', bottom: '#2c3a5a', bottomStyle: 'pants', shoe: '#3a2a1f', sock: '#ddd', build: BUILDS.huge, beard: true, chain: true, gloves: '#3a2a1f' },
  // 2 TRAIN MASTER
  { skin: '#8a5432', hair: '#1b1210', hairStyle: 'short', top: '#2f4f8f', trim: '#ffcc33', topStyle: 'jacket', bottom: '#1f2a44', bottomStyle: 'pants', shoe: '#111', sock: '#ddd', build: BUILDS.big, cap: '#1f2a44', shades: '#ffcc33', gloves: '#ffcc33' },
  // 3 IRON JACK
  { skin: '#d9a074', hair: '#3a3a3a', hairStyle: 'buzz', top: '#4a4f57', trim: '#ff7a1a', topStyle: 'tee', bottom: '#3d3328', bottomStyle: 'pants', shoe: '#222', sock: '#ddd', build: BUILDS.huge, armor: '#9aa3ad', gloves: '#6d7480', beard: true },
  // 4 SHARK
  { skin: '#b5754a', hair: '#3a76c7', hairStyle: 'mohawk', top: '#0f6f8f', trim: '#e9f5ff', topStyle: 'bare', bottom: '#0e8fa5', bottomStyle: 'shorts', shoe: '#e9f5ff', sock: '#e9f5ff', build: BUILDS.athletic, wrist: '#e9f5ff', shades: '#0a2a3a' },
  // 5 NEON KING
  { skin: '#5e3a24', hair: '#ff3fd2', hairStyle: 'afro', top: '#7d2bd6', trim: '#38f6ff', topStyle: 'jacket', number: '00', bottom: '#2a1640', bottomStyle: 'shorts', shoe: '#38f6ff', sock: '#ff3fd2', build: BUILDS.athletic, shades: '#38f6ff', chain: true },
  // 6 DUNK MASTER
  { skin: '#4e301d', hair: '#111', hairStyle: 'short', top: '#ffb000', trim: '#7a2b00', topStyle: 'tank', number: '99', bottom: '#ffb000', bottomStyle: 'shorts', shoe: '#7a2b00', sock: '#fff', build: { ...BUILDS.big, tall: 1.15 }, headband: '#7a2b00', wrist: '#7a2b00' },
  // 7 DRAGON
  { skin: '#e9b98f', hair: '#111', hairStyle: 'topknot', top: '#c41e2a', trim: '#ffd23f', topStyle: 'gi', bottom: '#111', bottomStyle: 'pants', shoe: '#111', sock: '#111', build: BUILDS.athletic, headband: '#ffd23f', wrist: '#ffd23f' },
  // 8 THE MACHINE
  { skin: '#9aa3ad', hair: '#333', hairStyle: 'bald', top: '#3a3f47', trim: '#ff3355', topStyle: 'vest', bottom: '#2a2e35', bottomStyle: 'pants', shoe: '#555', sock: '#555', build: BUILDS.huge, armor: '#c4ccd6', gloves: '#c4ccd6', mask: '#5a616b', eyeGlow: '#ff3355' },
  // 9 SHADOW
  { skin: '#2b2b33', hair: '#0b0b10', hairStyle: 'short', top: '#14141c', trim: '#7d5cff', topStyle: 'gi', bottom: '#0e0e14', bottomStyle: 'pants', shoe: '#0e0e14', sock: '#0e0e14', build: BUILDS.slim, mask: '#14141c', eyeGlow: '#a98bff' },
  // 10 THE KING
  { skin: '#7a4a2c', hair: '#111', hairStyle: 'short', top: '#ffffff', trim: '#ffcf33', topStyle: 'tank', number: '1', bottom: '#ffffff', bottomStyle: 'shorts', shoe: '#ffcf33', sock: '#ffffff', build: { ...BUILDS.athletic, tall: 1.08 }, crown: true, chain: true, wrist: '#ffcf33', beard: true },
];
