'use strict';
// Dados, imagens e sons do jogo. Tudo é gerado por código ao abrir o jogo
// (src/content/), então não há arquivos de arte externos.

const Assets = {
  data: null,
  objects: {},      // id -> { id, type, name, data }
  images: {},       // chave -> canvas
  backgrounds: [],

  // Monta os lutadores, armas, efeitos e cenários. onProgress(0..1)
  load(onProgress) {
    return Content.build(this.images, onProgress).then((D) => {
      this.data = D;
      for (const o of D.objects) this.objects[o.id] = o;
      this.backgrounds = D.backgrounds;
    });
  },

  img(path) { return this.images[path]; },
  obj(id) { return this.objects[id]; },
  prop(id, key) {
    const p = this.data.properties[id];
    return p ? p[key] : undefined;
  },
};

// Folha de sprites de um objeto: cada quadro tem (w+1) x (h+1) pixels.
class SpriteSheet {
  constructor(bmp) {
    this.files = bmp.file.map((f) => ({ img: Assets.img(f.file), w: f.w, h: f.h, cols: f.row, rows: f.col, count: f.row * f.col }));
    this.w = bmp.file[0].w + 1;
    this.h = bmp.file[0].h + 1;
  }

  // desenha o quadro `pic` com o canto superior esquerdo em (x, y)
  draw(ctx, pic, x, y, flip) {
    let i = pic, f = null;
    for (const file of this.files) {
      if (i < file.count) { f = file; break; }
      i -= file.count;
    }
    if (!f || !f.img) return;
    // cada célula tem uma linha separadora de 1px à direita e embaixo, que não é desenhada
    const cw = f.w + 1, ch = f.h + 1;
    const sx = (i % f.cols) * cw, sy = Math.floor(i / f.cols) * ch;
    x = Math.round(x); y = Math.round(y);
    if (flip) {
      ctx.save();
      ctx.translate(x + cw, y);
      ctx.scale(-1, 1);
      ctx.drawImage(f.img, sx, sy, f.w, f.h, 0, 0, f.w, f.h);
      ctx.restore();
    } else {
      ctx.drawImage(f.img, sx, sy, f.w, f.h, x, y, f.w, f.h);
    }
  }
}

// Sons sintetizados na hora (ruído filtrado e tons), um buffer por nome.
const Sound = {
  ctx: null,
  buffers: {},
  muted: false,
  volume: 0.55,

  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.gain.connect(this.ctx.destination);
    for (const name in SOUNDS) this.buffers[name] = synth(this.ctx, ...SOUNDS[name]);
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  play(name) {
    if (!this.ctx || this.muted || !name) return;
    const buf = this.buffers[name];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    src.start(0);
  },
};

function synth(ctx, dur, gen) {
  const sr = ctx.sampleRate, n = Math.floor(dur * sr);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const S = { sr, lp: {}, ph: {} };
  for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, gen(i / sr, S)));
  return buf;
}

// envelope: sobe em a segundos e cai exponencialmente com constante d
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
// ruído com filtro passa-baixa (c perto de 1 = agudo)
const noise = (S, c, k = 0) => {
  const y = S.lp[k] || 0;
  S.lp[k] = y + c * (Math.random() * 2 - 1 - y);
  return S.lp[k];
};
const tone = (S, f, k = 0, shape = 'sin') => {
  S.ph[k] = (S.ph[k] || 0) + f / S.sr;
  const p = S.ph[k] % 1;
  if (shape === 'sq') return p < 0.5 ? 0.6 : -0.6;
  if (shape === 'tri') return 4 * Math.abs(p - 0.5) - 1;
  return Math.sin(2 * Math.PI * p);
};
const notes = (S, t, list, len, shape = 'tri') => {
  const i = Math.min(list.length - 1, Math.floor(t / len));
  return tone(S, list[i], 9, shape) * env(t - i * len, 0.005, len * 0.7);
};

