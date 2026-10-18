// Pintor dos sprites do elenco nativo, com Skia (CanvasKit) em Node.
//
// Recebe o esqueleto resolvido (rig.mjs → solve) e o visual do personagem
// (characters.mjs → look) e desenha um lutador "de verdade": membros com
// músculo em curvas de Bézier, sombreamento cel (luz de cima e da frente),
// brilho de borda, contorno com espessura, rosto, cabelo, roupas com dobras,
// faixa com nó e pontas, luvas, pés e armas. Os projéteis ganham brilho com
// desfoque. Coordenadas em unidades do MUGEN (y para baixo), lutador virado
// para +x.

import { createRequire } from "node:module";

import { Canvas } from "./raster.mjs";
import { weaponSegment } from "./rig.mjs";

const require = createRequire(import.meta.url);
let CK = null;

/** Carrega o CanvasKit (uma vez). */
export async function initPainter() {
  if (CK) return CK;
  const init = require("canvaskit-wasm/bin/full/canvaskit.js");
  CK = await init();
  return CK;
}

// ------------------------------------------------------------ cores

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
function hex(c) {
  const v = c.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16));
}
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
/** Sombra: mais escura e puxada para um roxo frio, como em arte de jogo de luta. */
const shadowOf = (c, k = 1) => mix(c.map((x) => x * (1 - 0.34 * k)), [52, 36, 92], 0.18 * k);
const lightOf = (c) => mix(c, [255, 250, 235], 0.32);
const OUTLINE = [24, 16, 30];

function paintOf(rgb, alpha = 1, style = "fill", width = 1) {
  const p = new CK.Paint();
  p.setAntiAlias(true);
  p.setColor(CK.Color(clamp(rgb[0]), clamp(rgb[1]), clamp(rgb[2]), alpha));
  if (style === "stroke") {
    p.setStyle(CK.PaintStyle.Stroke);
    p.setStrokeWidth(width);
    p.setStrokeJoin(CK.StrokeJoin.Round);
    p.setStrokeCap(CK.StrokeCap.Round);
  }
  return p;
}

// ------------------------------------------------------------ geometria

