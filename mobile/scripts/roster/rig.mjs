// Esqueleto 2D dos personagens nativos: pose (ângulos) → segmentos → sprite + caixas Clsn.
//
// Ângulos em graus, absolutos, lutador virado para a direita (+x):
//   0 = frente, 90 = para baixo, -90 = para cima, 180 = para trás.
// Unidades = unidades do MUGEN (localcoord 320x240). Chão em y = 0, para cima é negativo.

import { Canvas, hex, sdCapsule, sdCircle, sdEllipse, sdPolygon, shade } from "./raster.mjs";

const rad = (deg) => (deg * Math.PI) / 180;
const dir = (deg) => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const add = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];

export function proportions(H, build = 1) {
  return {
    H,
    head: 0.072 * H,
    torso: 0.3 * H,
    upperArm: 0.16 * H,
    foreArm: 0.15 * H,
    thigh: 0.245 * H,
    shin: 0.245 * H,
    shoulderDrop: 0.035 * H,
    armR: 0.044 * H * build,
    fistR: 0.05 * H * build,
    thighR: 0.06 * H * build,
    shinR: 0.045 * H * build,
    footLen: 0.08 * H,
    chestR: 0.112 * H * build,
    hipR: 0.088 * H * build,
  };
}

// Pose padrão (base) — cada pose sobrescreve só o que muda.
export const BASE_POSE = {
  torso: -84,
  head: -90,
  armF: [62, -38],
  armB: [100, -55],
  legF: [68, 98],
  legB: [114, 96],
  hipX: 0,
  lift: 0, // quanto o ponto mais baixo fica acima do chão
  ground: true,
  hurtArm: false,
  strike: null, // "handF" | "handB" | "hands" | "footF" | "footB" | "kneeF" | "elbowF" | "body"
  weapon: null, // ângulo da arma na mão da frente (null = segue o antebraço)
  scale: 1,
};

export function solve(P, poseIn) {
  const pose = { ...BASE_POSE, ...poseIn };
  const hip = [pose.hipX, 0];
  const td = dir(pose.torso);
  const neck = add(hip, td, P.torso);
  const head = add(neck, dir(pose.head), P.head * 1.25);
  const shoulder = add(neck, td, -P.shoulderDrop);
  const limb = (base, [a1, a2], l1, l2) => {
    const mid = add(base, dir(a1), l1);
    return [base, mid, add(mid, dir(a2), l2)];
  };
  const armF = limb(shoulder, pose.armF, P.upperArm, P.foreArm);
  const armB = limb(shoulder, pose.armB, P.upperArm, P.foreArm);
  const legF = limb(hip, pose.legF, P.thigh, P.shin);
  const legB = limb(hip, pose.legB, P.thigh, P.shin);

  const pts = [hip, neck, head, ...armF, ...armB, ...legF, ...legB];
  // ponto mais baixo (maior y) considerando espessura dos pés/corpo
  const lowest = Math.max(
    legF[2][1] + P.shinR,
    legB[2][1] + P.shinR,
    hip[1] + P.hipR,
    neck[1] + P.chestR * 0.8,
    head[1] + P.head,
    armF[2][1] + P.fistR,
    armB[2][1] + P.fistR,
  );
  const dy = pose.ground ? -lowest - pose.lift : -pose.lift;
  const shift = (p) => [p[0], p[1] + dy];
  const S = {
    pose,
    hip: shift(hip),
    neck: shift(neck),
    head: shift(head),
    shoulder: shift(shoulder),
    armF: armF.map(shift),
    armB: armB.map(shift),
    legF: legF.map(shift),
    legB: legB.map(shift),
  };
  void pts;
  return S;
}

// ------------------------------------------------------------- arma

/**
 * Arma na mão da frente (look.weapon): [cabo, mão, ponta] em unidades. Sem
 * ângulo na pose, a lâmina segue o antebraço, um pouco para cima.
 */
export function weaponSegment(P, S, look) {
  const wpn = look?.weapon;
  if (!wpn) return null;
  const hand = S.armF[2];
  const fore = S.pose.armF[1];
  const ang = S.pose.weapon ?? fore - 12;
  const d = dir(ang);
  return { butt: add(hand, d, -P.H * (wpn.back ?? 0.1)), hand, tip: add(hand, d, P.H * (wpn.length ?? 0.6)), ang };
}

