import { audio } from '../core/audio';
import { FLOOR_BOTTOM, FLOOR_TOP, W } from '../core/config';
import { chance, clamp, rand, sign } from '../core/math';
import { BOSSES, type BossDef, type BossMove } from '../data/bosses';
import { BOSS_LOOKS } from '../data/looks';
import { drawBall, drawFighter } from '../render/fighter';
import { poseFor, type Anim } from '../render/poses';
import type { Power } from './actor';
import { Enemy } from './enemy';
import { Projectile } from './projectile';
import type { World } from './world';

/** Chefe de fase: escolhe golpes por peso, com passivas (esquiva, armadura) e fúria com pouca vida. */
export class Boss extends Enemy {
  bdef: BossDef;
  move: BossMove | null = null;
  phase = 0;
  armor: number;
  enraged = false;
  target = { x: 0, y: 0 };
  shots = 0;
  summoned = new Set<number>();
  comboStep = 0;
  idleT = 0;
  lastMove: BossMove | null = null;
  vanish = 0;
  bigHits = 0;
  index: number;

  constructor(index: number, x: number, y: number, w: World) {
    super('heavy', x, y, w, BOSSES[index].name, index);
    this.index = index;
    this.bdef = BOSSES[index];
    this.isBoss = true;
    this.look = BOSS_LOOKS[index];
    this.scale = this.bdef.scale;
    const hp = Math.round(this.bdef.hp * w.diff.enemyHp);
    this.hp = hp;
    this.maxHp = hp;
    this.dmg = Math.round(this.bdef.dmg * w.diff.enemyDmg);
    this.speed = this.bdef.speed;
    this.armor = this.bdef.armor;
    this.name = this.bdef.name;
    this.facing = -1;
    this.setState('intro');
  }

  get halfW() {
    return 11 * this.scale;
  }

  private get mult() {
    return this.enraged ? this.bdef.rage : 1;
  }