const rad = (d) => (d * Math.PI) / 180;
const dirOf = (deg) => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const add = (p, d, s = 1) => [p[0] + d[0] * s, p[1] + d[1] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]) || 1e-6;
const norm = (v) => [v[0] / len(v), v[1] / len(v)];
const perp = (d) => [-d[1], d[0]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function translate(path, dx, dy) {
  const b = new CK.PathBuilder();
  b.addPath(path);
  b.offset(dx, dy);
  return b.detachAndDelete();
}

function op(a, b, kind) {
  return CK.Path.MakeFromOp(a, b, kind) ?? a;
}

const union = (...paths) => paths.filter(Boolean).reduce((acc, p) => (acc ? op(acc, p, CK.PathOp.Union) : p), null);

/**
 * Membro afinado com músculo: de `a` (raio r1) até `b` (raio r2), pontas
 * arredondadas. `bulge` = [lado +n, lado -n] em unidades, no ponto `at` (0..1).
 */
function limb(a, b, r1, r2, bulge = [0, 0], at = 0.4) {
  const d = norm(sub(b, a));
  const n = perp(d);
  const L = len(sub(b, a));
  const th = Math.atan2(n[1], n[0]) * (180 / Math.PI);
  const rAt = (t) => r1 + (r2 - r1) * t;
  const pb = new CK.PathBuilder();
  const side = (sign, from, to, bl) => {
    // curva do lado `sign` (1 = +n), indo de `from` (t) para `to` (t)
    const t1 = from + (to - from) * 0.33;
    const t2 = from + (to - from) * 0.66;
    const bump = (t) => bl * Math.max(0, 1 - Math.abs(t - at) / 0.5) * 1.6;
    const c1 = add(add(a, d, L * t1), n, sign * (rAt(t1) + bump(t1)));
    const c2 = add(add(a, d, L * t2), n, sign * (rAt(t2) + bump(t2)));
    const end = add(add(a, d, L * to), n, sign * rAt(to));
    pb.cubicTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
  };
  const s0 = add(a, n, r1);
  pb.moveTo(s0[0], s0[1]);
  side(1, 0, 1, bulge[0]);
  pb.arcToOval(CK.XYWHRect(b[0] - r2, b[1] - r2, r2 * 2, r2 * 2), th, -180, false);
  side(-1, 1, 0, bulge[1]);
  pb.arcToOval(CK.XYWHRect(a[0] - r1, a[1] - r1, r1 * 2, r1 * 2), th + 180, -180, false);
  pb.close();
  return pb.detachAndDelete();
}

function circle(c, r) {
  const pb = new CK.PathBuilder();
  pb.addOval(CK.XYWHRect(c[0] - r, c[1] - r, r * 2, r * 2));
  return pb.detachAndDelete();
}

function ellipse(c, rx, ry, angle = 0) {
  const pb = new CK.PathBuilder();
  pb.addOval(CK.XYWHRect(-rx, -ry, rx * 2, ry * 2));
  const p = pb.detachAndDelete();
  return transformed(p, c, angle);
}

/** Polígono suave (Catmull-Rom fechado → Bézier). */
function smooth(points, closed = true) {
  const pb = new CK.PathBuilder();
  const n = points.length;
  const P = (i) => points[(i + n) % n];
  pb.moveTo(points[0][0], points[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = closed ? P(i - 1) : points[Math.max(0, i - 1)];
    const p1 = P(i);
    const p2 = closed ? P(i + 1) : points[Math.min(n - 1, i + 1)];
    const p3 = closed ? P(i + 2) : points[Math.min(n - 1, i + 2)];
    const c1 = add(p1, sub(p2, p0), 1 / 6);
    const c2 = add(p2, sub(p3, p1), -1 / 6);
    pb.cubicTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
  if (closed) pb.close();
  return pb.detachAndDelete();
}

/** Aplica rotação (graus) e translação a um caminho desenhado em coordenadas locais. */
function transformed(path, at, angle) {
  const c = Math.cos(rad(angle));
  const s = Math.sin(rad(angle));
  const pb = new CK.PathBuilder();
  pb.addPath(path, c, -s, at[0], s, c, at[1], 0, 0, 1);
  return pb.detachAndDelete();
}

/** Converte pontos locais (x para a frente, y para baixo) da cabeça/mão em mundo. */
function frame(at, angle) {
  const c = Math.cos(rad(angle));
  const s = Math.sin(rad(angle));
  return (p) => [at[0] + p[0] * c - p[1] * s, at[1] + p[0] * s + p[1] * c];
}

// ------------------------------------------------------------ pintura

/**
 * Lista de camadas do sprite. Cada item: { path, color, shade?, outline?, alpha?, lines? }
 * desenhado na ordem. `shade` liga o sombreamento cel e o brilho de borda.
 */
class Sprite {
  constructor(unit) {
    this.items = [];
    this.u = unit; // espessura base (unidades)
  }
  part(path, color, opts = {}) {
    this.items.push({ path, color, shade: true, outline: true, ...opts });
  }
  flat(path, color, opts = {}) {
    this.items.push({ path, color, shade: false, outline: false, ...opts });
  }
  line(pts, color, width, opts = {}) {
    this.items.push({ stroke: pts, color, width, ...opts });
  }
  glow(path, color, sigma, alpha = 1) {
    this.items.push({ path, color, glow: sigma, alpha, shade: false, outline: false });
  }
}

const LIGHT = [-0.55, -0.85]; // luz de cima e da frente-esquerda da tela

function render(sprite, k, pad = 6) {
  // limites
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of sprite.items) {
    let b;
    if (it.stroke) {
      const xs = it.stroke.map((p) => p[0]);
      const ys = it.stroke.map((p) => p[1]);
      b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    } else {
      const r = it.path.getBounds();
      b = [r[0], r[1], r[2], r[3]];
    }
    const g = (it.glow ?? 0) * 3;
    x0 = Math.min(x0, b[0] - g);
    y0 = Math.min(y0, b[1] - g);
    x1 = Math.max(x1, b[2] + g);
    y1 = Math.max(y1, b[3] + g);
  }
  const w = Math.ceil((x1 - x0) * k + pad * 2);
  const h = Math.ceil((y1 - y0) * k + pad * 2);
  const surface = CK.MakeSurface(w, h);
  const c = surface.getCanvas();
  c.clear(CK.TRANSPARENT);
  const ox = -x0 * k + pad;
  const oy = -y0 * k + pad;
  c.translate(ox, oy);
  c.scale(k, k);

  const ow = sprite.u * 0.85; // contorno (unidades)
  for (const it of sprite.items) {
    const alpha = it.alpha ?? 1;
    if (it.stroke) {
      const pb = new CK.PathBuilder();
      pb.moveTo(it.stroke[0][0], it.stroke[0][1]);
      if (it.stroke.length === 3) pb.quadTo(it.stroke[1][0], it.stroke[1][1], it.stroke[2][0], it.stroke[2][1]);
      else for (const p of it.stroke.slice(1)) pb.lineTo(p[0], p[1]);
      const path = pb.detachAndDelete();
      c.drawPath(path, paintOf(it.color, alpha, "stroke", it.width));
      continue;
    }
    if (it.glow) {
      const p = paintOf(it.color, alpha);
      p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, it.glow, true));
      c.drawPath(it.path, p);
      continue;
    }
    if (it.outline) c.drawPath(it.path, paintOf(OUTLINE, alpha, "stroke", ow * 2 * (it.outlineScale ?? 1)));
    if (!it.shade) {
      c.drawPath(it.path, paintOf(it.color, alpha));
      continue;
    }
    // cel: tudo na cor da sombra; a parte iluminada é o próprio caminho
    // deslocado na direção da luz; brilho fino na borda do lado da luz
    const s = sprite.u * (it.shadeSize ?? 2.6);
    c.drawPath(it.path, paintOf(shadowOf(it.color, it.dim ?? 1), alpha));
    const lit = op(it.path, translate(it.path, LIGHT[0] * s, LIGHT[1] * s), CK.PathOp.Intersect);
    c.drawPath(lit, paintOf(it.color, alpha));
    const h2 = sprite.u * 0.9;
    const rim = op(it.path, translate(it.path, -LIGHT[0] * h2, -LIGHT[1] * h2), CK.PathOp.Difference);
    c.drawPath(rim, paintOf(lightOf(it.color), alpha * 0.85));
  }
  surface.flush();
  const img = surface.makeImageSnapshot();
  const px = img.readPixels(0, 0, { width: w, height: h, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Premul, colorSpace: CK.ColorSpace.SRGB });
  surface.delete();
  const out = new Canvas(w, h);
  for (let i = 0; i < px.length; i++) out.px[i] = px[i] / 255;
  return { canvas: out, axisX: ox, axisY: oy };
}

