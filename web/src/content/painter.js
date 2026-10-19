'use strict';
// Desenho por código: lutadores (esqueleto em pose + roupa e cabelo), retratos,
// armas, ataques especiais e efeitos. Tudo o que aparece no jogo sai daqui.

const BODY = { T: 19, UA: 10, LA: 10, TH: 12, SH: 12, HEAD: 9, FOOT: 6 };
const INK = '#1d1428';
const FIGHTER_SCALE = 1.14; // tamanho dos lutadores em relação ao esqueleto base

const rad = (d) => (d * Math.PI) / 180;
// ângulos em graus: 0 aponta para baixo, 90 para a frente, 180 para cima
const vec = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];
const along = (p, a, len) => { const [x, y] = vec(a); return [p[0] + x * len, p[1] + y * len]; };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  // a SpriteSheet e o cenário tratam o canvas como uma imagem já carregada
  c.complete = true;
  c.naturalWidth = c.width;
  c.naturalHeight = c.height;
  return c;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

// Pose: { lean, head, af: [braço, antebraço], ab, lf: [coxa, joelho], lb, rot, dx, dy, face, open }
// af/lf são o braço e a perna da frente (mais perto de quem olha); ab/lb os de trás.
function solvePose(p, scale = 1) {
  const L = BODY, s = scale;
  const J = {};
  const lean = p.lean || 0, up = 180 - lean;
  J.pelvis = [0, 0];
  J.neck = along(J.pelvis, up, L.T * s);
  J.chest = along(J.pelvis, up, L.T * 0.65 * s);
  J.shoulder = along(J.pelvis, up, L.T * 0.9 * s);
  const hu = up + (p.head || 0);
  J.head = along(J.neck, hu, (L.HEAD + 1.5) * s);
  J.headUp = along(J.head, hu, 1);
  const arm = (k, a) => {
    const ua = a[0] - lean, fa = ua + a[1];
    J['e' + k] = along(J.shoulder, ua, L.UA * s);
    J['h' + k] = along(J['e' + k], fa, L.LA * s);
    J['fa' + k] = fa;
  };
  arm('f', p.af || [10, 20]);
  arm('b', p.ab || [-10, 20]);
  const leg = (k, a) => {
    const th = a[0], sh = th - a[1];
    J['k' + k] = along(J.pelvis, th, L.TH * s);
    J['a' + k] = along(J['k' + k], sh, L.SH * s);
    J['t' + k] = along(J['a' + k], sh + 90, L.FOOT * s);
    J['heel' + k] = along(J['a' + k], sh - 90, 1.5 * s);
  };
  leg('f', p.lf || [8, 4]);
  leg('b', p.lb || [-8, 4]);
  // rotação do corpo inteiro (em torno do quadril), positiva para a frente
  if (p.rot) {
    const r = rad(p.rot), c = Math.cos(r), sn = Math.sin(r);
    for (const k in J) {
      if (!Array.isArray(J[k])) continue;
      const [x, y] = J[k];
      J[k] = [x * c - y * sn, x * sn + y * c];
    }
    J.faf += p.rot ? -p.rot : 0;
    J.fab += p.rot ? -p.rot : 0;
  }
  return J;
}

// encaixa a pose na célula: quadril em x = cx + dx e o ponto mais baixo em y = base + dy
function placePose(p, scale, cx, base) {
  const J = solvePose(p, scale);
  let maxY = -Infinity;
  for (const k in J) {
    if (!Array.isArray(J[k]) || k === 'headUp') continue;
    let y = J[k][1];
    if (k === 'head') y += BODY.HEAD * scale;
    if (k[0] === 'h' && k.length === 2) y += 3 * scale;
    maxY = Math.max(maxY, y);
  }
  const ox = cx + (p.dx || 0), oy = base - maxY + (p.dy || 0);
  for (const k in J) if (Array.isArray(J[k])) J[k] = [J[k][0] + ox, J[k][1] + oy];
  return J;
}

// luz vem de cima, um pouco da esquerda
const LIGHT = [-0.5, -0.85];