  update(w: World) {
    this.tickTimers();
    if (this.cooldown > 0) this.cooldown--;
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    if (!this.enraged && this.hp < this.maxHp * 0.35 && this.state !== 'ko') {
      this.enraged = true;
      w.fx.popup(this.x, this.y - 110 * this.scale, 'RAGE!', '#ff4d4d', 11);
      audio.sfx('boss');
    }
    const s = this.speed * this.mult;
    const playerDown = ['ko', 'respawn', 'falling'].includes(p.state);

    switch (this.state) {
      case 'intro':
        // entra andando, depois provoca
        this.facing = sign(dx) as 1 | -1;
        if (this.x > w.camX + W - 110) this.vx = -1.4;
        else {
          this.vx = 0;
          if (this.st > 70) this.setState('think');
        }
        break;
      case 'think': {
        this.facing = sign(dx) as 1 | -1;
        // anda ao redor mantendo distância média
        const want = 110;
        const tx = p.x - this.facing * want;
        this.vx = Math.abs(tx - this.x) > 10 ? sign(tx - this.x) * s * 0.7 : 0;
        this.vy = Math.abs(dy) > 6 ? sign(dy) * s * 0.45 : 0;
        if (playerDown) break;
        if (this.st >= Math.round(40 / this.mult)) this.chooseMove(w);
        break;
      }
      case 'approach':
        // até o alcance do golpe corpo a corpo
        this.facing = sign(dx) as 1 | -1;
        this.vx = sign(dx) * s;
        this.vy = Math.abs(dy) > 3 ? sign(dy) * s * 0.7 : 0;
        if (Math.abs(dx) < 34 * this.scale && Math.abs(dy) < 9) this.setState(this.move === 'combo' ? 'combo' : 'windup');
        else if (this.st > 150) this.setState('think');
        break;
      case 'windup':
        this.vx = 0;
        this.vy = 0;
        this.facing = sign(dx) as 1 | -1;
        if (this.st >= Math.round(26 / this.mult)) {
          this.hitDone = false;
          this.setState('attack');
        }
        break;
      case 'attack':
        this.vx = this.facing * (this.st < 6 ? 1.6 : 0);
        if (!this.hitDone && this.st >= 3 && this.st <= 9) this.tryHit(w, 34 * this.scale, this.dmg, true);
        if (this.st >= 26) this.finish(50);
        break;
      case 'combo': {
        // 3 golpes rápidos (soco, chute, soco)
        this.vx = this.facing * 0.9;
        this.vy = 0;
        const step = Math.floor(this.st / 16);
        if (step !== this.comboStep) {
          this.comboStep = step;
          this.hitDone = false;
          audio.sfx('whoosh');
        }
        if (!this.hitDone && this.st % 16 >= 6 && this.st % 16 <= 10) this.tryHit(w, 32 * this.scale, Math.round(this.dmg * 0.6), step === 2);
        if (this.st >= 48) this.finish(60);
        break;
      }
      case 'align':
        // alinha na faixa do jogador antes da investida
        this.facing = sign(dx) as 1 | -1;
        this.vx = 0;
        this.vy = Math.abs(dy) > 2 ? sign(dy) * Math.min(2.2, Math.abs(dy)) : 0;
        if ((Math.abs(dy) < 4 && this.st > 10) || this.st > 45) {
          this.setState('dashWind');
          audio.sfx('whoosh');
        }
        break;
      case 'dashWind':
        this.vx = -this.facing * 0.5;
        this.vy = 0;
        if (this.st >= Math.round(22 / this.mult)) {
          this.hitDone = false;
          this.setState('dash');
        }
        break;
      case 'dash':
        this.vx = this.facing * 6.5 * this.mult;
        this.vy = 0;
        if (this.st % 3 === 0) w.fx.dust(this.x - this.facing * 10, this.y, 1);
        if (!this.hitDone) this.tryHit(w, 24 * this.scale, this.dmg, true);
        if (this.st > 38 || this.x < w.camX + 24 || this.x > w.camX + W - 24) this.finish(55);
        break;
      case 'retreat': {
        // recua para atirar de longe
        this.facing = sign(dx) as 1 | -1;
        const tx = clamp(p.x - this.facing * 210, w.camX + 30, w.camX + W - 30);
        this.vx = Math.abs(tx - this.x) > 8 ? sign(tx - this.x) * s * 1.2 : 0;
        this.vy = Math.abs(dy) > 4 ? sign(dy) * s * 0.8 : 0;
        if ((Math.abs(tx - this.x) < 12 && Math.abs(dy) < 8) || this.st > 70) {
          this.shots = 0;
          this.setState('volley');
        }
        break;
      }
      case 'volley': {
        this.vx = 0;
        this.vy = 0;
        this.facing = sign(dx) as 1 | -1;
        const wind = Math.round(24 / this.mult);
        const count = this.bdef.volley.count + (this.enraged ? 2 : 0);
        if (this.st >= wind && (this.st - wind) % 9 === 0 && this.shots < count) {
          const mid = (count - 1) / 2;
          const yy = clamp(p.y + (this.shots - mid) * this.bdef.volley.spread, FLOOR_TOP + 6, FLOOR_BOTTOM - 2);
          const pr = new Projectile({ x: this.x + this.facing * 16 * this.scale, y: yy, z: 44 * this.scale, vx: this.facing * this.bdef.volley.speed * this.mult, kind: this.bdef.projectile, fromPlayer: false, dmg: Math.round(this.dmg * 0.75), power: 'quick', range: 520, laneTol: 13, maxLife: 200 });
          pr.ownerId = this.id;
          if (this.bdef.projectile === 'rocket') pr.homing = 0.035;
          w.projectiles.push(pr);
          this.shots++;
          audio.sfx(this.bdef.projectile === 'ball' ? 'throw' : 'special');
        }
        if (this.shots >= count && this.st > wind + count * 9 + 10) this.finish(45);
        break;
      }
      case 'jump': {
        // salto até onde o jogador estava (sombra marca o ponto)
        const k = Math.min(1, this.st / 38);
        this.x += (this.target.x - this.x) * 0.08;
        this.y += (this.target.y - this.y) * 0.08;
        this.vx = 0;
        this.vy = 0;
        if (this.z === 0 && this.st > 6) {
          this.slamLand(w);
          this.finish(60);
        }
        void k;
        break;
      }
      case 'jumpWind':
        this.vx = 0;
        this.vy = 0;
        if (this.st >= Math.round(18 / this.mult)) {
          this.target = { x: p.x, y: p.y };
          this.vz = 8.5;
          this.z = 0.1;
          this.setState('jump');
          audio.sfx('whoosh');
        }
        break;
      case 'vanish':
        this.vx = 0;
        this.vy = 0;
        this.vanish = Math.min(1, this.st / 14);
        if (this.st === 16) {
          // reaparece atrás do jogador
          this.x = clamp(p.x - p.facing * 46, w.camX + 30, w.camX + W - 30);
          this.y = p.y;
          this.facing = sign(p.x - this.x) as 1 | -1;
          w.fx.smoke(this.x, this.y, 30);
        }
        if (this.st > 16) this.vanish = Math.max(0, 1 - (this.st - 16) / 8);
        if (this.st >= 26) {
          this.vanish = 0;
          this.move = 'combo';
          this.comboStep = -1;
          this.setState('combo');
        }
        break;
      case 'summon':
        this.vx = 0;
        this.vy = 0;
        if (this.st === 30) {
          const kinds = this.bdef.summon ?? ['thug'];
          for (let i = 0; i < 2; i++) w.spawnEnemy(kinds[(i + this.phase) % kinds.length], i === 0 ? 1 : -1);
          audio.sfx('boss');
        }
        if (this.st >= 60) this.finish(30);
        break;
      case 'stagger':
        this.vx *= 0.85;
        if (this.st >= 14) this.setState('think');
        break;
      case 'recover':
        this.vx *= 0.8;
        this.vy *= 0.8;
        if (this.st >= Math.round(26 / this.mult)) this.setState('think');
        break;
      case 'fall':
        this.vx *= 0.97;
        if (this.z === 0 && this.st > 6) this.setState(this.hp <= 0 ? 'ko' : 'down');
        break;
      case 'down':
        this.vx *= 0.8;
        if (this.st >= 34) this.setState('getup');
        break;
      case 'getup':
        if (this.st >= 22) {
          this.invuln = 30;
          this.setState('think');
        }
        break;
      case 'dodge':
        this.vx *= 0.9;
        if (this.st >= 12) {
          this.vy = 0;
          this.setState('think');
        }
        break;
      case 'ko':
        this.vx *= 0.92;
        break;
    }

    this.physics(w.camX + 12, w.camX + W - 12);
  }

