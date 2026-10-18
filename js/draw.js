'use strict';
// Desenho procedural dos lutadores: um esqueleto articulado com poses por ângulos.
//
// Convenção de ângulos (graus): 0 = apontando para baixo, 90 = para frente
// (na direção em que o lutador olha), 180 = para cima. O segundo valor de cada
// membro é a dobra do cotovelo/joelho relativa ao primeiro segmento.

const BONE = { thigh: 20, shin: 20, torso: 27, uarm: 14, farm: 14, neck: 3, head: 9.5 };

function P(o) {
  return Object.assign({
    lean: 0, head: 0, a1: [20, 40], a2: [10, 40], l1: [10, -6], l2: [-10, -6], rot: 0, lift: 0, hipY: -10,
  }, o);
}

const POSES = {
  stand: P({ lean: 2, a1: [8, 18], a2: [-6, 18], l1: [6, -2], l2: [-6, -2] }),
  guard: P({ lean: 6, a1: [55, 85], a2: [30, 100], l1: [25, -12], l2: [-22, -2] }),
  punchWind: P({ lean: 2, a1: [35, 115], a2: [45, 95], l1: [25, -12], l2: [-22, -2] }),
  punchHit: P({ lean: 14, a1: [90, -4], a2: [20, 110], l1: [30, -10], l2: [-26, -2] }),
  punch2Wind: P({ lean: 4, a1: [50, 90], a2: [25, 120], l1: [25, -12], l2: [-22, -2] }),
  punch2Hit: P({ lean: 18, a1: [30, 100], a2: [90, -4], l1: [32, -10], l2: [-28, -2] }),
  kickWind: P({ lean: -8, a1: [50, 90], a2: [25, 100], l1: [70, -110], l2: [-8, -4] }),
  kickHit: P({ lean: -20, a1: [40, 90], a2: [-30, 60], l1: [100, -5], l2: [-10, -2] }),
  uppercutWind: P({ lean: 25, a1: [10, 130], a2: [40, 90], l1: [55, -80], l2: [-15, -50] }),
  uppercut: P({ lean: -4, a1: [175, 0], a2: [-20, 70], l1: [15, -30], l2: [-25, -35] }),
  jump: P({ lean: 8, a1: [110, 40], a2: [80, 50], l1: [65, -95], l2: [25, -75] }),
  jumpDown: P({ lean: 4, a1: [130, 20], a2: [100, 30], l1: [35, -40], l2: [-5, -30] }),
  jumpKick: P({ lean: -12, a1: [60, 70], a2: [130, 30], l1: [80, -4], l2: [20, -100] }),
  flyKick: P({ lean: -22, a1: [120, 10], a2: [160, 10], l1: [88, 0], l2: [-20, -70] }),
  defend: P({ lean: -6, a1: [80, 120], a2: [65, 130], l1: [28, -22], l2: [-24, -10] }),
  hurt1: P({ lean: -22, head: -18, a1: [-25, 30], a2: [-40, 20], l1: [12, -6], l2: [-24, -6] }),
  hurt2: P({ lean: 28, head: 18, a1: [15, 15], a2: [-5, 15], l1: [22, -24], l2: [-14, -10] }),
  fall: P({ lean: -10, head: -10, a1: [150, 20], a2: [120, 30], l1: [40, -30], l2: [15, -50], hipY: -36 }),
  lie: P({ rot: -90, hipY: -7, a1: [165, 10], a2: [150, 10], l1: [4, 0], l2: [12, -8] }),
  crouch: P({ lean: 30, a1: [60, 60], a2: [30, 60], l1: [75, -140], l2: [35, -110] }),
  land: P({ lean: 18, a1: [60, 40], a2: [30, 40], l1: [55, -100], l2: [10, -70] }),
  skid: P({ lean: -18, a1: [60, 40], a2: [120, 30], l1: [40, -10], l2: [-10, -30] }),
  cast: P({ lean: 12, a1: [92, -2], a2: [86, 4], l1: [30, -10], l2: [-28, -2] }),
  castWind: P({ lean: -10, a1: [-35, 80], a2: [-45, 70], l1: [20, -12], l2: [-20, -4] }),
  raise: P({ lean: -8, a1: [170, 0], a2: [160, 10], l1: [12, -4], l2: [-12, -4] }),
  slam: P({ lean: 40, a1: [40, 0], a2: [30, 0], l1: [60, -95], l2: [-25, -40] }),
  charge: P({ lean: 40, a1: [70, 30], a2: [-35, 40], l1: [45, -35], l2: [-45, -15] }),
  slide: P({ lean: -40, a1: [-60, 20], a2: [-70, 10], l1: [95, -5], l2: [80, -150] }),
  throwWind: P({ lean: -12, a1: [195, 30], a2: [60, 60], l1: [25, -12], l2: [-22, -2] }),
  batWind: P({ lean: -10, a1: [200, 10], a2: [40, 80], l1: [25, -12], l2: [-22, -2] }),
  batHit: P({ lean: 20, a1: [95, -10], a2: [30, 90], l1: [32, -10], l2: [-28, -2] }),
  tuck: P({ lean: 50, a1: [100, 90], a2: [80, 90], l1: [90, -150], l2: [70, -140] }),
  spin: P({ lean: 0, a1: [90, 0], a2: [-90, 0], l1: [95, 0], l2: [-30, -60], hipY: -45 }),
  victory: P({ lean: -4, a1: [165, 15], a2: [-20, 30], l1: [10, -4], l2: [-12, -4] }),
};