// membro cônico com contorno, brilho do lado da luz e sombra do lado oposto
function limb(ctx, a, b, w1, w2, hex, back) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (nx * LIGHT[0] + ny * LIGHT[1] < 0) { nx = -nx; ny = -ny; }
  const base = back ? shade(hex, 0.74) : hex;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * w1 / 2, a[1] + ny * w1 / 2);
    ctx.lineTo(b[0] + nx * w2 / 2, b[1] + ny * w2 / 2);
    ctx.lineTo(b[0] - nx * w2 / 2, b[1] - ny * w2 / 2);
    ctx.lineTo(a[0] - nx * w1 / 2, a[1] - ny * w1 / 2);
    ctx.closePath();
    ctx.moveTo(a[0] + w1 / 2, a[1]); ctx.arc(a[0], a[1], w1 / 2, 0, Math.PI * 2);
    ctx.moveTo(b[0] + w2 / 2, b[1]); ctx.arc(b[0], b[1], w2 / 2, 0, Math.PI * 2);
  };
  ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke();
  // o preenchimento é feito em partes: sentidos opostos dos subcaminhos abririam buracos
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * w1 / 2, a[1] + ny * w1 / 2); ctx.lineTo(b[0] + nx * w2 / 2, b[1] + ny * w2 / 2);
  ctx.lineTo(b[0] - nx * w2 / 2, b[1] - ny * w2 / 2); ctx.lineTo(a[0] - nx * w1 / 2, a[1] - ny * w1 / 2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(a[0], a[1], w1 / 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(b[0], b[1], w2 / 2, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round';
  const edge = (k, w, col, alpha) => {
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, w);
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * k * w1, a[1] + ny * k * w1);
    ctx.lineTo(b[0] + nx * k * w2, b[1] + ny * k * w2);
    ctx.stroke(); ctx.globalAlpha = 1;
  };
  edge(0.22, Math.min(w1, w2) * 0.2, shade(hex, back ? 1.1 : 1.4), 0.55);
  edge(-0.26, Math.min(w1, w2) * 0.26, shade(hex, 0.5), 0.35);
}

function capsule(ctx, a, b, w, fill) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 2.4;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

function blob(ctx, pts, fill, line = 1.2) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = line * 2;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

function disc(ctx, c, r, fill) {
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c[0], c[1], Math.max(0.5, r - 1.2), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// esfera com luz: cabeça, mãos
function ball(ctx, c, r, hex, back) {
  ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  const g = ctx.createRadialGradient(c[0] - r * 0.35, c[1] - r * 0.4, r * 0.1, c[0], c[1], r);
  g.addColorStop(0, shade(hex, back ? 1.1 : 1.28)); g.addColorStop(0.55, back ? shade(hex, 0.74) : hex); g.addColorStop(1, shade(hex, back ? 0.55 : 0.78));
  ctx.beginPath(); ctx.arc(c[0], c[1], Math.max(0.5, r - 1.2), 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
}

// símbolo no peito, no sistema de coordenadas do tronco (x para a frente, y para cima)
function drawEmblem(ctx, e, at, ang, size) {
  ctx.save();
  ctx.translate(at[0], at[1]); ctx.rotate(ang);
  ctx.fillStyle = e.color; ctx.strokeStyle = e.color; ctx.lineWidth = Math.max(1, size * 0.14); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = size;
  switch (e.type) {
    case 'flame':
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.9, -r * 0.1, r * 0.4, r * 0.7); ctx.quadraticCurveTo(0, r * 1.1, -r * 0.5, r * 0.6);
      ctx.quadraticCurveTo(-r * 0.9, 0, -r * 0.2, -r * 0.3); ctx.quadraticCurveTo(-r * 0.2, -r * 0.7, 0, -r); ctx.fill(); break;
    case 'snow':
      for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(-Math.cos(a) * r, -Math.sin(a) * r); ctx.stroke(); } break;
    case 'bolt':
      ctx.beginPath(); ctx.moveTo(r * 0.3, -r); ctx.lineTo(-r * 0.5, r * 0.1); ctx.lineTo(r * 0.05, r * 0.1); ctx.lineTo(-r * 0.3, r); ctx.lineTo(r * 0.6, -r * 0.2); ctx.lineTo(0, -r * 0.2); ctx.closePath(); ctx.fill(); break;
    case 'star':
      ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, a = (k * Math.PI) / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); break;
    case 'moon':
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.2, r * 0.85, 0, Math.PI * 2); ctx.fill(); break;
    case 'ring':
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2); ctx.fill(); break;
    case 'fist':
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = shade('#000000', 1); break;
    default: break;
  }
  ctx.restore();
}

