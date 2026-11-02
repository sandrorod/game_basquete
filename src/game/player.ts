import { audio } from '../core/audio';
import { FLOOR_BOTTOM, FLOOR_TOP } from '../core/config';
import type { Input } from '../core/input';
import { clamp } from '../core/math';
import { HERO } from '../data/looks';
import { NO_GEAR, type GearStats } from '../data/shop';
import { drawHeroSprite } from '../render/spriteAnim';
import { Actor } from './actor';
import { resolveObstacles } from './obstacle';
import { Projectile } from './projectile';
import type { World } from './world';

type ThrowKind = 'quick' | 'strong';

const WALK = 2.1;
const RUN = 3.7;
const DEPTH = 1.55;
/** Arremesso turbinado (K): custo na barra de poder = mínimo + proporcional à carga */
const TURBO_MIN = 0.15;
const TURBO_PER_CHARGE = 0.3;
const turboCost = (c: number) => TURBO_MIN + TURBO_PER_CHARGE * c;

export class Player extends Actor {
  ball: 'hand' | 'out' | 'stolen' = 'hand';
  stolenT = 0;
  throwCd = 0;
  throwKind: ThrowKind = 'quick';
  bufferedThrow = 0;
  sp = 0;
  charge = 0;
  combo = 0;
  comboT = 0;
  bestCombo = 0;
  running = false;
  noPowerT = 0;
  tookDamage = false;
  lastSafe = { x: 0, y: 0 };
  hitThisShove = new Set<number>();
  /** Modo de teste: não perde energia */
  god = false;
  /** Bônus dos itens equipados (mochila) */
  gear: GearStats = NO_GEAR;
  /** Efeitos temporários dos prêmios (quadros restantes) */
  buffs = { shield: 0, glove: 0, rocket: 0, magnet: 0 };

  get dmgMul() {
    return (1 + this.gear.dmg) * (this.buffs.glove > 0 ? 1.5 : 1);
  }

  get speedMul() {
    return (1 + this.gear.speed) * (this.buffs.rocket > 0 ? 1.35 : 1);
  }

  constructor(x: number, y: number) {
    super(x, y, 100, HERO);
    this.name = 'STREET PLAYER';
  }

  /** Caído, nocauteado ou fora de controle (não pode ter a bola roubada) */
  get passiveState() {
    return !['idle', 'walk', 'run', 'windup', 'throw', 'charge', 'shove'].includes(this.state);
  }

  get canAct() {
    return ['idle', 'walk', 'run'].includes(this.state);
  }

