import type { Action, Input } from '../core/input';

/** Analógico virtual + botões grandes para celular/tablet (vários dedos ao mesmo tempo). */
export function setupTouch(root: HTMLElement, input: Input, onPause: () => void) {
  root.innerHTML = `
    <div class="stick"><div class="knob"></div></div>
    <div class="tbtn tb-throw" data-a="throw">LANÇAR</div>
    <div class="tbtn tb-run" data-a="run">CORRER</div>
    <div class="tbtn tb-pause" data-p="1">II</div>`;
  const stick = root.querySelector<HTMLElement>('.stick')!;
  const knob = root.querySelector<HTMLElement>('.knob')!;
  let stickId: number | null = null;
  const moveStick = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    input.stick = { x: dx, y: dy };
    knob.style.transform = `translate(${dx * 42}px, ${dy * 42}px)`;
  };
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  stick.addEventListener('pointermove', (e) => e.pointerId === stickId && moveStick(e));
  const endStick = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    input.stick = { x: 0, y: 0 };
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  for (const b of root.querySelectorAll<HTMLElement>('.tbtn')) {
    const a = b.dataset.a as Action | undefined;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.classList.add('down');
      if (b.dataset.p) onPause();
      else if (a) input.press(a);
      navigator.vibrate?.(8);
    });
    const up = () => {
      b.classList.remove('down');
      if (a) input.release(a);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }
}
