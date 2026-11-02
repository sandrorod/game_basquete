import { approach, clamp, rng } from '../src/core/math';
import { Input } from '../src/core/input';
import { Obstacle, resolveObstacles } from '../src/game/obstacle';
import { STAGES } from '../src/data/stages';
import { BOSSES } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { BOSS_LOOKS } from '../src/data/looks';

const fakeWindow = { addEventListener: () => {} } as unknown as Window;

describe('matemática', () => {
  it('sorteio com semente é reproduzível (cenários iguais a cada vez)', () => {
    const a = rng(42), b = rng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });
  it('clamp e approach', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(10, 0, 30)).toBe(0);
  });
});

describe('colisão com obstáculos', () => {
  it('empurra o personagem para fora de um obstáculo sólido', () => {
    const car = new Obstacle('car', 500, 280, '#f00');
    const a = { x: 500, y: 275, z: 0 };
    resolveObstacles(a, [car]);
    const f = car.footprint();
    const inside = a.x + 8 > f.x0 && a.x - 8 < f.x1 && a.y + 4 > f.y0 && a.y - 4 < f.y1;
    expect(inside).toBe(false);
  });
  it('obstáculo quebrado não bloqueia e quem está no ar passa por cima', () => {
    const crate = new Obstacle('crate', 300, 300, '#000');
    crate.broken = true;
    const a = { x: 300, y: 296, z: 0 };
    resolveObstacles(a, [crate]);
    expect(a).toEqual({ x: 300, y: 296, z: 0 });
    const b = { x: 300, y: 296, z: 40 };
    resolveObstacles(b, [new Obstacle('crate', 300, 300, '#000')]);
    expect(b.x).toBe(300);
  });
});

describe('controles', () => {
  it('diagonal normalizada e "apertou" só no primeiro quadro', () => {
    const inp = new Input(fakeWindow);
    inp.press('right');
    inp.press('down');
    const ax = inp.axis();
    expect(Math.hypot(ax.x, ax.y)).toBeCloseTo(1, 5);
    expect(inp.wasPressed('right')).toBe(true);
    inp.endFrame();
    expect(inp.wasPressed('right')).toBe(false);
    expect(inp.isHeld('right')).toBe(true);
  });
  it('analógico virtual com zona morta', () => {
    const inp = new Input(fakeWindow);
    inp.stick = { x: 0.1, y: 0.05 };
    expect(inp.axis()).toEqual({ x: 0, y: 0 });
    inp.stick = { x: 0.8, y: 0 };
    expect(inp.axis().x).toBeCloseTo(0.8);
  });
});

describe('dados do jogo', () => {
  it('10 fases, cenários e chefes diferentes, cada uma com inimigos próprios', () => {
    expect(STAGES).toHaveLength(10);
    expect(new Set(STAGES.map((s) => s.theme)).size).toBe(10);
    expect(STAGES.map((s) => s.boss)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const s of STAGES) {
      expect(s.enemies.length).toBeGreaterThanOrEqual(2);
      for (const e of s.enemies) expect(ENEMIES[e.kind]).toBeDefined();
    }
  });
  it('chefes com estratégias diferentes (não só "mais vida")', () => {
    expect(BOSSES).toHaveLength(10);
    expect(BOSS_LOOKS).toHaveLength(10);
    const signatures = BOSSES.map((b) => Object.keys(b.moves).sort().join(',') + '|' + b.projectile + '|' + (b.dodge > 0) + '|' + (b.armor > 0));
    expect(new Set(signatures).size).toBe(10);
    // o chefe final é a luta mais longa
    expect(Math.max(...BOSSES.map((b) => b.hp))).toBe(BOSSES[9].hp);
  });
  it('dificuldade cresce: fases mais longas e com mais ondas', () => {
    expect(STAGES[9].waves).toBeGreaterThan(STAGES[0].waves);
    expect(STAGES[8].length).toBeGreaterThan(STAGES[0].length);
  });
});