// Desenha um lutador numa pose já posicionada (J de placePose).
function drawBody(ctx, J, look, p, s = 1) {
  const w = look.build || 1;
  const skin = look.skin;
  const sleeveUp = look.sleeves === 'none' ? skin : look.shirt;
  const sleeveLow = look.sleeves === 'long' ? look.shirt : skin;
  const shinColor = look.shorts ? skin : look.pants;
  const handColor = look.gloves || skin;

  const drawLeg = (k, back) => {
    limb(ctx, J.pelvis, J['k' + k], 10 * w * s, 8 * w * s, look.pants, back);
    limb(ctx, J['k' + k], J['a' + k], 8 * w * s, 6 * w * s, shinColor, back);
    if (look.shorts) limb(ctx, along(J['a' + k], 0, -3 * s), J['a' + k], 6.4 * s, 6 * s, look.socks || '#f2f2f2', back);
    // pé: sapato com sola clara
    limb(ctx, J['heel' + k], J['t' + k], 6 * s, 5 * s, look.shoes, back);
    ctx.globalAlpha = back ? 0.6 : 0.85;
    capsule(ctx, [J['heel' + k][0] - 0.5 * s, J['heel' + k][1] + 2.4 * s], [J['t' + k][0], J['t' + k][1] + 2.2 * s], 1.5 * s, '#efeae0');
    ctx.globalAlpha = 1;
  };
  const drawArm = (k, back) => {
    limb(ctx, J.shoulder, J['e' + k], 7.4 * w * s, 6.2 * w * s, sleeveUp, back);
    limb(ctx, J['e' + k], J['h' + k], 6.2 * w * s, 5 * w * s, sleeveLow, back);
    if (look.wrist) limb(ctx, along(J['h' + k], J['fa' + k] + 180, 3.4 * s), J['h' + k], 6 * s, 5.4 * s, look.wrist, back);
    ball(ctx, J['h' + k], (p.open ? 3.4 : 4.3) * Math.sqrt(w) * s, handColor, back);
  };

  const hu = sub(J.headUp, J.head), fw = [-hu[1], hu[0]];
  const H = (lx, ly) => [J.head[0] + fw[0] * lx * s + hu[0] * ly * s, J.head[1] + fw[1] * lx * s + hu[1] * ly * s];

  // cachecol: as pontas esvoaçam para trás
  if (look.scarf) {
    const n = J.neck, wob = Math.sin(p.lean || 0) * 2;
    const t1 = [n[0] - fw[0] * 9 * s, n[1] - fw[1] * 9 * s + 3 * s + wob], t2 = [t1[0] - fw[0] * 8 * s, t1[1] + 3 * s];
    limb(ctx, n, t1, 4.4 * s, 3.4 * s, look.scarf, true);
    limb(ctx, t1, t2, 3.4 * s, 2 * s, look.scarf, true);
  }

  drawArm('b', true);
  drawLeg('b', true);

  // tronco: quadril, cintura, peito e ombros
  const ax = sub(J.neck, J.pelvis), len = Math.hypot(ax[0], ax[1]) || 1;
  const n = [-ax[1] / len, ax[0] / len];
  const hw = 6.6 * w * s, sw = 8.8 * w * s;
  const at = (t, k) => [J.pelvis[0] + ax[0] * t + n[0] * k, J.pelvis[1] + ax[1] * t + n[1] * k];
  const tp = [at(0, hw), at(0.42, hw * 0.9), at(0.8, sw), at(1, sw * 0.62), at(1, -sw * 0.62), at(0.8, -sw), at(0.42, -hw * 0.9), at(0, -hw)];
  const grad = ctx.createLinearGradient(...at(0.5, hw * 1.1), ...at(0.5, -hw * 1.1));
  const lightFront = n[0] * LIGHT[0] + n[1] * LIGHT[1] > 0;
  grad.addColorStop(0, shade(look.shirt, lightFront ? 1.25 : 0.72));
  grad.addColorStop(0.5, look.shirt);
  grad.addColorStop(1, shade(look.shirt, lightFront ? 0.72 : 1.25));
  blob(ctx, tp, grad, 1.3);
  // gola e barra da camisa
  ctx.globalAlpha = 0.9;
  blob(ctx, [at(1, sw * 0.4), at(0.74, 0), at(1, -sw * 0.4)], sleeveUp === skin && !look.vest ? skin : shade(look.shirt, 0.6), 0.5);
  ctx.globalAlpha = 1;
  if (look.vest) {
    const m = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    blob(ctx, [m(tp[0], tp[7], 0.38), m(tp[0], tp[7], 0.62), m(tp[3], tp[4], 0.64), m(tp[3], tp[4], 0.36)], look.vest, 0.6);
  }
  if (look.emblem) {
    const c = at(0.62, hw * 0.35 * (look.emblemSide || 0.6));
    drawEmblem(ctx, look.emblem, c, Math.atan2(ax[1], ax[0]) + Math.PI / 2, 2.8 * w * s);
  }
  if (look.belt) {
    capsule(ctx, at(0.06, hw * 1.02), at(0.06, -hw * 1.02), 2.8 * s, look.belt);
    ctx.globalAlpha = 0.9;
    capsule(ctx, at(0.06, hw * 0.1 + 0.5 * s), at(0.06, hw * 0.1 + 0.6 * s), 3.2 * s, '#ffd54a');
    ctx.globalAlpha = 1;
  }
  drawLeg('f', false);

  // cabeça
  const R = (BODY.HEAD + 0.6) * s;
  ball(ctx, J.head, R, skin, false);
  ball(ctx, H(-1.6, -0.6), 2.3 * s, skin, true);
  drawHair(ctx, H, look, s);
  drawFace(ctx, H, look, p.face, s);
  if (look.scarf) { limb(ctx, J.neck, along(J.neck, 180 - (p.lean || 0), 1.5 * s), 7 * s, 7 * s, look.scarf, false); }

  drawArm('f', false);
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }

function drawHair(ctx, H, look, s) {
  const c = look.hair, poly = (pts, col = c) => blob(ctx, pts.map(([x, y]) => H(x * 1.12, y * 1.12)), col, 1.1);
  const shine = (a, ctl, b, col = shade(c, 1.7)) => {
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...H(a[0] * 1.12, a[1] * 1.12)); ctx.quadraticCurveTo(...H(ctl[0] * 1.12, ctl[1] * 1.12), ...H(b[0] * 1.12, b[1] * 1.12)); ctx.stroke(); ctx.restore();
  };
  switch (look.hairStyle) {
    case 'spiky':
      poly([[6, 5], [4, 12], [1, 8], [-2, 14], [-4, 8], [-9, 12], [-8, 5], [-13, 4], [-9, 0], [-10, -4], [-7, -2], [-5, 3], [0, 5], [4, 3]]);
      shine([-5, 7], [-1, 10], [3, 7]);
      break;
    case 'short':
      poly([[7, 3], [6, 7], [2, 9.6], [-3, 9.4], [-7.5, 6.5], [-9.4, 1.5], [-8.8, -3], [-6.5, -2], [-5, 3], [0, 5], [5, 5.2]]);
      shine([-5, 7.5], [-1, 9.5], [3, 8]);
      break;
    case 'flat':
      poly([[7.5, 4], [7.5, 9], [-8.5, 9], [-9.5, 0], [-8.5, -3], [-6, 2], [0, 5.5]]);
      shine([-5, 7.5], [-1, 8.5], [4, 8]);
      break;
    case 'long':
      poly([[7, 3], [6, 8], [1, 10], [-5, 9], [-9, 5], [-11, -3], [-10, -11], [-6, -12], [-5, -4], [-4, 2], [0, 5], [5, 5]]);
      shine([-5, 8], [-1, 10], [4, 8]);
      shine([-9, -2], [-9.5, -6], [-8, -9]);
      break;
    case 'bun':
      poly([[7, 3], [5.5, 8], [0, 9.8], [-6, 8], [-9, 3], [-8.5, -2], [-6, 2], [0, 5], [5, 5]]);
      ball(ctx, H(-7, 9), 3.8 * s, c, false);
      break;
    case 'ponytail':
      poly([[7, 3], [6, 8], [1, 10], [-5, 9], [-9, 5], [-9, 0], [-6, 2], [0, 5], [5, 5]]);
      poly([[-7, 7], [-14, 5], [-17, -2], [-15, -9], [-12, -3], [-9, 2]]);
      shine([-4, 8], [0, 9.5], [4, 7.5]);
      break;
    case 'mohawk':
      poly([[5, 7], [3, 13], [-1, 12], [-5, 13], [-8, 9], [-9, 4], [-6, 7], [0, 8]]);
      shine([-6, 10], [-2, 12], [2, 11]);
      break;
    case 'hood':
      poly([[7.5, 2], [7, 8], [1, 11], [-6, 10], [-10, 4], [-11, -6], [-7, -9], [-5, -3], [-3, 2], [3, 3.5]]);
      shine([-6, 9], [-1, 10.5], [4, 8.5], '#7a7a94');
      break;
    case 'bandana':
      poly([[7.5, 2.5], [6.5, 7.5], [1, 9.8], [-5, 9], [-8.5, 5], [-9, 1], [-3, 2.5], [3, 3]], look.accent);
      poly([[-8, 3], [-15, 1], [-16, -4], [-10, -1]], look.accent);
      shine([-5, 7.5], [-1, 9], [3, 8], shade(look.accent, 1.6));
      break;
    default: break; // careca
  }
  if (look.headband) {
    capsule(ctx, H(7.8, 3.2), H(-8.6, 3.6), 2.8 * s, look.headband);
    capsule(ctx, H(-8.6, 3.6), H(-15, 1), 2.2 * s, look.headband);
    capsule(ctx, H(-8.6, 3.6), H(-14, -2.5), 2.2 * s, look.headband);
  }
}