function weaponShapes(P, S, look, col) {
  const seg = weaponSegment(P, S, look);
  if (!seg) return [];
  const w = look.weapon;
  const perp = dir(seg.ang + 90);
  const guard = add(seg.hand, dir(seg.ang), P.H * 0.03);
  return [
    { kind: "cap", a: seg.butt, b: seg.hand, r1: P.H * 0.016, color: col(w.hilt) },
    { kind: "cap", a: add(guard, perp, -P.H * 0.03), b: add(guard, perp, P.H * 0.03), r1: P.H * 0.012, color: col(w.guard) },
    { kind: "cap", a: guard, b: seg.tip, r1: P.H * 0.014, r2: P.H * 0.006, color: col(w.blade) },
    { kind: "cap", a: add(guard, perp, -P.H * 0.004), b: add(seg.tip, perp, -P.H * 0.003), r1: P.H * 0.004, r2: P.H * 0.002, color: [255, 255, 255], noOutline: true },
  ];
}

// ------------------------------------------------------------- desenho

function limbShapes(seg, r1, r2, end) {
  return [
    { kind: "cap", a: seg[0], b: seg[1], r1, r2 },
    { kind: "cap", a: seg[1], b: seg[2], r1: r2, r2: r2 * 0.9 },
    end,
  ];
}

// Monta a lista ordenada de formas (com cor) de uma pose.
export function shapes(P, S, look) {
  const out = [];
  const back = 0.72;
  const col = (c, f = 1) => shade(hex(c), f);

  const footShape = (seg, f) => {
    const [knee, ankle] = [seg[1], seg[2]];
    const d = [ankle[0] - knee[0], ankle[1] - knee[1]];
    const len = Math.hypot(...d) || 1;
    // pé aponta para a frente, perpendicular à canela
    const fwd = [-d[1] / len, d[0] / len];
    const sign = fwd[0] >= 0 ? 1 : -1;
    const toe = [ankle[0] + fwd[0] * sign * P.footLen, ankle[1] + fwd[1] * sign * P.footLen];
    return { kind: "cap", a: ankle, b: toe, r1: P.shinR * 0.95, r2: P.shinR * 0.7, color: col(look.shoes, f) };
  };

  const leg = (seg, f) => {
    const [thigh, shin] = limbShapes(seg, P.thighR, P.shinR);
    out.push({ ...thigh, color: col(look.pants, f) });
    // calção (muay thai): canela à mostra
    out.push({ ...shin, color: col(look.shorts ? look.skin : look.pants, f) });
    if (look.shorts) out.push({ kind: "cap", a: seg[0], b: add(seg[0], norm(seg[0], seg[1]), P.thigh * 0.7), r1: P.thighR * 1.12, r2: P.thighR * 1.05, color: col(look.pants, f) });
    out.push(footShape(seg, f));
  };
  const arm = (seg, f) => {
    const sleeve = look.sleeves ? look.top : look.skin;
    out.push({ kind: "cap", a: seg[0], b: seg[1], r1: P.armR * 1.15, r2: P.armR, color: col(sleeve, f) });
    // braçadeira (prajioud)
    if (look.armband) {
      const mid = add(seg[0], norm(seg[0], seg[1]), P.upperArm * 0.45);
      out.push({ kind: "circle", c: mid, r: P.armR * 1.25, color: col(look.armband, f) });
    }
    out.push({ kind: "cap", a: seg[1], b: seg[2], r1: P.armR, r2: P.armR * 0.9, color: col(look.forearm ?? look.skin, f) });
    out.push({ kind: "circle", c: seg[2], r: P.fistR, color: col(look.gloves, f) });
  };

  arm(S.armB, back);
  leg(S.legB, back);
  // tronco
  out.push({ kind: "cap", a: S.hip, b: S.neck, r1: P.hipR, r2: P.chestR, color: col(look.top) });
  if (look.vest) out.push({ kind: "cap", a: S.hip, b: S.neck, r1: P.hipR * 0.55, r2: P.chestR * 0.45, color: col(look.vest) });
  // faixa/cinto
  const belt = add(S.hip, dir(S.pose.torso), P.torso * 0.12);
  out.push({ kind: "cap", a: add(belt, dir(S.pose.torso + 90), P.hipR * 1.05), b: add(belt, dir(S.pose.torso - 90), P.hipR * 1.05), r1: P.H * 0.018, color: col(look.belt) });
  leg(S.legF, 1);
  // pescoço e cabeça
  out.push({ kind: "cap", a: S.neck, b: S.head, r1: P.armR * 1.1, r2: P.armR, color: col(look.skin, 0.9) });
  out.push({ kind: "circle", c: S.head, r: P.head, color: col(look.skin) });
  hair(out, P, S, look, col);
  // olho (do lado da frente)
  const hd = dir(S.pose.head + 90);
  const eye = [S.head[0] + P.head * 0.45 + hd[0] * 0, S.head[1] - P.head * 0.1];
  out.push({ kind: "circle", c: eye, r: P.head * 0.16, color: [20, 20, 28] });
  if (look.headband) {
    const a = [S.head[0] - P.head, S.head[1] - P.head * 0.35];
    const b = [S.head[0] + P.head, S.head[1] - P.head * 0.35];
    out.push({ kind: "cap", a, b, r1: P.head * 0.22, color: col(look.headband) });
    out.push({ kind: "cap", a, b: [a[0] - P.head * 1.3, a[1] + P.head * 0.6], r1: P.head * 0.16, r2: P.head * 0.08, color: col(look.headband, 0.85) });
  }
  out.push(...weaponShapes(P, S, look, col));
  arm(S.armF, 1);
  return out;
}