  update(w: World, input: Input) {
    this.tickTimers();
    if (this.throwCd > 0) this.throwCd--;
    if (this.noPowerT > 0) this.noPowerT--;
    if (this.bufferedThrow > 0) this.bufferedThrow--;
    for (const k of Object.keys(this.buffs) as (keyof Player['buffs'])[]) if (this.buffs[k] > 0) this.buffs[k]--;
    if (this.buffs.rocket > 0 && this.state === 'run' && this.st % 4 === 0) w.fx.smoke(this.x - this.facing * 10, this.y, 20);
    if (this.comboT > 0 && --this.comboT === 0) this.combo = 0;
    if (this.ball === 'stolen' && this.stolenT > 0 && --this.stolenT === 0) {
      this.ball = 'hand';
      w.fx.popup(this.x, this.y - 80, 'BOLA NOVA!', '#ffd23f', 7);
      audio.sfx('pickup');
    }

    const ax = input.axis();
    switch (this.state) {
      case 'idle':
      case 'walk':
      case 'run': {
        this.running = input.running() && ax.x !== 0;
        const sp = (this.running ? RUN : WALK) * this.speedMul;
        this.vx += (ax.x * sp - this.vx) * 0.32;
        this.vy += (ax.y * (this.running ? DEPTH * 1.15 : DEPTH) * this.speedMul - this.vy) * 0.38;
        if (ax.x > 0.1) this.facing = 1;
        else if (ax.x < -0.1) this.facing = -1;
        const moving = Math.abs(this.vx) > 0.25 || Math.abs(this.vy) > 0.25;
        this.setState(!moving ? 'idle' : this.running ? 'run' : 'walk');
        if (this.running && this.st % 14 === 0) w.fx.dust(this.x - this.facing * 6, this.y, 2);
        if (this.state === 'idle' && this.ball === 'hand' && this.st % 40 === 20) audio.sfx('dribble');

        // Ataques
        const wantThrow = input.wasPressed('throw') || this.bufferedThrow > 0;
        if (input.wasPressed('special')) {
          if (this.sp >= 1) return this.startSuper(w);
          if (this.ball === 'hand') {
            // o turbo da bola gasta a barra de poder: sem o mínimo, não dá para usar
            if (this.sp < TURBO_MIN) {
              if (this.noPowerT <= 0) {
                this.noPowerT = 45;
                w.fx.popup(this.x, this.y - 88, 'SEM PODER', '#9fdcff', 7);
                audio.sfx('block');
              }
              return;
            }
            this.charge = 0;
            this.setState('charge');
            return;
          }
        }
        if (input.wasPressed('strong') && this.ball === 'hand' && this.throwCd === 0) return this.startThrow('strong');
        if (wantThrow) {
          if (this.ball === 'hand' && this.throwCd === 0) {
            this.bufferedThrow = 0;
            return this.startThrow('quick');
          }
          if (this.ball === 'stolen') {
            this.bufferedThrow = 0;
            this.hitThisShove.clear();
            this.setState('shove');
            audio.sfx('whoosh');
            return;
          }
          if (input.wasPressed('throw')) this.bufferedThrow = 10;
        }
        break;
      }
      case 'windup': {
        this.vx *= 0.6;
        this.vy *= 0.6;
        const wind = this.throwKind === 'quick' ? 5 : 13;
        if (this.st >= wind) this.release(w, this.throwKind === 'quick' ? 'quick' : 'strong', 0);
        break;
      }
      case 'throw':
        this.vx *= 0.7;
        this.vy *= 0.7;
        if (this.st >= (this.throwKind === 'quick' ? 9 : 14)) this.setState('idle');
        break;
      case 'charge': {
        // segurando K: carrega o arremesso especial (anda devagar)
        this.vx += (ax.x * WALK * 0.45 - this.vx) * 0.3;
        this.vy += (ax.y * DEPTH * 0.45 - this.vy) * 0.3;
        if (ax.x > 0.1) this.facing = 1;
        else if (ax.x < -0.1) this.facing = -1;
        // a carga vai até onde o poder disponível paga
        const maxCharge = Math.max(0, Math.min(1, (this.sp - TURBO_MIN) / TURBO_PER_CHARGE));
        this.charge = Math.min(maxCharge, this.charge + 1 / 55);
        if (this.st % 6 === 0 && this.charge > 0.3) w.fx.hit(this.x + this.facing * 4, this.y, 92 * this.scale, false, '#ffd23f');
        if (!input.isHeld('special') || input.wasReleased('special')) {
          if (this.charge < 0.15) {
            this.charge = 0;
            this.startThrow('quick');
          } else {
            const c = this.charge;
            this.charge = 0;
            this.sp = Math.max(0, this.sp - turboCost(c));
            w.fx.popup(this.x, this.y - 90, `-${Math.round(turboCost(c) * 100)}% PODER`, '#38f6ff', 6);
            this.release(w, 'special', c);
          }
        }
        break;
      }
      case 'super':
        this.vx = 0;
        this.vy = 0;
        if (this.st === 18) this.fireSuper(w);
        if (this.st >= 34) this.setState('idle');
        break;
      case 'shove': {
        // sem bola: empurrão de perto
        this.vx = this.facing * (this.st < 6 ? 2.2 : 0.3);
        if (this.st >= 4 && this.st <= 9) {
          for (const e of w.enemies) {
            if (e.dead || this.hitThisShove.has(e.id)) continue;
            const dx = (e.x - this.x) * this.facing;
            if (dx > -4 && dx < 30 && Math.abs(e.y - this.y) < 13) {
              this.hitThisShove.add(e.id);
              w.hitEnemy(e, 6, 'melee', this.facing, e.x, e.y, 40);
            }
          }
        }
        if (this.st >= 18) this.setState('idle');
        break;
      }
      case 'hurt':
        this.vx *= 0.82;
        this.vy *= 0.8;
        if (this.st >= 16) this.setState('idle');
        break;
      case 'fall':
        this.vx *= 0.97;
        if (this.z === 0 && this.st > 8) {
          this.setState('down');
          w.fx.dust(this.x, this.y, 6);
          w.fx.shake = Math.max(w.fx.shake, 4);
        }
        break;
      case 'down':
        this.vx *= 0.8;
        if (this.st >= 36) {
          if (this.hp <= 0) this.setState('ko');
          else this.setState('getup');
        }
        break;
      case 'getup':
        this.vx = 0;
        if (this.st >= 24) {
          this.invuln = 50;
          this.setState('idle');
        }
        break;
      case 'ko':
        this.vx *= 0.9;
        if (this.st === 80) w.onPlayerDown();
        break;
      case 'respawn':
        this.vx = 0;
        this.vy = 0;
        if (this.z === 0 && this.st > 4) {
          w.fx.dust(this.x, this.y, 10);
          w.fx.ring(this.x, this.y, 90);
          w.pushAway(this.x, this.y, 110);
          this.setState('idle');
        }
        break;
      case 'falling':
        // caiu num vão do telhado
        if (this.st >= 45) {
          this.x = this.lastSafe.x;
          this.y = this.lastSafe.y;
          this.z = 140;
          this.vz = 0;
          this.invuln = 120;
          this.setState('respawn');
          this.takeDamage(w, 15, false, 0, true);
        }
        break;
      case 'celebrate':
        this.vx = 0;
        this.vy = 0;
        break;
    }

    if (this.state !== 'falling') {
      this.physics(w.minX + 22, w.maxX - 22);
      resolveObstacles(this, w.obstacles, 9, 4);
      this.y = clamp(this.y, FLOOR_TOP + 4, FLOOR_BOTTOM);
    }
    // ponto de retorno (se cair num vão): sempre longe das bordas
    if (this.z === 0 && !w.nearGap(this.x, this.y, 40) && ['idle', 'walk', 'run'].includes(this.state)) this.lastSafe = { x: this.x, y: this.y };
    if (this.z === 0 && this.state !== 'falling' && this.state !== 'respawn' && w.inGap(this.x, this.y)) {
      this.vx = 0;
      this.vy = 0;
      this.setState('falling');
      audio.sfx('whoosh');
    }
  }

