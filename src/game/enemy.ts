import { audio } from '../core/audio';
import { FLOOR_BOTTOM, FLOOR_TOP, W } from '../core/config';
import { chance, clamp, rand, sign } from '../core/math';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { enemyLook, type EnemyKind } from '../data/looks';
import { drawBall, drawFighter } from '../render/fighter';
import { enemyBar } from '../render/hud';
import { poseFor, type Anim } from '../render/poses';
import { drawBike } from '../render/props';
import { Actor, type Power } from './actor';
import { resolveObstacles } from './obstacle';
import { Projectile } from './projectile';
import type { World } from './world';

export class Enemy extends Actor {
  kind: EnemyKind;
  def: EnemyDef;
  dmg: number;
  speed: number;
  cooldown = 0;
  hasToken = false;
  /** Lado preferido em volta do jogador e deslocamento de profundidade (evita amontoar) */
  side: 1 | -1 = 1;
  laneOff = 0;
  thinkT = 0;
  holdingBall = false;
  hitDone = false;
  ridePasses = 0;
  aggression: number;
  isBoss = false;
  knockCount = 0;
  showBar = 0;
  /** Dano dos projéteis (escala mais devagar que o corpo a corpo) */
  shotDmg = 0;
  /** Faixa por onde o motoqueiro vai voltar (anunciada antes) */
  laneY = 0;

  constructor(kind: EnemyKind, x: number, y: number, w: World, label?: string, seed = Math.floor(rand(0, 1000))) {
    const def = ENEMIES[kind];
    const st = w.stageN;
    const hp = Math.round(def.hp * (1 + 0.09 * (st - 1)) * w.diff.enemyHp);
    super(x, y, hp, enemyLook(kind, w.stage.palette, seed));
    this.kind = kind;
    this.def = def;
    this.name = label ?? kind.toUpperCase().replace('THUG', 'STREET THUG').replace('RUNNER', 'FAST RUNNER').replace('HEAVY', 'HEAVY GUY').replace('THIEF', 'BALL THIEF').replace('SHOOTER', 'STREET SHOOTER').replace('BALLER', 'STREET BALLER');
    this.scale = def.scale;
    this.dmg = Math.round(def.dmg * (1 + 0.05 * (st - 1)) * w.diff.enemyDmg);
    this.shotDmg = Math.round(def.dmg * (1 + 0.035 * (st - 1)) * w.diff.enemyDmg);
    this.speed = def.speed * (1 + 0.035 * (st - 1));
    this.aggression = (0.75 + st * 0.035) * w.diff.aggression;
    this.side = x > w.player.x ? 1 : -1;
    this.laneOff = rand(-26, 26);
    this.facing = this.side === 1 ? -1 : 1;
    this.cooldown = Math.round(rand(30, 90));
    this.setState(kind === 'biker' ? 'ride' : 'approach');
    if (kind === 'biker') {
      this.facing = x > w.camX + W / 2 ? -1 : 1;
      this.y = clamp(w.player.y + rand(-10, 10), FLOOR_TOP + 10, FLOOR_BOTTOM - 4);
    }
  }

  get halfW() {
    return (this.kind === 'biker' && this.state === 'ride' ? 20 : 10) * this.scale;
  }

  /** Está fora de combate (caído, nocauteado, fugindo) */
  get passive() {
    return ['hurt', 'fall', 'down', 'getup', 'ko', 'flee', 'dead'].includes(this.state);
  }