function norm(a, b) {
  const d = [b[0] - a[0], b[1] - a[1]];
  const l = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / l, d[1] / l];
}

function hair(out, P, S, look, col) {
  const h = S.head;
  const r = P.head;
  switch (look.hair) {
    case "short":
      out.push({ kind: "ellipse", c: [h[0] - r * 0.1, h[1] - r * 0.45], rx: r * 1.02, ry: r * 0.7, color: col(look.hairColor) });
      break;
    case "spiky": {
      out.push({ kind: "ellipse", c: [h[0] - r * 0.1, h[1] - r * 0.4], rx: r * 1.02, ry: r * 0.72, color: col(look.hairColor) });
      for (const [dx, dy, tx, ty] of [
        [-0.9, -0.3, -1.9, -0.9],
        [-0.5, -0.8, -1.2, -1.9],
        [0.1, -0.95, -0.2, -2.1],
        [0.6, -0.7, 0.9, -1.7],
      ]) {
        out.push({
          kind: "poly",
          pts: [
            [h[0] + dx * r - r * 0.35, h[1] + dy * r + r * 0.2],
            [h[0] + tx * r, h[1] + ty * r],
            [h[0] + dx * r + r * 0.35, h[1] + dy * r + r * 0.2],
          ],
          color: col(look.hairColor),
        });
      }
      break;
    }
    case "long":
      out.push({ kind: "cap", a: [h[0] - r * 0.4, h[1] - r * 0.3], b: [h[0] - r * 1.1, h[1] + r * 2.2], r1: r * 0.75, r2: r * 0.4, color: col(look.hairColor, 0.9) });
      out.push({ kind: "ellipse", c: [h[0] - r * 0.1, h[1] - r * 0.45], rx: r * 1.04, ry: r * 0.72, color: col(look.hairColor) });
      break;
    case "topknot":
      out.push({ kind: "ellipse", c: [h[0] - r * 0.1, h[1] - r * 0.5], rx: r, ry: r * 0.62, color: col(look.hairColor) });
      out.push({ kind: "circle", c: [h[0] - r * 0.3, h[1] - r * 1.25], r: r * 0.42, color: col(look.hairColor) });
      break;
    case "hood":
      out.push({ kind: "circle", c: [h[0], h[1]], r: r * 1.12, color: col(look.hairColor) });
      out.push({ kind: "cap", a: [h[0] - r * 0.2, h[1] - r * 0.12], b: [h[0] + r * 0.95, h[1] - r * 0.12], r1: r * 0.22, color: col(look.skin) });
      break;
    case "mohawk":
      out.push({ kind: "cap", a: [h[0] - r * 0.9, h[1] - r * 0.6], b: [h[0] + r * 0.4, h[1] - r * 1.15], r1: r * 0.32, r2: r * 0.22, color: col(look.hairColor) });
      break;
    default:
      break;
  }
}