  private chooseMove(w: World) {
    // convoca capangas ao passar de 66% e 33%
    const hpFrac = this.hp / this.maxHp;
    if (this.bdef.moves.summon) {
      for (const th of [0.66, 0.33]) {
        if (hpFrac < th && !this.summoned.has(th)) {
          this.summoned.add(th);
          this.phase++;
          this.move = 'summon';
          this.setState('summon');
          return;
        }
      }
    }
    const dist = Math.abs(w.player.x - this.x);
    const opts = Object.entries(this.bdef.moves).filter(([m]) => m !== 'summon') as [BossMove, number][];
    // o rei ganha golpes novos conforme as fases da luta
    const allowed = opts.filter(([m]) => {
      if (this.index === 9 && hpFrac > 0.66 && ['dash', 'slam', 'teleport'].includes(m)) return false;
      if (this.index === 9 && hpFrac > 0.33 && m === 'teleport') return false;
      return true;
    });
    let total = 0;
    const weighted = allowed.map(([m, wgt]) => {
      let v = wgt;
      if (m === this.lastMove) v *= 0.4;
      if ((m === 'melee' || m === 'combo') && dist < 90) v *= 1.6;
      if (m === 'volley' && dist > 150) v *= 1.5;
      total += v;
      return [m, v] as const;
    });
    let r = Math.random() * total;
    let pickMove: BossMove = weighted[0][0];
    for (const [m, v] of weighted) {
      r -= v;
      if (r <= 0) {
        pickMove = m;
        break;
      }
    }
    this.move = pickMove;
    this.lastMove = pickMove;
    this.comboStep = -1;
    switch (pickMove) {
      case 'melee':
      case 'combo':
        this.setState('approach');
        break;
      case 'dash':
        this.setState('align');
        break;
      case 'volley':
        this.setState('retreat');
        break;
      case 'slam':
        this.setState('jumpWind');
        break;
      case 'teleport':
        this.setState('vanish');
        audio.sfx('whoosh');
        break;
    }
  }

  private slamLand(w: World) {
    const p = w.player;
    const R = 72 * Math.min(1.4, this.scale);
    w.fx.ring(this.x, this.y, R * 2, 'rgba(255,220,120,0.9)');
    w.fx.dust(this.x, this.y, 14);
    w.fx.shake = 10;
    audio.sfx('bigHit');
    if (Math.hypot(p.x - this.x, (p.y - this.y) * 2.2) < R && p.z < 30) p.takeDamage(w, this.dmg, true, sign(p.x - this.x));
  }

  private finish(recover: number) {
    this.cooldown = recover;
    this.setState('recover');
  }

  react(w: World, proj: Projectile) {
    if (proj.judged.has(this.id)) return;
    proj.judged.add(this.id);
    const busy = ['attack', 'combo', 'dash', 'jump', 'jumpWind', 'volley', 'summon', 'vanish', 'fall', 'down', 'getup', 'ko', 'stagger', 'intro'].includes(this.state);
    if (busy || proj.power === 'super') return;
    if (chance(this.bdef.dodge * (this.enraged ? 1.15 : 1))) {
      this.vy = this.y > (FLOOR_TOP + FLOOR_BOTTOM) / 2 ? -3.4 : 3.4;
      w.fx.popup(this.x, this.y - 92 * this.scale, 'DODGE', '#c9b6ff', 7);
      this.setState('dodge');
    }
  }

