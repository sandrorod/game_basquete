import { shade } from '../core/math';

/**
 * Renderizador de lutadores com esqueleto articulado (estilo sprite de fliperama, desenhado em Canvas).
 * Coordenadas locais: origem nos pés, +x para a frente do personagem, −y para cima.
 */

export type Expr = 'normal' | 'angry' | 'hurt' | 'happy' | 'ko' | 'focus';
export type HairStyle = 'short' | 'afro' | 'mohawk' | 'bald' | 'buzz' | 'long' | 'cornrows' | 'topknot' | 'spiky' | 'dreads';
export type TopStyle = 'tank' | 'tee' | 'jacket' | 'vest' | 'bare' | 'gi';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  trim: string;
  topStyle: TopStyle;
  number?: string;
  bottom: string;
  bottomStyle: 'shorts' | 'pants';
  shoe: string;
  /** Detalhe colorido do tênis (cano alto) */
  shoeAccent?: string;
  sock: string;
  build: { sw: number; hw: number; armR: number; legR: number; belly: number; tall: number };
  cap?: string;
  capBack?: boolean;
  headband?: string;
  bandana?: string;
  shades?: string;
  chain?: boolean;
  gloves?: string;
  wrist?: string;
  beard?: boolean;
  mask?: string;
  crown?: boolean;
  armor?: string;
  eyeGlow?: string;
}

export interface Pose {
  lean: number;
  head: number;
  aF: number; eF: number;
  aB: number; eB: number;
  lF: number; kF: number;
  lB: number; kB: number;
  lift: number;
  rot: number;
  expr: Expr;
  /** Bola: na mão da frente, acima da cabeça, quicando ou sem bola */
  ball: 'hand' | 'overhead' | 'dribble' | 'none';
  dribble: number;
  ballSpin: number;
}

export const BASE_POSE: Pose = {
  lean: 0.05, head: 0, aF: 0.2, eF: 0.5, aB: -0.15, eB: 0.4, lF: 0.12, kF: 0.1, lB: -0.1, kB: 0.12,
  lift: 0, rot: 0, expr: 'normal', ball: 'none', dribble: 0, ballSpin: 0,
};

export const BUILDS = {
  slim: { sw: 8.5, hw: 6.5, armR: 2.6, legR: 3.2, belly: 0, tall: 1.04 },
  normal: { sw: 9.5, hw: 7, armR: 3, legR: 3.6, belly: 0, tall: 1 },
  athletic: { sw: 10.5, hw: 7, armR: 3.4, legR: 3.8, belly: 0, tall: 1.03 },
  big: { sw: 12.5, hw: 9, armR: 4.2, legR: 4.6, belly: 3, tall: 1.02 },
  huge: { sw: 14.5, hw: 10.5, armR: 5, legR: 5.2, belly: 5, tall: 1.05 },
};

const OUTLINE = '#15121c';
const THIGH = 16, SHIN = 16, TORSO = 22, UPPER = 12.5, FORE = 12, HEAD_R = 7.2;

const dir = (a: number) => ({ x: Math.sin(a), y: Math.cos(a) });

interface Opts {
  facing: 1 | -1;
  scale: number;
  flash?: boolean;
  alpha?: number;
  /** Sombra desenhada separadamente (no chão), exceto quando pedido aqui */
  tint?: string;
}

/** Linha grossa com contorno (membros) */
function limb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, r: number, color: string, flash: boolean) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = r * 2 + 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = flash ? '#ffffff' : color;
  ctx.lineWidth = r * 2;
  ctx.stroke();
  if (!flash) {
    // brilho: faixa clara no lado de cima
    ctx.strokeStyle = shade(color, 0.28);
    ctx.lineWidth = Math.max(0.8, r * 0.7);
    ctx.beginPath();
    ctx.moveTo(x1 - r * 0.35, y1 - r * 0.25);
    ctx.lineTo(x2 - r * 0.35, y2 - r * 0.25);
    ctx.stroke();
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke = true) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, glow?: string) {
  ctx.save();
  ctx.translate(x, y);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
  }
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffb35c');
  g.addColorStop(0.6, '#f07818');
  g.addColorStop(1, '#a8460a');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(0.8, r * 0.14);
  ctx.strokeStyle = '#2a1408';
  ctx.stroke();
  // Costuras girando
  ctx.rotate(spin);
  ctx.lineWidth = Math.max(0.6, r * 0.11);
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-r * 0.95, 0, r * 0.55, r * 0.95, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(r * 0.95, 0, r * 0.55, r * 0.95, 0, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.stroke();
  ctx.restore();
}

