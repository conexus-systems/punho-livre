'use strict';
// Carrega os dados do LF2 (assets/data.js), as imagens e os sons.

const Assets = {
  data: null,
  objects: {},      // id -> { id, type, name, data }
  images: {},       // caminho -> HTMLImageElement
  backgrounds: [],

  // Carrega data.js e todas as imagens. onProgress(0..1)
  load(onProgress) {
    return loadScript(LF.ASSETS + 'data.js').then(() => {
      const D = window.LF2_DATA;
      if (!D) throw new Error('assets/data.js não definiu LF2_DATA');
      this.data = D;
      for (const o of D.objects) this.objects[o.id] = o;
      this.backgrounds = D.backgrounds;
      const paths = new Set();
      for (const o of D.objects) {
        for (const f of o.data.bmp.file) for (const k in f) if (k.startsWith('file')) paths.add(f[k]);
        if (o.data.bmp.head) paths.add(o.data.bmp.head);
        if (o.data.bmp.small) paths.add(o.data.bmp.small);
      }
      for (const b of D.backgrounds) {
        if (b.data.shadow) paths.add(b.data.shadow);
        for (const l of b.data.layer) if (l.pic && !l.rect) paths.add(l.pic);
      }
      for (const k in D.ui) {
        const u = D.ui[k];
        if (u && typeof u === 'object') {
          for (const p of [u.pic, u.bg]) if (typeof p === 'string') paths.add(p);
          for (const v of Object.values(u)) if (v && typeof v === 'object' && typeof v.pic === 'string') paths.add(v.pic);
        }
      }
      const list = [...paths];
      let done = 0;
      return Promise.all(list.map((p) => new Promise((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => { done++; if (onProgress) onProgress(done / list.length); resolve(); };
        img.src = LF.ASSETS + p;
        this.images[p] = img;
      })));
    });
  },

  img(path) { return this.images[path]; },
  obj(id) { return this.objects[id]; },
  prop(id, key) {
    const p = this.data.properties[id];
    return p ? p[key] : undefined;
  },
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Não foi possível carregar ' + src));
    document.head.appendChild(s);
  });
}

// Folha de sprites de um objeto: cada quadro tem (w+1) x (h+1) pixels.
class SpriteSheet {
  constructor(bmp) {
    this.files = bmp.file.map((f) => {
      let path = '';
      for (const k in f) if (k.startsWith('file')) path = f[k];
      return { img: Assets.img(path), w: f.w, h: f.h, cols: f.row, rows: f.col, count: f.row * f.col };
    });
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
    if (!f || !f.img || !f.img.complete || !f.img.naturalWidth) return;
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

// Sons: um único arquivo com todos os efeitos, cada um num trecho (início, duração).
const Sound = {
  ctx: null,
  buffer: null,
  muted: false,
  loading: false,
  volume: 0.6,

  init() {
    if (this.ctx || this.loading) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.gain.connect(this.ctx.destination);
    this.loading = true;
    const tryFormat = (fmt) => loadScript(LF.ASSETS + `sound-${fmt}.js`).then(() => {
      const b64 = window['LF2_SOUND_' + fmt.toUpperCase()];
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Promise((res, rej) => this.ctx.decodeAudioData(bytes.buffer, res, rej));
    });
    tryFormat('ogg').catch(() => tryFormat('mp3')).then((buf) => { this.buffer = buf; }).catch(() => {});
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  play(name) {
    if (!this.buffer || this.muted || !name) return;
    const key = String(name).replace(/^.*\//, '').replace(/\.wav$/i, '');
    const s = Assets.data.sounds[key];
    if (!s) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain);
    src.start(0, s[0], s[1]);
  },
};
