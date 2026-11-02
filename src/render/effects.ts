import { rand } from '../core/math';

interface Particle {
  kind: 'spark' | 'dust' | 'debris' | 'confetti' | 'ring' | 'star' | 'smoke' | 'flash';
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number;
  color: string;
  rot: number;
}

interface Popup { x: number; y: number; text: string; color: string; life: number; max: number; size: number }

/** Partículas, textos flutuantes e tremor de tela (coordenadas do mundo: x, profundidade y e altura z). */
export class Effects {
  parts: Particle[] = [];
  popups: Popup[] = [];
  shake = 0;
  flash = 0;

  private add(p: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>) {
    if (this.parts.length > 420) this.parts.shift();
    this.parts.push({ z: 0, vx: 0, vy: 0, vz: 0, life: 30, size: 2, color: '#fff', rot: rand(0, 6), ...p, max: p.life ?? 30 });
  }

  hit(x: number, y: number, z: number, big = false, color = '#ffe66d') {
    const n = big ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(2, big ? 6 : 4);
      this.add({ kind: 'spark', x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, life: rand(8, 16), size: rand(1.5, 3), color: i % 3 ? color : '#ffffff' });
    }
    this.add({ kind: 'star', x, y, z, life: 9, size: big ? 22 : 15, color: '#ffffff' });
    this.shake = Math.max(this.shake, big ? 7 : 3);
  }

  dust(x: number, y: number, n = 5) {
    for (let i = 0; i < n; i++) this.add({ kind: 'dust', x: x + rand(-8, 8), y, z: rand(0, 4), vx: rand(-1, 1), vz: rand(0.2, 1), life: rand(18, 30), size: rand(3, 6), color: 'rgba(210,200,180,0.7)' });
  }

  debris(x: number, y: number, color: string, n = 12) {
    for (let i = 0; i < n; i++) this.add({ kind: 'debris', x, y, z: rand(5, 20), vx: rand(-3, 3), vy: rand(-0.6, 0.6), vz: rand(2, 5), life: rand(30, 50), size: rand(2, 5), color });
    this.shake = Math.max(this.shake, 4);
  }

  confetti(x: number, y: number, n = 60) {
    const colors = ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0', '#ffffff'];
    for (let i = 0; i < n; i++) this.add({ kind: 'confetti', x: x + rand(-160, 160), y: y + rand(-20, 20), z: rand(80, 220), vx: rand(-1, 1), vz: rand(-0.5, 1.5), life: rand(90, 160), size: rand(2, 4), color: colors[i % colors.length] });
  }

  ring(x: number, y: number, radius: number, color = 'rgba(255,255,255,0.8)') {
    this.add({ kind: 'ring', x, y, life: 20, size: radius, color });
  }

  smoke(x: number, y: number, z: number) {
    this.add({ kind: 'smoke', x, y, z, vx: rand(-0.5, 0.5), vz: rand(0.4, 1.2), life: rand(30, 50), size: rand(4, 8), color: 'rgba(230,230,230,0.5)' });
  }

  popup(x: number, y: number, text: string, color = '#ffffff', size = 10) {
    this.popups.push({ x, y, text, color, life: 50, max: 50, size });
  }

  update() {
    for (const p of this.parts) {
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === 'debris' || p.kind === 'spark') {
        p.z += p.vz;
        p.vz -= p.kind === 'debris' ? 0.25 : 0.12;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.4;
          p.vx *= 0.6;
        }
      } else if (p.kind === 'confetti') {
        p.z -= 0.6 + p.vz * 0.2;
        p.x += Math.sin(p.life * 0.1) * 0.6;
        p.rot += 0.1;
        if (p.z < 0) p.z = 0;
      } else {
        p.z += p.vz;
      }
      p.vx *= 0.95;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.popups) {
      t.life--;
      t.y -= 0.5;
    }
    this.popups = this.popups.filter((t) => t.life > 0);
    this.shake *= 0.86;
    if (this.shake < 0.3) this.shake = 0;
    this.flash = Math.max(0, this.flash - 1);
  }

  /** Partículas no chão (antes dos personagens) */
  drawGround(ctx: CanvasRenderingContext2D, camX: number) {
    for (const p of this.parts) {
      if (p.kind !== 'ring') continue;
      const k = 1 - p.life / p.max;
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(p.x - camX, p.y, p.size * (0.3 + k), p.size * 0.32 * (0.3 + k), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number) {
    for (const p of this.parts) {
      const sx = p.x - camX, sy = p.y - p.z;
      const k = p.life / p.max;
      switch (p.kind) {
        case 'spark':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - p.vx * 2, sy + p.vz * 2);
          ctx.stroke();
          break;
        case 'star': {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = k;
          ctx.beginPath();
          const r = p.size * (1.2 - k * 0.5);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + p.rot;
            const rr = i % 2 ? r * 0.3 : r;
            ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
          }
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'dust':
        case 'smoke':
          ctx.fillStyle = p.color;
          ctx.globalAlpha = k * 0.8;
          ctx.beginPath();
          ctx.arc(sx, sy, p.size * (1.6 - k), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        case 'debris':
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot + p.life * 0.2);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
          break;
        case 'confetti':
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
      }
    }
    for (const t of this.popups) {
      const a = Math.min(1, t.life / 15);
      ctx.globalAlpha = a;
      ctx.font = `${t.size}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.strokeText(t.text, t.x - camX, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x - camX, t.y);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }
}