  receive(w: World, dmg: number, power: Power, dirX: number): 'block' | 'hit' | 'ko' {
    if (this.state === 'intro' || this.state === 'ko' || this.vanish > 0.5) return 'block';
    let d = dmg;
    if (this.armor > 0 && power !== 'super') d = Math.round(dmg * (1 - this.armor * (power === 'quick' || power === 'melee' ? 1 : 0.5)));
    d = Math.max(1, d);
    this.hp -= d;
    this.flash = 6;
    if (this.bdef.armorBreaks && this.armor > 0 && this.hp < this.maxHp * 0.5) {
      this.armor = 0;
      this.look = { ...this.look, armor: undefined };
      w.fx.debris(this.x, this.y, '#9aa3ad', 20);
      w.fx.popup(this.x, this.y - 100 * this.scale, 'ARMOR BREAK!', '#ffd23f', 9);
      audio.sfx('break');
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.vx = dirX * 2.4;
      this.vz = 5;
      this.z = 0.1;
      this.setState('fall');
      return 'ko';
    }
    // golpes fortes derrubam de vez em quando (sem travar o chefe)
    const big = power === 'strong' || power === 'special' || power === 'super';
    const interruptible = ['think', 'approach', 'retreat', 'align', 'recover', 'dodge', 'windup', 'dashWind', 'jumpWind'].includes(this.state);
    if (big && interruptible) {
      this.bigHits++;
      if (this.bigHits % 3 === 0) {
        this.vx = dirX * 2.2;
        this.vz = 3;
        this.z = 0.1;
        this.setState('fall');
      } else {
        this.vx = dirX * 1.4;
        this.setState('stagger');
      }
    }
    return 'hit';
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const sx = this.x - camX, sy = this.y - this.z;
    // marca de pouso do salto
    if (this.state === 'jump') {
      ctx.strokeStyle = Math.floor(t / 4) % 2 ? '#ff4d4d' : '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.target.x - camX, this.target.y, 30, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const comboAnims: Anim[] = ['punch', 'kick', 'punch'];
    const map: Record<string, Anim> = {
      intro: this.st > 30 ? 'taunt' : 'walk', think: Math.abs(this.vx) + Math.abs(this.vy) > 0.3 ? 'walk' : 'idle', approach: 'run', windup: 'punchWind', attack: 'punch',
      combo: this.st % 16 < 6 ? 'punchWind' : comboAnims[Math.min(2, Math.floor(this.st / 16))], align: 'walk', dashWind: 'guard', dash: 'dash', retreat: 'walk',
      volley: this.st % 9 < 5 ? 'shootWind' : 'shoot', jumpWind: 'guard', jump: this.vz > 0 ? 'jump' : 'slam', vanish: 'guard', summon: 'taunt', stagger: 'hurt',
      recover: 'idle', fall: this.hp <= 0 ? 'fall' : 'pushed', down: 'down', getup: 'getup', dodge: 'walk', ko: 'ko',
    };
    const anim = map[this.state] ?? 'idle';
    const prog = this.state === 'fall' ? Math.min(1, this.st / 14) : this.state === 'getup' ? this.st / 22 : 0;
    const ballMode = this.bdef.projectile === 'ball' && (this.state === 'volley' || this.state === 'retreat') ? 'hand' : 'none';
    const pose = poseFor(anim, this.state === 'think' ? t : this.st, { progress: prog, expr: this.state === 'down' || this.state === 'ko' ? 'ko' : this.enraged ? 'angry' : 'focus', ball: ballMode });
    const alpha = (1 - this.vanish) * (this.state === 'ko' && this.st > 60 ? (Math.floor(this.st / 3) % 2 ? 0.3 : 1) : 1);
    // fúria: aura vermelha
    if (this.enraged && this.state !== 'ko') {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(t * 0.2) * 0.1;
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 40 * this.scale, 26 * this.scale, 46 * this.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // rastro do teleporte / investida
    if (this.state === 'dash' || this.state === 'vanish') {
      for (let i = 1; i <= 3; i++) drawFighter(ctx, sx - this.facing * i * 14, sy, this.look, pose, { facing: this.facing, scale: this.scale, alpha: 0.18 * (4 - i) * alpha });
    }
    drawFighter(ctx, sx, sy, this.look, pose, { facing: this.facing, scale: this.scale, flash: this.flash > 0, alpha });
    if (this.state === 'volley' && this.bdef.projectile === 'ball') drawBall(ctx, sx + this.facing * 8, sy - 80 * this.scale, 5, t * 0.3);
    if ((this.state === 'windup' || this.state === 'dashWind' || this.state === 'jumpWind') && this.st % 8 < 4) {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 14px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!!', sx, sy - 92 * this.scale);
      ctx.textAlign = 'left';
    }
  }
}