  private startThrow(kind: ThrowKind) {
    this.throwKind = kind;
    this.setState('windup');
  }

  private release(w: World, power: 'quick' | 'strong' | 'special', c: number) {
    const z = 40 * this.scale;
    const stats =
      power === 'quick' ? { vx: 10, dmg: 10, range: 270, lane: 13 } :
      power === 'strong' ? { vx: 12.5, dmg: 22, range: 320, lane: 15 } :
      { vx: 10 + 4 * c, dmg: Math.round(12 + 30 * c), range: 340, lane: 13 + 6 * c };
    const p = new Projectile({ x: this.x + this.facing * 14, y: this.y, z, vx: stats.vx * this.facing, kind: 'ball', fromPlayer: true, dmg: Math.round(stats.dmg * this.dmgMul), power, range: stats.range, laneTol: stats.lane });
    p.mainBall = true;
    p.ownerId = this.id;
    if (power === 'special') {
      p.pierce = c >= 0.7;
      p.glow = c >= 0.7 ? '#ffd23f' : '#ff9f1c';
    }
    w.projectiles.push(p);
    this.ball = 'out';
    this.throwKind = power === 'strong' ? 'strong' : 'quick';
    this.throwCd = power === 'quick' ? 10 : 20;
    this.setState('throw');
    audio.sfx(power === 'quick' ? 'throw' : power === 'strong' ? 'strong' : 'special');
    if (power !== 'quick') w.fx.shake = Math.max(w.fx.shake, 2);
  }