  update(w: World) {
    this.tickTimers();
    if (this.showBar > 0) this.showBar--;
    if (this.cooldown > 0) this.cooldown--;
    const p = w.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const playerDown = ['ko', 'respawn', 'falling'].includes(p.state);

    switch (this.state) {
      case 'approach': {
        if (!['ride'].includes(this.state) && Math.abs(dx) > 2) this.facing = sign(dx) as 1 | -1;
        if (--this.thinkT <= 0) {
          this.thinkT = Math.round(rand(40, 90));
          // troca de lado de vez em quando, para cercar
          if (chance(0.25)) this.side = -this.side as 1 | -1;
          this.laneOff = rand(-28, 28);
        }
        const ranged = this.def.attack === 'shoot';
        let tx: number, ty: number;
        if (ranged) {
          const dist = (this.def.range[0] + this.def.range[1]) / 2;
          tx = p.x + this.side * dist;
          // fica fora da tela? volta para dentro
          tx = clamp(tx, w.camX + 20, w.camX + W - 20);
          ty = p.y + (this.cooldown < 30 ? 0 : this.laneOff);
        } else if (this.hasToken || w.tokens.free() > 0) {
          tx = p.x + this.side * this.def.range[0] * this.scale;
          ty = p.y;
        } else {
          // aguardando a vez: rodeia o jogador a uma distância segura
          tx = p.x + this.side * rand(70, 95);
          ty = p.y + this.laneOff;
        }
        const ddx = tx - this.x, ddy = ty - this.y;
        const spd = this.speed * (playerDown ? 0.4 : 1);
        this.vx = Math.abs(ddx) > 4 ? sign(ddx) * Math.min(spd, Math.abs(ddx)) : 0;
        this.vy = Math.abs(ddy) > 3 ? sign(ddy) * Math.min(spd * 0.7, Math.abs(ddy)) : 0;
        if (w.inGap(this.x + this.vx * 8, this.y + this.vy * 8)) {
          this.vx = 0;
          this.vy = this.y < 290 ? spd : -spd;
        }
        this.separate(w);
        if (playerDown || this.cooldown > 0) break;
        // pronto para atacar?
        const adx = Math.abs(dx), ady = Math.abs(dy);
        if (ranged) {
          if (ady < 9 && adx > 60 && adx < 300 && this.onScreen(w) && w.canEnemyShoot()) {
            w.lastEnemyShot = w.t;
            this.facing = sign(dx) as 1 | -1;
            this.setState('shootWind');
          } else if (this.kind === 'baller' && adx < 40 && ady < 12 && w.tokens.take(this)) {
            this.setState('windup');
          }
        } else if (this.def.attack === 'dash') {
          if (ady < 10 && adx < 170 && adx > 50 && w.tokens.take(this)) this.setState('windup');
          else if (adx < this.def.reach * this.scale + 6 && ady < 10 && w.tokens.take(this)) this.setState('windup');
        } else if (this.def.attack === 'steal') {
          if (adx < 70 && ady < 14 && w.tokens.take(this)) this.setState('dashSteal');
        } else if (adx < this.def.reach * this.scale + 4 && ady < 10 && chance(0.05 * this.aggression + 0.02)) {
          if (w.tokens.take(this)) this.setState('windup');
        }
        break;
      }
      case 'windup': {
        this.vx *= 0.5;
        this.vy *= 0.5;
        this.facing = sign(dx) as 1 | -1;
        const wind = Math.round(this.def.windup / Math.min(1.4, this.aggression));
        if (this.st >= wind) {
          this.hitDone = false;
          if (this.def.attack === 'dash' && Math.abs(dx) > 40) {
            this.setState('dash');
            audio.sfx('whoosh');
          } else this.setState('attack');
        }
        break;
      }
      case 'attack': {
        this.vx = this.facing * (this.st < 5 ? 1.2 : 0);
        if (!this.hitDone && this.st >= 3 && this.st <= 8) this.tryHit(w, this.def.reach * this.scale, this.dmg, this.kind === 'heavy');
        if (this.st >= 22) this.endAttack(w, rand(40, 80));
        break;
      }
      case 'dash': {
        this.vx = this.facing * this.speed * 2.6;
        this.vy = sign(dy) * Math.min(0.6, Math.abs(dy));
        if (!this.hitDone) this.tryHit(w, 20, this.dmg, false);
        if (this.st >= 26 || (this.hitDone && this.st > 6)) this.endAttack(w, rand(50, 90));
        break;
      }
      case 'dashSteal': {
        this.facing = sign(dx) as 1 | -1;
        this.vx = this.facing * this.speed * 1.9;
        this.vy = sign(dy) * Math.min(1.4, Math.abs(dy));
        if (Math.abs(dx) < 16 && Math.abs(dy) < 11) {
          if (p.ball === 'hand' && p.invuln === 0 && !p.passiveState) {
            p.ball = 'stolen';
            p.stolenT = 0;
            this.holdingBall = true;
            w.fx.popup(this.x, this.y - 80, 'STOLEN!', '#ff4d6d', 8);
            audio.sfx('steal');
            w.tokens.release(this);
            this.setState('flee');
          } else {
            this.tryHit(w, 24, this.dmg, false);
            this.endAttack(w, 70);
          }
        } else if (this.st > 50) this.endAttack(w, 60);
        break;
      }
      case 'flee': {
        // foge com a bola para fora da tela
        const away = this.x < p.x ? -1 : 1;
        this.facing = away as 1 | -1;
        this.vx = away * this.speed * 1.35;
        this.vy = 0;
        const out = this.x < w.camX - 30 || this.x > w.camX + W + 30;
        if (out) {
          this.remove = true;
          this.dead = true;
          p.stolenT = 75;
          w.fx.popup(p.x, p.y - 90, 'BALL LOST!', '#ff4d6d', 7);
        }
        break;
      }
      case 'shootWind':
        this.vx = 0;
        this.vy = 0;
        if (this.st >= this.def.windup) {
          const kind = this.def.projectile ?? 'can';
          const proj = new Projectile({ x: this.x + this.facing * 12, y: this.y, z: 40 * this.scale, vx: this.facing * (kind === 'ball' ? 5.3 : 4.6) * (1 + 0.02 * w.stageN), kind, fromPlayer: false, dmg: this.shotDmg, power: 'quick', range: 420, laneTol: 12 });
          proj.ownerId = this.id;
          w.projectiles.push(proj);
          audio.sfx('throw');
          this.setState('shoot');
        }
        break;
      case 'shoot':
        if (this.st >= 18) {
          this.cooldown = Math.round(this.def.cooldown / this.aggression + rand(0, 40));
          this.setState('approach');
        }
        break;
      case 'block':
        this.vx = 0;
        this.vy = 0;
        if (this.st >= 36) this.setState('approach');
        break;
      case 'dodge':
        this.vx *= 0.9;
        if (this.st >= 12) {
          this.vy = 0;
          this.setState('approach');
        }
        break;
      case 'ride': {
        // motoqueiro: atravessa a tela numa faixa e volta
        this.vx = this.facing * this.speed;
        this.vy = 0;
        if (!this.hitDone && Math.abs(dy) < 13 && Math.abs(dx) < 26 && p.z < 20) {
          this.hitDone = true;
          p.takeDamage(w, this.dmg, true, this.facing);
        }
        const offLeft = this.x < w.camX - 90, offRight = this.x > w.camX + W + 90;
        if ((offLeft && this.facing < 0) || (offRight && this.facing > 0)) {
          this.vx = 0;
          this.setState('rideWait');
        }
        if (this.st % 6 === 0) w.fx.dust(this.x - this.facing * 18, this.y, 1);
        break;
      }
      case 'rideWait':
        this.vx = 0;
        // escolhe a faixa e avisa (40 quadros) antes de voltar
        if (this.st === 30) {
          this.laneY = clamp(p.y + rand(-8, 8), FLOOR_TOP + 10, FLOOR_BOTTOM - 4);
          audio.sfx('steal');
        }
        if (this.st >= 70) {
          this.facing = -this.facing as 1 | -1;
          this.y = this.laneY;
          this.hitDone = false;
          this.ridePasses++;
          this.setState('ride');
          audio.sfx('whoosh');
        }
        break;
      case 'recover':
        this.vx *= 0.8;
        this.vy *= 0.8;
        if (this.st >= 20) this.setState('approach');
        break;
      case 'hurt':
        this.vx *= 0.85;
        this.vy *= 0.85;
        if (this.st >= 18) this.setState('approach');
        break;
      case 'fall':
        this.vx *= 0.98;
        if (this.z === 0 && this.st > 6) {
          this.setState(this.hp <= 0 ? 'ko' : 'down');
          w.fx.dust(this.x, this.y, 5);
        }
        break;
      case 'down':
        this.vx *= 0.8;
        if (this.st >= 40) this.setState('getup');
        break;
      case 'getup':
        this.vx = 0;
        if (this.st >= 22) {
          this.invuln = 20;
          this.setState('approach');
        }
        break;
      case 'ko':
        this.vx *= 0.9;
        if (this.z === 0 && this.st > 50) this.remove = true;
        break;
    }

    const margin = this.state === 'flee' || this.state === 'ride' || this.state === 'rideWait' ? 400 : 40;
    this.physics(w.camX - margin, w.camX + W + margin);
    if (this.state !== 'ride' && this.state !== 'rideWait') resolveObstacles(this, w.obstacles, 8, 4);
    if (this.z === 0 && !this.dead && w.inGap(this.x, this.y) && this.state !== 'ride') {
      // caiu no vão do telhado
      this.hp = 0;
      this.dead = true;
      this.remove = true;
      w.onEnemyDefeated(this, true);
    }
  }

