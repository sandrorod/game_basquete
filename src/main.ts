import './styles.css';
import { audio } from './core/audio';
import { H, STEP, W } from './core/config';
import { Input } from './core/input';
import { loadSave } from './core/save';
import { loadSprites } from './render/sprites';
import { Game } from './game/game';
import { Screens } from './ui/screens';
import { setupTouch } from './ui/touch';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;
const save = loadSave();
const input = new Input();
audio.setMusic(save.music);
audio.setSfx(save.sfx);

const touchRoot = document.getElementById('touch')!;
const applyTouchPref = () => {
  const auto = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  touchRoot.classList.toggle('on', save.touch === 'on' || (save.touch === 'auto' && auto));
};
const screens = new Screens(document.getElementById('ui')!, save, applyTouchPref);
const game = new Game(input, save, screens);
screens.attach(game);
setupTouch(touchRoot, input, () => game.togglePause());
applyTouchPref();

// Libera o áudio no primeiro toque/tecla (regra dos navegadores)
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
document.addEventListener('visibilitychange', () => document.hidden && game.state === 'play' && game.togglePause());

// Tela: resolução lógica 640×360 escalada para caber (com faixas pretas) e nítida em telas retina
let scale = 1, ox = 0, oy = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  scale = Math.min(canvas.width / W, canvas.height / H);
  ox = Math.round((canvas.width - W * scale) / 2);
  oy = Math.round((canvas.height - H * scale) / 2);
}
window.addEventListener('resize', resize);
resize();

// Toque no canvas avança telas (fim de fase, apresentação)
canvas.addEventListener('pointerdown', () => {
  if (game.state === 'clear' || game.state === 'intro') {
    input.press('confirm');
    setTimeout(() => input.release('confirm'), 50);
  }
});

let acc = 0;
let last = performance.now();
function frame(now: number) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  // lógica a 60 passos por segundo, independente da taxa da tela
  while (acc >= STEP) {
    if (game.state !== 'paused') game.update();
    else {
      // pausado: só escuta o Esc para voltar
      if (input.wasPressed('pause')) game.togglePause();
      input.endFrame();
    }
    acc -= STEP;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  game.draw(ctx);
  ctx.restore();
  requestAnimationFrame(frame);
}

// Espera as fontes de fliperama para os textos do canvas
// e os sprites dos modelos (herói, inimigos, objetos)
Promise.all([Promise.race([document.fonts.load('10px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]), loadSprites()]).then(() => {
  game.toTitle();
  requestAnimationFrame(frame);
});

// Acesso para testes automáticos e depuração
declare global {
  interface Window {
    __game: Game;
  }
}
window.__game = game;
