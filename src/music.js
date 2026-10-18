'use strict';
// Trilha sonora sintetizada: um sequenciador pequeno que toca baixo, bateria e
// melodia com osciladores do Web Audio. Não usa arquivos de áudio.

const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Cada faixa: andamento, passos por compasso (16 = semicolcheias), acordes (notas MIDI),
// e padrões por instrumento. Nos padrões, um número é o grau do acorde (0 fundamental,
// 1 terça, 2 quinta, 3 oitava) e null é pausa.
const TRACKS = {
  menu: {
    bpm: 92, steps: 16, swing: 0,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Am F C G
    bass: [0, null, null, null, 0, null, null, null, 2, null, null, null, 0, null, null, null],
    arp: [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 2, 1, 2, 3],
    arpOct: 12, arpVol: 0.05, arpWave: 'triangle',
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    drums: 0.6,
  },
  fight1: {
    bpm: 148, steps: 16, swing: 0,
    chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 51, 54]], // Em C D B
    bass: [0, null, 0, 0, null, 0, null, 3, 0, null, 0, 0, null, 0, 3, null],
    arp: [null, 3, null, 2, null, 3, 1, null, 3, null, 2, null, 3, null, 1, 2],
    arpOct: 24, arpVol: 0.045, arpWave: 'square',
    kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    drums: 1,
  },
  fight2: {
    bpm: 132, steps: 16, swing: 0.12,
    chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], // Dm Bb Gm A
    bass: [0, null, null, 0, null, 3, null, 0, null, null, 0, null, 3, null, 0, null],
    arp: [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 0, null, 1, 2],
    arpOct: 24, arpVol: 0.05, arpWave: 'sawtooth',
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
    hat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
    drums: 1,
  },
};

const Music = {
  current: null,
  timer: null,
  step: 0,
  bar: 0,
  next: 0,
  noise: null,
  duck: 1,

  // troca de faixa (name = null para silenciar)
  play(name) {
    if (name === this.current) return;
    this.current = name;
    this.step = 0;
    this.bar = 0;
    this.next = 0;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 30);
  },

  // abaixa a música durante a pausa
  setDuck(v) {
    this.duck = v;
    if (Sound.musicGain) Sound.musicGain.gain.setTargetAtTime(Sound.musicVolume * v, Sound.ctx.currentTime, 0.05);
  },

  tick() {
    const ctx = Sound.ctx;
    if (!ctx || ctx.state !== 'running' || !this.current || !Sound.musicVolume) return;
    const T = TRACKS[this.current];
    if (!this.noise) this.makeNoise(ctx);
    const stepLen = 60 / T.bpm / (T.steps / 4);
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.2) {
      const s = this.step % T.steps;
      const odd = s % 2 === 1;
      const t = this.next + (odd ? T.swing * stepLen : 0);
      this.playStep(T, s, t, stepLen);
      this.step++;
      if (this.step % T.steps === 0) this.bar = (this.bar + 1) % T.chords.length;
      this.next += stepLen;
    }
  },

  playStep(T, s, t, len) {
    const chord = T.chords[this.bar];
    const note = (deg, oct) => chord[deg % 3] + (deg === 3 ? 12 : 0) + oct;
    if (T.bass[s] !== null && T.bass[s] !== undefined) this.voice('sawtooth', hz(note(T.bass[s], -12)), t, len * 1.6, 0.16, 600);
    if (T.arp[s] !== null && T.arp[s] !== undefined) this.voice(T.arpWave, hz(note(T.arp[s], T.arpOct - 12)), t, len * 1.3, T.arpVol, 3200);
    const d = T.drums;
    if (T.kick[s]) this.kick(t, d);
    if (T.snare[s]) this.snare(t, d);
    if (T.hat[s]) this.hat(t, d * (s % 4 === 0 ? 1 : 0.6));
  },

  out() { return Sound.musicGain; },

  voice(type, f, t, dur, vol, cutoff) {
    const ctx = Sound.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = type;
    o.frequency.value = f;
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.out());
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  kick(t, vol) {
    const ctx = Sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.5 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(this.out());
    o.start(t); o.stop(t + 0.22);
  },

  snare(t, vol) {
    this.burst(t, 0.16, 0.28 * vol, 'bandpass', 1800);
    const ctx = Sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    g.gain.setValueAtTime(0.18 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(this.out());
    o.start(t); o.stop(t + 0.12);
  },

  hat(t, vol) { this.burst(t, 0.05, 0.12 * vol, 'highpass', 7000); },

  burst(t, dur, vol, type, freq) {
    const ctx = Sound.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out());
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  },

  makeNoise(ctx) {
    const n = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  },
};

// faixa de cada tela: menus tocam o tema calmo; lutas alternam por cenário
function trackFor(screen) {
  if (screen instanceof MatchScreen || (typeof NetMatchScreen !== 'undefined' && screen instanceof NetMatchScreen)) {
    return screen.match.demo ? 'menu' : screen.match.bg.id % 2 ? 'fight1' : 'fight2';
  }
  return 'menu';
}
