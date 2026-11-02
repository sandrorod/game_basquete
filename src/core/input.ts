export type Action = 'up' | 'down' | 'left' | 'right' | 'throw' | 'strong' | 'special' | 'run' | 'pause' | 'confirm';

const KEYMAP: Record<string, Action> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'throw', KeyJ: 'strong', KeyK: 'special', ShiftLeft: 'run', ShiftRight: 'run', Escape: 'pause', KeyP: 'pause', Enter: 'confirm',
};

/** Teclado + controles de toque. `held` = segurando; `pressed` = apertou neste quadro. */
export class Input {
  private held = new Set<Action>();
  private pressedNow = new Set<Action>();
  private releasedNow = new Set<Action>();
  /** Analógico virtual (−1..1) */
  stick = { x: 0, y: 0 };
  /** Duplo toque para correr */
  private lastTap: Partial<Record<'left' | 'right', number>> = {};
  runLatch = false;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.press(a);
    });
    target.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.release(a);
    });
    target.addEventListener('blur', () => {
      for (const a of [...this.held]) this.release(a);
      this.stick = { x: 0, y: 0 };
    });
  }

  press(a: Action) {
    if (!this.held.has(a)) this.pressedNow.add(a);
    this.held.add(a);
    if (a === 'left' || a === 'right') {
      const now = performance.now();
      if (now - (this.lastTap[a] ?? 0) < 260) this.runLatch = true;
      this.lastTap[a] = now;
    }
  }

  release(a: Action) {
    if (this.held.has(a)) this.releasedNow.add(a);
    this.held.delete(a);
    if ((a === 'left' || a === 'right') && !this.held.has('left') && !this.held.has('right')) this.runLatch = false;
  }

  isHeld = (a: Action) => this.held.has(a);
  wasPressed = (a: Action) => this.pressedNow.has(a);
  wasReleased = (a: Action) => this.releasedNow.has(a);

  /** Direção combinada (teclas + analógico), já normalizada */
  axis() {
    let x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0) + this.stick.x;
    let y = (this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0) + this.stick.y;
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));
    const len = Math.hypot(x, y);
    if (len > 1) return { x: x / len, y: y / len };
    return { x: Math.abs(x) < 0.15 ? 0 : x, y: Math.abs(y) < 0.15 ? 0 : y };
  }

  running() {
    return this.held.has('run') || this.runLatch;
  }

  /** Chamado no fim de cada quadro de lógica */
  endFrame() {
    this.pressedNow.clear();
    this.releasedNow.clear();
  }
}