function walkPose(ph) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return P({
    lean: 6,
    a1: [45 + s * 18, 85], a2: [28 - s * 18, 95],
    l1: [s * 26, -8 - Math.max(0, -c) * 35], l2: [-s * 26, -8 - Math.max(0, c) * 35],
  });
}

function runPose(ph) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return P({
    lean: 24,
    a1: [45 - s * 55, 95], a2: [45 + s * 55, 95],
    l1: [10 + s * 50, -15 - Math.max(0, -c) * 70], l2: [10 - s * 50, -15 - Math.max(0, c) * 70],
    lift: Math.abs(c) * 3,
  });
}

function idlePose(frame) {
  const b = Math.sin(frame * 0.08);
  const g = POSES.guard;
  return P({
    lean: g.lean + b * 1.5, a1: [g.a1[0] + b * 4, g.a1[1]], a2: [g.a2[0] - b * 3, g.a2[1]],
    l1: [g.l1[0], g.l1[1] - 3 - b * 3], l2: [g.l2[0], g.l2[1] - 3 - b * 3],
  });
}

function blendPose(a, b, t) {
  const r = {};
  for (const k in a) {
    const va = a[k], vb = b[k] !== undefined ? b[k] : va;
    r[k] = Array.isArray(va) ? [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t)] : lerp(va, vb, t);
  }
  return r;
}

// keys: [[quadro, 'nomeDaPose'], ...] — interpola entre os quadros-chave.
function keyPose(keys, t) {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
  const [f0, n0] = keys[i];
  if (i === keys.length - 1) return POSES[n0];
  const [f1, n1] = keys[i + 1];
  const k = clamp((t - f0) / Math.max(1, f1 - f0), 0, 1);
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  return blendPose(POSES[n0], POSES[n1], e);
}

function prepLook(look) {
  if (look._d) return look;
  look.outline = look.outline || '#15131f';
  look._d = {};
  for (const k of ['skin', 'hair', 'shirt', 'pants', 'shoes', 'accent', 'gloves']) {
    if (look[k]) look._d[k] = shade(look[k], -0.3);
  }
  return look;
}

const FLASH = prepLook({
  skin: '#ffffff', hair: '#ffffff', shirt: '#ffffff', pants: '#ffffff', shoes: '#ffffff',
  accent: '#ffffff', gloves: '#ffffff', outline: '#ff7070',
});

function limbPts(ox, oy, ang, bend, l1, l2, f) {
  const a = ang * DEG, b = (ang + bend) * DEG;
  const ex = ox + Math.sin(a) * f * l1, ey = oy + Math.cos(a) * l1;
  return [ex, ey, ex + Math.sin(b) * f * l2, ey + Math.cos(b) * l2];
}

