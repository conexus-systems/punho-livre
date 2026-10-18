'use strict';
// Efeitos sonoros sintetizados com WebAudio (nenhum arquivo de áudio necessário).

const Sound = {
  ctx: null,
  out: null,
  noiseBuf: null,
  muted: false,
  last: {},

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.32;
      this.out.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, len);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch (e) {
      this.ctx = null;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(f0, f1, dur, type, vol, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol, freq, freq1, type = 'lowpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(freq, t);
    if (freq1) fl.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.03) return;
    this.last[name] = now;
    switch (name) {
      case 'whoosh': this.noise(0.12, 0.22, 600, 2400, 'bandpass'); break;
      case 'hit': this.noise(0.09, 0.7, 2200, 400); this.tone(180, 60, 0.1, 'sine', 0.6); break;
      case 'heavy': this.noise(0.18, 0.9, 1600, 200); this.tone(120, 40, 0.22, 'sine', 0.9); break;
      case 'block': this.tone(900, 600, 0.07, 'square', 0.15); this.noise(0.05, 0.3, 4000, 2000, 'highpass'); break;
      case 'ki': this.tone(300, 900, 0.25, 'sawtooth', 0.12); this.tone(150, 450, 0.25, 'sine', 0.25); break;
      case 'fire': this.noise(0.4, 0.5, 800, 200); this.tone(90, 50, 0.3, 'sawtooth', 0.15); break;
      case 'ice': this.tone(1800, 2600, 0.25, 'triangle', 0.12); this.tone(1200, 2400, 0.3, 'sine', 0.1, 0.05); break;
      case 'freeze': this.tone(2400, 800, 0.4, 'triangle', 0.12); this.noise(0.3, 0.3, 6000, 3000, 'highpass'); break;
      case 'shatter': this.noise(0.3, 0.5, 7000, 1500, 'highpass'); this.tone(2000, 500, 0.25, 'square', 0.06); break;
      case 'zap': this.tone(1400, 200, 0.15, 'sawtooth', 0.18); this.noise(0.12, 0.3, 5000, 1000, 'highpass'); break;
      case 'thunder': this.noise(0.8, 1, 1200, 80); this.tone(70, 30, 0.7, 'sawtooth', 0.4); break;
      case 'boom': this.noise(0.6, 1, 900, 60); this.tone(90, 30, 0.5, 'sine', 0.9); break;
      case 'throw': this.noise(0.15, 0.3, 900, 3000, 'bandpass'); break;
      case 'pick': this.tone(600, 900, 0.08, 'square', 0.12); break;
      case 'drink': this.tone(500, 1000, 0.12, 'sine', 0.25); this.tone(700, 1400, 0.12, 'sine', 0.2, 0.1); break;
      case 'land': this.noise(0.08, 0.35, 500, 150); break;
      case 'fall': this.noise(0.2, 0.8, 700, 100); this.tone(90, 40, 0.2, 'sine', 0.7); break;
      case 'teleport': this.tone(200, 2000, 0.18, 'sine', 0.2); break;
      case 'smoke': this.noise(0.4, 0.4, 1500, 300, 'bandpass'); break;
      case 'break': this.noise(0.2, 0.6, 3000, 600, 'bandpass'); this.tone(300, 120, 0.15, 'square', 0.1); break;
      case 'ko': this.tone(400, 100, 0.6, 'square', 0.18); this.tone(300, 80, 0.6, 'square', 0.12, 0.05); break;
      case 'menu': this.tone(700, 0, 0.05, 'square', 0.08); break;
      case 'select': this.tone(500, 1200, 0.1, 'square', 0.12); break;
      case 'back': this.tone(500, 250, 0.1, 'square', 0.1); break;
      case 'go': this.tone(440, 0, 0.12, 'square', 0.15); this.tone(660, 0, 0.2, 'square', 0.15, 0.12); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0, 0.25, 'square', 0.12, i * 0.12)); break;
      case 'lose': [400, 330, 262, 196].forEach((f, i) => this.tone(f, 0, 0.3, 'triangle', 0.15, i * 0.18)); break;
    }
  },
};