const SOUNDS = {
  hit: [0.12, (t, S) => 1.3 * noise(S, 0.35) * env(t, 0.002, 0.04) + 0.6 * tone(S, 140 - t * 400) * env(t, 0.001, 0.05)],
  hit2: [0.25, (t, S) => 1.6 * noise(S, 0.22) * env(t, 0.002, 0.08) + 0.8 * tone(S, 90 - t * 160) * env(t, 0.001, 0.12)],
  block: [0.12, (t, S) => 0.35 * (tone(S, 900) + tone(S, 1340, 1)) * env(t, 0.001, 0.04) + 0.4 * noise(S, 0.8) * env(t, 0.001, 0.015)],
  swing: [0.16, (t, S) => 1.2 * noise(S, 0.08 + t * 2) * Math.sin((Math.PI * t) / 0.16)],
  step: [0.06, (t, S) => 1.2 * noise(S, 0.12) * env(t, 0.002, 0.02)],
  jump: [0.12, (t, S) => 0.9 * noise(S, 0.15 + t * 3) * Math.sin((Math.PI * t) / 0.12)],
  land: [0.12, (t, S) => 1.6 * noise(S, 0.08) * env(t, 0.002, 0.04)],
  fall: [0.3, (t, S) => 2 * noise(S, 0.06) * env(t, 0.002, 0.08) + 0.7 * tone(S, 70 - t * 60) * env(t, 0.001, 0.12)],
  grab: [0.12, (t, S) => 0.9 * noise(S, 0.4) * env(t, 0.002, 0.03) + 0.4 * tone(S, 260) * env(t, 0.001, 0.05)],
  pick: [0.1, (t, S) => 0.3 * tone(S, 600 + t * 3000, 0, 'tri') * env(t, 0.002, 0.05)],
  blast: [0.4, (t, S) => 0.5 * tone(S, 700 - t * 1300, 0, 'tri') * env(t, 0.005, 0.15) + 0.8 * noise(S, 0.3) * env(t, 0.01, 0.12)],
  fire: [0.45, (t, S) => 1.2 * noise(S, 0.22) * env(t, 0.03, 0.18) * (0.7 + 0.3 * Math.sin(t * 90))],
  freeze: [0.5, (t, S) => 0.22 * (tone(S, 1800) + tone(S, 2420, 1) + tone(S, 3160, 2)) * env(t, 0.005, 0.18) + 0.4 * noise(S, 0.9) * env(t, 0.001, 0.08)],
  shatter: [0.35, (t, S) => 1.1 * noise(S, 0.9) * env(t, 0.001, 0.1) + 0.3 * tone(S, 2600 + 900 * Math.sin(t * 300)) * env(t, 0.001, 0.08)],
  zap: [0.3, (t, S) => 0.5 * tone(S, 900 + 600 * Math.sign(Math.sin(t * 160)), 0, 'sq') * env(t, 0.002, 0.1) + 0.5 * noise(S, 0.7) * env(t, 0.002, 0.06)],
  boom: [0.45, (t, S) => 1.8 * noise(S, 0.1) * env(t, 0.003, 0.14) + 0.8 * tone(S, 75 - t * 60) * env(t, 0.002, 0.2)],
  slam: [0.6, (t, S) => 2.2 * noise(S, 0.05) * env(t, 0.003, 0.2) + tone(S, 55 - t * 30) * env(t, 0.002, 0.3)],
  teleport: [0.35, (t, S) => 0.4 * tone(S, 300 + t * 4000 + 60 * Math.sin(t * 120)) * env(t, 0.01, 0.15)],
  heal: [0.7, (t, S) => 0.4 * notes(S, t, [523, 659, 784, 1046], 0.12)],
  wood: [0.12, (t, S) => 0.5 * (tone(S, 420) + tone(S, 690, 1)) * env(t, 0.001, 0.03) + 0.6 * noise(S, 0.5) * env(t, 0.001, 0.015)],
  clank: [0.35, (t, S) => 0.25 * (tone(S, 1700) + tone(S, 2650, 1) + tone(S, 3330, 2)) * env(t, 0.001, 0.09)],
  thud: [0.25, (t, S) => 0.9 * tone(S, 95 - t * 100) * env(t, 0.001, 0.08) + 1.2 * noise(S, 0.1) * env(t, 0.001, 0.05)],
  break: [0.35, (t, S) => 1.3 * noise(S, 0.6) * env(t, 0.001, 0.08) + 0.6 * noise(S, 0.1, 1) * env(t, 0.001, 0.15)],
  m_pass: [0.05, (t, S) => 0.18 * tone(S, 880, 0, 'sq') * env(t, 0.001, 0.02)],
  m_ok: [0.2, (t, S) => 0.3 * notes(S, t, [660, 990], 0.08, 'sq')],
  m_cancel: [0.18, (t, S) => 0.3 * notes(S, t, [440, 330], 0.08, 'sq')],
  m_join: [0.2, (t, S) => 0.3 * notes(S, t, [523, 784, 1046], 0.06, 'sq')],
  m_end: [0.9, (t, S) => 0.32 * notes(S, t, [523, 659, 784, 1046, 1046], 0.14, 'sq')],
};
