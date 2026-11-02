import { audio } from '../core/audio';
import type { Difficulty } from '../core/config';
import { writeSave, type SaveData } from '../core/save';
import { HERO } from '../data/looks';
import { STAGES } from '../data/stages';
import { drawFighter } from '../render/fighter';
import { poseFor } from '../render/poses';
import type { Game } from '../game/game';

type ScreenName = 'title' | 'howto' | 'options' | 'pause' | 'gameover' | 'victory' | 'none';

/** Menus em HTML por cima do canvas (navegação por mouse, toque, setas + Enter). */
export class Screens {
  private root: HTMLElement;
  private game!: Game;
  private heroRaf = 0;
  private from: ScreenName = 'title';
  current: ScreenName = 'none';

  constructor(root: HTMLElement, private save: SaveData, private onTouchPref: () => void) {
    this.root = root;
    window.addEventListener('keydown', (e) => {
      if (this.current === 'none') return;
      const btns = [...this.root.querySelectorAll<HTMLButtonElement>('.btn')];
      if (!btns.length) return;
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        btns[(i + 1) % btns.length].focus();
        audio.sfx('select');
      } else if (['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        btns[(i - 1 + btns.length) % btns.length].focus();
        audio.sfx('select');
      } else if ((e.code === 'Enter' || e.code === 'Space') && i >= 0) {
        e.preventDefault();
        btns[i].click();
      } else if (e.code === 'Escape' && (this.current === 'howto' || this.current === 'options')) {
        this.show(this.from);
      }
    });
  }

  attach(game: Game) {
    this.game = game;
  }

  private btn(label: string, onClick: () => void, alt = false) {
    const b = document.createElement('button');
    b.className = `btn${alt ? ' alt' : ''}`;
    b.textContent = label;
    b.addEventListener('click', () => {
      audio.unlock();
      audio.sfx('select');
      onClick();
    });
    return b;
  }

  private mount(html: string, buttons: HTMLButtonElement[] = [], menuSel = '.menu') {
    cancelAnimationFrame(this.heroRaf);
    this.root.innerHTML = html;
    const menu = this.root.querySelector(menuSel);
    for (const b of buttons) menu?.appendChild(b);
    setTimeout(() => buttons[0]?.focus(), 30);
  }

