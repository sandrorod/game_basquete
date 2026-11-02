import { audio } from '../core/audio';
import { H, W } from '../core/config';
import type { Input } from '../core/input';
import { writeSave, type SaveData } from '../core/save';
import { STAGES } from '../data/stages';
import { drawFighter } from '../render/fighter';
import { text } from '../render/hud';
import { poseFor } from '../render/poses';
import { HERO } from '../data/looks';
import { buildStageArt, FAR_PARALLAX, ART_SCALE, type StageArt } from '../render/backgrounds';
import { Effects } from '../render/effects';
import { World } from './world';

export type GameState = 'boot' | 'title' | 'intro' | 'play' | 'paused' | 'clear' | 'gameover' | 'victory';

export interface UiHooks {
  show(screen: 'title' | 'pause' | 'gameover' | 'victory' | 'none', data?: Record<string, string | number>): void;
}

/** Máquina de estados do jogo (menus, fases, pausa, fim). */
export class Game {
  /** 'boot' até as fontes carregarem e o título aparecer */
  state: GameState = 'boot';
  world: World | null = null;
  stageIdx = 0;
  t = 0;
  stateT = 0;
  score = 0;
  lives = 3;
  nextLifeAt = 60000;
  bonus = { time: 0, health: 0, flawless: 0, combo: 0, total: 0 };
  private titleArt: StageArt | null = null;
  private victoryFx = new Effects();

  constructor(public input: Input, public save: SaveData, public ui: UiHooks) {}

  private setState(s: GameState) {
    this.state = s;
    this.stateT = 0;
  }

  toTitle() {
    this.world = null;
    this.setState('title');
    this.ui.show('title');
    audio.play('title');
  }

  /** Começa um jogo novo a partir de uma fase */
  newGame(stageIdx = 0) {
    this.score = 0;
    this.lives = this.difficultyLives();
    this.nextLifeAt = 60000;
    this.startStage(stageIdx);
  }

  private difficultyLives() {
    return this.save.difficulty === 'easy' ? 5 : this.save.difficulty === 'hard' ? 2 : 3;
  }

  startStage(idx: number, hp?: number) {
    this.stageIdx = idx;
    this.world = new World(idx, this.save.difficulty, { score: this.score, lives: this.lives, hp, nextLifeAt: this.nextLifeAt });
    this.setState('intro');
    this.ui.show('none');
    audio.play('stage', idx);
    audio.sfx('stageStart');
  }

  restartStage() {
    this.lives = Math.max(this.lives, 1);
    this.startStage(this.stageIdx);
  }

  togglePause() {
    if (this.state === 'play') {
      this.setState('paused');
      this.ui.show('pause');
    } else if (this.state === 'paused') {
      this.setState('play');
      this.ui.show('none');
    }
  }