// ------------------------------------------------------------ corpo

/** Desenha um lutador numa pose resolvida. */
export function paintFighter(P, S, look, k) {
  const sp = new Sprite(P.H * 0.0105);
  const col = (c) => hex(c);
  const skin = col(look.skin);
  const back = 0.82; // membros de trás um pouco mais escuros
  const dimmed = (c, f) => c.map((x) => x * f);
  const top = col(look.top);
  const bare = look.top === look.skin;
  const pants = col(look.pants);

  // ---- perna
  const leg = (seg, f) => {
    const [hip, knee, ankle] = seg;
    const thighR = P.thighR * 1.05;
    const kneeR = P.shinR * 1.05;
    const ankleR = P.shinR * 0.62;
    // pé: do calcanhar à ponta, perpendicular à canela
    const shin = norm(sub(ankle, knee));
    const fwd = perp(shin);
    const sign = fwd[0] >= 0 ? 1 : -1;
    const toeDir = [fwd[0] * sign, fwd[1] * sign];
    const heel = add(ankle, toeDir, -P.footLen * 0.25);
    const toe = add(add(ankle, toeDir, P.footLen * 1.05), shin, P.shinR * 0.55);
    const footPath = limb(add(heel, shin, P.shinR * 0.15), add(toe, toeDir, P.footLen * 0.15), P.shinR * 0.8, P.shinR * 0.5, [0, 0.5], 0.3);
    const shoes = look.shoes === look.skin ? skin : col(look.shoes);
    sp.part(footPath, dimmed(shoes, f), { dim: 0.9 });
    if (look.shorts || bare && look.pants === look.skin) {
      const legSkin = union(limb(hip, knee, thighR, kneeR, [0.7, 0.4], 0.35), limb(knee, ankle, kneeR, ankleR, [0.2, 1.1], 0.3));
      sp.part(legSkin, dimmed(skin, f));
      // calção
      const shortEnd = lerp(hip, knee, 0.55);
      sp.part(limb(hip, shortEnd, thighR * 1.1, thighR * 1.12, [0.3, 0.2], 0.4), dimmed(pants, f));
      sp.line([add(shortEnd, perp(norm(sub(knee, hip))), thighR * 1.1), add(shortEnd, perp(norm(sub(knee, hip))), -thighR * 1.1)], dimmed(col(look.belt), f), sp.u * 1.6);
    } else {
      // calça folgada (gi / hakama): mais larga e com dobras
      const cuff = lerp(knee, ankle, 0.92);
      const p = union(limb(hip, knee, thighR * 1.16, kneeR * 1.18, [0.6, 0.5], 0.45), limb(knee, cuff, kneeR * 1.16, ankleR * 1.7, [0.4, 0.7], 0.45));
      sp.part(p, dimmed(pants, f));
      const sh = shadowOf(dimmed(pants, f), 1.2);
      const kd = perp(norm(sub(ankle, knee)));
      sp.line([add(knee, kd, -kneeR * 0.6), add(lerp(knee, hip, 0.25), kd, kneeR * 0.1), add(lerp(knee, hip, 0.45), kd, kneeR * 0.5)], sh, sp.u * 0.9, { alpha: 0.8 });
      sp.line([add(lerp(knee, ankle, 0.35), kd, kneeR * 0.7), add(lerp(knee, ankle, 0.55), kd, 0), add(lerp(knee, ankle, 0.8), kd, -kneeR * 0.5)], sh, sp.u * 0.9, { alpha: 0.7 });
    }
  };

  // ---- braço
  const arm = (seg, f, front) => {
    const [shoulder, elbow, wrist] = seg;
    const upperR = P.armR * 1.35;
    const elbowR = P.armR * 0.95;
    const wristR = P.armR * 0.72;
    const sleeve = look.sleeves ? top : null;
    const fore = look.forearm ? col(look.forearm) : skin;
    if (sleeve) {
      sp.part(limb(shoulder, elbow, upperR * 1.35, elbowR * 1.4, [0.6, 0.6], 0.4), dimmed(sleeve, f));
      sp.part(limb(lerp(elbow, wrist, 0.1), wrist, elbowR * 1.05, wristR, [0.7, 0.3], 0.25), dimmed(fore, f));
      // punho largo da manga
      const ed = perp(norm(sub(wrist, elbow)));
      sp.part(limb(add(lerp(shoulder, elbow, 0.75), ed, 0), add(elbow, norm(sub(wrist, elbow)), elbowR * 0.9), elbowR * 1.45, elbowR * 1.65), dimmed(sleeve, f));
    } else {
      // ombro (deltoide), bíceps e antebraço
      sp.part(
        union(limb(shoulder, elbow, upperR * 1.1, elbowR, [1.1, 0.7], 0.32), circle(shoulder, upperR * 1.18)),
        dimmed(skin, f),
      );
      sp.part(limb(elbow, wrist, elbowR, wristR, [0.9, 0.45], 0.22), dimmed(fore, f));
      if (look.armband) sp.part(ellipse(lerp(shoulder, elbow, 0.42), upperR * 0.5, upperR * 1.18, Math.atan2(elbow[1] - shoulder[1], elbow[0] - shoulder[0]) * (180 / Math.PI)), dimmed(col(look.armband), f), { shadeSize: 1.2 });
    }
    // punho fechado (luva ou mão)
    const fd = norm(sub(wrist, elbow));
    const fist = add(wrist, fd, P.fistR * 0.55);
    const ang = Math.atan2(fd[1], fd[0]) * (180 / Math.PI);
    const glove = col(look.gloves);
    const fp = new CK.PathBuilder();
    const r = P.fistR;
    fp.addRRect(CK.RRectXY(CK.XYWHRect(-r * 0.95, -r * 0.85, r * 1.9, r * 1.7), r * 0.55, r * 0.55));
    sp.part(transformed(fp.detachAndDelete(), fist, ang), dimmed(glove, f), { shadeSize: 1.8 });
    // dedos
    const F = frame(fist, ang);
    const ink = shadowOf(dimmed(glove, f), 1.4);
    for (const t of [-0.4, 0.05, 0.5]) sp.line([F([r * 0.35, t * r]), F([r * 0.9, t * r])], ink, sp.u * 0.7, { alpha: 0.85 });
    if (look.gloves !== look.skin && look.gloves !== look.forearm) {
      // punho da luva
      sp.part(limb(add(wrist, fd, -P.armR * 0.4), add(wrist, fd, P.armR * 0.25), wristR * 1.25, wristR * 1.3), dimmed(glove, f), { shadeSize: 1 });
    }
    void front;
  };

  // ---- tronco
  const torso = () => {
    const t = norm(sub(S.neck, S.hip));
    const n = perp(t); // +n = frente (peito)
    const L = len(sub(S.neck, S.hip));
    const at = (u, side) => add(add(S.hip, t, L * u), n, side);
    const sh = P.chestR * 1.2;
    const pts = [
      at(1.02, P.armR * 0.9), // pescoço frente
      at(0.92, sh * 0.95), // ombro frente
      at(0.72, P.chestR * 1.28), // peito
      at(0.55, P.chestR * 1.1),
      at(0.33, P.hipR * 0.92), // cintura
      at(0.05, P.hipR * 1.12), // quadril frente
      at(-0.16, P.hipR * 0.75),
      at(-0.18, -P.hipR * 0.6),
      at(0.05, -P.hipR * 1.12), // quadril trás
      at(0.4, -P.hipR * 0.88), // lombar
      at(0.72, -P.chestR * 1.05), // costas
      at(0.9, -sh * 0.85), // ombro trás
      at(1.02, -P.armR * 0.9),
    ];
    const body = smooth(pts);
    sp.part(body, top, { shadeSize: 3.6 });
    const ink = shadowOf(top, 1.5);
    if (bare) {
      // peitoral e abdômen
      sp.line([at(0.82, P.chestR * 0.2), at(0.66, P.chestR * 0.55), at(0.62, P.chestR * 1.02)], ink, sp.u * 1, { alpha: 0.7 });
      for (const u of [0.48, 0.36, 0.24]) sp.line([at(u, P.hipR * 0.35), at(u - 0.01, P.hipR * 0.62), at(u + 0.01, P.hipR * 0.85)], ink, sp.u * 0.8, { alpha: 0.55 });
      sp.line([at(0.6, P.hipR * 0.55), at(0.38, P.hipR * 0.58), at(0.16, P.hipR * 0.6)], ink, sp.u * 0.8, { alpha: 0.5 });
    } else {
      // gola do gi em V e dobras
      const trim = shadowOf(top, 0.6);
      sp.line([at(1.0, P.armR * 0.6), at(0.72, P.chestR * 0.5), at(0.32, P.hipR * 0.95)], trim, sp.u * 2.2);
      sp.line([at(0.98, P.chestR * 0.7), at(0.66, P.chestR * 0.25), at(0.3, -P.hipR * 0.2)], trim, sp.u * 2.2, { alpha: 0.9 });
      sp.line([at(0.6, -P.chestR * 0.6), at(0.45, -P.hipR * 0.3), at(0.3, -P.hipR * 0.7)], ink, sp.u * 0.9, { alpha: 0.6 });
      if (look.vest) {
        sp.part(smooth([at(0.98, -P.armR * 0.4), at(0.92, -sh * 0.8), at(0.5, -P.hipR * 0.88), at(0.12, -P.hipR * 1.0), at(0.12, P.hipR * 0.35), at(0.55, P.chestR * 0.2)]), col(look.vest), { shadeSize: 2.4 });
      }
    }
    // sem camisa: abaixo da faixa é a calça
    if (bare) {
      const pelvis = smooth([at(0.12, P.hipR * 1.1), at(0.05, P.hipR * 1.14), at(-0.16, P.hipR * 0.78), at(-0.18, -P.hipR * 0.62), at(0.05, -P.hipR * 1.13), at(0.12, -P.hipR * 1.08)]);
      sp.part(pelvis, pants, { shadeSize: 2.4 });
    }
    // faixa/cinto com nó e pontas penduradas
    const belt = col(look.belt);
    const b0 = at(0.1, -P.hipR * 1.16);
    const b1 = at(0.1, P.hipR * 1.2);
    sp.part(limb(b0, b1, P.H * 0.018, P.H * 0.018), belt, { shadeSize: 1 });
    const knot = at(0.11, P.hipR * 0.95);
    sp.part(ellipse(knot, P.H * 0.018, P.H * 0.024, Math.atan2(t[1], t[0]) * (180 / Math.PI)), belt, { shadeSize: 1 });
    const down = [0, 1];
    for (const [dx, l] of [[-0.25, 0.13], [0.35, 0.11]]) {
      const tail = add(add(knot, down, P.H * l), n, P.H * dx * 0.12 + P.H * 0.01);
      sp.part(limb(knot, tail, P.H * 0.013, P.H * 0.016), belt, { shadeSize: 1 });
    }
    return { t, n };
  };

  // ---- cabeça (perfil virado para +x, inclinada pelo ângulo da cabeça)
  const head = () => {
    const r = P.head * 1.28;
    const ang = S.pose.head + 90; // -90 (em pé) → 0
    const F = frame(S.head, ang);
    // pescoço
    sp.part(limb(add(S.neck, norm(sub(S.neck, S.hip)), -P.H * 0.02), lerp(S.neck, S.head, 0.75), P.armR * 1.5, P.armR * 1.25), skin, { shadeSize: 1.6 });
    // crânio + mandíbula + queixo
    const face = smooth([
      F([-r * 0.95, -r * 0.1]),
      F([-r * 0.7, -r * 0.8]),
      F([0, -r * 1.02]),
      F([r * 0.72, -r * 0.72]),
      F([r * 0.98, -r * 0.1]), // testa/olho
      F([r * 1.12, r * 0.22]), // nariz
      F([r * 0.96, r * 0.5]),
      F([r * 0.9, r * 0.82]), // queixo
      F([r * 0.45, r * 0.98]),
      F([-r * 0.25, r * 0.72]), // mandíbula
      F([-r * 0.75, r * 0.45]),
    ]);
    sp.part(face, skin, { shadeSize: 2.4 });
    // orelha
    sp.part(ellipse(F([-r * 0.18, r * 0.12]), r * 0.2, r * 0.28, ang), skin, { shadeSize: 0.8, outlineScale: 0.7 });
    // olho, sobrancelha, boca
    sp.flat(ellipse(F([r * 0.58, -r * 0.08]), r * 0.17, r * 0.12, ang), [250, 248, 240]);
    sp.flat(ellipse(F([r * 0.66, -r * 0.07]), r * 0.08, r * 0.1, ang), [30, 22, 26]);
    sp.line([F([r * 0.32, -r * 0.34]), F([r * 0.6, -r * 0.3]), F([r * 0.86, -r * 0.18])], OUTLINE, sp.u * 1.6);
    sp.line([F([r * 0.6, r * 0.55]), F([r * 0.86, r * 0.5])], shadowOf(skin, 1.6), sp.u * 0.9);
    hair(F, r, ang);
    if (look.headband) {
      const hb = col(look.headband);
      sp.part(limb(F([-r * 0.95, -r * 0.3]), F([r * 0.95, -r * 0.42]), r * 0.17, r * 0.17), hb, { shadeSize: 0.9 });
      const tie = F([-r * 0.95, -r * 0.3]);
      sp.part(limb(tie, add(tie, [-1, 0.55], r * 1.3), r * 0.12, r * 0.07), hb, { shadeSize: 0.8 });
      sp.part(limb(tie, add(tie, [-1, 0.95], r * 1.1), r * 0.11, r * 0.06), shadowOf(hb, 0.3), { shadeSize: 0.8 });
    }
  };

  const hair = (F, r, ang) => {
    const hc = col(look.hairColor);
    switch (look.hair) {
      case "spiky": {
        const pts = [F([-r * 1.05, r * 0.25]), F([-r * 1.9, -r * 0.4]), F([-r * 0.95, -r * 0.6]), F([-r * 1.5, -r * 1.5]), F([-r * 0.45, -r * 1.0]), F([-r * 0.4, -r * 2.0]), F([r * 0.15, -r * 1.12]), F([r * 0.7, -r * 1.85]), F([r * 0.62, -r * 0.95]), F([r * 1.25, -r * 1.05]), F([r * 0.85, -r * 0.55]), F([r * 0.5, -r * 0.55]), F([-r * 0.3, -r * 0.4]), F([-r * 0.7, r * 0.1])];
        const pb = new CK.PathBuilder();
        pb.addPolygon(pts.flat(), true);
        sp.part(pb.detachAndDelete(), hc, { shadeSize: 2 });
        break;
      }
      case "long": {
        sp.part(smooth([F([-r * 0.3, -r * 0.9]), F([-r * 1.2, -r * 0.2]), F([-r * 1.5, r * 1.4]), F([-r * 1.8, r * 2.6]), F([-r * 1.05, r * 1.9]), F([-r * 0.75, r * 0.6]), F([-r * 0.4, r * 0.1])]), hc, { shadeSize: 2 });
        sp.part(smooth([F([-r * 1.02, r * 0.2]), F([-r * 0.85, -r * 0.85]), F([0, -r * 1.12]), F([r * 0.85, -r * 0.8]), F([r * 1.0, -r * 0.3]), F([r * 0.55, -r * 0.5]), F([-r * 0.2, -r * 0.45]), F([-r * 0.6, 0])]), hc, { shadeSize: 2 });
        break;
      }
      case "topknot": {
        sp.part(smooth([F([-r * 1.0, r * 0.15]), F([-r * 0.85, -r * 0.82]), F([0, -r * 1.1]), F([r * 0.8, -r * 0.78]), F([r * 0.95, -r * 0.42]), F([r * 0.4, -r * 0.58]), F([-r * 0.45, -r * 0.42])]), hc, { shadeSize: 2 });
        sp.part(ellipse(F([-r * 0.35, -r * 1.25]), r * 0.42, r * 0.34, ang - 20), hc, { shadeSize: 1.4 });
        sp.part(limb(F([-r * 0.35, -r * 1.05]), F([-r * 0.3, -r * 0.92]), r * 0.16, r * 0.16), [200, 40, 40], { shadeSize: 0.6, outlineScale: 0.6 });
        break;
      }
      case "hood": {
        sp.part(smooth([F([-r * 1.25, r * 0.6]), F([-r * 1.2, -r * 0.8]), F([0, -r * 1.25]), F([r * 1.0, -r * 0.85]), F([r * 1.15, -r * 0.2]), F([r * 0.95, r * 0.95]), F([0, r * 1.2])]), hc, { shadeSize: 2.2 });
        // fenda dos olhos
        sp.flat(smooth([F([r * 0.25, -r * 0.3]), F([r * 1.1, -r * 0.32]), F([r * 1.1, r * 0.08]), F([r * 0.25, r * 0.06])]), skin);
        sp.flat(ellipse(F([r * 0.66, -r * 0.1]), r * 0.09, r * 0.1, ang), [30, 22, 26]);
        sp.line([F([r * 0.4, -r * 0.32]), F([r * 1.0, -r * 0.24])], OUTLINE, sp.u * 1.4);
        break;
      }
      case "mohawk": {
        sp.part(smooth([F([-r * 1.05, -r * 0.2]), F([-r * 0.9, -r * 1.3]), F([-r * 0.1, -r * 1.75]), F([r * 0.75, -r * 1.25]), F([r * 0.6, -r * 0.85]), F([-r * 0.2, -r * 0.95])]), hc, { shadeSize: 1.8 });
        break;
      }
      case "short":
      default:
        sp.part(smooth([F([-r * 1.02, r * 0.2]), F([-r * 0.95, -r * 0.75]), F([0, -r * 1.12]), F([r * 0.82, -r * 0.82]), F([r * 0.95, -r * 0.45]), F([r * 0.4, -r * 0.62]), F([-r * 0.4, -r * 0.45])]), hc, { shadeSize: 2 });
        break;
    }
  };

  const weapon = () => {
    const seg = weaponSegment(P, S, look);
    if (!seg) return;
    const w = look.weapon;
    const d = dirOf(seg.ang);
    const n = perp(d);
    const guard = add(seg.hand, d, P.H * 0.035);
    // lâmina levemente curva (katana): fio do lado -n
    const L = len(sub(seg.tip, guard));
    const curve = P.H * 0.025;
    const bp = new CK.PathBuilder();
    const back0 = add(guard, n, P.H * 0.013);
    const edge0 = add(guard, n, -P.H * 0.011);
    const tipP = add(seg.tip, n, curve);
    const midB = add(add(guard, d, L * 0.55), n, curve * 0.9 + P.H * 0.011);
    const midE = add(add(guard, d, L * 0.55), n, curve * 0.9 - P.H * 0.01);
    bp.moveTo(back0[0], back0[1]);
    bp.quadTo(midB[0], midB[1], tipP[0], tipP[1]);
    bp.quadTo(midE[0], midE[1], edge0[0], edge0[1]);
    bp.close();
    const blade = bp.detachAndDelete();
    sp.part(blade, col(w.blade), { shadeSize: 0.6, outlineScale: 0.7 });
    sp.line([add(guard, n, -P.H * 0.004), add(add(guard, d, L * 0.55), n, curve * 0.9 - P.H * 0.005), add(seg.tip, n, curve * 0.97)], [255, 255, 255], sp.u * 0.6, { alpha: 0.9 });
    // tsuba e cabo trançado
    sp.part(ellipse(guard, P.H * 0.012, P.H * 0.034, seg.ang), col(w.guard), { shadeSize: 0.6, outlineScale: 0.7 });
    sp.part(limb(seg.butt, add(guard, d, -P.H * 0.012), P.H * 0.016, P.H * 0.016), col(w.hilt), { shadeSize: 0.6, outlineScale: 0.7 });
    for (let i = 1; i < 5; i++) {
      const p = lerp(seg.butt, guard, i / 5);
      sp.line([add(p, n, P.H * 0.014), add(add(p, d, P.H * 0.015), n, -P.H * 0.014)], [200, 190, 170], sp.u * 0.5, { alpha: 0.9 });
    }
  };

  // ordem: trás → frente; a bacia cobre o alto das coxas
  arm(S.armB, back, false);
  leg(S.legB, back);
  leg(S.legF, 1);
  const t = torso();
  head();
  weapon();
  arm(S.armF, 1, true);
  void t;
  return render(sp, k);
}