function seg(ctx, pts, w, color) {
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

function dot(ctx, x, y, r, fill, ol, olw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (ol) { ctx.lineWidth = olw; ctx.strokeStyle = ol; ctx.stroke(); }
}

function limb(ctx, ox, oy, L, w, c1, c2, ol) {
  seg(ctx, [ox, oy, L[0], L[1], L[2], L[3]], w + 3, ol);
  seg(ctx, [ox, oy, L[0], L[1]], w, c1);
  seg(ctx, [L[0], L[1], L[2], L[3]], w - 0.6, c2);
}

function drawHair(ctx, look, C, hx, hy, r, f, ang, ol) {
  const st = look.hairStyle;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang * f);
  ctx.scale(f, 1);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = ol;
  ctx.fillStyle = C.hair;
  const path = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0] * r, pts[1] * r);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * r, pts[i + 1] * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  switch (st) {
    case 'spiky':
      path([0.95, -0.35, 0.9, -0.9, 1.3, -1.0, 0.5, -1.2, 0.6, -1.75, -0.05, -1.3, -0.45, -1.85, -0.6, -1.15,
        -1.35, -1.35, -1.05, -0.6, -1.5, -0.25, -1.0, 0.1, -0.95, 0.55, -0.6, 0.2, -0.3, -0.35, 0.3, -0.5]);
      break;
    case 'flame': {
      if (C === look) {
        const g = ctx.createLinearGradient(0, -2.4 * r, 0, 0);
        g.addColorStop(0, '#fff176'); g.addColorStop(0.45, '#ff9800'); g.addColorStop(1, look.hair);
        ctx.fillStyle = g;
      }
      path([0.95, -0.35, 1.0, -1.1, 1.5, -1.5, 0.55, -1.4, 0.7, -2.3, 0.0, -1.5, -0.3, -2.5, -0.6, -1.4,
        -1.6, -1.9, -1.1, -0.8, -1.7, -0.6, -1.0, 0.0, -0.95, 0.5, -0.5, 0.1, -0.2, -0.4, 0.4, -0.5]);
      break;
    }
    case 'long':
      path([0.95, -0.4, 0.7, -0.98, 0, -1.2, -0.75, -1.02, -1.12, -0.4, -1.18, 0.6, -1.35, 2.1, -0.55, 2.2,
        -0.5, 0.7, -0.35, -0.15, 0.25, -0.55]);
      break;
    case 'bandana': {
      path([0.9, -0.45, 0.6, -0.98, 0, -1.1, -0.7, -0.92, -1.05, -0.3, -0.95, 0.25, -0.5, -0.2, 0.3, -0.55]);
      seg(ctx, [-1.0 * r, -0.45 * r, 1.0 * r, -0.55 * r], 0.42 * r + 2, ol);
      seg(ctx, [-1.0 * r, -0.45 * r, 1.0 * r, -0.55 * r], 0.42 * r, C.accent);
      seg(ctx, [-1.0 * r, -0.45 * r, -1.9 * r, -0.05 * r], 2.6, C.accent);
      seg(ctx, [-1.0 * r, -0.45 * r, -1.75 * r, 0.4 * r], 2.6, C.accent);
      break;
    }
    case 'mask': {
      seg(ctx, [-0.8 * r, 0.6 * r, -2.1 * r, 1.0 * r], 3.2, C.accent);
      seg(ctx, [-0.8 * r, 0.6 * r, -1.9 * r, 1.5 * r], 3.2, C.accent);
      dot(ctx, 0, 0, r * 1.06, C.hair, ol, 1.8);
      ctx.fillStyle = C.skin;
      ctx.fillRect(0.05 * r, -0.48 * r, 0.98 * r, 0.42 * r);
      break;
    }
    case 'bun':
      dot(ctx, -0.8 * r, -0.85 * r, r * 0.45, C.hair, ol, 1.8);
      path([0.95, -0.4, 0.7, -0.98, 0, -1.12, -0.75, -0.95, -1.08, -0.35, -1.0, 0.35, -0.55, -0.1, 0.25, -0.55]);
      break;
    case 'mohawk':
      path([0.55, -0.8, 0.45, -1.55, 0.05, -1.05, -0.25, -1.75, -0.45, -1.0, -0.85, -1.5, -0.85, -0.6]);
      break;
    case 'bald':
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(-0.1 * r, -0.1 * r, r * 0.7, -2.5, -1.7);
      ctx.stroke();
      break;
  }
  ctx.fillStyle = '#16121c';
  ctx.fillRect(r * 0.38, -r * 0.32, r * 0.22, r * 0.34);
  ctx.restore();
}