  update() {
    this.t++;
    this.stateT++;
    const inp = this.input;
    if (inp.wasPressed('pause') && (this.state === 'play' || this.state === 'paused')) this.togglePause();

    switch (this.state) {
      case 'intro': {
        const w = this.world!;
        // jogador entra andando
        w.player.x = Math.min(90, 20 + this.stateT * 1.2);
        w.player.setState(this.stateT < 60 ? 'walk' : 'idle');
        w.player.vx = this.stateT < 60 ? 1.2 : 0;
        w.player.st++;
        if (this.stateT > 130 || (this.stateT > 30 && (inp.wasPressed('throw') || inp.wasPressed('confirm')))) {
          w.player.vx = 0;
          w.player.setState('idle');
          this.setState('play');
        }
        break;
      }
      case 'play': {
        const w = this.world!;
        w.update(inp);
        this.score = w.score;
        this.lives = w.lives;
        this.nextLifeAt = w.nextLifeAt;
        if (w.event === 'gameOver') {
          this.setState('gameover');
          this.save.best = Math.max(this.save.best, this.score);
          writeSave(this.save);
          audio.play('none');
          this.ui.show('gameover', { score: this.score, stage: w.stageN, name: w.stage.name, best: this.save.best });
        } else if (w.event === 'stageClear') {
          this.bonus = w.stageBonus();
          this.setState('clear');
          audio.play('victory');
        }
        break;
      }
      case 'clear': {
        const w = this.world!;
        w.player.st++;
        w.fx.update();
        if (this.stateT === 150) {
          w.addScore(this.bonus.total);
          this.score = w.score;
          this.lives = w.lives;
          this.nextLifeAt = w.nextLifeAt;
          audio.sfx('pickup');
        }
        const next = this.stageIdx + 1;
        if (this.stateT > 330 || (this.stateT > 160 && (inp.wasPressed('throw') || inp.wasPressed('confirm')))) {
          if (this.stateT <= 150) {
            w.addScore(this.bonus.total);
            this.score = w.score;
          }
          if (next >= STAGES.length) {
            this.save.unlocked = STAGES.length;
            this.save.best = Math.max(this.save.best, this.score);
            writeSave(this.save);
            this.setState('victory');
            this.ui.show('victory', { score: this.score, best: this.save.best });
          } else {
            this.save.unlocked = Math.max(this.save.unlocked, next + 1);
            writeSave(this.save);
            // energia continua de uma fase para outra (com um pequeno descanso)
            this.startStage(next, Math.min(100, w.player.hp + 35));
          }
        }
        break;
      }
      case 'victory':
        this.victoryFx.update();
        if (this.stateT % 40 === 1) this.victoryFx.confetti(W / 2, 290, 40);
        if (this.stateT % 90 === 1) audio.sfx('victory');
        break;
    }
    inp.endFrame();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const t = this.t;
    if (this.state === 'title' || (this.state === 'gameover' && !this.world)) {
      // fundo animado do menu: a primeira rua passando
      this.titleArt ??= buildStageArt('night', 3400, 5);
      const camX = (t * 0.6) % (3400 - W);
      ctx.drawImage(this.titleArt.far, camX * FAR_PARALLAX * ART_SCALE, 0, W * ART_SCALE, 236 * ART_SCALE, 0, 0, W, 236);
      ctx.drawImage(this.titleArt.near, camX * ART_SCALE, 0, W * ART_SCALE, H * ART_SCALE, 0, 0, W, H);
      this.titleArt.live?.(ctx, camX, t);
      ctx.fillStyle = 'rgba(5,5,20,0.55)';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const w = this.world;
    if (!w) return;

    if (this.state === 'victory') {
      // arena limpa, herói comemorando à direita (o painel fica à esquerda)
      w.t = t;
      w.draw(ctx, true);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(W * 0.74, 322, 60, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      drawFighter(ctx, W * 0.74, 320, HERO, poseFor('celebrate', t, { ball: 'overhead' }), { facing: -1, scale: 2.5 });
      this.victoryFx.draw(ctx, 0);
      return;
    }

    w.draw(ctx);
    if (this.state === 'intro') {
      const k = Math.min(1, this.stateT / 25);
      ctx.fillStyle = `rgba(0,0,0,${0.6 * k})`;
      ctx.fillRect(0, H / 2 - 44, W, 88);
      text(ctx, `STAGE ${w.stageN}`, W / 2, H / 2 - 12, 18, '#ffd23f', 'center', 5);
      text(ctx, w.stage.name, W / 2 - (1 - k) * 200, H / 2 + 14, 12, '#ffffff', 'center', 4);
      if (this.stateT > 60 && Math.floor(t / 15) % 2) text(ctx, 'GET READY!', W / 2, H / 2 + 34, 7, '#38f6ff', 'center');
    }
    if (this.state === 'clear') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      text(ctx, 'STAGE CLEAR!', W / 2, 92, 20, '#ffd23f', 'center', 5);
      text(ctx, w.stage.name, W / 2, 114, 8, '#ffffff', 'center');
      const rows: [string, number][] = [['TIME BONUS', this.bonus.time], ['HEALTH BONUS', this.bonus.health], ['NO DAMAGE BOSS', this.bonus.flawless], ['BEST COMBO', this.bonus.combo]];
      rows.forEach(([label, v], i) => {
        if (this.stateT < 30 + i * 25) return;
        text(ctx, label, W / 2 - 130, 150 + i * 22, 8, '#cfe9ff');
        text(ctx, String(v), W / 2 + 130, 150 + i * 22, 8, '#ffffff', 'right');
      });
      if (this.stateT > 140) {
        text(ctx, 'TOTAL', W / 2 - 130, 250, 10, '#ffd23f');
        text(ctx, String(this.bonus.total), W / 2 + 130, 250, 10, '#ffd23f', 'right');
        text(ctx, `SCORE ${String(this.score).padStart(8, '0')}`, W / 2, 280, 9, '#ffffff', 'center');
      }
      if (this.stateT > 170 && Math.floor(t / 20) % 2) text(ctx, 'PRESS SPACE / TAP TO CONTINUE', W / 2, 320, 7, '#38f6ff', 'center');
    }
  }
}
