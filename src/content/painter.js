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

// Desenha um lutador numa pose já posicionada (J de placePose).
function drawBody(ctx, J, look, p, s = 1) {
  const w = look.build || 1;
  const dark = (c) => shade(c, 0.78);
  const skin = look.skin;
  const sleeveUp = look.sleeves === 'none' ? skin : look.shirt;
  const sleeveLow = look.sleeves === 'long' ? look.shirt : skin;
  const shinColor = look.shorts ? skin : look.pants;
  const handColor = look.gloves || skin;

  const drawLeg = (k, back) => {
    const f = back ? dark : (c) => c;
    capsule(ctx, J['k' + k], J['a' + k], 7 * w * s, f(shinColor));
    capsule(ctx, J.pelvis, J['k' + k], 8.6 * w * s, f(look.pants));
    capsule(ctx, J['heel' + k], J['t' + k], 5.2 * s, f(look.shoes));
    if (look.shorts) capsule(ctx, J['a' + k], J['a' + k], 6.6 * s, f(look.socks || '#f2f2f2'));
  };
  const drawArm = (k, back) => {
    const f = back ? dark : (c) => c;
    capsule(ctx, J['e' + k], J['h' + k], 6 * w * s, f(sleeveLow));
    capsule(ctx, J.shoulder, J['e' + k], 7 * w * s, f(sleeveUp));
    if (look.wrist) capsule(ctx, along(J['h' + k], J['fa' + k] + 180, 3 * s), J['h' + k], 5.6 * s, f(look.wrist));
    disc(ctx, J['h' + k], (p.open ? 3.2 : 4) * Math.sqrt(w) * s, f(handColor));
  };

  // faixa ou cachecol esvoaçando atrás
  const hu = sub(J.headUp, J.head), fw = [-hu[1], hu[0]];
  // fw: para a frente do rosto (perpendicular ao topo da cabeça)
  const H = (lx, ly) => [J.head[0] + fw[0] * lx * s + hu[0] * ly * s, J.head[1] + fw[1] * lx * s + hu[1] * ly * s];
  if (look.scarf) {
    const n = J.neck, b = [n[0] - fw[0] * 13 * s + hu[0] * -2 * s, n[1] - fw[1] * 13 * s - hu[1] * 2 * s];
    capsule(ctx, n, b, 3.6 * s, dark(look.scarf));
  }

  drawArm('b', true);
  drawLeg('b', true);

  // tronco: trapézio do quadril aos ombros
  const ax = sub(J.neck, J.pelvis), len = Math.hypot(ax[0], ax[1]) || 1;
  const n = [-ax[1] / len, ax[0] / len];
  const hw = 6.4 * w * s, sw = 8.4 * w * s;
  const tp = [
    [J.pelvis[0] + n[0] * hw, J.pelvis[1] + n[1] * hw], [J.pelvis[0] - n[0] * hw, J.pelvis[1] - n[1] * hw],
    [J.neck[0] - n[0] * sw, J.neck[1] - n[1] * sw], [J.neck[0] + n[0] * sw, J.neck[1] + n[1] * sw],
  ];
  blob(ctx, tp, look.shirt);
  if (look.vest) {
    // colete aberto: faixa da pele/camiseta no meio
    const m = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    blob(ctx, [m(tp[0], tp[1], 0.4), m(tp[0], tp[1], 0.6), m(tp[3], tp[2], 0.62), m(tp[3], tp[2], 0.38)], look.vest, 0.5);
  }
  if (look.belt) {
    const b0 = along(J.pelvis, 180 - (p.lean || 0) - (p.rot || 0), 2.5 * s);
    const bl = [[b0[0] + n[0] * hw * 1.05, b0[1] + n[1] * hw * 1.05], [b0[0] - n[0] * hw * 1.05, b0[1] - n[1] * hw * 1.05]];
    capsule(ctx, bl[0], bl[1], 2.4 * s, look.belt);
  }
  drawLeg('f', false);

  // cabeça
  disc(ctx, J.head, (BODY.HEAD + 0.6) * s, skin);
  disc(ctx, H(-1.5, -0.5), 2.1 * s, skin);
  drawHair(ctx, H, look, s);
  drawFace(ctx, H, look, p.face, s);
  if (look.scarf) capsule(ctx, along(J.neck, 0, 0), J.neck, 6.5 * s, look.scarf);

  drawArm('f', false);
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }

