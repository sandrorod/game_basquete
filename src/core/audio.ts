/**
 * Áudio 100% sintetizado (Web Audio): efeitos sonoros e trilha arcade com sequenciador próprio.
 * Música e efeitos ligam/desligam separadamente.
 */
export type Sfx =
  | 'throw' | 'strong' | 'special' | 'super' | 'hit' | 'bigHit' | 'enemyKo' | 'playerHit' | 'block' | 'break'
  | 'pickup' | 'stageStart' | 'boss' | 'bossKo' | 'victory' | 'gameOver' | 'select' | 'steal' | 'dribble' | 'whoosh' | 'oneUp';

export type Track = 'title' | 'stage' | 'boss' | 'victory' | 'none';

interface Song {
  bpm: number;
  root: number; // nota MIDI da tônica do baixo
  bass: (number | null)[]; // 16 passos, semitons relativos à tônica do acorde
  chords: number[]; // um acorde (semitons) a cada compasso
  lead: (number | null)[]; // 32 passos (2 compassos), graus da escala menor pentatônica
  drums: string; // 16 caracteres: k=bumbo s=caixa h=chimbal x=bumbo+chimbal o=chimbal aberto -=nada
  wave: OscillatorType;
}

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Uma música para cada fase + título + chefe + vitória (mesma identidade, variações de tom e ritmo) */
const STAGE_SONGS: Song[] = [
  { bpm: 132, root: 40, wave: 'square', chords: [0, 0, 8, 7], bass: [0, null, 0, 12, null, 0, 10, null, 0, null, 0, 12, null, 7, 10, null], lead: [4, null, 5, 4, 2, null, 3, null, 4, null, 2, 1, 0, null, null, null, 2, null, 3, 4, 5, null, 4, null, 6, null, 5, 4, 3, null, 2, null], drums: 'x-h-s-h-x-hxs-h-' },
  { bpm: 140, root: 38, wave: 'sawtooth', chords: [0, 5, 3, 7], bass: [0, 0, null, 0, 12, null, 0, null, 0, 0, null, 10, 12, null, 7, null], lead: [6, null, 5, null, 4, 5, 6, null, 7, null, 6, null, 4, null, null, null, 4, 5, 4, 2, 1, null, 2, null, 4, null, 2, null, 0, null, null, null], drums: 'x-h-s-hhx-h-s-ho' },
  { bpm: 120, root: 36, wave: 'square', chords: [0, 0, 3, 5], bass: [0, null, null, 0, null, null, 0, null, 12, null, null, 0, null, 10, null, 7], lead: [0, null, 0, 3, null, 2, null, 0, 1, null, 0, null, null, null, null, null, 0, null, 0, 3, null, 4, null, 3, 2, null, 1, null, 0, null, null, null], drums: 'k-h-s-h-k-k-s-hh' },
  { bpm: 128, root: 41, wave: 'triangle', chords: [0, 7, 9, 5], bass: [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 10, null, 7, null], lead: [7, 6, 5, null, 4, null, 5, 6, 7, null, null, 5, 4, null, null, null, 5, 4, 3, null, 2, null, 3, 4, 5, null, null, 3, 2, null, null, null], drums: 'x-hhs-h-x-hhs-hh' },
  { bpm: 136, root: 39, wave: 'sawtooth', chords: [0, 0, 10, 8], bass: [0, 12, 0, 12, 0, 12, 0, 12, 10, 22, 10, 22, 8, 20, 8, 20], lead: [4, null, 4, 5, 6, null, 5, 4, 2, null, null, 2, 3, 4, null, null, 6, null, 6, 7, 8, null, 7, 6, 5, null, 4, null, 3, null, 2, null], drums: 'x-hhs-hxx-hhs-ho' },
  { bpm: 144, root: 43, wave: 'square', chords: [0, 3, 5, 3], bass: [0, null, 0, null, 0, 3, null, 5, 0, null, 0, null, 7, null, 5, 3], lead: [2, 4, 5, null, 4, 2, 0, null, 2, 4, 5, 7, 6, null, null, null, 7, 6, 5, null, 4, 5, 4, 2, 0, null, 2, null, 1, null, 0, null], drums: 'x-h-s-hxh-x-s-ho' },
  { bpm: 126, root: 38, wave: 'triangle', chords: [0, 8, 3, 10], bass: [0, null, null, 7, null, null, 12, null, 0, null, null, 7, null, 12, null, 10], lead: [5, null, 6, 7, null, 6, 5, null, 4, null, 2, null, 4, null, null, null, 5, null, 6, 7, null, 9, 8, null, 7, null, 6, null, 5, null, null, null], drums: 'k-h-s-hkk-h-s-h-' },
  { bpm: 116, root: 35, wave: 'sawtooth', chords: [0, 1, 0, 3], bass: [0, 0, 0, null, 0, 0, 1, null, 0, 0, 0, null, 3, null, 1, null], lead: [0, null, null, 1, 0, null, null, null, 3, null, 2, null, 1, null, 0, null, 0, null, null, 1, 0, null, 5, null, 4, null, 3, null, 2, null, 1, null], drums: 'x--hs-h-x-xhs-h-' },
  { bpm: 150, root: 42, wave: 'square', chords: [0, 5, 7, 10], bass: [0, 12, 0, 12, 5, 17, 5, 17, 7, 19, 7, 19, 10, 22, 10, 22], lead: [7, null, 6, 7, 8, null, 7, null, 6, 5, 4, null, 5, null, 4, null, 2, null, 4, 5, 6, null, 7, 8, 9, null, 8, null, 7, null, 6, null], drums: 'x-hhs-hhx-hhs-hh' },
  { bpm: 138, root: 40, wave: 'sawtooth', chords: [0, 8, 10, 7], bass: [0, null, 0, 0, 12, null, 0, 0, 8, null, 8, 8, 10, null, 7, 7], lead: [9, null, 8, 7, 6, null, 7, null, 8, null, 9, 10, 9, null, null, null, 7, null, 6, 5, 4, null, 5, null, 6, null, 7, 8, 7, null, null, null], drums: 'x-hxs-hhx-hxs-ho' },
];
const TITLE_SONG: Song = { bpm: 118, root: 40, wave: 'square', chords: [0, 8, 3, 10], bass: [0, null, 0, null, 7, null, 12, null, 0, null, 0, null, 10, null, 7, null], lead: [4, null, 4, 5, 6, null, 5, null, 4, null, 2, null, 4, null, null, null, 6, null, 7, 6, 5, null, 4, null, 2, null, 4, null, 5, null, null, null], drums: 'k-h-s-h-k-hks-h-' };
const BOSS_SONG: Song = { bpm: 160, root: 37, wave: 'sawtooth', chords: [0, 1, 0, 6], bass: [0, 0, 12, 0, 0, 12, 0, 1, 0, 0, 12, 0, 6, 6, 7, 7], lead: [0, 1, 0, null, 3, null, 2, 1, 0, null, null, null, 5, 4, 3, 2, 0, 1, 0, null, 3, null, 5, 6, 7, null, 6, null, 5, null, 3, null], drums: 'xhhhshhhxhxhshho' };
const VICTORY_SONG: Song = { bpm: 128, root: 43, wave: 'square', chords: [0, 5, 7, 0], bass: [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 12, null, 7, null], lead: [0, 2, 4, 5, 6, null, 6, null, 5, 4, 5, null, 6, null, null, null, 7, 6, 5, 4, 5, null, 4, 2, 0, null, 2, null, 0, null, null, null], drums: 'x-h-s-h-x-h-s-hh' };

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  musicOn = true;
  sfxOn = true;
  private song: Song | null = null;
  private trackName: Track = 'none';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;

  /** O navegador só libera o som depois de um toque/tecla do usuário */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
    this.sfxBus.connect(this.master);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (this.trackName !== 'none') this.startScheduler();
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.05);
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  play(track: Track, stage = 0) {
    const song = track === 'title' ? TITLE_SONG : track === 'boss' ? BOSS_SONG : track === 'victory' ? VICTORY_SONG : track === 'stage' ? STAGE_SONGS[stage % STAGE_SONGS.length] : null;
    if (track === this.trackName && song === this.song) return;
    this.trackName = track;
    this.song = song;
    this.step = 0;
    if (this.ctx) {
      this.nextTime = this.ctx.currentTime + 0.08;
      this.startScheduler();
    }
  }

  private startScheduler() {
    if (this.timer !== null) return;
    if (this.ctx) this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.song) return;
    const song = this.song;
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % song.chords.length;
      const chord = song.chords[bar];
      const t = this.nextTime;
      const b = song.bass[s];
      if (b !== null) this.tone(midi(song.root + chord + b), t, stepDur * 0.9, 'triangle', 0.5, this.musicBus);
      const l = song.lead[this.step % 32];
      if (l !== null) {
        const n = song.root + 24 + chord + PENTA[l % PENTA.length];
        this.tone(midi(n), t, stepDur * 1.6, song.wave, 0.16, this.musicBus, 0.004);
      }
      const d = song.drums[s];
      if (d === 'k' || d === 'x') this.kick(t);
      if (d === 's') this.snare(t);
      if (d === 'h' || d === 'x') this.hat(t, 0.03);
      if (d === 'o') this.hat(t, 0.12);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, bus: GainNode, attack = 0.002, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, vol: number, bus: GainNode, filter: BiquadFilterType = 'highpass', freq = 3000, q = 0.7) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    this.tone(150, t, 0.16, 'sine', 0.9, this.musicBus, 0.001, 40);
  }
  private snare(t: number) {
    this.noise(t, 0.14, 0.45, this.musicBus, 'highpass', 1500);
    this.tone(220, t, 0.07, 'triangle', 0.25, this.musicBus, 0.001, 120);
  }
  private hat(t: number, dur: number) {
    this.noise(t, dur, 0.18, this.musicBus, 'highpass', 7000);
  }

  sfx(name: Sfx) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + 0.005;
    const bus = this.sfxBus;
    switch (name) {
      case 'throw':
        this.noise(t, 0.12, 0.35, bus, 'bandpass', 1800, 1.5);
        this.tone(520, t, 0.08, 'triangle', 0.2, bus, 0.002, 900);
        break;
      case 'strong':
        this.noise(t, 0.2, 0.5, bus, 'bandpass', 900, 1.2);
        this.tone(200, t, 0.18, 'sawtooth', 0.25, bus, 0.002, 500);
        break;
      case 'special':
        this.tone(220, t, 0.45, 'sawtooth', 0.3, bus, 0.01, 1300);
        this.tone(330, t + 0.05, 0.4, 'square', 0.15, bus, 0.01, 1700);
        break;
      case 'super':
        for (let i = 0; i < 4; i++) this.tone(300 + i * 160, t + i * 0.05, 0.35, 'sawtooth', 0.22, bus, 0.005, 1600 + i * 300);
        this.noise(t, 0.5, 0.4, bus, 'bandpass', 2500, 0.8);
        break;
      case 'hit':
        this.noise(t, 0.09, 0.7, bus, 'lowpass', 2200);
        this.tone(180, t, 0.09, 'square', 0.3, bus, 0.001, 70);
        break;
      case 'bigHit':
        this.noise(t, 0.2, 0.9, bus, 'lowpass', 1600);
        this.tone(120, t, 0.22, 'square', 0.45, bus, 0.001, 40);
        break;
      case 'enemyKo':
        this.tone(600, t, 0.35, 'square', 0.22, bus, 0.002, 90);
        this.noise(t, 0.25, 0.4, bus, 'lowpass', 900);
        break;
      case 'playerHit':
        this.tone(300, t, 0.18, 'sawtooth', 0.35, bus, 0.001, 110);
        this.noise(t, 0.12, 0.6, bus, 'lowpass', 1400);
        break;
      case 'block':
        this.tone(1400, t, 0.12, 'square', 0.18, bus, 0.001, 1100);
        this.tone(2100, t, 0.1, 'triangle', 0.15, bus, 0.001);
        break;
      case 'break':
        this.noise(t, 0.3, 0.8, bus, 'bandpass', 700, 0.9);
        this.noise(t + 0.04, 0.2, 0.5, bus, 'highpass', 3000);
        break;
      case 'pickup':
        [0, 4, 7, 12].forEach((n, i) => this.tone(midi(72 + n), t + i * 0.05, 0.1, 'square', 0.2, bus));
        break;
      case 'oneUp':
        [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(midi(72 + n), t + i * 0.06, 0.14, 'square', 0.2, bus));
        break;
      case 'stageStart':
        [0, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(midi(60 + n), t + i * 0.08, 0.2, 'square', 0.22, bus));
        break;
      case 'boss':
        for (let i = 0; i < 3; i++) {
          this.tone(440, t + i * 0.36, 0.16, 'sawtooth', 0.3, bus, 0.005, 660);
          this.tone(330, t + i * 0.36 + 0.18, 0.16, 'sawtooth', 0.3, bus, 0.005, 220);
        }
        break;
      case 'bossKo':
        for (let i = 0; i < 6; i++) this.noise(t + i * 0.12, 0.25, 0.7, bus, 'lowpass', 1200 - i * 120);
        this.tone(500, t, 1.0, 'sawtooth', 0.3, bus, 0.01, 50);
        break;
      case 'victory':
        [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(midi(64 + n), t + i * 0.11, 0.24, 'square', 0.22, bus));
        break;
      case 'gameOver':
        [12, 7, 3, 0, -5].forEach((n, i) => this.tone(midi(60 + n), t + i * 0.22, 0.3, 'triangle', 0.3, bus));
        break;
      case 'select':
        this.tone(880, t, 0.06, 'square', 0.15, bus);
        this.tone(1320, t + 0.05, 0.06, 'square', 0.15, bus);
        break;
      case 'steal':
        this.tone(900, t, 0.25, 'square', 0.2, bus, 0.002, 300);
        break;
      case 'dribble':
        this.tone(110, t, 0.06, 'sine', 0.25, bus, 0.001, 70);
        break;
      case 'whoosh':
        this.noise(t, 0.18, 0.3, bus, 'bandpass', 1200, 2);
        break;
    }
  }
}

export const audio = new Audio();