function shapeSdf(s, k, ox, oy) {
  const t = (p) => [p[0] * k + ox, p[1] * k + oy];
  switch (s.kind) {
    case "cap": {
      const a = t(s.a);
      const b = t(s.b);
      const r1 = s.r1 * k;
      const r2 = (s.r2 ?? s.r1) * k;
      const m = Math.max(r1, r2);
      return { sdf: sdCapsule(a[0], a[1], b[0], b[1], r1, r2), bbox: [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m] };
    }
    case "circle": {
      const c = t(s.c);
      const r = s.r * k;
      return { sdf: sdCircle(c[0], c[1], r), bbox: [c[0] - r, c[1] - r, c[0] + r, c[1] + r] };
    }
    case "ellipse": {
      const c = t(s.c);
      return { sdf: sdEllipse(c[0], c[1], s.rx * k, s.ry * k), bbox: [c[0] - s.rx * k, c[1] - s.ry * k, c[0] + s.rx * k, c[1] + s.ry * k] };
    }
    case "poly": {
      const pts = s.pts.map(t);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      return { sdf: sdPolygon(pts), bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    }
  }
  throw new Error(`forma desconhecida ${s.kind}`);
}

// Renderiza as formas num canvas; devolve {canvas, axisX, axisY} em pixels.
export function renderShapes(list, k, outlineColor = [16, 14, 22]) {
  // limites em unidades
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of list) {
    const { bbox } = shapeSdf(s, 1, 0, 0);
    minX = Math.min(minX, bbox[0]);
    minY = Math.min(minY, bbox[1]);
    maxX = Math.max(maxX, bbox[2]);
    maxY = Math.max(maxY, bbox[3]);
  }
  const pad = 3;
  const ox = -minX * k + pad;
  const oy = -minY * k + pad;
  const w = Math.ceil((maxX - minX) * k + pad * 2);
  const h = Math.ceil((maxY - minY) * k + pad * 2);
  const cv = new Canvas(w, h);
  const outline = 1.3;
  for (const s of list) {
    const { sdf, bbox } = shapeSdf(s, k, ox, oy);
    const [r, g, b] = s.color;
    if (!s.noOutline) {
      cv.fill([bbox[0] - outline, bbox[1] - outline, bbox[2] + outline, bbox[3] + outline], (x, y) => sdf(x, y) - outline, () => [...outlineColor, s.alpha ?? 1]);
    }
    const cy = (bbox[1] + bbox[3]) / 2;
    const hh = Math.max(1, (bbox[3] - bbox[1]) / 2);
    cv.fill(bbox, sdf, (x, y, d) => {
      // luz de cima + leve brilho na borda superior
      const top = (cy - y) / hh;
      const f = 0.92 + 0.14 * top + (d > -1.6 && y < cy ? 0.06 : 0);
      const c = shade([r, g, b], f);
      return [c[0], c[1], c[2], s.alpha ?? 1];
    });
  }
  return { canvas: cv, axisX: ox, axisY: oy };
}

// ---------------------------------------------------------- caixas

const round = (v) => Math.round(v);

function segBox(seg, r) {
  const xs = seg.map((p) => p[0]);
  const ys = seg.map((p) => p[1]);
  return [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r];
}

function unionBox(...boxes) {
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
}

// Clsn2 (onde pode apanhar) e Clsn1 (onde acerta) de uma pose resolvida.
export function boxes(P, S, look = null) {
  const upper = unionBox(segBox([S.head], P.head), segBox([S.hip, S.neck], P.chestR * 0.85));
  const legs = unionBox(segBox(S.legF, P.thighR * 0.8), segBox(S.legB, P.thighR * 0.8));
  const clsn2 = [upper, legs];
  if (S.pose.hurtArm) clsn2.push(segBox(S.armF.slice(1), P.armR));
  const clsn1 = [];
  const strike = S.pose.strike;
  // com arma, os golpes da mão da frente acertam com a lâmina
  const blade = weaponSegment(P, S, look);
  if (blade && (strike === "handF" || strike === "hands")) {
    clsn1.push(segBox([blade.hand, blade.tip], 4));
    if (strike === "hands") clsn1.push(segBox(S.armB.slice(1), P.fistR + 2));
    return { clsn1: clsn1.map((b) => b.map(round)), clsn2: clsn2.map((b) => b.map(round)) };
  }
  if (strike === "kneeF") clsn1.push(segBox([S.legF[1]], P.thighR + 4));
  if (strike === "elbowF") clsn1.push(segBox([S.armF[1]], P.armR + 5));
  if (strike === "handF") clsn1.push(segBox(S.armF.slice(1), P.fistR + 2));
  if (strike === "handB") clsn1.push(segBox(S.armB.slice(1), P.fistR + 2));
  if (strike === "hands") clsn1.push(unionBox(segBox(S.armF.slice(1), P.fistR + 2), segBox(S.armB.slice(1), P.fistR + 2)));
  if (strike === "footF") clsn1.push(segBox(S.legF.slice(1), P.shinR + 3));
  if (strike === "footB") clsn1.push(segBox(S.legB.slice(1), P.shinR + 3));
  if (strike === "body") clsn1.push(unionBox(upper, legs).map((v, i) => v + (i < 2 ? -4 : 4)));
  return { clsn1: clsn1.map((b) => b.map(round)), clsn2: clsn2.map((b) => b.map(round)) };
}