function drawFace(ctx, H, look, face, s) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  const K = 1.12, Q = (x, y) => H(x * K, y * K);
  const line = (a, b, w = 1.3) => { ctx.lineWidth = w * s; ctx.beginPath(); ctx.moveTo(...Q(a[0], a[1])); ctx.lineTo(...Q(b[0], b[1])); ctx.stroke(); };
  const oval = (c, rx, ry, fill, rot = 0) => { ctx.beginPath(); ctx.ellipse(...Q(c[0], c[1]), rx * s, ry * s, rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  if (look.mask) {
    blob(ctx, [Q(8.4, -0.4), Q(7, -6), Q(1, -8.4), Q(-4, -6), Q(-2, -0.4)], look.mask, 0.8);
    ctx.globalAlpha = 0.35; line([-1, -3], [6, -2], 1.2); ctx.globalAlpha = 1;
  } else if (face !== 'ko') {
    ctx.globalAlpha = 0.28; oval([3.6, -2.6], 2.2, 1.3, '#ff6b6b'); ctx.globalAlpha = 1; // bochecha
  }
  if (face === 'ko') {
    ctx.strokeStyle = INK;
    line([3.4, 2.8], [6.8, -0.4], 1.5); line([3.4, -0.4], [6.8, 2.8], 1.5);
  } else if (face === 'hurt') {
    ctx.strokeStyle = INK;
    line([3.4, 2.6], [7, 0.6], 1.5); line([3.4, -0.4], [7, 0.6], 1.5);
    if (!look.mask) { oval([5.8, -4.6], 1.5, 1.1, '#3a1010'); }
    line([3, 4.6], [7.2, 3.4], 1.4);
  } else {
    const shout = face === 'shout';
    // olho: branco, íris e brilho
    const ey = shout ? 1.9 : 2.6;
    oval([5.7, 1.2], 1.9, ey, '#ffffff');
    ctx.lineWidth = 0.9 * s; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(...Q(5.7, 1.2), 1.9 * s, ey * s, 0, 0, Math.PI * 2); ctx.stroke();
    oval([6.3, 1.1], 1.45, ey - 0.35, look.eye || '#3a2418');
    oval([6.5, 1.1], 0.8, ey - 1, '#0c0810');
    oval([6.8, 1.9], 0.55, 0.55, '#ffffff');
    // sobrancelha (brava se gritando)
    ctx.strokeStyle = look.brow || INK;
    line(shout ? [3, 5.8] : [3.4, 5.4], shout ? [8, 3.6] : [8, 5.2], shout ? 1.9 : 1.3);
    ctx.strokeStyle = INK;
    if (!look.mask) {
      if (shout) { oval([6.2, -4.6], 1.8, 1.4, '#4a0f18'); oval([6.2, -5.2], 1, 0.5, '#e86a7a'); }
      else line([4.6, -4.4], [7.4, -4.1], 1.2);
      line([8.6, -1.4], [9.2, -2.2], 1);
    }
  }
  if (look.beard) blob(ctx, [Q(7.8, -2.5), Q(6, -7.6), Q(1, -9), Q(-3, -6), Q(-1, -3), Q(4, -4.5)], look.hair, 0.8);
  if (look.glasses) { ctx.strokeStyle = INK; line([2.5, 1.2], [8, 1.2], 2.6); }
}

// desenha uma pose numa célula de w x h com o pé em `base`
function drawPoseCell(ctx, look, pose, x0, y0, w, base) {
  const s = (look.scale || 1) * FIGHTER_SCALE;
  const J = placePose(pose, s, x0 + w / 2, y0 + base);
  drawBody(ctx, J, look, pose, s);
  return J;
}

// Retrato (cabeça e ombros) num quadrado de `size`
function drawPortrait(ctx, look, x, y, size, bg) {
  const s = size / 29;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  if (bg) {
    const g = ctx.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, shade(bg, 1.35)); g.addColorStop(1, shade(bg, 0.55));
    ctx.fillStyle = g; ctx.fillRect(x, y, size, size);
  }
  const pose = { lean: 4, head: 2, af: [8, 30], ab: [-8, 30], lf: [6, 2], lb: [-6, 2] };
  const J = solvePose(pose, s);
  const ox = x + size * 0.5 - J.head[0], oy = y + size * 0.47 - J.head[1];
  for (const k in J) if (Array.isArray(J[k])) J[k] = [J[k][0] + ox, J[k][1] + oy];
  drawBody(ctx, J, look, pose, s);
  ctx.restore();
}