function drawHair(ctx, H, look, s) {
  const c = look.hair, poly = (pts, col = c) => blob(ctx, pts.map(([x, y]) => H(x * 1.12, y * 1.12)), col, 1.1);
  switch (look.hairStyle) {
    case 'spiky':
      poly([[6, 5], [4, 12], [1, 8], [-2, 14], [-4, 8], [-9, 12], [-8, 5], [-13, 4], [-9, 0], [-10, -4], [-7, -2], [-5, 3], [0, 5], [4, 3]]);
      break;
    case 'short':
      poly([[7, 3], [6, 7], [2, 9.6], [-3, 9.4], [-7.5, 6.5], [-9.4, 1.5], [-8.8, -3], [-6.5, -2], [-5, 3], [0, 5], [5, 5.2]]);
      break;
    case 'flat':
      poly([[7.5, 4], [7.5, 9], [-8.5, 9], [-9.5, 0], [-8.5, -3], [-6, 2], [0, 5.5]]);
      break;
    case 'long':
      poly([[7, 3], [6, 8], [1, 10], [-5, 9], [-9, 5], [-11, -3], [-10, -11], [-6, -12], [-5, -4], [-4, 2], [0, 5], [5, 5]]);
      break;
    case 'bun':
      poly([[7, 3], [5.5, 8], [0, 9.8], [-6, 8], [-9, 3], [-8.5, -2], [-6, 2], [0, 5], [5, 5]]);
      disc(ctx, H(-7, 9), 3.6 * s, c);
      break;
    case 'ponytail':
      poly([[7, 3], [6, 8], [1, 10], [-5, 9], [-9, 5], [-9, 0], [-6, 2], [0, 5], [5, 5]]);
      poly([[-7, 7], [-14, 5], [-17, -2], [-15, -9], [-12, -3], [-9, 2]]);
      break;
    case 'mohawk':
      poly([[5, 7], [3, 13], [-1, 12], [-5, 13], [-8, 9], [-9, 4], [-6, 7], [0, 8]]);
      break;
    case 'hood':
      poly([[7.5, 2], [7, 8], [1, 11], [-6, 10], [-10, 4], [-11, -6], [-7, -9], [-5, -3], [-3, 2], [3, 3.5]]);
      break;
    case 'bandana':
      poly([[7.5, 2.5], [6.5, 7.5], [1, 9.8], [-5, 9], [-8.5, 5], [-9, 1], [-3, 2.5], [3, 3]], look.accent);
      poly([[-8, 3], [-15, 1], [-16, -4], [-10, -1]], look.accent);
      break;
    default: break; // careca
  }
  if (look.headband) {
    capsule(ctx, H(7.8, 3.2), H(-8.6, 3.6), 2.6 * s, look.headband);
    capsule(ctx, H(-8.6, 3.6), H(-15, 1), 2 * s, look.headband);
    capsule(ctx, H(-8.6, 3.6), H(-14, -2.5), 2 * s, look.headband);
  }
}

function drawFace(ctx, H, look, face, s) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  const K = 1.12, line = (a, b, w = 1.3) => { ctx.lineWidth = w * s; ctx.beginPath(); ctx.moveTo(...H(a[0] * K, a[1] * K)); ctx.lineTo(...H(b[0] * K, b[1] * K)); ctx.stroke(); };
  if (look.mask) {
    blob(ctx, [H(8.3, -0.5), H(7, -6), H(1, -8.2), H(-4, -6), H(-2, -0.5)].map((q) => q), look.mask, 0.8);
  }
  if (face === 'ko') {
    line([3.5, 2.5], [6.5, -0.5]); line([3.5, -0.5], [6.5, 2.5]);
  } else if (face === 'hurt') {
    line([3.5, 2.6], [6.8, 0.8]); line([3.5, -0.2], [6.8, 0.8]);
    if (!look.mask) line([4.8, -4.2], [7, -4.6], 1.6);
  } else {
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.ellipse(...H(6, 0.9), 1.3 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
    line([3.2, 3.6], [7, 2.8], 1.4);
    if (!look.mask) line(face === 'shout' ? [5, -3.6] : [5.2, -4.4], face === 'shout' ? [7.4, -4.8] : [7.2, -4.2], face === 'shout' ? 2.4 : 1.1);
  }
  if (look.beard) blob(ctx, [H(7.8, -2.5), H(6, -7.6), H(1, -9), H(-3, -6), H(-1, -3), H(4, -4.5)], look.hair, 0.8);
  if (look.glasses) { line([2.5, 1.2], [8, 1.2], 2.6); }
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
  const s = size / 26;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  if (bg) {
    const g = ctx.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, shade(bg, 1.35)); g.addColorStop(1, shade(bg, 0.55));
    ctx.fillStyle = g; ctx.fillRect(x, y, size, size);
  }
  const pose = { lean: 4, head: 2, af: [8, 30], ab: [-8, 30], lf: [6, 2], lb: [-6, 2] };
  const J = solvePose(pose, s);
  const ox = x + size * 0.5 - J.head[0], oy = y + size * 0.42 - J.head[1];
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
  const R = (big ? 22 : 13) * (0.6 + k * 0.25), r = R * 0.38;
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