// ------------------------------------------------------ projéteis

export function projectileShapes(kind, look, H, frame) {
  const e = hex(look.energy);
  const glow = shade(e, 1.5);
  const core = [255, 255, 255];
  const pulse = frame % 2 === 0 ? 1 : 0.88;
  const r = H * 0.11 * pulse;
  switch (kind) {
    case "blade":
      return [
        { kind: "ellipse", c: [0, 0], rx: r * 2.2, ry: r * 0.55, color: e, alpha: 0.55, noOutline: true },
        { kind: "poly", pts: [[r * 1.8, 0], [-r * 0.6, r * 0.45], [-r * 1.4, 0], [-r * 0.6, -r * 0.45]], color: glow },
        { kind: "poly", pts: [[r * 1.4, 0], [-r * 0.3, r * 0.2], [-r * 0.8, 0], [-r * 0.3, -r * 0.2]], color: core, noOutline: true },
      ];
    case "wave":
      return [
        { kind: "ellipse", c: [0, -r * 1.4], rx: r * 0.9, ry: r * 1.6, color: e, alpha: 0.6, noOutline: true },
        { kind: "ellipse", c: [r * 0.2, -r * 1.3], rx: r * 0.55, ry: r * 1.3, color: glow, noOutline: true },
        { kind: "ellipse", c: [r * 0.35, -r * 1.2], rx: r * 0.25, ry: r * 0.9, color: core, noOutline: true },
      ];
    case "beam":
      return [
        { kind: "ellipse", c: [r * 3, 0], rx: r * 4.2, ry: r * 1.25, color: e, alpha: 0.55, noOutline: true },
        { kind: "ellipse", c: [r * 3, 0], rx: r * 3.8, ry: r * 0.85, color: glow, noOutline: true },
        { kind: "ellipse", c: [r * 3, 0], rx: r * 3.4, ry: r * 0.4, color: core, noOutline: true },
      ];
    case "burst":
      return [
        { kind: "circle", c: [0, 0], r: r * (1 + frame * 0.45), color: e, alpha: Math.max(0.15, 0.7 - frame * 0.15), noOutline: true },
        { kind: "circle", c: [0, 0], r: r * (0.6 + frame * 0.3), color: glow, alpha: Math.max(0.1, 0.8 - frame * 0.2), noOutline: true },
      ];
    case "slash": {
      // lâmina de vento em meia-lua: arco de cápsulas, grosso no meio e fino nas pontas
      const arc = (rad, thick, color, alpha) => {
        const out = [];
        const n = 8;
        for (let i = 0; i < n; i++) {
          const a0 = (-70 + (140 * i) / n) * (Math.PI / 180);
          const a1 = (-70 + (140 * (i + 1)) / n) * (Math.PI / 180);
          const w = (t) => thick * (0.25 + 0.75 * Math.sin(Math.PI * t));
          out.push({
            kind: "cap",
            a: [-r * 0.6 + Math.cos(a0) * rad, Math.sin(a0) * rad],
            b: [-r * 0.6 + Math.cos(a1) * rad, Math.sin(a1) * rad],
            r1: w(i / n),
            r2: w((i + 1) / n),
            color,
            alpha,
            noOutline: true,
          });
        }
        return out;
      };
      return [...arc(r * 1.9, r * 0.5, e, 0.55), ...arc(r * 1.9, r * 0.3, glow, 1), ...arc(r * 1.95, r * 0.1, core, 1)];
    }
    case "orb":
    default:
      return [
        { kind: "circle", c: [0, 0], r: r * 1.35, color: e, alpha: 0.5, noOutline: true },
        { kind: "circle", c: [0, 0], r: r, color: glow },
        { kind: "circle", c: [r * 0.15, -r * 0.1], r: r * 0.55, color: core, noOutline: true },
        { kind: "ellipse", c: [-r * 1.3, 0], rx: r * 0.9, ry: r * 0.45, color: e, alpha: 0.45, noOutline: true },
      ];
  }
}