// ---- armas ----

// arma leve: 16 ângulos (k = 0 para cima, girando para a frente)
function weaponAngle(k) { return 180 - k * 22.5; }

function drawWeapon(ctx, kind, cx, cy, angle, s = 1) {
  const tip = along([cx, cy], angle, 19 * s), butt = along([cx, cy], angle + 180, 5 * s);
  if (kind === 'bat') {
    capsule(ctx, butt, along([cx, cy], angle, 6 * s), 3 * s, '#8a5a2b');
    capsule(ctx, along([cx, cy], angle, 5 * s), tip, 5.2 * s, '#c88a4a');
  } else if (kind === 'pipe') {
    capsule(ctx, butt, tip, 3.6 * s, '#9aa4b2');
    capsule(ctx, along([cx, cy], angle, 16 * s), tip, 5 * s, '#6c7682');
  } else if (kind === 'stone') {
    blob(ctx, [[cx - 15, cy + 2], [cx - 12, cy - 11], [cx - 2, cy - 16], [cx + 11, cy - 12], [cx + 16, cy - 1], [cx + 12, cy + 12], [cx - 3, cy + 15], [cx - 13, cy + 11]].map(([px, py]) => [cx + (px - cx) * s, cy + (py - cy) * s]), '#8d8d94', 1.3);
    blob(ctx, [[cx - 8, cy - 8], [cx + 2, cy - 12], [cx + 8, cy - 7], [cx - 1, cy - 4]], '#b3b3ba', 0.6);
  } else if (kind === 'crate') {
    const r = 15 * s;
    blob(ctx, [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], '#b9803f', 1.3);
    ctx.strokeStyle = '#7a4f22'; ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx + r, cy - r);
    ctx.strokeRect(cx - r + 3, cy - r + 3, 2 * r - 6, 2 * r - 6); ctx.stroke();
  }
}

// ---- ataques especiais e efeitos ----

