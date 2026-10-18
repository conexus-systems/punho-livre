// Lutadores novos do Punho Livre. Cada um usa o corpo de um lutador existente,
// com roupas recoloridas (só a paleta das imagens muda) e golpes, atributos e
// especiais próprios, montados alterando os dados de quadro.

const clone = (o) => JSON.parse(JSON.stringify(o));
const frames = (d) => Object.values(d.frame);
const makeArray = (t) => (!t ? [] : Array.isArray(t) ? t : [t]);

// quadros alcançados a partir de `start` seguindo `next`
function chain(d, start, max = 40) {
  const out = [];
  let n = start;
  for (let i = 0; i < max && d.frame[n] && !out.includes(n); i++) {
    out.push(n);
    const nx = Math.abs(d.frame[n].next);
    if (!nx || nx === 999 || nx === 1000) break;
    n = nx;
  }
  return out;
}

// troca o objeto criado pelos opoints (bolas de energia) por outro
function swapBalls(d, fromOid, toOid, objects) {
  const target = objects.find((o) => o.id === toOid);
  for (const f of frames(d)) {
    for (const op of makeArray(f.opoint)) {
      if (op.oid !== fromOid) continue;
      op.oid = toOid;
      if (!target.data.frame[op.action]) op.action = 0;
    }
  }
}

function eachItr(d, list, fn) {
  for (const n of list) for (const I of makeArray(d.frame[n] && d.frame[n].itr)) if (I.kind === 0) fn(I);
}

function scaleSpeed(d, k, jumpK = 1) {
  const b = d.bmp;
  for (const key of ['walking_speed', 'walking_speedz', 'running_speed', 'running_speedz', 'heavy_walking_speed', 'heavy_running_speed', 'dash_distance']) {
    if (b[key]) b[key] = Math.round(b[key] * k * 100) / 100;
  }
  b.jump_height = Math.round(b.jump_height * jumpK * 100) / 100;
  b.jump_distance = Math.round(b.jump_distance * k * 100) / 100;
}

export const NEW_CHARACTERS = [
  {
    id: 50, base: 11, name: 'Brasa', file: 'brasa',
    color: { to: 2, sat: 1.15, light: 1, keep: [12, 48] },
    props: { hp: 500 },
    mod(d, objects) {
      // rajada de energia vira bola de fogo; o gancho (D↑A) queima
      swapBalls(d, 207, 210, objects);
      eachItr(d, chain(d, d.frame[0].hit_Ua), (I) => { I.effect = 20; });
    },
  },
  {
    id: 51, base: 9, name: 'Geada', file: 'geada',
    color: { to: 195, sat: 0.6, light: 1.3 },
    props: { hp: 480 },
    mod(d, objects) {
      // bolas de gelo e chute giratório que congela
      swapBalls(d, 205, 209, objects);
      eachItr(d, chain(d, d.frame[0].hit_Fj), (I) => { I.effect = 30; });
    },
  },
  {
    id: 52, base: 10, name: 'Corvo', file: 'corvo',
    color: { hue: 140, sat: 0.7, light: 0.62, grays: 0.75 },
    props: { hp: 470 },
    mod(d, objects) {
      // bolas que perseguem o alvo
      swapBalls(d, 206, 215, objects);
      scaleSpeed(d, 1.08);
    },
  },
  {
    id: 53, base: 6, name: 'Titã', file: 'tita',
    color: { to: 44, sat: 1.1, light: 1.05, keep: [36, 70] },
    props: { hp: 620 },
    mod(d) {
      // mais vida e golpes mais fortes, porém mais lento
      for (const f of frames(d)) for (const I of makeArray(f.itr)) if (I.kind === 0 && I.injury) I.injury = Math.round(I.injury * 1.2);
      scaleSpeed(d, 0.88, 0.95);
    },
  },
  {
    id: 54, base: 2, name: 'Faísca', file: 'faisca',
    color: { hue: -150, sat: 1.2, light: 1.1 },
    props: { hp: 450 },
    mod(d, objects) {
      // o mais rápido do elenco, com rajada de energia no lugar do disco
      scaleSpeed(d, 1.22, 1.08);
      for (const f of frames(d)) {
        for (const op of makeArray(f.opoint)) {
          if (op.oid === 200 && op.action === 0) { op.oid = 207; }
        }
      }
      void objects;
    },
  },
];

// Monta os dados do lutador novo e a lista de imagens a gerar (destino <- origem).
export function buildCharacter(spec, objects) {
  const base = objects.find((o) => o.id === spec.base);
  const d = clone(base.data);
  const images = [];
  const remap = (path) => {
    const to = path.replace(/^sprite\/[^/_]+/, `sprite/new/${spec.file}`);
    images.push({ to, from: path });
    return to;
  };
  for (const f of d.bmp.file) for (const k in f) if (k.startsWith('file')) f[k] = remap(f[k]);
  d.bmp.head = remap(d.bmp.head);
  d.bmp.small = remap(d.bmp.small);
  d.bmp.name = spec.name;
  spec.mod(d, objects);
  return { object: { id: spec.id, base: spec.base, type: 'character', name: spec.name, data: d }, images };
}

// ---- cores ----

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const dd = max - min, s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
  let h;
  if (max === r) h = (g - b) / dd + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / dd + 2;
  else h = (r - g) / dd + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}

// Recolore uma entrada de paleta: a pele fica igual, roupas e cabelo mudam de cor.
export function recolor(r, g, b, c) {
  if (r === 0 && g === 0 && b === 0) return [r, g, b];
  let [h, s, l] = rgbToHsl(r, g, b);
  const skin = h >= 5 && h <= 50 && s > 0.2 && l > 0.38 && l < 0.92;
  if (skin) return [r, g, b];
  if (s < 0.12) {
    if (!c.grays) return [r, g, b];
    return hslToRgb(h, s, Math.min(1, l * c.grays));
  }
  // faixas de matiz preservadas (ex.: cabelo castanho ou loiro)
  if (c.keep && h >= c.keep[0] && h <= c.keep[1]) return [r, g, b];
  // `to` leva todas as cores para um matiz; `hue` só gira o matiz
  if (c.to !== undefined) h = c.to + (h % 30) - 15;
  else h += c.hue;
  s = Math.min(1, s * c.sat);
  l = Math.min(0.97, l * c.light);
  return hslToRgb(h, s, l);
}