// Desenha um lutador com os pés em (x, y) na tela. f = 1 olha para a direita.
function drawFigure(ctx, x, y, f, pose, look, s, opt = {}) {
  prepLook(look);
  const C = opt.flash ? FLASH : look;
  const D = opt.flash ? FLASH._d : look._d;
  const ol = opt.flash ? FLASH.outline : look.outline;
  const bulk = look.bulk || 1;
  const B = BONE;
  const L1 = limbPts(0, 0, pose.l1[0], pose.l1[1], B.thigh, B.shin, f);
  const L2 = limbPts(0, 0, pose.l2[0], pose.l2[1], B.thigh, B.shin, f);
  const hipY = pose.rot ? pose.hipY : -(Math.max(L1[3], L2[3]) + 3) - pose.lift;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(0, hipY);
  if (pose.rot) ctx.rotate(pose.rot * DEG * f);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const lean = pose.lean * DEG;
  const nx = Math.sin(lean) * f * B.torso, ny = -Math.cos(lean) * B.torso;
  const sx = nx * 0.88, sy = ny * 0.88;
  const hl = (pose.lean + pose.head) * DEG, hd = B.neck + B.head;
  const hx = nx + Math.sin(hl) * f * hd, hy = ny - Math.cos(hl) * hd;
  const A1 = limbPts(sx, sy, pose.a1[0], pose.a1[1], B.uarm, B.farm, f);
  const A2 = limbPts(sx, sy, pose.a2[0], pose.a2[1], B.uarm, B.farm, f);
  const lw = 6.5 * bulk, tw = 12 * bulk;
  const armTop = look.sleeves ? C.shirt : C.skin, armTopD = look.sleeves ? D.shirt : D.skin;
  const fistC = look.gloves ? C.gloves : C.skin, fistD = look.gloves ? D.gloves : D.skin;

  // perna e braço de trás (mais escuros)
  limb(ctx, 0, 0, L2, lw, D.pants, D.pants, ol);
  dot(ctx, L2[2], L2[3], 3.8 * bulk, D.shoes, ol, 1.6);
  limb(ctx, sx, sy, A2, lw - 0.6, armTopD, D.skin, ol);
  dot(ctx, A2[2], A2[3], 3.4 * bulk, fistD, ol, 1.6);

  // tronco
  seg(ctx, [0, 0, nx, ny], tw + 3, ol);
  seg(ctx, [0, 0, nx, ny], tw, C.shirt);
  if (look.vest) seg(ctx, [nx * 0.15, ny * 0.15, nx * 0.95, ny * 0.95], tw * 0.35, C.accent);
  seg(ctx, [0, 0, nx * 0.12, ny * 0.12], tw + 1, C.pants);
  if (look.belt) seg(ctx, [nx * 0.13, ny * 0.13, nx * 0.22, ny * 0.22], tw + 1, look.belt);

  // perna da frente
  limb(ctx, 0, 0, L1, lw, C.pants, C.pants, ol);
  dot(ctx, L1[2], L1[3], 3.8 * bulk, C.shoes, ol, 1.6);

  // pescoço e cabeça
  seg(ctx, [nx, ny, (nx + hx) / 2, (ny + hy) / 2], 8, ol);
  seg(ctx, [nx, ny, (nx + hx) / 2, (ny + hy) / 2], 5, C.skin);
  if (look.scarf) {
    seg(ctx, [nx - 4, ny + 1, nx + 4, ny + 1], 6, ol);
    seg(ctx, [nx - 4, ny + 1, nx + 4, ny + 1], 4, C.accent);
  }
  dot(ctx, hx, hy, B.head, C.skin, ol, 2.2);
  drawHair(ctx, look, C, hx, hy, B.head, f, hl, ol);

  // braço da frente + arma
  limb(ctx, sx, sy, A1, lw - 0.6, armTop, C.skin, ol);
  if (opt.holding === 'bat') {
    const dx = A1[2] - A1[0], dy = A1[3] - A1[1], len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, px = A1[2], py = A1[3];
    seg(ctx, [px - ux * 4, py - uy * 4, px + ux * 31, py + uy * 31], 9, ol);
    seg(ctx, [px - ux * 3, py - uy * 3, px + ux * 14, py + uy * 14], 4.5, '#7a4b22');
    seg(ctx, [px + ux * 12, py + uy * 12, px + ux * 30, py + uy * 30], 7, '#b07a3e');
  } else if (opt.holding === 'stone') {
    dot(ctx, A1[2], A1[3] - 3, 7, '#8d8a85', ol, 2);
  }
  dot(ctx, A1[2], A1[3], 3.6 * bulk, fistC, ol, 1.6);

  ctx.restore();
}

// Retratos em cache para o HUD e as telas de menu.
const PORTRAITS = new Map();
function portrait(key, size) {
  const id = key + ':' + size;
  let c = PORTRAITS.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const look = prepLook(CHARACTERS[key].look);
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, shade(look.shirt, 0.35));
  grd.addColorStop(1, shade(look.shirt, -0.5));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const sc = size / 26;
  drawFigure(g, size * 0.5, size * 0.46 + 82 * sc, 1, POSES.stand, look, sc);
  PORTRAITS.set(id, c);
  return c;
}
