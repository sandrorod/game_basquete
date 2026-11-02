import { audio } from '../core/audio';
import { DIFFICULTY, FLOOR_BOTTOM, FLOOR_TOP, H, W, type Difficulty } from '../core/config';
import type { Input } from '../core/input';
import { clamp, rand, rng, sign } from '../core/math';
import type { EnemyKind } from '../data/looks';
import { STAGES, type HazardKind, type StageDef } from '../data/stages';
import { buildStageArt, FAR_PARALLAX, ART_SCALE, type StageArt } from '../render/backgrounds';
import { Effects } from '../render/effects';
import { drawBall } from '../render/fighter';
import { drawHud, text } from '../render/hud';
import { drawPickup, drawProjectile, drawProp, drawTrafficCar, drawTrain, PROP_SIZE, type PickupKind } from '../render/props';
import type { Power } from './actor';
import { Boss } from './boss';
import { Enemy } from './enemy';
import { Obstacle, Pickup } from './obstacle';
import { Player } from './player';
import { Projectile } from './projectile';

interface Wave {
  x: number;
  spawned: boolean;
  queue: { kind: EnemyKind; side: 1 | -1; name?: string }[];
  cleared: boolean;
}

interface Hazard {
  kind: HazardKind;
  x: number;
  y: number;
  t: number;
  period: number;
  dir: 1 | -1;
  w: number;
  hitIds: Set<number>;
}

interface Gap { x0: number; x1: number; y0: number; y1: number }

export type WorldEvent = 'none' | 'stageClear' | 'gameOver';

/** Uma fase em andamento. */
export class World {
  stage: StageDef;
  stageN: number;
  diff: (typeof DIFFICULTY)[Difficulty];
  art: StageArt;
  player: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  obstacles: Obstacle[] = [];
  pickups: Pickup[] = [];
  hazards: Hazard[] = [];
  gaps: Gap[] = [];
  fx = new Effects();
  camX = 0;
  lockX: number | null = null;
  waves: Wave[] = [];
  boss: Boss | null = null;
  bossPhase: 'none' | 'intro' | 'fight' | 'ko' = 'none';
  bossT = 0;
  goT = 0;
  t = 0;
  frozen = 0;
  slowmo = 0;
  score: number;
  lives: number;
  nextLifeAt: number;
  event: WorldEvent = 'none';
  stageT = 0;
  clearT = 0;
  startScore: number;
  spawnCd = 0;
  maxOnScreen: number;
  /** Último disparo de inimigo comum: evita chuva de projéteis de vários atiradores ao mesmo tempo */
  lastEnemyShot = -999;

  canEnemyShoot() {
    return this.t - this.lastEnemyShot > Math.max(50, 74 - this.stageN * 2);
  }

  tokens = {
    max: 2,
    holders: new Set<number>(),
    free: () => this.tokens.max - this.tokens.holders.size,
    take: (e: Enemy) => {
      if (e.hasToken) return true;
      if (this.tokens.holders.size >= this.tokens.max) return false;
      this.tokens.holders.add(e.id);
      e.hasToken = true;
      return true;
    },
    release: (e: Enemy) => {
      this.tokens.holders.delete(e.id);
      e.hasToken = false;
    },
  };

  constructor(stageIndex: number, difficulty: Difficulty, carry: { score: number; lives: number; hp?: number; nextLifeAt: number }) {
    this.stage = STAGES[stageIndex];
    this.stageN = this.stage.n;
    this.diff = DIFFICULTY[difficulty];
    this.art = buildStageArt(this.stage.theme, this.stage.length, 1000 + this.stageN * 77);
    this.player = new Player(90, 300);
    if (carry.hp) this.player.hp = carry.hp;
    this.score = carry.score;
    this.startScore = carry.score;
    this.lives = carry.lives;
    this.nextLifeAt = carry.nextLifeAt;
    // no máximo 3 inimigos atacando ao mesmo tempo (2 nas primeiras fases)
    this.tokens.max = 2 + Math.floor(this.stageN / 6);
    this.maxOnScreen = Math.min(6, 3 + Math.floor(this.stageN / 3));
    this.build();
  }

  get minX() {
    return this.camX;
  }
  get maxX() {
    return this.camX + W;
  }