  onScreen(w: World) {
    return this.x > w.camX + 10 && this.x < w.camX + W - 10;
  }

  separate(w: World) {
    for (const o of w.enemies) {
      if (o === this || o.dead) continue;
      const ddx = this.x - o.x, ddy = (this.y - o.y) * 1.6;
      const d = Math.hypot(ddx, ddy);
      if (d < 24 && d > 0.01) {
        this.vx += (ddx / d) * 0.6;
        this.vy += (ddy / d) * 0.4;
      }
    }
  }

  tryHit(w: World, reach: number, dmg: number, knock: boolean) {
    const p = w.player;
    const ddx = (p.x - this.x) * this.facing;
    if (ddx > -6 && ddx < reach + 6 && Math.abs(p.y - this.y) < 12 && p.z < 24) {
      if (p.takeDamage(w, dmg, knock, this.facing)) {
        this.hitDone = true;
        audio.sfx(knock ? 'bigHit' : 'hit');
      }
    }
  }

  endAttack(w: World, cd: number) {
    this.cooldown = Math.round(cd / this.aggression);
    // devolve a vez de atacar (libera a vaga para outro inimigo)
    w.tokens.release(this);
    this.setState('recover');
  }

  /** Reação a um arremesso que vem na direção dele (bloquear/esquivar) */
  react(w: World, proj: Projectile) {
    if (proj.judged.has(this.id) || this.passive || ['attack', 'windup', 'dash', 'ride', 'rideWait', 'shootWind'].includes(this.state)) return;
    proj.judged.add(this.id);
    if (this.def.blockChance && chance(this.def.blockChance) && proj.power === 'quick') {
      this.facing = sign(proj.x - this.x) as 1 | -1;
      this.setState('block');
      return;
    }
    if (this.def.dodgeChance && chance(this.def.dodgeChance)) {
      this.vy = this.y > 290 ? -3 : 3;
      this.setState('dodge');
    }
  }

