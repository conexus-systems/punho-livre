'use strict';
// Constantes e utilitários compartilhados por todo o jogo.

const VIEW_W = 960;
const VIEW_H = 540;
const FLOOR_Y = 300;   // y da tela onde fica a borda de trás do chão (z = 0)
const DEPTH = 200;     // profundidade jogável: z vai de 0 (fundo) a DEPTH (frente)
const GRAVITY = 0.62;
const DEG = Math.PI / 180;

const FONT_DISPLAY = '"Bungee", Impact, "Arial Black", sans-serif';
const FONT_UI = '"Chakra Petch", "Trebuchet MS", "Segoe UI", sans-serif';

const PLAYER_COLORS = ['#ff5a4e', '#4fb0ff'];
const TEAM_COLORS = ['#c9c9d6', '#ff6b5e', '#5aa9ff', '#66d17a', '#ffc94a'];
const TEAM_NAMES = ['Independente', 'Time 1', 'Time 2', 'Time 3', 'Time 4'];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sign = (v) => (v < 0 ? -1 : 1);

function approach(v, target, step) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

// Ruído determinístico: mesmo n -> mesmo valor em [0, 1).
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Clareia (amt > 0) ou escurece (amt < 0) uma cor #rrggbb.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function txt(ctx, s, x, y, o = {}) {
  ctx.font = `${o.weight || ''} ${o.size || 16}px ${o.font || FONT_UI}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.stroke) {
    ctx.lineWidth = o.strokeW || 4;
    ctx.strokeStyle = o.stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y);
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
