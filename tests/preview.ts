// Página de conferência visual dos personagens (só desenvolvimento)
import { drawFighter } from '../src/render/fighter';
import { poseFor, type Anim } from '../src/render/poses';
import { BOSS_LOOKS, HERO, enemyLook, type EnemyKind } from '../src/data/looks';

const c = document.getElementById('c') as HTMLCanvasElement;
const S = 2;
c.width = 1500 * S;
c.height = 760 * S;
c.style.width = '1500px';
const ctx = c.getContext('2d')!;
ctx.scale(S, S);
ctx.fillStyle = '#5a6375';
ctx.fillRect(0, 0, 1500, 760);
const anims: Anim[] = ['idle', 'walk', 'run', 'windup', 'throw', 'charge', 'hurt', 'pushed', 'fall', 'ko', 'getup', 'celebrate'];
anims.forEach((a, i) => {
  const ball = a === 'idle' || a === 'walk' || a === 'run' ? 'dribble' : a === 'windup' ? 'hand' : a === 'celebrate' ? 'overhead' : 'none';
  drawFighter(ctx, 60 + i * 118, 170, HERO, poseFor(a, 12, { ball, progress: 0.6 }), { facing: 1, scale: 2 });
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(a, 30 + i * 118, 195);
});
const kinds: EnemyKind[] = ['thug', 'runner', 'heavy', 'thief', 'shooter', 'defender', 'biker', 'baller'];
const pal = { a: '#c0392b', b: '#2c3e50', c: '#f1c40f' };
const enemyAnims: Anim[] = ['idle', 'walk', 'punch', 'kick', 'idle', 'block', 'ride', 'shoot'];
kinds.forEach((k, i) => {
  drawFighter(ctx, 70 + i * 160, 420, enemyLook(k, pal, i + 1), poseFor(enemyAnims[i], 10), { facing: -1, scale: 2 });
  ctx.fillStyle = '#fff';
  ctx.fillText(k, 40 + i * 160, 445);
});
BOSS_LOOKS.forEach((l, i) => {
  drawFighter(ctx, 70 + i * 145, 700, l, poseFor(i % 2 ? 'punch' : 'idle', 8, { expr: 'angry' }), { facing: -1, scale: 2.1 });
});
