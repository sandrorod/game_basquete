import { audio } from '../core/audio';
import type { Difficulty } from '../core/config';
import { addRank, writeSave, type SaveData } from '../core/save';
import { describe, gearStats, money, SHOP, SLOT_NAMES, type ShopItem, type Slot } from '../data/shop';
import { STAGES } from '../data/stages';
import { drawHeroSprite } from '../render/spriteAnim';
import type { Game } from '../game/game';

type ScreenName = 'title' | 'howto' | 'options' | 'pause' | 'gameover' | 'victory' | 'shop' | 'backpack' | 'ranking' | 'none';

const ICON: Record<Slot, string> = { tenis: '👟', camiseta: '👕', bola: '🏀', munhequeira: '💪', bone: '🧢' };
const itemIcon = (it: ShopItem) => (it.consumable === 'continue' ? '👑' : it.consumable === 'life' ? '❤️' : ICON[it.slot]);
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Menus em HTML por cima do canvas (navegação por mouse, toque, setas + Enter). */
export class Screens {
  private root: HTMLElement;
  private game!: Game;
  private heroRaf = 0;
  private from: ScreenName = 'title';
  /** Dados da última tela de fim de jogo (para voltar a ela depois do ranking) */
  private endData: Record<string, string | number> = {};
  /** Tela que abriu a mochila */
  private bagFrom: ScreenName = 'pause';
  /** Posição destacada no ranking (placar recém-gravado) */
  private highlight = -1;
  current: ScreenName = 'none';