  show(name: ScreenName, data: Record<string, string | number> = {}) {
    if (name === 'pause' || name === 'title') this.from = name;
    this.current = name;
    const g = this.game;
    switch (name) {
      case 'none':
        cancelAnimationFrame(this.heroRaf);
        this.root.innerHTML = '';
        break;
      case 'title': {
        const btns = [this.btn('Start Game', () => g.newGame(0))];
        if (this.save.unlocked > 1) btns.push(this.btn(`Continue · Stage ${Math.min(this.save.unlocked, STAGES.length)}`, () => g.newGame(Math.min(this.save.unlocked, STAGES.length) - 1)));
        btns.push(this.btn('How to Play', () => this.show('howto'), true), this.btn('Options', () => this.show('options'), true));
        this.mount(
          `<div class="screen">
            <div class="title-wrap">
              <canvas class="hero-canvas" width="360" height="440"></canvas>
              <div>
                <h1 class="logo"><span class="l1">STREET</span><span class="l2">BASKETBALL</span><span class="l3">FIGHT</span></h1>
                <p class="tag">10 STAGES · 10 BOSSES · 1 BALL</p>
              </div>
            </div>
            <div class="menu"></div>
            <p class="tag">HI-SCORE ${String(this.save.best).padStart(8, '0')}</p>
          </div>`,
          btns,
        );
        this.animateHero();
        break;
      }
      case 'howto':
        this.mount(
          `<div class="screen"><div class="panel">
            <h2>HOW TO PLAY</h2>
            <p class="small">Atravesse 10 fases, derrote as gangues e os chefes usando sua bola de basquete. A bola volta para a sua mão depois de cada arremesso.</p>
            <h3>COMPUTADOR</h3>
            <div class="keys">
              <span><kbd>W A S D</kbd> <kbd>↑ ← ↓ →</kbd></span><span>Andar nas 4 direções (aproxime-se ou afaste-se do fundo)</span>
              <span><kbd>SHIFT</kbd></span><span>Correr (ou toque duas vezes na direção)</span>
              <span><kbd>ESPAÇO</kbd></span><span>Arremesso rápido · sem bola: empurrão</span>
              <span><kbd>J</kbd></span><span>Arremesso forte (derruba, quebra defesas)</span>
              <span><kbd>K</kbd></span><span>Segure para carregar · solte para o arremesso especial · com SP cheio: SUPER SHOT</span>
              <span><kbd>ESC</kbd></span><span>Pausar</span>
            </div>
            <h3>CELULAR</h3>
            <p class="small">Analógico à esquerda · THROW, STRONG, SP (segure para carregar) e RUN à direita.</p>
            <h3>DICAS</h3>
            <p class="small">Fique na mesma faixa do inimigo para acertar · troque de faixa para desviar · o BALL THIEF rouba sua bola: empurre-o para recuperar · quebre caixas e lixeiras para achar comida, estrelas e 1UP.</p>
          </div><div class="menu"></div></div>`,
          [this.btn('Back', () => this.show(this.from))],
        );
        break;
      case 'options': {
        const diffLabel: Record<Difficulty, string> = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' };
        const render = () => {
          const music = this.btn(this.save.music ? 'ON' : 'OFF', () => {
            this.save.music = !this.save.music;
            audio.setMusic(this.save.music);
            writeSave(this.save);
            render();
          }, true);
          const sfx = this.btn(this.save.sfx ? 'ON' : 'OFF', () => {
            this.save.sfx = !this.save.sfx;
            audio.setSfx(this.save.sfx);
            writeSave(this.save);
            render();
          }, true);
          const diff = this.btn(diffLabel[this.save.difficulty], () => {
            const order: Difficulty[] = ['easy', 'normal', 'hard'];
            this.save.difficulty = order[(order.indexOf(this.save.difficulty) + 1) % 3];
            writeSave(this.save);
            render();
          }, true);
          const touch = this.btn(this.save.touch.toUpperCase(), () => {
            const order: SaveData['touch'][] = ['auto', 'on', 'off'];
            this.save.touch = order[(order.indexOf(this.save.touch) + 1) % 3];
            writeSave(this.save);
            this.onTouchPref();
            render();
          }, true);
          const reset = this.btn('Reset progress', () => {
            this.save.unlocked = 1;
            this.save.best = 0;
            writeSave(this.save);
            render();
          }, true);
          this.root.innerHTML = `<div class="screen"><div class="panel"><h2>OPTIONS</h2>
            <div class="menu" style="gap:12px">
              <div class="opt"><span>MUSIC</span><span data-s="music"></span></div>
              <div class="opt"><span>SOUND FX</span><span data-s="sfx"></span></div>
              <div class="opt"><span>DIFFICULTY</span><span data-s="diff"></span></div>
              <div class="opt"><span>TOUCH CONTROLS</span><span data-s="touch"></span></div>
              <div class="opt"><span>PROGRESS (STAGE ${this.save.unlocked})</span><span data-s="reset"></span></div>
            </div></div><div class="menu" data-s="back"></div></div>`;
          const put = (k: string, b: HTMLButtonElement) => this.root.querySelector(`[data-s="${k}"]`)!.appendChild(b);
          put('music', music);
          put('sfx', sfx);
          put('diff', diff);
          put('touch', touch);
          put('reset', reset);
          const back = this.btn('Back', () => this.show(this.from));
          put('back', back);
          setTimeout(() => music.focus(), 20);
        };
        cancelAnimationFrame(this.heroRaf);
        render();
        break;
      }
      case 'pause': {
        const sound = this.btn(`Sound: ${this.save.music || this.save.sfx ? 'ON' : 'OFF'}`, () => {
          const on = !(this.save.music || this.save.sfx);
          this.save.music = on;
          this.save.sfx = on;
          audio.setMusic(on);
          audio.setSfx(on);
          writeSave(this.save);
          sound.textContent = `Sound: ${on ? 'ON' : 'OFF'}`;
        }, true);
        this.mount(`<div class="screen"><div class="panel"><h2 class="blink">PAUSED</h2><div class="menu"></div></div></div>`, [
          this.btn('Continue', () => g.togglePause()),
          this.btn('Restart Stage', () => g.restartStage(), true),
          sound,
          this.btn('Options', () => this.show('options'), true),
          this.btn('Back to Menu', () => g.toTitle(), true),
        ]);
        break;
      }
      case 'gameover':
        this.mount(
          `<div class="screen"><div class="panel">
            <p class="big">GAME OVER</p>
            <p class="score">SCORE ${String(data.score ?? 0).padStart(8, '0')}</p>
            <p class="small">STAGE ${data.stage} · ${data.name}<br/>HI-SCORE ${String(data.best ?? 0).padStart(8, '0')}</p>
            <div class="menu"></div></div></div>`,
          [this.btn('Try Again', () => g.newGame(g.stageIdx)), this.btn('Main Menu', () => g.toTitle(), true)],
        );
        break;
      case 'victory':
        this.mount(
          `<div class="screen victory"><div class="panel">
            <p class="win">THE KING<br/>DEFEATED!</p>
            <p class="small">STREET PLAYER é o novo rei das quadras.</p>
            <p class="score">FINAL SCORE ${String(data.score ?? 0).padStart(8, '0')}</p>
            <p class="small">HI-SCORE ${String(data.best ?? 0).padStart(8, '0')}</p>
            <div class="menu"></div></div></div>`,
          [this.btn('Play Again', () => g.newGame(0)), this.btn('Main Menu', () => g.toTitle(), true)],
        );
        break;
    }
  }

  /** Herói animado na tela inicial */
  private animateHero() {
    const c = this.root.querySelector<HTMLCanvasElement>('.hero-canvas');
    if (!c) return;
    const ctx = c.getContext('2d')!;
    let t = 0;
    const frame = () => {
      t++;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const g = ctx.createRadialGradient(180, 300, 20, 180, 260, 200);
      g.addColorStop(0, 'rgba(255,138,31,0.5)');
      g.addColorStop(1, 'rgba(255,138,31,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(180, 420, 70, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      const anim = Math.floor(t / 240) % 2 ? 'celebrate' : 'idle';
      drawFighter(ctx, 180, 418, HERO, poseFor(anim, t, { ball: anim === 'idle' ? 'dribble' : 'overhead', spin: t * 0.2 }), { facing: 1, scale: 4.6 });
      this.heroRaf = requestAnimationFrame(frame);
    };
    frame();
  }
}