/** Desenha o lutador com os pés em (x, y) na tela. */
export function drawFighter(ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, pose: Pose, o: Opts) {
  const fl = !!o.flash;
  const C = (c: string) => (fl ? '#ffffff' : c);
  const b = look.build;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.scale(o.facing * o.scale, o.scale);
  if (pose.rot) ctx.rotate(pose.rot);
  ctx.lineJoin = 'round';

  const th = THIGH * b.tall, sh = SHIN * b.tall, to = TORSO * b.tall;
  const legH = (l: number, k: number) => th * Math.cos(l) + sh * Math.cos(l - k);
  const hipY = -(Math.max(legH(pose.lF, pose.kF), legH(pose.lB, pose.kB)) + pose.lift);
  const hip = { x: 0, y: hipY };
  const tdir = { x: Math.sin(pose.lean), y: -Math.cos(pose.lean) };
  const shoulder = { x: hip.x + tdir.x * to, y: hip.y + tdir.y * to };
  const skinD = shade(look.skin, -0.25);

  const leg = (l: number, k: number, back: boolean) => {
    const d1 = dir(l), d2 = dir(l - k);
    const hx = hip.x + (back ? -1.5 : 1.5);
    const knee = { x: hx + d1.x * th, y: hip.y + d1.y * th };
    const foot = { x: knee.x + d2.x * sh, y: knee.y + d2.y * sh };
    const dk = back ? -0.22 : 0;
    const pants = look.bottomStyle === 'pants';
    // coxa (shorts largos até o joelho) e canela
    limb(ctx, knee.x, knee.y, foot.x, foot.y, b.legR * 0.85, shade(pants ? look.bottom : look.skin, dk), fl);
    if (!pants) {
      // meião
      const sx = knee.x + (foot.x - knee.x) * 0.55, sy = knee.y + (foot.y - knee.y) * 0.55;
      limb(ctx, sx, sy, foot.x, foot.y - 1, b.legR * 0.88, shade(look.sock, dk), fl);
    }
    limb(ctx, hx, hip.y, knee.x, knee.y, b.legR * (pants ? 1 : 1.25), shade(look.bottom, dk), fl);
    // tênis
    ctx.save();
    ctx.translate(foot.x, foot.y);
    ctx.rotate(-(l - k) * 0.4);
    ctx.beginPath();
    ctx.moveTo(-3.2, -2.6);
    ctx.lineTo(4.5, -2.4);
    ctx.quadraticCurveTo(8.2, -1.6, 8, 1.2);
    ctx.lineTo(-3.8, 1.4);
    ctx.closePath();
    ctx.fillStyle = C(shade(look.shoe, dk));
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.fillStyle = C('#f4f4f4');
    ctx.fillRect(-3.6, 0, 11.4, 1.6);
    if (look.shoeAccent) {
      // cano alto + faixa colorida
      ctx.fillStyle = C(shade(look.shoe, dk));
      ctx.fillRect(-3.4, -5.2, 6, 3);
      ctx.strokeRect(-3.4, -5.2, 6, 3);
      ctx.fillStyle = C(shade(look.shoeAccent, dk));
      ctx.beginPath();
      ctx.moveTo(-2.6, -1.2);
      ctx.quadraticCurveTo(2.5, -3.2, 6.6, -1.4);
      ctx.lineTo(6, -0.4);
      ctx.quadraticCurveTo(2.5, -1.8, -2.6, -0.2);
      ctx.fill();
      ctx.fillRect(-3.4, -5.2, 6, 1.2);
    } else {
      ctx.fillStyle = C(shade(look.shoe, 0.35));
      ctx.fillRect(0, -2.2, 3, 1);
    }
    ctx.restore();
  };

  const arm = (a: number, e: number, back: boolean, holding: boolean) => {
    const sx = shoulder.x + (back ? -b.sw * 0.45 : b.sw * 0.35);
    const sy = shoulder.y + 2;
    const d1 = dir(a + pose.lean), d2 = dir(a + e + pose.lean);
    const el = { x: sx + d1.x * UPPER, y: sy + d1.y * UPPER };
    const hand = { x: el.x + d2.x * FORE, y: el.y + d2.y * FORE };
    const dk = back ? -0.25 : 0;
    const sleeve = look.topStyle === 'jacket' || look.topStyle === 'gi';
    const tee = look.topStyle === 'tee' || look.topStyle === 'vest';
    const armColor = shade(sleeve ? look.top : look.skin, dk);
    limb(ctx, sx, sy, el.x, el.y, b.armR, armColor, fl);
    if (tee) limb(ctx, sx, sy, sx + d1.x * UPPER * 0.45, sy + d1.y * UPPER * 0.45, b.armR * 1.15, shade(look.top, dk), fl);
    if (look.armor && !back) limb(ctx, sx, sy, sx + d1.x * UPPER * 0.6, sy + d1.y * UPPER * 0.6, b.armR * 1.35, look.armor, fl);
    limb(ctx, el.x, el.y, hand.x, hand.y, b.armR * 0.9, shade(sleeve ? look.top : look.skin, dk), fl);
    if (look.wrist) limb(ctx, el.x + d2.x * FORE * 0.7, el.y + d2.y * FORE * 0.7, hand.x - d2.x, hand.y - d2.y, b.armR * 0.95, look.wrist, fl);
    circle(ctx, hand.x, hand.y, b.armR * 1.05, C(shade(look.gloves ?? look.skin, dk)));
    if (holding && !back) {
      if (pose.ball === 'hand') drawBall(ctx, hand.x + 3.5, hand.y - 1, 6, pose.ballSpin);
    }
    return hand;
  };

  // ── braço e perna de trás ──
  const backHand = arm(pose.aB, pose.eB, true, false);
  leg(pose.lB, pose.kB, true);

  // ── tronco ──
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(pose.lean);
  const sw = b.sw, hw = b.hw;
  ctx.beginPath();
  ctx.moveTo(-hw, 1);
  ctx.lineTo(-sw, -to + 3);
  ctx.quadraticCurveTo(-sw + 1, -to - 1, -sw * 0.4, -to - 0.5);
  ctx.lineTo(sw * 0.4, -to - 0.5);
  ctx.quadraticCurveTo(sw - 1, -to - 1, sw, -to + 3);
  ctx.quadraticCurveTo(hw + b.belly * 1.3, -to * 0.35, hw, 1);
  ctx.closePath();
  if (look.topStyle === 'bare') {
    ctx.fillStyle = C(look.skin);
  } else {
    const g = ctx.createLinearGradient(-sw, 0, sw, 0);
    g.addColorStop(0, C(shade(look.top, -0.2)));
    g.addColorStop(0.6, C(look.top));
    g.addColorStop(1, C(shade(look.top, 0.15)));
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (!fl) {
    if (look.topStyle === 'bare') {
      // músculos
      ctx.strokeStyle = skinD;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -to + 6);
      ctx.lineTo(0, -6);
      ctx.moveTo(-sw * 0.6, -to + 9);
      ctx.quadraticCurveTo(0, -to + 12, sw * 0.6, -to + 9);
      ctx.stroke();
    } else {
      // gola/cavas da regata e acabamento
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (look.topStyle === 'tank') {
        ctx.moveTo(-sw * 0.4, -to);
        ctx.quadraticCurveTo(0, -to + 6, sw * 0.4, -to);
      } else if (look.topStyle === 'jacket' || look.topStyle === 'vest') {
        ctx.moveTo(sw * 0.15, -to);
        ctx.lineTo(sw * 0.05, -2);
      } else if (look.topStyle === 'gi') {
        ctx.moveTo(-sw * 0.5, -to);
        ctx.lineTo(sw * 0.4, -to * 0.45);
      } else {
        ctx.arc(0, -to, sw * 0.35, 0.2, Math.PI - 0.2);
      }
      ctx.stroke();
      ctx.fillStyle = look.trim;
      ctx.fillRect(-hw, -2.2, hw * 2, 2.2);
      if (look.number) {
        ctx.font = 'bold 9px "Arial Black", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = look.trim;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 0.8;
        // Desfaz o espelhamento para o número não aparecer invertido quando olha para a esquerda
        ctx.save();
        ctx.translate(sw * 0.12, -to * 0.42);
        ctx.scale(o.facing, 1);
        ctx.strokeText(look.number, 0, 0);
        ctx.fillText(look.number, 0, 0);
        ctx.restore();
      }
      if (look.topStyle === 'gi') {
        ctx.fillStyle = shade(look.trim, -0.1);
        ctx.fillRect(-hw - 0.5, -5, hw * 2 + 1, 3);
      }
    }
    if (look.armor) {
      ctx.fillStyle = look.armor;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(-sw * 0.7, -to + 2, sw * 1.5, to * 0.42);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = shade(look.armor, 0.35);
      for (let i = 0; i < 3; i++) ctx.fillRect(-sw * 0.5 + i * sw * 0.45, -to + 4, 1.5, 1.5);
    }
    if (look.chain) {
      ctx.strokeStyle = '#ffd34a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(1, -to + 1, sw * 0.42, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
  }
  // shorts: cintura
  ctx.beginPath();
  ctx.moveTo(-hw - 0.5, -1.5);
  ctx.lineTo(hw + 0.5, -1.5);
  ctx.lineTo(hw + 1.5, 5);
  ctx.lineTo(-hw - 1.5, 5);
  ctx.closePath();
  ctx.fillStyle = C(look.bottom);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (!fl && look.bottomStyle === 'shorts') {
    ctx.fillStyle = look.trim;
    ctx.fillRect(hw - 1.5, -1, 1.5, 6);
  }
  ctx.restore();

  // ── perna da frente ──
  leg(pose.lF, pose.kF, false);

  // ── cabeça ──
  const neck = { x: shoulder.x + tdir.x * 2, y: shoulder.y + tdir.y * 2 };
  limb(ctx, shoulder.x, shoulder.y + 1, neck.x, neck.y - 1, 2.6 * (b.sw / 9.5), look.skin, fl);
  ctx.save();
  ctx.translate(neck.x + tdir.x * HEAD_R * 0.9, neck.y + tdir.y * HEAD_R * 0.9);
  ctx.rotate(pose.lean * 0.5 + pose.head);
  drawHead(ctx, look, pose.expr, fl);
  ctx.restore();

  // ── braço da frente ──
  arm(pose.aF, pose.eF, false, true);
  if (pose.ball === 'overhead') {
    const hx = (backHand.x + shoulder.x) / 2;
    drawBall(ctx, hx + 2, shoulder.y - 17, 6.2, pose.ballSpin);
  }
  ctx.restore();

  // Bola quicando (fora da rotação/escala do corpo para cair até o chão)
  if (pose.ball === 'dribble') {
    const bx = x + o.facing * 9 * o.scale;
    const top = y - 26 * o.scale;
    drawBall(ctx, bx, top + (y - 6 * o.scale - top) * pose.dribble, 6 * o.scale, pose.ballSpin);
  }
}

function drawHead(ctx: CanvasRenderingContext2D, look: Look, expr: Expr, fl: boolean) {
  const C = (c: string) => (fl ? '#ffffff' : c);
  const r = HEAD_R;
  // cabelo atrás (afro/longo)
  if (look.hairStyle === 'afro') circle(ctx, -1.5, -2.5, r + 3.6, C(look.hair));
  if (look.hairStyle === 'dreads') drawDreads(ctx, r, C(look.hair), fl);
  if (look.hairStyle === 'long') {
    ctx.fillStyle = C(look.hair);
    ctx.beginPath();
    ctx.ellipse(-3, 2, r * 0.75, r + 3, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
  // rosto (levemente oval, queixo para a frente)
  ctx.beginPath();
  ctx.ellipse(0.6, 0, r * 0.92, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = C(look.skin);
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (!fl) {
    // sombra do lado de trás
    ctx.fillStyle = shade(look.skin, -0.18);
    ctx.beginPath();
    ctx.ellipse(-2.2, 1, r * 0.55, r * 0.85, 0, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    // orelha
    circle(ctx, -1.6, 0.6, 1.7, shade(look.skin, -0.08));
  }
  // cabelo
  ctx.fillStyle = C(look.hair);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  switch (look.hairStyle) {
    case 'short':
    case 'cornrows':
      ctx.beginPath();
      ctx.ellipse(-0.5, -2.6, r * 0.98, r * 0.66, -0.1, Math.PI * 0.95, Math.PI * 2.08);
      ctx.fill();
      ctx.stroke();
      if (look.hairStyle === 'cornrows' && !fl) {
        ctx.strokeStyle = shade(look.hair, 0.3);
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 2.2, -r + 0.5);
          ctx.lineTo(i * 2.2 - 2.5, -1.5);
          ctx.stroke();
        }
      }
      break;
    case 'afro':
      ctx.beginPath();
      ctx.ellipse(-1.2, -4, r + 2.6, r * 0.8, 0, Math.PI * 0.92, Math.PI * 2.08);
      ctx.fill();
      ctx.stroke();
      break;
    case 'mohawk':
      ctx.beginPath();
      ctx.moveTo(-5, -4);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(-4 + i * 2.2, -r - 5 + (i % 2) * 3);
        ctx.lineTo(-3 + i * 2.2, -r + 0.5);
      }
      ctx.lineTo(5, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'spiky':
      ctx.beginPath();
      ctx.moveTo(-r, -1);
      for (let i = 0; i < 6; i++) ctx.lineTo(-r + i * 2.8, -r - 3.5 + (i % 2) * 3.5);
      ctx.lineTo(r - 0.5, -3);
      ctx.quadraticCurveTo(0, -r + 1, -r, -1);
      ctx.fill();
      ctx.stroke();
      break;
    case 'buzz':
      ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      ctx.ellipse(-0.5, -2.2, r * 0.95, r * 0.62, -0.1, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha /= 0.85;
      break;
    case 'topknot':
      ctx.beginPath();
      ctx.ellipse(-0.5, -2.6, r * 0.98, r * 0.66, -0.1, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      ctx.stroke();
      circle(ctx, -2.5, -r - 2, 2.8, C(look.hair));
      break;
    case 'long':
      ctx.beginPath();
      ctx.ellipse(-0.5, -2.6, r, r * 0.7, -0.1, Math.PI * 0.9, Math.PI * 2.05);
      ctx.fill();
      ctx.stroke();
      break;
    case 'dreads':
      // base do cabelo sobre a testa (as mechas já foram desenhadas atrás)
      ctx.beginPath();
      ctx.ellipse(-0.6, -2.8, r * 1.02, r * 0.7, -0.1, Math.PI * 0.92, Math.PI * 2.08);
      ctx.fill();
      ctx.stroke();
      break;
    case 'bald':
      if (!fl) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(1, -4.5, 2.4, 1.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
  if (look.beard) {
    ctx.fillStyle = C(look.hair);
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.quadraticCurveTo(0, r + 2.5, 6.5, 3);
    ctx.lineTo(6.2, 5);
    ctx.quadraticCurveTo(1, r + 4.5, -2.5, 3.5);
    ctx.fill();
  }
  if (!fl) drawFace(ctx, look, expr);
  // faixas, bonés, máscara, coroa
  if (look.headband) {
    ctx.fillStyle = look.headband;
    ctx.beginPath();
    ctx.ellipse(0.5, -3.2, r * 0.98, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
  if (look.bandana) {
    ctx.fillStyle = look.bandana;
    ctx.beginPath();
    ctx.ellipse(-0.3, -3.4, r * 1.02, r * 0.62, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r + 0.5, -3);
    ctx.lineTo(-r - 4, 0);
    ctx.lineTo(-r - 2, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (look.cap) {
    ctx.fillStyle = look.cap;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-0.2, -3.6, r * 1.02, r * 0.68, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    if (look.capBack) ctx.ellipse(-r - 1.5, -3.2, 4, 1.4, -0.15, 0, Math.PI * 2);
    else ctx.ellipse(r + 1.5, -3.4, 4.5, 1.5, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (look.mask) {
    ctx.fillStyle = look.mask;
    ctx.beginPath();
    ctx.ellipse(0.6, 0, r * 0.95, r * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.fillStyle = look.eyeGlow ?? '#ff3355';
    ctx.shadowColor = look.eyeGlow ?? '#ff3355';
    ctx.shadowBlur = 6;
    ctx.fillRect(2, -1.8, 4.2, 1.6);
    ctx.shadowBlur = 0;
  }
  if (look.crown) {
    ctx.fillStyle = '#ffcf33';
    ctx.strokeStyle = '#6b4a00';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-5.5, -r + 0.5);
    ctx.lineTo(-5.5, -r - 5);
    ctx.lineTo(-2.8, -r - 2);
    ctx.lineTo(0, -r - 6.5);
    ctx.lineTo(2.8, -r - 2);
    ctx.lineTo(5.5, -r - 5);
    ctx.lineTo(5.5, -r + 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8204a';
    ctx.fillRect(-0.8, -r - 3, 1.6, 1.6);
  }
  if (look.shades) {
    ctx.fillStyle = look.shades;
    ctx.beginPath();
    ctx.moveTo(0, -2.4);
    ctx.lineTo(7.2, -2.4);
    ctx.lineTo(6.6, 0.2);
    ctx.lineTo(1.2, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(4.6, -2, 1.4, 0.8);
  }
}

function drawFace(ctx: CanvasRenderingContext2D, look: Look, expr: Expr) {
  const eyeX = 3.8, eyeY = -0.8;
  ctx.lineCap = 'round';
  // olho
  if (expr === 'ko') {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(eyeX - 1.3, eyeY - 1.3);
    ctx.lineTo(eyeX + 1.3, eyeY + 1.3);
    ctx.moveTo(eyeX + 1.3, eyeY - 1.3);
    ctx.lineTo(eyeX - 1.3, eyeY + 1.3);
    ctx.stroke();
  } else if (expr === 'hurt') {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(eyeX - 1.6, eyeY - 0.8);
    ctx.lineTo(eyeX + 1.2, eyeY + 0.2);
    ctx.lineTo(eyeX - 1.4, eyeY + 1);
    ctx.stroke();
  } else if (!look.shades) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 1.6, 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.eyeGlow ?? '#1b1410';
    ctx.beginPath();
    ctx.arc(eyeX + 0.6, eyeY + 0.1, 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  // sobrancelha
  ctx.strokeStyle = shade(look.hair === '#f2f2f2' ? '#888888' : look.hair, -0.2);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  if (expr === 'angry' || expr === 'focus') {
    ctx.moveTo(eyeX - 2.2, eyeY - 3);
    ctx.lineTo(eyeX + 1.8, eyeY - 1.8);
  } else {
    ctx.moveTo(eyeX - 2, eyeY - 2.6);
    ctx.lineTo(eyeX + 1.8, eyeY - 2.8);
  }
  ctx.stroke();
  // nariz
  ctx.strokeStyle = shade(look.skin, -0.35);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(6.4, -0.2);
  ctx.lineTo(7.6, 2);
  ctx.lineTo(6.3, 2.4);
  ctx.stroke();
  // boca
  ctx.strokeStyle = '#3a1712';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (expr === 'happy') {
    ctx.fillStyle = '#5a1a14';
    ctx.moveTo(3, 3.6);
    ctx.quadraticCurveTo(5, 6.6, 7, 3.8);
    ctx.closePath();
    ctx.fill();
  } else if (expr === 'hurt' || expr === 'ko') {
    ctx.ellipse(5.4, 4.6, 1.2, 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (expr === 'angry') {
    ctx.moveTo(3.4, 5);
    ctx.lineTo(6.8, 4.2);
    ctx.stroke();
  } else {
    ctx.moveTo(3.6, 4.6);
    ctx.lineTo(6.6, 4.4);
    ctx.stroke();
  }
}

/** Dreads espetados e torcidos, saindo do alto da cabeça para cima e para trás */
function drawDreads(ctx: CanvasRenderingContext2D, r: number, color: string, fl: boolean) {
  const locks: [number, number, number][] = [
    // [ângulo, comprimento, curvatura]
    [-2.55, 11, 0.5], [-2.3, 12.5, -0.4], [-2.05, 13, 0.4], [-1.8, 12, -0.3], [-1.55, 12.5, 0.35],
    [-1.3, 11, -0.3], [-1.05, 9.5, 0.3], [-2.8, 9.5, -0.3], [-3.05, 8, 0.3], [-0.85, 7.5, -0.2],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    for (const [a, len, curve] of locks) {
      const bx = Math.cos(a) * r * 0.55, by = -2 + Math.sin(a) * r * 0.55;
      const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
      const mx = (bx + ex) / 2 + Math.cos(a + Math.PI / 2) * curve * 4;
      const my = (by + ey) / 2 + Math.sin(a + Math.PI / 2) * curve * 4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      if (pass === 0) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 4.4;
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.8;
      }
      ctx.stroke();
      if (pass === 1 && !fl) {
        // torção das mechas
        ctx.strokeStyle = shade(color, 0.35);
        ctx.lineWidth = 0.7;
        for (let k = 0.3; k < 1; k += 0.25) {
          const px = bx + (ex - bx) * k, py = by + (ey - by) * k;
          ctx.beginPath();
          ctx.moveTo(px - Math.sin(a) * 1.2, py + Math.cos(a) * 1.2);
          ctx.lineTo(px + Math.sin(a) * 1.2 + Math.cos(a) * 0.8, py - Math.cos(a) * 1.2 + Math.sin(a) * 0.8);
          ctx.stroke();
        }
      }
    }
  }
  ctx.restore();
}