function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// bola de energia indo para a direita, quadro i de uma animação
function drawOrb(ctx, cx, cy, color, i, style) {
  ctx.save();
  if (style === 'shard') {
    for (let k = 0; k < 3; k++) {
      const x = cx - k * 13 - (i % 2) * 3;
      ctx.globalAlpha = 1 - k * 0.3;
      blob(ctx, [[x + 14, cy], [x - 2, cy - 6], [x - 8, cy], [x - 2, cy + 6]], k ? rgba(color, 0.7) : '#e8fbff', 0.8);
    }
  } else if (style === 'star') {
    ctx.translate(cx, cy);
    ctx.rotate((i * Math.PI) / 4);
    const pts = [];
    for (let k = 0; k < 8; k++) { const r = k % 2 ? 3 : 10; pts.push([Math.cos((k * Math.PI) / 4) * r, Math.sin((k * Math.PI) / 4) * r]); }
    blob(ctx, pts, '#c9d2dc', 0.9);
    disc(ctx, [0, 0], 2.4, '#3a4250');
  } else if (style === 'wave') {
    const h = 26 + (i % 2) * 4;
    const g = ctx.createLinearGradient(cx - 30, 0, cx + 12, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, rgba(color, 0.9));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - 30, cy + 10); ctx.quadraticCurveTo(cx + 4, cy + 10, cx + 12, cy + 10 - h); ctx.quadraticCurveTo(cx + 2, cy + 4, cx - 30, cy + 4); ctx.fill();
    glow(ctx, cx + 6, cy + 2, 10, rgba(color, 0.8), 0.8);
  } else {
    // rastro
    for (let k = 4; k >= 1; k--) {
      ctx.globalAlpha = 0.18 * (5 - k);
      glow(ctx, cx - k * 7 - (i % 2) * 2, cy + Math.sin(i + k) * 1.5, 11 - k, rgba(color, 0.8));
    }
    ctx.globalAlpha = 1;
    glow(ctx, cx, cy, 16 + (i % 2) * 2, rgba(color, 0.95));
    if (style === 'fire') {
      // línguas de fogo para trás
      for (let k = 0; k < 3; k++) {
        ctx.save(); ctx.translate(cx - 14 - k * 9, cy + (k - 1) * 5); ctx.rotate(-Math.PI / 2); drawFlame(ctx, 0, 0, i + k, 1.1 - k * 0.2); ctx.restore();
      }
      ctx.fillStyle = rgba('#ffe066', 0.9);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + i;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 6 - 3, cy + Math.sin(a) * 5, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

// explosão de energia (quadro k de 4)
function drawEnergyBurst(ctx, cx, cy, color, k, size = 1) {
  ctx.save();
  const r = (8 + k * 7) * size;
  ctx.globalAlpha = 1 - k * 0.22;
  glow(ctx, cx, cy, r, rgba(color, 0.9));
  ctx.strokeStyle = rgba(color, 0.9);
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + k * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
    ctx.lineTo(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

// faísca de golpe em estrela
function drawSpark(ctx, cx, cy, k, big, color = '#fff27a') {
  ctx.save();
  const R = (big ? 32 : 19) * (0.6 + k * 0.25), r = R * 0.38;
  ctx.globalAlpha = 1 - k * 0.2;
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + k * 0.2, rr = i % 2 ? r : R * (i % 4 === 0 ? 1 : 0.7);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  blob(ctx, pts, color, 0.9);
  disc(ctx, [cx, cy], r * 0.8, '#ffffff');
  ctx.restore();
}

function drawFlame(ctx, cx, cy, k, s = 1) {
  ctx.save();
  const h = (16 + (k % 3) * 4) * s;
  const g = ctx.createLinearGradient(0, cy, 0, cy - h);
  g.addColorStop(0, '#ff5a1f'); g.addColorStop(0.6, '#ffb43a'); g.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - 7 * s, cy);
  ctx.quadraticCurveTo(cx - 9 * s, cy - h * 0.5, cx + (k % 2 ? 2 : -2) * s, cy - h);
  ctx.quadraticCurveTo(cx + 9 * s, cy - h * 0.45, cx + 7 * s, cy);
  ctx.fill();
  ctx.restore();
}

function drawIceBlock(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.62;
  blob(ctx, [[x + 4, y + h], [x, y + 18], [x + 8, y + 2], [x + w - 10, y], [x + w, y + 14], [x + w - 3, y + h]], '#9fe3ff', 1);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 10, y + 10); ctx.lineTo(x + 16, y + 30); ctx.moveTo(x + w - 14, y + 8); ctx.lineTo(x + w - 10, y + 22); ctx.stroke();
  ctx.restore();
}