// ------------------------------------------------------------ projéteis

export function paintProjectile(kind, look, H, frameNo, k) {
  const sp = new Sprite(H * 0.01);
  const e = hex(look.energy);
  const glowC = mix(e, [255, 255, 255], 0.45);
  const white = [255, 255, 255];
  const pulse = frameNo % 2 === 0 ? 1 : 0.9;
  const r = H * 0.11 * pulse;
  switch (kind) {
    case "blade": {
      sp.glow(ellipse([0, 0], r * 2.2, r * 0.7), e, r * 0.5, 0.7);
      const pb = new CK.PathBuilder();
      pb.addPolygon([r * 1.9, 0, -r * 0.5, r * 0.42, -r * 1.3, 0, -r * 0.5, -r * 0.42], true);
      sp.part(pb.detachAndDelete(), glowC, { shadeSize: 0.5, outlineScale: 0.6 });
      sp.flat(ellipse([r * 0.2, 0], r * 1.1, r * 0.13), white);
      break;
    }
    case "wave": {
      sp.glow(ellipse([0, -r * 1.4], r * 1.1, r * 1.8), e, r * 0.6, 0.8);
      sp.flat(ellipse([r * 0.2, -r * 1.3], r * 0.6, r * 1.35), glowC, { alpha: 0.95 });
      sp.flat(ellipse([r * 0.35, -r * 1.2], r * 0.26, r * 0.95), white);
      break;
    }
    case "beam": {
      sp.glow(ellipse([r * 3, 0], r * 4.4, r * 1.4), e, r * 0.7, 0.85);
      sp.flat(ellipse([r * 3, 0], r * 3.9, r * 0.85), glowC);
      sp.flat(ellipse([r * 3, 0], r * 3.5, r * 0.38), white);
      break;
    }
    case "slash": {
      const arc = (rad1, rad0) => {
        // meia-lua: arco externo menos arco interno deslocado
        const outer = ellipse([-r * 0.6, 0], rad1, rad1 * 1.15);
        const inner = ellipse([-r * 1.25, 0], rad0, rad0 * 1.2);
        return op(outer, inner, CK.PathOp.Difference);
      };
      sp.glow(arc(r * 2.0, r * 1.95), e, r * 0.45, 0.9);
      sp.flat(arc(r * 1.9, r * 1.95), glowC);
      sp.flat(arc(r * 1.82, r * 2.1), white, { alpha: 0.95 });
      break;
    }
    case "burst": {
      const s = 1 + frameNo * 0.5;
      sp.glow(circle([0, 0], r * s), e, r * 0.5, Math.max(0.2, 0.9 - frameNo * 0.2));
      sp.flat(circle([0, 0], r * (0.55 + frameNo * 0.3)), glowC, { alpha: Math.max(0.15, 0.9 - frameNo * 0.22) });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + frameNo * 0.3;
        sp.line([[Math.cos(a) * r * s * 0.5, Math.sin(a) * r * s * 0.5], [Math.cos(a) * r * s * 1.3, Math.sin(a) * r * s * 1.3]], white, sp.u * 1.2, { alpha: Math.max(0.1, 0.9 - frameNo * 0.22) });
      }
      break;
    }
    case "orb":
    default: {
      sp.glow(circle([0, 0], r * 1.5), e, r * 0.55, 0.9);
      sp.glow(ellipse([-r * 1.4, 0], r * 1.2, r * 0.55), e, r * 0.35, 0.6);
      sp.flat(circle([0, 0], r * 1.02), glowC);
      sp.flat(circle([r * 0.12, -r * 0.08], r * 0.6), white);
      break;
    }
  }
  return render(sp, k, 4);
}