  /** Monta obstáculos, perigos e ondas com sorteio fixo por fase */
  private build() {
    const r = rng(this.stageN * 991 + 7);
    const L = this.stage.length;
    const arenaStart = L - W;
    // obstáculos: espaçados, sem fechar a rua inteira
    let x = 260;
    while (x < arenaStart - 80) {
      const kind = r.pick(this.stage.props);
      const s = PROP_SIZE[kind];
      const big = s.fd > 14;
      const y = big ? r.range(FLOOR_TOP + s.fd + 2, FLOOR_TOP + 40) : r.chance(0.5) ? r.range(FLOOR_TOP + s.fd + 4, FLOOR_TOP + 46) : r.range(FLOOR_BOTTOM - 26, FLOOR_BOTTOM - 2);
      this.obstacles.push(new Obstacle(kind, x, y, this.stage.palette.a));
      // às vezes um par (um em cima, outro embaixo) deixando passagem no meio
      if (r.chance(0.25) && !big) {
        const k2 = r.pick(this.stage.props);
        if (PROP_SIZE[k2].fd <= 14) this.obstacles.push(new Obstacle(k2, x + r.range(-20, 20), FLOOR_BOTTOM - r.range(2, 20), this.stage.palette.b));
      }
      x += r.range(150, 260);
    }
    // perigos
    for (const hz of this.stage.hazards) {
      if (hz === 'train') this.hazards.push({ kind: 'train', x: 0, y: FLOOR_TOP + 24, t: 200, period: 620, dir: -1, w: 0, hitIds: new Set() });
      if (hz === 'traffic') this.hazards.push({ kind: 'traffic', x: 0, y: 0, t: 260, period: 560, dir: 1, w: 0, hitIds: new Set() });
      if (hz === 'steam') {
        for (let sx = 520; sx < arenaStart - 100; sx += r.range(420, 560)) this.hazards.push({ kind: 'steam', x: sx, y: r.range(FLOOR_TOP + 20, FLOOR_BOTTOM - 20), t: r.int(0, 200), period: 220, dir: 1, w: 0, hitIds: new Set() });
      }
      if (hz === 'gap') {
        for (let gx = 700; gx < arenaStart - 200; gx += r.range(520, 700)) {
          // vão na metade de cima ou de baixo, sempre com passagem
          const top = r.chance(0.5);
          this.gaps.push({ x0: gx, x1: gx + r.range(60, 90), y0: top ? FLOOR_TOP : FLOOR_TOP + 62, y1: top ? FLOOR_TOP + 46 : FLOOR_BOTTOM + 12 });
        }
      }
    }
    // tirar obstáculos de cima dos vãos
    this.obstacles = this.obstacles.filter((o) => !this.gaps.some((g) => o.x > g.x0 - 30 && o.x < g.x1 + 30));
    // ondas de inimigos
    const n = this.stage.waves;
    const pool = this.stage.enemies;
    const totalW = pool.reduce((a, b) => a + b.w, 0);
    for (let i = 0; i < n; i++) {
      const wx = 420 + (i * (arenaStart - 520)) / n;
      const count = Math.min(9, 3 + Math.floor(this.stageN * 0.45) + (i % 2) + Math.floor(i / 3));
      const queue: Wave['queue'] = [];
      for (let k = 0; k < count; k++) {
        let rr = r.range(0, totalW);
        let choice = pool[0];
        for (const e of pool) {
          rr -= e.w;
          if (rr <= 0) {
            choice = e;
            break;
          }
        }
        queue.push({ kind: choice.kind, side: r.chance(0.7) ? 1 : -1, name: choice.name });
      }
      this.waves.push({ x: wx, spawned: false, queue, cleared: false });
    }
  }

  freeze(n: number) {
    this.frozen = Math.max(this.frozen, n);
  }

  inGap(x: number, y: number) {
    for (const g of this.gaps) if (x > g.x0 + 6 && x < g.x1 - 6 && y > g.y0 + 3 && y < g.y1) return true;
    return false;
  }

  nearGap(x: number, y: number, margin: number) {
    for (const g of this.gaps) if (x > g.x0 - margin && x < g.x1 + margin && y > g.y0 - margin * 0.5 && y < g.y1 + margin * 0.5) return true;
    return false;
  }

  spawnEnemy(kind: EnemyKind, side: 1 | -1, name?: string) {
    const x = side === 1 ? this.camX + W + 30 : this.camX - 30;
    const y = clamp(this.player.y + rand(-40, 40), FLOOR_TOP + 10, FLOOR_BOTTOM - 4);
    const e = new Enemy(kind, x, y, this, name);
    if (kind === 'biker') e.facing = side === 1 ? -1 : 1;
    this.enemies.push(e);
    return e;
  }

  pushAway(x: number, y: number, radius: number) {
    for (const e of this.enemies) {
      if (e.dead || e.isBoss) continue;
      const d = Math.hypot(e.x - x, (e.y - y) * 2);
      if (d < radius) {
        e.vx = sign(e.x - x) * 3;
        e.vz = 2.5;
        e.z = 0.1;
        e.setState('fall');
      }
    }
  }