  constructor(root: HTMLElement, private save: SaveData, private onTouchPref: () => void) {
    this.root = root;
    window.addEventListener('keydown', (e) => {
      if (this.current === 'none') return;
      // digitando o nome do ranking: as teclas são do campo de texto
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
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
      } else if (e.code === 'Escape' && this.current === 'ranking') {
        this.show(this.from, this.from === 'gameover' || this.from === 'victory' ? this.endData : {});
      } else if (e.code === 'Escape' && (this.current === 'howto' || this.current === 'options')) {
        this.show(this.from);
      } else if (e.code === 'Escape' && this.current === 'backpack') {
        this.show(this.bagFrom);
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
    if (name === 'pause' || name === 'title' || name === 'gameover' || name === 'victory') this.from = name;
    if ((name === 'gameover' || name === 'victory') && Object.keys(data).length) this.endData = data;
    this.current = name;
    const g = this.game;
    switch (name) {
      case 'none':
        cancelAnimationFrame(this.heroRaf);
        this.root.innerHTML = '';
        break;
      case 'title': {
        const btns = [this.btn('Novo Jogo', () => g.newGame(0))];
        if (this.save.unlocked > 1) btns.push(this.btn(`Continuar · Fase ${Math.min(this.save.unlocked, STAGES.length)}`, () => g.newGame(Math.min(this.save.unlocked, STAGES.length) - 1)));
        btns.push(
          this.btn('Mochila', () => this.openBag('title'), true),
          this.btn('Ranking', () => this.show('ranking'), true),
          this.btn('Como Jogar', () => this.show('howto'), true),
          this.btn('Opções', () => this.show('options'), true),
        );
        this.mount(
          `<div class="screen">
            <div class="title-wrap">
              <canvas class="hero-canvas" width="360" height="440"></canvas>
              <div>
                <h1 class="logo"><span class="l1">STREET</span><span class="l2">BASKETBALL</span><span class="l3">FIGHT</span></h1>
                <p class="tag">10 FASES · 10 CHEFES · 1 BOLA</p>
              </div>
            </div>
            <div class="menu"></div>
            <p class="tag">RECORDE ${String(this.save.best).padStart(8, '0')} · ${money(this.save.money)}</p>
          </div>`,
          btns,
        );
        this.animateHero();
        break;
      }
      case 'howto':
        this.mount(
          `<div class="screen"><div class="panel">
            <h2>COMO JOGAR</h2>
            <p class="small">Atravesse 10 fases, derrote as gangues e os chefes usando sua bola de basquete. A bola volta para a sua mão depois de cada arremesso.</p>
            <h3>COMPUTADOR</h3>
            <div class="keys">
              <span><kbd>W A S D</kbd> <kbd>↑ ← ↓ →</kbd></span><span>Andar nas 4 direções (aproxime-se ou afaste-se do fundo)</span>
              <span><kbd>SHIFT</kbd></span><span>Correr (ou toque duas vezes na direção)</span>
              <span><kbd>ESPAÇO</kbd></span><span>Arremesso rápido · sem bola: empurrão</span>
              <span><kbd>J</kbd></span><span>Arremesso forte (derruba, quebra defesas)</span>
              <span><kbd>K</kbd></span><span>Segure para carregar o arremesso turbo (gasta a barra de PODER) · com a barra cheia: SUPER ARREMESSO</span>
              <span><kbd>ESC</kbd></span><span>Pausar · Mochila (trocar os itens comprados)</span>
            </div>
            <h3>CELULAR</h3>
            <p class="small">Analógico à esquerda · ARREMESSO, FORTE, TURBO (segure para carregar) e CORRER à direita.</p>
            <h3>DICAS</h3>
            <p class="small">Fique na mesma faixa do inimigo para acertar · troque de faixa para desviar · o LADRÃO rouba sua bola: empurre-o para recuperar · quebre tambores, caixas e lixeiras para achar comida, moedas, poções e a coroa (ficha de continue) · depois de cada fase, gaste seu dinheiro na LOJA.</p>
          </div><div class="menu"></div></div>`,
          [this.btn('Voltar', () => this.show(this.from))],
        );
        break;
      case 'options': {
        const diffLabel: Record<Difficulty, string> = { easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL' };
        const render = () => {
          const music = this.btn(this.save.music ? 'LIGADA' : 'DESLIGADA', () => {
            this.save.music = !this.save.music;
            audio.setMusic(this.save.music);
            writeSave(this.save);
            render();
          }, true);
          const sfx = this.btn(this.save.sfx ? 'LIGADOS' : 'DESLIGADOS', () => {
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
          const touch = this.btn({ auto: 'AUTOMÁTICO', on: 'LIGADO', off: 'DESLIGADO' }[this.save.touch], () => {
            const order: SaveData['touch'][] = ['auto', 'on', 'off'];
            this.save.touch = order[(order.indexOf(this.save.touch) + 1) % 3];
            writeSave(this.save);
            this.onTouchPref();
            render();
          }, true);
          const reset = this.btn('Apagar progresso', () => {
            this.save.unlocked = 1;
            this.save.best = 0;
            this.save.money = 0;
            this.save.owned = [];
            this.save.equipped = {};
            this.save.continues = 0;
            this.save.ranking = [];
            g.applyGear();
            writeSave(this.save);
            render();
          }, true);
          this.root.innerHTML = `<div class="screen"><div class="panel"><h2>OPÇÕES</h2>
            <div class="menu" style="gap:12px">
              <div class="opt"><span>MÚSICA</span><span data-s="music"></span></div>
              <div class="opt"><span>EFEITOS</span><span data-s="sfx"></span></div>
              <div class="opt"><span>DIFICULDADE</span><span data-s="diff"></span></div>
              <div class="opt"><span>CONTROLES DE TOQUE</span><span data-s="touch"></span></div>
              <div class="opt"><span>PROGRESSO (FASE ${this.save.unlocked})</span><span data-s="reset"></span></div>
            </div></div><div class="menu" data-s="back"></div></div>`;
          const put = (k: string, b: HTMLButtonElement) => this.root.querySelector(`[data-s="${k}"]`)!.appendChild(b);
          put('music', music);
          put('sfx', sfx);
          put('diff', diff);
          put('touch', touch);
          put('reset', reset);
          const back = this.btn('Voltar', () => this.show(this.from));
          put('back', back);
          setTimeout(() => music.focus(), 20);
        };
        cancelAnimationFrame(this.heroRaf);
        render();
        break;
      }
      case 'pause': {
        const sound = this.btn(`Som: ${this.save.music || this.save.sfx ? 'LIGADO' : 'DESLIGADO'}`, () => {
          const on = !(this.save.music || this.save.sfx);
          this.save.music = on;
          this.save.sfx = on;
          audio.setMusic(on);
          audio.setSfx(on);
          writeSave(this.save);
          sound.textContent = `Som: ${on ? 'LIGADO' : 'DESLIGADO'}`;
        }, true);
        this.mount(`<div class="screen"><div class="panel"><h2 class="blink">PAUSA</h2><div class="menu"></div></div></div>`, [
          this.btn('Continuar', () => g.togglePause()),
          this.btn('Mochila', () => this.openBag('pause')),
          this.btn('Reiniciar Fase', () => g.restartStage(), true),
          sound,
          this.btn('Opções', () => this.show('options'), true),
          this.btn('Menu Principal', () => g.toTitle(), true),
        ]);
        break;
      }
      case 'gameover': {
        const fichas = this.save.continues;
        const btns: HTMLButtonElement[] = [];
        if (fichas > 0) btns.push(this.btn(`Continuar nesta fase (ficha 👑 x${fichas})`, () => g.useContinue()));
        btns.push(this.btn('Recomeçar do início', () => g.newGame(0), fichas > 0), this.btn('Ranking', () => this.show('ranking'), true), this.btn('Menu Principal', () => g.toTitle(), true));
        this.mount(
          `<div class="screen"><div class="panel">
            <p class="big">FIM DE JOGO</p>
            <p class="score">PONTOS ${String(data.score ?? 0).padStart(8, '0')}</p>
            <p class="small">FASE ${data.stage} · ${data.name}<br/>RECORDE ${String(Math.max(this.save.best, Number(data.score ?? 0))).padStart(8, '0')}</p>
            ${this.recordForm()}
            <p class="small">${fichas > 0 ? `Você tem ${fichas} ficha(s) de continue: pode continuar na mesma fase (os pontos voltam a zero).` : 'Sem ficha de continue: é preciso recomeçar do início.<br/>Pegue a coroa 👑 nos tambores ou compre fichas na loja.'}</p>
            <div class="menu"></div></div></div>`,
          btns,
        );
        this.bindRecord();
        break;
      }
      case 'victory':
        this.mount(
          `<div class="screen victory"><div class="panel">
            <p class="win">KING BALL<br/>DERROTADO!</p>
            <p class="small">STREET PLAYER é o novo rei das quadras.</p>
            <p class="score">PONTOS ${String(data.score ?? 0).padStart(8, '0')}</p>
            <p class="small">RECORDE ${String(Math.max(this.save.best, Number(data.score ?? 0))).padStart(8, '0')}</p>
            ${this.recordForm()}
            <div class="menu"></div></div></div>`,
          [this.btn('Jogar de Novo', () => g.newGame(0)), this.btn('Ranking', () => this.show('ranking'), true), this.btn('Menu Principal', () => g.toTitle(), true)],
        );
        this.bindRecord();
        break;
      case 'ranking': {
        const rows = this.save.ranking
          .map((r, i) => `<tr class="${i === this.highlight ? 'hl' : ''}"><td>${i + 1}º</td><td>${esc(r.name)}</td><td>${String(r.score).padStart(8, '0')}</td><td>F${r.stage}</td></tr>`)
          .join('');
        this.mount(
          `<div class="screen"><div class="panel">
            <h2>RANKING · TOP 10</h2>
            ${rows ? `<table class="rank"><tr><th>#</th><th>NOME</th><th>PONTOS</th><th>FASE</th></tr>${rows}</table>` : '<p class="small">Nenhum placar gravado ainda.</p>'}
            <div class="menu"></div></div></div>`,
          [this.btn('Voltar', () => this.show(this.from, this.from === 'gameover' || this.from === 'victory' ? this.endData : {}))],
        );
        break;
      }
      case 'shop':
        this.renderShop(Number(data.stage ?? g.stageIdx + 2));
        break;
      case 'backpack':
        this.renderBag();
        break;
    }
  }

  /** Campo para gravar o nome quando o placar entra no ranking */
  private recordForm() {
    if (!this.game.isRecord) return '';
    return `<div class="record"><p class="new-rec blink">NOVO RECORDE!</p>
      <p class="small">Digite seu nome para entrar no ranking:</p>
      <div class="rec-row"><input class="name" maxlength="12" placeholder="SEU NOME" autocomplete="off" /><button class="btn save-rec">Gravar</button></div></div>`;
  }

  private bindRecord() {
    const input = this.root.querySelector<HTMLInputElement>('input.name');
    const saveBtn = this.root.querySelector<HTMLButtonElement>('.save-rec');
    if (!input || !saveBtn) return;
    setTimeout(() => input.focus(), 60);
    const submit = () => {
      const name = input.value.trim().toUpperCase().slice(0, 12) || 'JOGADOR';
      const g = this.game;
      const entry = { name, score: g.score, stage: g.world?.stageN ?? g.stageIdx + 1 };
      addRank(this.save, entry);
      this.highlight = this.save.ranking.indexOf(entry);
      audio.sfx('oneUp');
      this.show('ranking');
    };
    saveBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') submit();
    });
  }

  private openBag(from: ScreenName) {
    this.bagFrom = from;
    this.show('backpack');
  }

  /** Cartão de um item (loja ou mochila) */
  private card(it: ShopItem, action: HTMLButtonElement, note = '') {
    const d = document.createElement('div');
    const on = this.save.equipped[it.slot] === it.id;
    d.className = `item${on ? ' on' : ''}`;
    d.innerHTML = `<span class="ic">${itemIcon(it)}</span>
      <span class="nm">${it.name}</span>
      <span class="st">${it.consumable === 'continue' ? 'Continua na mesma fase depois de perder todas as vidas' : it.consumable === 'life' ? '+1 vida agora' : describe(it.stats)}</span>
      ${note ? `<span class="pr">${note}</span>` : ''}`;
    d.appendChild(action);
    return d;
  }

  private gearSummary() {
    const s = describe(gearStats(this.save.equipped));
    return s || 'Nenhum bônus equipado';
  }

  private renderShop(stageN: number) {
    cancelAnimationFrame(this.heroRaf);
    const g = this.game;
    const sv = this.save;
    this.root.innerHTML = `<div class="screen wide"><div class="panel shop">
      <h2>LOJA DE BASQUETE</h2>
      <p class="small">Carteira: <b class="money">${money(sv.money)}</b> · Fichas 👑 x${sv.continues} · Vidas x${g.lives}</p>
      <p class="small dim">Equipado: ${this.gearSummary()}</p>
      <div class="items"></div>
      <div class="menu row"></div></div></div>`;
    const grid = this.root.querySelector('.items')!;
    let first: HTMLButtonElement | null = null;
    for (const it of SHOP) {
      const owned = !it.consumable && sv.owned.includes(it.id);
      const on = sv.equipped[it.slot] === it.id;
      let b: HTMLButtonElement;
      if (owned) b = this.btn(on ? 'Usando' : 'Usar', () => (g.toggleEquip(it.id), this.renderShop(stageN)), true);
      else {
        b = this.btn(money(it.price), () => {
          if (g.buy(it.id)) audio.sfx('pickup');
          else audio.sfx('block');
          this.renderShop(stageN);
        });
        if (sv.money < it.price) b.classList.add('off');
      }
      first ??= b;
      grid.appendChild(this.card(it, b));
    }
    const menu = this.root.querySelector('.menu')!;
    const go = this.btn(`Jogar Fase ${stageN} ▶`, () => g.leaveShop());
    menu.appendChild(go);
    setTimeout(() => go.focus(), 30);
  }

  private renderBag() {
    cancelAnimationFrame(this.heroRaf);
    const g = this.game;
    const sv = this.save;
    this.root.innerHTML = `<div class="screen wide"><div class="panel shop">
      <h2>MOCHILA</h2>
      <p class="small">Escolha o que o STREET PLAYER vai usar (um item por parte).</p>
      <p class="small dim">Bônus: ${this.gearSummary()}</p>
      <div class="items"></div>
      <div class="menu row"></div></div></div>`;
    const grid = this.root.querySelector('.items')!;
    const owned = SHOP.filter((it) => !it.consumable && sv.owned.includes(it.id));
    if (!owned.length) grid.innerHTML = '<p class="small">A mochila está vazia. Compre itens na loja depois de cada fase.</p>';
    for (const it of owned) {
      const on = sv.equipped[it.slot] === it.id;
      const b = this.btn(on ? 'Tirar' : 'Usar', () => {
        g.toggleEquip(it.id);
        this.renderBag();
      }, on);
      grid.appendChild(this.card(it, b, SLOT_NAMES[it.slot]));
    }
    const back = this.btn('Voltar', () => this.show(this.bagFrom));
    this.root.querySelector('.menu')!.appendChild(back);
    setTimeout(() => back.focus(), 30);
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
      drawHeroSprite(ctx, 180, 418, { state: anim, st: t, t, vx: 0, vy: 0, facing: 1, hasBall: true, quick: true, hp: 100 }, { scale: 4.2 });
      this.heroRaf = requestAnimationFrame(frame);
    };
    frame();
  }
}