  /** Recebe um golpe; devolve 'block' quando defendeu */
  receive(w: World, dmg: number, power: Power, dirX: number): 'block' | 'hit' | 'ko' {
    if (this.state === 'block' && power === 'quick' && sign(-dirX) === this.facing) {
      w.fx.popup(this.x, this.y - 74 * this.scale, 'BLOCK', '#9fdcff', 7);
      audio.sfx('block');
      return 'block';
    }
    this.hp -= dmg;
    this.flash = 6;
    this.showBar = 180;
    if (this.hasToken) w.tokens.release(this);
    if (this.holdingBall) {
      // o ladrão solta a bola
      this.holdingBall = false;
      w.returnBallFrom(this.x, this.y);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.vx = dirX * 3.2;
      this.vz = 4.2;
      this.z = Math.max(this.z, 0.1);
      this.setState('fall');
      return 'ko';
    }
    if (this.kind === 'biker' && (this.state === 'ride' || this.state === 'rideWait')) {
      const big = power === 'strong' || power === 'special' || power === 'super' || power === 'hazard';
      if (!big && this.hp > this.maxHp * 0.5) return 'hit';
      // derrubado da moto: a moto se desfaz e ele segue lutando a pé
      this.def = { ...ENEMIES.thug, score: ENEMIES.biker.score };
      this.speed = this.def.speed * 1.1;
      w.fx.debris(this.x, this.y, this.look.trim, 18);
      w.fx.popup(this.x, this.y - 70, 'CRASH!', '#ff8a3d', 8);
      audio.sfx('break');
      this.vx = dirX * 3;
      this.vz = 3.4;
      this.z = 0.1;
      this.setState('fall');
      return 'hit';
    }
    const big = power === 'strong' || power === 'special' || power === 'super' || power === 'hazard';
    if (this.def.armor && !big) return 'hit';
    if (big || dmg >= 20) {
      this.vx = dirX * 2.6;
      this.vz = 3.2;
      this.z = 0.1;
      this.setState('fall');
    } else {
      this.vx = dirX * 1.6;
      this.setState('hurt');
    }
    return 'hit';
  }