  addScore(n: number) {
    this.score += n;
    if (this.score >= this.nextLifeAt) {
      // cada vida extra fica mais difícil: 60 mil, 132 mil, 290 mil, 638 mil…
      this.nextLifeAt = Math.round(this.nextLifeAt * 2.2);
      this.lives++;
      audio.sfx('oneUp');
      this.fx.popup(this.player.x, this.player.y - 100, '1UP!', '#7cff6b', 12);
    }
  }

  /** A bola (ou outro golpe do jogador) acertou um inimigo */
  hitEnemy(e: Enemy, dmg: number, power: Power, dirX: number, hx: number, hy: number, hz: number): boolean {
    const res = e.receive(this, dmg, power, dirX);
    if (res === 'block') return false;
    const p = this.player;
    p.combo++;
    p.comboT = 100;
    p.bestCombo = Math.max(p.bestCombo, p.combo);
    p.sp = Math.min(1, p.sp + (power === 'quick' || power === 'melee' ? 0.07 : power === 'super' ? 0 : 0.11));
    const big = power !== 'quick' && power !== 'melee';
    this.fx.hit(hx, hy, hz, big || res === 'ko', power === 'super' ? '#38f6ff' : '#ffe66d');
    this.freeze(res === 'ko' ? 7 : big ? 5 : 3);
    audio.sfx(big ? 'bigHit' : 'hit');
    this.addScore(50 + (p.combo >= 3 ? p.combo * 30 : 0));
    if (p.combo >= 3 && p.combo % 5 === 0) this.fx.popup(p.x, p.y - 95, `${p.combo} COMBO!`, '#ffd23f', 9);
    if (res === 'ko') this.onEnemyDefeated(e, false);
    return true;
  }

  onEnemyDefeated(e: Enemy, fell: boolean) {
    if (e.hasToken) this.tokens.release(e);
    if (e.isBoss) return this.onBossDefeated(e as Boss);
    const pts = e.def.score * (1 + Math.floor(this.stageN / 3));
    this.addScore(pts);
    this.fx.popup(e.x, e.y - 70, `+${pts}`, '#ffffff', 7);
    audio.sfx('enemyKo');
    if (fell) this.fx.popup(e.x, e.y - 50, 'FELL!', '#ff8a3d', 7);
  }

  private onBossDefeated(b: Boss) {
    this.bossPhase = 'ko';
    this.bossT = 0;
    this.slowmo = 90;
    const timeBonus = Math.max(0, 6000 - Math.floor(b.st / 2));
    const pts = 5000 + this.stageN * 1000;
    this.addScore(pts);
    this.fx.popup(b.x, b.y - 120, `+${pts}`, '#ffd23f', 10);
    void timeBonus;
    audio.sfx('bossKo');
    this.fx.flash = 14;
    this.fx.shake = 14;
    for (const e of this.enemies) if (!e.isBoss && !e.dead) e.receive(this, 999, 'super', sign(e.x - b.x));
  }

  /** Bola volta para o jogador (ex.: ladrão derrubado) */
  returnBallFrom(x: number, y: number) {
    const p = new Projectile({ x, y, z: 40, vx: 0, kind: 'ball', fromPlayer: true, dmg: 0, power: 'quick' });
    p.mainBall = true;
    p.returning = true;
    this.projectiles.push(p);
    this.player.ball = 'out';
    this.player.stolenT = 0;
    this.fx.popup(x, y - 70, 'BALL BACK!', '#ffd23f', 7);
  }