  private startSuper(w: World) {
    this.sp = 0;
    this.setState('super');
    this.invuln = 40;
    w.fx.flash = 10;
    w.freeze(6);
    audio.sfx('super');
    w.fx.popup(this.x, this.y - 90, 'SUPER ARREMESSO!', '#38f6ff', 10);
  }

  private fireSuper(w: World) {
    for (const dy of [-44, -22, 0, 22, 44]) {
      const y = clamp(this.y + dy, FLOOR_TOP + 6, FLOOR_BOTTOM - 2);
      const p = new Projectile({ x: this.x + this.facing * 14, y, z: 40, vx: 9 * this.facing, kind: 'ball', fromPlayer: true, dmg: Math.round(30 * this.dmgMul), power: 'super', range: 520, laneTol: 16, maxLife: 90 });
      p.pierce = true;
      p.glow = '#38f6ff';
      w.projectiles.push(p);
    }
    w.fx.shake = 8;
  }

  /** Recebe golpe. knock = cai no chão. */
  takeDamage(w: World, dmg: number, knock: boolean, dirX: number, force = false) {
    if (!force && (this.invuln > 0 || ['ko', 'respawn', 'falling', 'down', 'getup'].includes(this.state))) return false;
    // modo de teste (robô): ignora o golpe por completo (sem dano nem atordoamento)
    if (this.god && !force) return false;
    if (this.god) dmg = 0;
    // escudo (prêmio): bloqueia o golpe
    if (this.buffs.shield > 0 && !force) {
      w.fx.hit(this.x, this.y, 45, false, '#7cff6b');
      audio.sfx('block');
      this.invuln = 20;
      return false;
    }
    // camiseta e outros itens: menos dano
    dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.6, this.gear.def))));
    this.hp = Math.max(0, this.hp - dmg);
    this.tookDamage = true;
    this.flash = 6;
    this.combo = 0;
    this.comboT = 0;
    this.charge = 0;
    w.fx.hit(this.x, this.y, 45, knock, '#ff6b6b');
    audio.sfx('playerHit');
    if (this.hp <= 0) {
      this.vz = 4;
      this.vx = dirX * 2.5;
      this.z = 0.1;
      this.setState('fall');
      this.invuln = 999;
      return true;
    }
    if (force) return true;
    if (knock) {
      this.vz = 3.4;
      this.z = 0.1;
      this.vx = dirX * 2.6;
      this.setState('fall');
      this.invuln = 90;
    } else {
      this.vx = dirX * 1.8;
      this.setState('hurt');
      this.invuln = 40;
    }
    return true;
  }

  catchBall() {
    this.ball = 'hand';
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const blink = this.invuln > 0 && this.invuln < 900 && !['fall', 'down', 'ko'].includes(this.state) && Math.floor(this.invuln / 4) % 2 === 0;
    let scale = 1;
    let alpha = blink ? 0.45 : 1;
    let drop = 0;
    if (this.state === 'falling') {
      scale = Math.max(0.1, 1 - this.st / 45);
      alpha = Math.max(0, 1 - this.st / 45);
      drop = this.st * 0.8;
    }
    // efeitos dos prêmios: escudo (bolha verde), luva (brilho vermelho)
    const px = this.x - camX, py = this.y - this.z + drop;
    if (this.buffs.glove > 0 || this.buffs.shield > 0) {
      ctx.save();
      const end = Math.min(this.buffs.glove || 999, this.buffs.shield || 999) < 90;
      ctx.globalAlpha = end && Math.floor(t / 6) % 2 ? 0.1 : 0.3 + Math.sin(t * 0.2) * 0.08;
      ctx.fillStyle = this.buffs.shield > 0 ? '#7cff6b' : '#ff4d4d';
      ctx.beginPath();
      ctx.ellipse(px, py - 44, 30, 50, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // sprites do modelo do STREET PLAYER (tools/slice_hero.py)
    drawHeroSprite(
      ctx,
      this.x - camX,
      this.y - this.z + drop,
      { state: this.state, st: this.st, t, vx: this.vx, vy: this.vy, facing: this.facing, hasBall: this.ball === 'hand', quick: this.throwKind === 'quick', hp: this.hp },
      { flash: this.flash > 0, alpha, scale },
    );
  }
}