  drawShadowR() {
    return (this.kind === 'biker' && (this.state === 'ride' || this.state === 'rideWait') ? 22 : 14) * this.scale;
  }

  /** Aviso na borda da tela: o motoqueiro vai voltar por esta faixa */
  drawWarning(ctx: CanvasRenderingContext2D, t: number) {
    if (this.kind !== 'biker' || this.state !== 'rideWait' || this.st < 30 || Math.floor(t / 6) % 2) return;
    // ainda virado para o lado por onde saiu: volta por esse mesmo lado
    const fromRight = this.facing > 0;
    const x = fromRight ? W - 26 : 26;
    ctx.fillStyle = 'rgba(255,60,60,0.25)';
    ctx.fillRect(0, this.laneY - 14, W, 18);
    ctx.fillStyle = '#ff3b3b';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, this.laneY - 24);
    ctx.lineTo(x + 12, this.laneY - 2);
    ctx.lineTo(x - 12, this.laneY - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, this.laneY - 5);
    ctx.textAlign = 'left';
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const sx = this.x - camX, sy = this.y - this.z;
    const riding = this.kind === 'biker' && (this.state === 'ride' || this.state === 'rideWait');
    if (riding) drawBike(ctx, sx, sy, this.facing, t, this.look.trim, this.flash > 0);
    const map: Record<string, Anim> = {
      approach: Math.abs(this.vx) + Math.abs(this.vy) > 0.3 ? (Math.abs(this.vx) > 1.9 ? 'run' : 'walk') : 'idle',
      windup: this.def.attack === 'punch' ? (this.kind === 'heavy' ? 'punchWind' : this.id % 2 ? 'kickWind' : 'punchWind') : 'punchWind',
      attack: this.kind === 'heavy' || this.id % 2 === 0 ? 'punch' : 'kick',
      dash: 'dash', dashSteal: 'run', flee: 'run', shootWind: 'shootWind', shoot: 'shoot', block: 'block', dodge: 'walk',
      ride: 'ride', rideWait: 'ride', recover: 'idle', hurt: 'hurt', fall: this.hp <= 0 ? 'fall' : 'pushed', down: 'down', getup: 'getup', ko: 'ko',
    };
    const anim = map[this.state] ?? 'idle';
    const prog = this.state === 'fall' ? Math.min(1, this.st / 14) : this.state === 'getup' ? this.st / 22 : 0;
    const animT = this.state === 'approach' ? t + this.id * 13 : this.st;
    const ballMode = this.kind === 'baller' && this.state === 'shootWind' ? 'hand' : 'none';
    const pose = poseFor(anim, animT, { progress: prog, expr: this.state === 'down' || this.state === 'ko' ? 'ko' : this.state === 'hurt' ? 'hurt' : 'angry', ball: ballMode });
    // pisca antes de sumir
    const alpha = this.state === 'ko' && this.st > 25 ? (Math.floor(this.st / 3) % 2 ? 0.2 : 1) : 1;
    drawFighter(ctx, sx, sy - (riding ? 8 : 0), this.look, pose, { facing: this.facing, scale: this.scale, flash: this.flash > 0, alpha });
    if (this.holdingBall) drawBall(ctx, sx + this.facing * 10, sy - 42 * this.scale, 6, t * 0.2);
    if (this.state === 'windup' && this.st % 8 < 4) {
      // aviso de ataque
      ctx.fillStyle = '#ffdd33';
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', sx, sy - 82 * this.scale);
      ctx.textAlign = 'left';
    }
    if (!this.isBoss && this.state !== 'ko') enemyBar(ctx, sx, sy - 80 * this.scale - (riding ? 8 : 0), this.hp / this.maxHp, this.trail, this.name, true);
  }
}