  onPlayerDown() {
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.event = 'gameOver';
      audio.sfx('gameOver');
      return;
    }
    const p = this.player;
    p.hp = p.maxHp;
    p.z = 150;
    p.vz = 0;
    p.ball = 'hand';
    p.invuln = 150;
    p.x = clamp(p.x, this.camX + 60, this.camX + W - 60);
    p.setState('respawn');
    for (const pr of this.projectiles) if (pr.mainBall) pr.remove = true;
  }

  update(input: Input) {
    this.t++;
    this.stageT++;
    if (this.frozen > 0) {
      this.frozen--;
      this.fx.update();
      return;
    }
    if (this.slowmo > 0) {
      this.slowmo--;
      if (this.slowmo % 3 !== 0) {
        this.fx.update();
        return;
      }
    }

    const p = this.player;
    p.update(this, input);
    for (const e of this.enemies) e.update(this);
    this.updateProjectiles();
    this.updatePickups();
    this.updateHazards();
    for (const o of this.obstacles) {
      if (o.hitT > 0) o.hitT -= 0.1;
      if (o.flash > 0) o.flash--;
    }
    this.enemies = this.enemies.filter((e) => {
      if (e.remove && e.hasToken) this.tokens.release(e);
      return !e.remove || e.isBoss;
    });
    this.updateCamera();
    this.updateWaves();
    this.updateBoss();
    this.fx.update();
    if (this.goT > 0) this.goT--;
  }

  private updateProjectiles() {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.life++;
      pr.spin += 0.35 * sign(pr.vx || 1);
      if (pr.returning) {
        // volta para a mão do jogador
        const tx = p.x + p.facing * 8, ty = p.y, tz = 40;
        const dx = tx - pr.x, dy = ty - pr.y, dz = tz - pr.z;
        const d = Math.hypot(dx, dy * 1.5, dz) || 1;
        const sp = Math.min(13, 6 + pr.life * 0.15);
        pr.x += (dx / d) * sp;
        pr.y += (dy / d) * sp;
        pr.z += (dz / d) * sp;
        // na volta a bola também acerta quem estiver no caminho (uma vez por inimigo, sem repetir quem já levou na ida)
        if (pr.dmg > 0) {
          for (const e of this.enemies) {
            if (e.dead || pr.hits.has(e.id) || pr.returnHits.has(e.id) || e.invuln > 0) continue;
            if (Math.abs(e.y - pr.y) > pr.laneTol + 4 || Math.abs(e.x - pr.x) > e.halfW + pr.radius) continue;
            if (pr.z < e.z - 4 || pr.z > e.z + e.height + 6) continue;
            pr.returnHits.add(e.id);
            this.hitEnemy(e, Math.max(6, Math.round(pr.dmg * 0.6)), 'quick', sign(dx || 1), pr.x, pr.y, pr.z);
          }
        }
        if (d < 16 || pr.life > 200) {
          pr.remove = true;
          if (p.ball === 'out') p.catchBall();
        }
        continue;
      }
      if (pr.homing && !pr.fromPlayer) pr.vy += sign(p.y - pr.y) * pr.homing * 2;
      pr.vy *= 0.97;
      pr.x += pr.vx;
      pr.y = clamp(pr.y + pr.vy, FLOOR_TOP + 2, FLOOR_BOTTOM);
      if (pr.power === 'special' || pr.power === 'super') {
        if (this.t % 2 === 0) this.fx.smoke(pr.x - sign(pr.vx) * 8, pr.y, pr.z);
      }
      const outOfRange = Math.abs(pr.x - pr.startX) > pr.range || pr.life > pr.maxLife || pr.x < this.camX - 60 || pr.x > this.camX + W + 60;
      if (pr.fromPlayer) {
        // inimigos veem a bola chegando (bloquear/esquivar)
        for (const e of this.enemies) {
          if (e.dead || pr.judged.has(e.id)) continue;
          const ahead = (e.x - pr.x) * sign(pr.vx);
          if (ahead > 0 && ahead < 110 && Math.abs(e.y - pr.y) < pr.laneTol + 6) e.react(this, pr);
        }
        for (const e of this.enemies) {
          if (e.dead || pr.hits.has(e.id) || e.invuln > 0) continue;
          if (Math.abs(e.y - pr.y) > pr.laneTol || Math.abs(e.x - pr.x) > e.halfW + pr.radius) continue;
          if (pr.z < e.z - 4 || pr.z > e.z + e.height + 6) continue;
          pr.hits.add(e.id);
          const landed = this.hitEnemy(e, pr.dmg, pr.power, sign(pr.vx), pr.x, pr.y, pr.z);
          if (!pr.pierce || !landed) {
            if (pr.mainBall) {
              pr.returning = true;
              pr.life = 0;
              // quica para trás antes de voltar
              pr.x -= sign(pr.vx) * 6;
            } else pr.remove = true;
            break;
          }
        }
        // a bola do jogador rebate projéteis inimigos no ar
        if (!pr.returning && !pr.remove) {
          const enemyProj = this.projectiles.find((q) => !q.fromPlayer && !q.remove && Math.abs(q.x - pr.x) < 12 && Math.abs(q.y - pr.y) < 12);
          if (enemyProj) {
            enemyProj.remove = true;
            this.fx.hit(enemyProj.x, enemyProj.y, enemyProj.z, false, '#9fdcff');
            this.fx.popup(enemyProj.x, enemyProj.y - 50, 'DEFLECT!', '#9fdcff', 7);
            audio.sfx('block');
            this.addScore(100);
            if (!pr.pierce) {
              if (pr.mainBall) {
                pr.returning = true;
                pr.life = 0;
              } else pr.remove = true;
            }
          }
        }
        if (!pr.returning && !pr.remove) {
          for (const o of this.obstacles) {
            if (o.broken || !o.breakable) continue;
            const f = o.footprint();
            // a bola vai na altura do peito: acerta também obstáculos baixos (caixas, lixeiras, cones)
            if (pr.x > f.x0 - 4 && pr.x < f.x1 + 4 && pr.y > f.y0 - 8 && pr.y < f.y1 + 8 && pr.z < Math.max(o.size.h, 30) + 18) {
              this.damageObstacle(o, pr.dmg);
              if (!pr.pierce) {
                if (pr.mainBall) {
                  pr.returning = true;
                  pr.life = 0;
                } else pr.remove = true;
              }
              break;
            }
          }
        }
        if (!pr.returning && !pr.remove && outOfRange) {
          if (pr.mainBall) {
            pr.returning = true;
            pr.life = 0;
          } else pr.remove = true;
        }
      } else {
        // projétil inimigo
        if (Math.abs(p.y - pr.y) < pr.laneTol && Math.abs(p.x - pr.x) < p.halfW + pr.radius && p.z < 50) {
          if (p.takeDamage(this, pr.dmg, pr.kind === 'rocket' || pr.kind === 'fire', sign(pr.vx))) {
            if (pr.kind === 'rocket') this.fx.debris(pr.x, pr.y, '#ff9f1c', 8);
            pr.remove = true;
          }
        }
        if (outOfRange) pr.remove = true;
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.remove);
    // a bola nunca some: se não houver bola em jogo e o jogador estiver sem ela, devolve
    if (p.ball === 'out' && !this.projectiles.some((pr) => pr.mainBall)) p.catchBall();
  }

  damageObstacle(o: Obstacle, dmg: number) {
    o.hp -= dmg;
    o.hitT = 1;
    o.flash = 4;
    audio.sfx('hit');
    if (o.hp <= 0) {
      o.broken = true;
      this.fx.debris(o.x, o.y, o.kind === 'barrel' ? o.accent : o.kind === 'trash' ? '#7d8a8c' : '#b07a3c', 16);
      audio.sfx('break');
      this.addScore(100);
      this.fx.popup(o.x, o.y - 40, '+100', '#ffffff', 6);
      const r = Math.random();
      let drop: PickupKind | null = null;
      if (r < 0.18) drop = 'chicken';
      else if (r < 0.38) drop = 'burger';
      else if (r < 0.55) drop = 'soda';
      else if (r < 0.68) drop = 'star';
      else if (r < 0.7) drop = 'oneup';
      if (drop) this.pickups.push(new Pickup(drop, o.x, clamp(o.y + 4, FLOOR_TOP + 6, FLOOR_BOTTOM)));
    }
  }

  private updatePickups() {
    const p = this.player;
    for (const k of this.pickups) {
      k.t++;
      if (Math.abs(k.x - p.x) < 16 && Math.abs(k.y - p.y) < 12 && p.z < 10 && !['ko', 'falling'].includes(p.state)) {
        k.taken = true;
        audio.sfx(k.kind === 'oneup' ? 'oneUp' : 'pickup');
        const heal: Partial<Record<PickupKind, number>> = { chicken: 45, burger: 28, soda: 14 };
        if (heal[k.kind]) {
          p.hp = Math.min(p.maxHp, p.hp + heal[k.kind]!);
          this.fx.popup(k.x, k.y - 30, `+${heal[k.kind]} HP`, '#7cff6b', 7);
        } else if (k.kind === 'star') {
          this.addScore(1000);
          p.sp = Math.min(1, p.sp + 0.35);
          this.fx.popup(k.x, k.y - 30, '+1000', '#ffd23f', 7);
        } else if (k.kind === 'oneup') {
          this.lives++;
          this.fx.popup(k.x, k.y - 30, '1UP!', '#7cff6b', 10);
        }
      }
    }
    this.pickups = this.pickups.filter((k) => !k.taken && k.t < 900);
  }

  private hurtAll(test: (a: { x: number; y: number; z: number }) => boolean, dmg: number, hz: Hazard, dir: number) {
    const p = this.player;
    if (!hz.hitIds.has(p.id) && test(p) && p.takeDamage(this, dmg, true, dir)) hz.hitIds.add(p.id);
    for (const e of this.enemies) {
      if (e.dead || e.isBoss || hz.hitIds.has(e.id) || !test(e)) continue;
      hz.hitIds.add(e.id);
      const res = e.receive(this, dmg * 1.5, 'hazard', dir);
      this.fx.hit(e.x, e.y, 40, true);
      if (res === 'ko') this.onEnemyDefeated(e, false);
    }
  }

  private updateHazards() {
    if (this.bossPhase !== 'none') return;
    for (const hz of this.hazards) {
      hz.t++;
      const c = hz.t % hz.period;
      if (hz.kind === 'train') {
        if (c === hz.period - 140) audio.sfx('boss');
        if (c >= hz.period - 60) {
          if (c === hz.period - 60) {
            hz.x = this.camX + W + 40;
            hz.hitIds.clear();
            audio.sfx('whoosh');
          }
          hz.x -= 22;
          this.hurtAll((a) => a.y < FLOOR_TOP + 30 && a.x > hz.x && a.x < hz.x + 900 && a.z < 40, 18, hz, -1);
        }
      } else if (hz.kind === 'traffic') {
        if (c === hz.period - 140) {
          hz.dir = Math.random() < 0.5 ? 1 : -1;
          hz.y = clamp(this.player.y + rand(-6, 6), FLOOR_TOP + 40, FLOOR_BOTTOM - 4);
          audio.sfx('steal');
        }
        if (c >= hz.period - 70) {
          if (c === hz.period - 70) {
            hz.x = hz.dir === 1 ? this.camX - 140 : this.camX + W + 140;
            hz.hitIds.clear();
          }
          hz.x += hz.dir * 15;
          this.hurtAll((a) => Math.abs(a.y - hz.y) < 16 && Math.abs(a.x - hz.x) < 60 && a.z < 30, 14, hz, hz.dir);
        }
      } else if (hz.kind === 'steam') {
        if (c === 160) hz.hitIds.clear();
        if (c > 160 && c < 215) this.hurtAll((a) => Math.abs(a.x - hz.x) < 18 && Math.abs(a.y - hz.y) < 11 && a.z < 60, 8, hz, sign(this.player.x - hz.x));
        if (c > 120 && c < 215 && this.t % 3 === 0) this.fx.smoke(hz.x + rand(-6, 6), hz.y, c > 160 ? rand(5, 50) : 2);
      }
    }
  }

  private updateCamera() {
    const p = this.player;
    const L = this.stage.length;
    if (this.lockX !== null) {
      this.camX += (this.lockX - this.camX) * 0.15;
      if (Math.abs(this.lockX - this.camX) < 0.5) this.camX = this.lockX;
      return;
    }
    // acompanha o jogador com folga (não volta muito para trás)
    const target = clamp(p.x - W * 0.42, 0, L - W);
    if (target > this.camX) this.camX += (target - this.camX) * 0.12;
    else if (target < this.camX - 120) this.camX += (target + 120 - this.camX) * 0.12;
    this.camX = clamp(this.camX, 0, L - W);
  }

  private updateWaves() {
    const p = this.player;
    const active = this.waves.find((w) => w.spawned && !w.cleared);
    if (active) {
      const alive = this.enemies.filter((e) => !e.dead && !e.isBoss && e.state !== 'flee');
      if (active.queue.length && alive.length < this.maxOnScreen && --this.spawnCd <= 0) {
        // no máximo 2 atiradores (de longe) ao mesmo tempo; os outros esperam na fila
        const ranged = (k: EnemyKind) => k === 'shooter' || k === 'baller';
        const rangedAlive = alive.filter((e) => ranged(e.kind)).length;
        const idx = rangedAlive >= 2 ? active.queue.findIndex((q) => !ranged(q.kind)) : 0;
        if (idx >= 0) {
          const [q] = active.queue.splice(idx, 1);
          this.spawnEnemy(q.kind, q.side, q.name);
        }
        this.spawnCd = 45;
      }
      if (!active.queue.length && alive.length === 0) {
        active.cleared = true;
        this.lockX = null;
        this.goT = 180;
        if (!p.tookDamage) {
          this.addScore(500);
          this.fx.popup(p.x, p.y - 100, 'PERFECT +500', '#7cff6b', 8);
        }
      }
      return;
    }
    const next = this.waves.find((w) => !w.spawned);
    if (next && p.x > next.x) {
      next.spawned = true;
      p.tookDamage = false;
      this.lockX = clamp(this.camX, 0, this.stage.length - W);
      this.spawnCd = 0;
      this.goT = 0;
    }
  }

  private updateBoss() {
    const L = this.stage.length;
    const p = this.player;
    if (this.bossPhase === 'none') {
      const allCleared = this.waves.every((w) => w.cleared);
      if (allCleared && p.x > L - W + 120) {
        this.bossPhase = 'intro';
        this.bossT = 0;
        this.lockX = L - W;
        this.boss = new Boss(this.stage.boss, L + 60, clamp(p.y, FLOOR_TOP + 30, FLOOR_BOTTOM - 20), this);
        this.enemies.push(this.boss);
        audio.sfx('boss');
        audio.play('boss');
        p.tookDamage = false;
      }
      return;
    }
    this.bossT++;
    if (this.bossPhase === 'intro' && this.boss && this.boss.state !== 'intro') this.bossPhase = 'fight';
    if (this.bossPhase === 'ko' && this.bossT > 170 && this.event === 'none') {
      p.setState('celebrate');
      if (this.bossT > 200) {
        this.event = 'stageClear';
        audio.sfx('victory');
      }
    }
  }

  /** Bônus do fim da fase (mostrado na tela de vitória da fase) */
  stageBonus() {
    const p = this.player;
    const time = Math.max(0, 5000 - Math.floor(this.stageT / 6));
    const health = Math.round(p.hp * 30);
    const flawless = !p.tookDamage ? 5000 : 0;
    const combo = p.bestCombo * 100;
    return { time, health, flawless, combo, total: time + health + flawless + combo };
  }

  // ─────────────────────────────────── desenho ───────────────────────────────────

  /** scene: só o cenário (sem personagens nem HUD), usado na tela de vitória */
  draw(ctx: CanvasRenderingContext2D, scene = false) {
    const t = this.t;
    let camX = this.camX;
    const sh = this.fx.shake;
    const shx = sh ? rand(-sh, sh) : 0, shy = sh ? rand(-sh, sh) * 0.6 : 0;
    ctx.save();
    ctx.translate(shx, shy);
    camX = Math.round(camX * 2) / 2;
    // cenário: fundo com paralaxe + rua
    const farX = camX * FAR_PARALLAX;
    ctx.drawImage(this.art.far, farX * ART_SCALE, 0, W * ART_SCALE, FLOOR_TOP * ART_SCALE, 0, 0, W, FLOOR_TOP);
    ctx.drawImage(this.art.near, camX * ART_SCALE, 0, W * ART_SCALE, H * ART_SCALE, 0, 0, W, H);
    this.art.live?.(ctx, camX, t);
    if (scene) {
      ctx.restore();
      return;
    }

    // vãos do telhado
    for (const g of this.gaps) {
      const x0 = g.x0 - camX;
      if (x0 > W || g.x1 - camX < 0) continue;
      ctx.fillStyle = '#05060a';
      ctx.fillRect(x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
      ctx.fillStyle = '#2a2d33';
      ctx.fillRect(x0, g.y0, g.x1 - g.x0, 4);
      ctx.fillStyle = 'rgba(255,200,120,0.25)';
      for (let i = 0; i < 5; i++) ctx.fillRect(x0 + 6 + i * 14, g.y0 + 14 + (i % 2) * 10, 3, 3);
    }
    // vapor da fábrica (bocal no chão)
    for (const hz of this.hazards) {
      if (hz.kind !== 'steam') continue;
      const c = hz.t % hz.period;
      ctx.fillStyle = '#3b3f45';
      ctx.fillRect(hz.x - camX - 10, hz.y - 3, 20, 5);
      ctx.fillStyle = c > 120 ? '#ff4d4d' : '#555';
      ctx.fillRect(hz.x - camX - 3, hz.y - 2, 6, 3);
      if (c > 160 && c < 215) {
        const g = ctx.createLinearGradient(0, hz.y, 0, hz.y - 70);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(hz.x - camX - 12, hz.y - 70, 24, 70);
      }
    }
    // trem (faixa de trás) e aviso
    for (const hz of this.hazards) {
      if (hz.kind !== 'train') continue;
      const c = hz.t % hz.period;
      if (c >= hz.period - 140 && c < hz.period - 60 && Math.floor(t / 8) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,40,40,0.22)';
        ctx.fillRect(0, FLOOR_TOP, W, 30);
        text(ctx, '! TRAIN !', W / 2, FLOOR_TOP + 20, 10, '#ff4d4d', 'center');
      }
      if (c >= hz.period - 60) drawTrain(ctx, hz.x - camX, FLOOR_TOP + 28, 900);
    }
    for (const hz of this.hazards) {
      if (hz.kind !== 'traffic') continue;
      const c = hz.t % hz.period;
      if (c >= hz.period - 140 && c < hz.period - 70 && Math.floor(t / 8) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,230,120,0.25)';
        ctx.fillRect(0, hz.y - 14, W, 20);
        text(ctx, hz.dir === 1 ? '◂ CAR' : 'CAR ▸', hz.dir === 1 ? 30 : W - 30, hz.y, 8, '#ffd23f', 'center');
      }
    }

    // sombras
    const shadow = (x: number, y: number, r: number, z: number) => {
      const k = Math.max(0.35, 1 - z / 120);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(x - camX, y + 1, r * k, r * 0.32 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    shadow(this.player.x, this.player.y, 15, this.player.z);
    for (const e of this.enemies) if (!(e.isBoss && (e as Boss).vanish > 0.6)) shadow(e.x, e.y, e.drawShadowR(), e.z);
    for (const pr of this.projectiles) shadow(pr.x, pr.y, 6, pr.z);
    this.fx.drawGround(ctx, camX);

    // tudo ordenado pela profundidade (quem está mais embaixo aparece na frente)
    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const o of this.obstacles) {
      if (o.broken || o.x - camX < -80 || o.x - camX > W + 80) continue;
      list.push({ y: o.y, draw: () => drawProp(ctx, o.kind, o.x - camX, o.y, o.flash > 0, o.hitT, o.accent) });
    }
    for (const k of this.pickups) list.push({ y: k.y, draw: () => drawPickup(ctx, k.kind, k.x - camX, k.y, k.t) });
    for (const e of this.enemies) list.push({ y: e.y, draw: () => e.draw(ctx, camX, t) });
    list.push({ y: this.player.y + 0.1, draw: () => this.player.draw(ctx, camX, t) });
    for (const pr of this.projectiles) {
      list.push({
        y: pr.y + 0.2,
        draw: () => {
          if (pr.kind === 'ball') drawBall(ctx, pr.x - camX, pr.y - pr.z, pr.power === 'super' ? 8 : pr.power === 'special' ? 7 : 6, pr.spin, pr.glow ?? (pr.fromPlayer ? undefined : '#ff4d4d'));
          else drawProjectile(ctx, pr.kind, pr.x - camX, pr.y - pr.z, this.t, sign(pr.vx));
        },
      });
    }
    for (const hz of this.hazards) {
      if (hz.kind === 'traffic' && hz.t % hz.period >= hz.period - 70) list.push({ y: hz.y, draw: () => drawTrafficCar(ctx, hz.x - camX, hz.y, hz.dir, '#d62828') });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();
    this.fx.draw(ctx, camX);
    for (const e of this.enemies) e.drawWarning(ctx, t);
    ctx.restore();

    if (this.fx.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.fx.flash / 18})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    const p = this.player;
    const boss = this.boss && this.bossPhase !== 'none' ? this.boss : null;
    drawHud(ctx, {
      hp: p.hp / p.maxHp, hpTrail: p.trail, sp: p.sp, score: this.score, lives: this.lives, stage: this.stageN, stageName: this.stage.name,
      combo: p.combo, comboT: p.comboT, ballReady: p.ball === 'hand', charge: p.state === 'charge' ? p.charge : 0, turbo: p.running && p.state === 'run', go: this.goT > 0 && this.bossPhase === 'none', t,
      boss: boss ? { name: boss.name, hp: boss.hp / boss.maxHp, trail: boss.trail, enraged: boss.enraged } : undefined,
    });

    // apresentação do chefe
    if (this.bossPhase === 'intro' && this.boss) {
      const k = Math.min(1, this.bossT / 20);
      ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`;
      ctx.fillRect(0, H / 2 - 50, W, 100);
      ctx.fillStyle = '#ff2a2a';
      ctx.fillRect(0, H / 2 - 50, W * k, 3);
      ctx.fillRect(W * (1 - k), H / 2 + 47, W * k, 3);
      text(ctx, 'WARNING!', W / 2, H / 2 - 22, 10, Math.floor(t / 6) % 2 ? '#ff2a2a' : '#ffd23f', 'center');
      text(ctx, this.boss.name, W / 2 + (1 - k) * 300, H / 2 + 8, 22, '#ffffff', 'center', 5);
      text(ctx, this.boss.bdef.title.toUpperCase(), W / 2, H / 2 + 26, 7, '#ffd23f', 'center');
      text(ctx, `"${this.boss.bdef.line}"`, W / 2, H / 2 + 40, 6, '#cfe9ff', 'center');
    }
    if (this.bossPhase === 'ko' && this.bossT < 150) {
      const s = 1 + Math.max(0, 20 - this.bossT) / 10;
      ctx.save();
      ctx.translate(W / 2, H / 2 - 20);
      ctx.scale(s, s);
      text(ctx, 'K.O.!', 0, 0, 34, '#ffd23f', 'center', 6);
      ctx.restore();
    }
  }
}
