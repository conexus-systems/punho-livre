#!/usr/bin/env node
// Pinta os cenários em camadas de imagem com Skia (CanvasKit) em Node.
//
//   node scripts/stages/paint-stages.mjs
//
// Saída: mobile/assets/stages/<cenário>-<camada>.(png|jpg) e
// src/game/stages.generated.ts (posição, paralaxe e require de cada camada).
// Cada camada cobre tudo o que a câmera pode mostrar com a sua paralaxe, em
// unidades do MUGEN (chão em y = 0, para cima negativo), a PX pixels por unidade.

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const OUT = path.join(root, "assets/stages");
const PX = 2.5;
const CAM = 230; // até onde a câmera anda
const HALF = 330; // meia tela mais larga (≈ 21:9) em unidades

const CK = await require("canvaskit-wasm/bin/full/canvaskit.js")();

// --------------------------------------------------------------- utilidades

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const hex = (c) => {
  const v = c.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16));
};
const color = (c, a = 1) => {
  const [r, g, b] = typeof c === "string" ? hex(c) : c;
  return CK.Color(r, g, b, a);
};
const mixHex = (a, b, t) => {
  const x = hex(a);
  const y = hex(b);
  return x.map((v, i) => Math.round(v + (y[i] - v) * t));
};

function fill(c, a = 1) {
  const p = new CK.Paint();
  p.setAntiAlias(true);
  p.setColor(color(c, a));
  return p;
}
function stroke(c, w, a = 1) {
  const p = fill(c, a);
  p.setStyle(CK.PaintStyle.Stroke);
  p.setStrokeWidth(w);
  p.setStrokeCap(CK.StrokeCap.Round);
  return p;
}
function glow(c, sigma, a = 1) {
  const p = fill(c, a);
  p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, sigma, true));
  return p;
}
function vgrad(y0, y1, stops) {
  const p = new CK.Paint();
  p.setShader(CK.Shader.MakeLinearGradient([0, y0], [0, y1], stops.map(([, c, a]) => color(c, a ?? 1)), stops.map(([t]) => t), CK.TileMode.Clamp));
  return p;
}
function radial(cx, cy, r, stops) {
  const p = new CK.Paint();
  p.setShader(CK.Shader.MakeRadialGradient([cx, cy], r, stops.map(([, c, a]) => color(c, a ?? 1)), stops.map(([t]) => t), CK.TileMode.Clamp));
  return p;
}
function poly(pts) {
  const b = new CK.PathBuilder();
  b.addPolygon(pts.flat(), true);
  return b.detachAndDelete();
}
const R = (x, y, w, h) => CK.XYWHRect(x, y, w, h);

/**
 * Pinta uma camada. `draw(c, L)` recebe o canvas já em unidades do mundo
 * (x, y) e L = { left, right, top, bottom }.
 */
function layer(stage, name, parallax, top, bottom, draw, opts = {}) {
  const reach = CAM * parallax + HALF + 10;
  const left = -reach;
  const right = reach;
  const w = Math.ceil((right - left) * PX);
  const h = Math.ceil((bottom - top) * PX);
  const surface = CK.MakeSurface(w, h);
  const c = surface.getCanvas();
  c.clear(CK.TRANSPARENT);
  c.scale(PX, PX);
  c.translate(-left, -top);
  draw(c, { left, right, top, bottom });
  surface.flush();
  const img = surface.makeImageSnapshot();
  const jpg = opts.opaque === true;
  const bytes = jpg ? img.encodeToBytes(CK.ImageFormat.JPEG, 86) : img.encodeToBytes(CK.ImageFormat.PNG, 100);
  surface.delete();
  const file = `${stage}-${name}.${jpg ? "jpg" : "png"}`;
  writeFileSync(path.join(OUT, file), bytes);
  return { name, parallax, x: left, y: top, w: right - left, h: bottom - top, pw: w, ph: h, file, bob: opts.bob ?? 0 };
}

/** Chão em perspectiva: faixas horizontais que encolhem para o fundo. */
function floorRows(top, bottom, n) {
  const rows = [];
  let y = top;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    const y1 = top + (bottom - top) * t * t * 0.6 + (bottom - top) * t * 0.4;
    rows.push([y, y1]);
    y = y1;
  }
  return rows;
}

/** Pessoa da plateia (silhueta com roupa colorida e luz de cima). */
function person(c, x, y, s, r, palette, opts = {}) {
  const skin = ["#8D5A3B", "#C68B59", "#E8B48A", "#5C3A21", "#F1D3BC", "#A0663E"][Math.floor(r() * 6)];
  const shirt = palette[Math.floor(r() * palette.length)];
  const dark = opts.dark ?? 0;
  const tone = (c0) => mixHex(c0, "#120c1c", dark);
  const lean = (r() - 0.5) * 4;
  const arms = opts.cheer && r() < 0.5;
  // corpo
  const body = new CK.PathBuilder();
  body.addRRect(CK.RRectXY(R(x - 7 * s, y - 34 * s, 14 * s, 26 * s), 5 * s, 5 * s));
  c.drawPath(body.detachAndDelete(), fill(tone(shirt)));
  // pernas
  c.drawRect(R(x - 6 * s, y - 10 * s, 5 * s, 10 * s), fill(tone("#2A2438")));
  c.drawRect(R(x + 1 * s, y - 10 * s, 5 * s, 10 * s), fill(tone("#2A2438")));
  // braços
  if (arms) {
    c.drawLine(x - 6 * s, y - 30 * s, x - 11 * s, y - 46 * s, stroke(tone(skin), 3.4 * s));
    c.drawLine(x + 6 * s, y - 30 * s, x + 11 * s, y - 46 * s, stroke(tone(skin), 3.4 * s));
  } else {
    c.drawLine(x - 7 * s, y - 30 * s, x - 9 * s, y - 16 * s, stroke(tone(shirt), 3.6 * s));
    c.drawLine(x + 7 * s, y - 30 * s, x + 9 * s, y - 16 * s, stroke(tone(shirt), 3.6 * s));
  }
  // cabeça e cabelo
  c.drawCircle(x + lean * s * 0.3, y - 40 * s, 6 * s, fill(tone(skin)));
  c.drawArc(R(x + lean * s * 0.3 - 6.4 * s, y - 47 * s, 12.8 * s, 10 * s), 180, 180, true, fill(tone(["#1C1917", "#3F2A1E", "#78350F", "#111827"][Math.floor(r() * 4)])));
  // luz de cima
  c.drawRect(R(x - 7 * s, y - 34 * s, 14 * s, 3 * s), fill("#FFFFFF", 0.12 * (1 - dark)));
}

// ------------------------------------------------------------------ dojo

function dojo() {
  const id = "dojo";
  const out = [];
  // céu do entardecer, montanhas e cerejeiras vistas pelas portas abertas
  out.push(
    layer(id, "sky", 0.15, -260, 10, (c, L) => {
      c.drawRect(R(L.left, L.top, L.right - L.left, L.bottom - L.top), vgrad(L.top, 0, [[0, "#3B1D4E"], [0.45, "#C2456A"], [0.75, "#F59E5B"], [1, "#FCD9A0"]]));
      c.drawCircle(90, -120, 26, glow("#FFE7B0", 12, 0.9));
      c.drawCircle(90, -120, 16, fill("#FFF4D6"));
      // montanha grande com neve
      c.drawPath(poly([[-260, -20], [-50, -105], [10, -118], [70, -105], [300, -20]]), fill("#6B3A63"));
      c.drawPath(poly([[-50, -105], [10, -118], [70, -105], [48, -90], [28, -98], [8, -86], [-14, -98], [-32, -90]]), fill("#F5E6F0"));
      c.drawPath(poly([[L.left, -15], [-250, -80], [-140, -45], [-60, -70], [60, -35], [190, -75], [L.right, -25], [L.right, 10], [L.left, 10]]), fill("#4A2B4F"));
      // pagode ao longe
      for (let i = 0; i < 4; i++) c.drawPath(poly([[-190 - 14 + i * 2, -50 - i * 12], [-190 + 14 - i * 2, -50 - i * 12], [-190 + 9 - i * 2, -44 - i * 12], [-190 - 9 + i * 2, -44 - i * 12]]), fill("#2E1A33"));
      c.drawRect(R(-195, -50, 10, 30), fill("#2E1A33"));
      c.drawRect(R(L.left, -12, L.right - L.left, 22), vgrad(-12, 10, [[0, "#3A2240"], [1, "#2A1830"]]));
    }, { opaque: true }),
  );
  // parede do dojo com portas abertas, vigas, pergaminhos, lanternas
  out.push(
    layer(id, "wall", 0.75, -250, 2, (c, L) => {
      const wood = "#6B4226";
      const woodDark = "#3E2614";
      const W = L.right - L.left;
      // parede de cima (papel) e de baixo (madeira); aberturas entre pilares
      c.drawRect(R(L.left, -250, W, 85), vgrad(-250, -165, [[0, "#D9C49E"], [1, "#EBDDBE"]]));
      c.drawRect(R(L.left, -165, W, 167), vgrad(-165, 0, [[0, "#C9A877"], [1, "#9C7647"]]));
      const span = 120;
      for (let i = Math.floor(L.left / span) - 1; i * span < L.right + span; i++) {
        const x = i * span;
        // abertura com a paisagem (transparente) e moldura das portas de correr
        const open = ((i % 3) + 3) % 3 !== 1;
        if (open) {
          c.save();
          c.clipRect(R(x + 12, -158, span - 24, 118), CK.ClipOp.Intersect, true);
          c.clear(CK.TRANSPARENT);
          c.restore();
          // porta de shoji meio aberta
          c.drawRect(R(x + 12, -158, 30, 118), fill("#F3E9D2"));
          for (let k = 1; k < 3; k++) c.drawLine(x + 12 + k * 10, -158, x + 12 + k * 10, -40, stroke(woodDark, 1));
          for (let k = 1; k < 6; k++) c.drawLine(x + 12, -158 + k * 20, x + 42, -158 + k * 20, stroke(woodDark, 1));
          c.drawRect(R(x + 12, -158, 30, 118), stroke(woodDark, 2));
          c.drawRect(R(x + 12, -40, span - 24, 8), fill(woodDark));
        } else {
          // parede com pergaminho e suporte de armas
          c.drawRect(R(x + 12, -158, span - 24, 118), vgrad(-158, -40, [[0, "#E2CFA6"], [1, "#CDB07E"]]));
          c.drawRect(R(x + span / 2 - 14, -150, 28, 72), fill("#F7F0DD"));
          c.drawRect(R(x + span / 2 - 14, -150, 28, 72), stroke("#8A6A3A", 1.2));
          c.drawRect(R(x + span / 2 - 17, -153, 34, 4), fill(woodDark));
          c.drawRect(R(x + span / 2 - 17, -80, 34, 4), fill(woodDark));
          // "ideograma" estilizado (pinceladas)
          const ink = stroke("#1F1410", 3);
          c.drawLine(x + span / 2 - 6, -138, x + span / 2 + 7, -134, ink);
          c.drawLine(x + span / 2, -142, x + span / 2 - 2, -108, ink);
          c.drawLine(x + span / 2 - 8, -118, x + span / 2 + 8, -100, ink);
          c.drawLine(x + span / 2 + 6, -120, x + span / 2 - 6, -96, ink);
          c.drawCircle(x + span / 2, -88, 3, fill("#B91C1C"));
          for (let k = 0; k < 3; k++) {
            c.drawLine(x + 22 + k * 8, -70, x + 30 + k * 8, -44, stroke("#5A3A1E", 2.4));
          }
          c.drawRect(R(x + 16, -48, 34, 4), fill(woodDark));
        }
        // pilar com veio
        c.drawRect(R(x - 7, -250, 14, 252), vgrad(-250, 0, [[0, "#7A4B2A"], [1, "#4E2E17"]]));
        c.drawRect(R(x - 7, -250, 4, 252), fill("#9A6A40", 0.6));
        c.drawRect(R(x + 4, -250, 3, 252), fill(woodDark, 0.8));
      }
      // vigas horizontais
      c.drawRect(R(L.left, -170, W, 12), vgrad(-170, -158, [[0, "#7A4B2A"], [1, wood]]));
      c.drawRect(R(L.left, -250, W, 8), fill(woodDark));
      c.drawRect(R(L.left, -14, W, 16), vgrad(-14, 2, [[0, "#5A361C"], [1, "#2E1A0C"]]));
      // treliça do alto
      for (let x = Math.floor(L.left / 15) * 15; x < L.right; x += 15) c.drawLine(x, -242, x, -170, stroke("#B89B6E", 0.8, 0.7));
      for (let y = -232; y < -170; y += 15) c.drawLine(L.left, y, L.right, y, stroke("#B89B6E", 0.8, 0.7));
      // placa do dojo no centro
      c.drawRect(R(-48, -238, 96, 30), fill("#2E1A0C"));
      c.drawRect(R(-44, -235, 88, 24), vgrad(-235, -211, [[0, "#F5E6C8"], [1, "#E6D2A8"]]));
      c.drawCircle(0, -223, 8, fill("#B91C1C"));
      // lanternas penduradas com brilho
      for (let i = -4; i <= 4; i++) {
        const x = i * 120 + 26;
        const ly = -150; // topo da lanterna, pendurada na viga
        c.drawLine(x, -158, x, ly, stroke("#2E1A0C", 1));
        c.drawCircle(x, ly + 14, 26, glow("#FFB46B", 14, 0.55));
        const lp = new CK.PathBuilder();
        lp.addOval(R(x - 9, ly, 18, 28));
        const lantern = lp.detachAndDelete();
        c.drawPath(lantern, radial(x - 2, ly + 11, 16, [[0, "#FFE0A8"], [0.5, "#F05A3A"], [1, "#9B1C1C"]]));
        for (let k = 1; k < 4; k++) c.drawLine(x - 9, ly + k * 7, x + 9, ly + k * 7, stroke("#7F1D1D", 0.6, 0.6));
        c.drawRect(R(x - 6, ly - 2, 12, 3), fill("#1F1410"));
        c.drawRect(R(x - 6, ly + 27, 12, 3), fill("#1F1410"));
      }
    }),
  );
  // alunos sentados em seiza ao fundo, assistindo
  out.push(
    layer(id, "crowd", 0.88, -60, 2, (c, L) => {
      const r = rng(7);
      for (let x = L.left + 10; x < L.right; x += 26 + r() * 12) {
        if (Math.abs(x) < 70) continue;
        const s = 0.75 + r() * 0.1;
        const y = -2;
        const gi = r() < 0.75 ? "#F1EEE6" : "#1E293B";
        const skin = ["#E8B48A", "#C68B59", "#8D5A3B", "#F1D3BC"][Math.floor(r() * 4)];
        // ajoelhado: corpo e pernas dobradas
        c.drawOval(R(x - 10 * s, y - 10 * s, 22 * s, 10 * s), fill(mixHex(gi, "#000000", 0.25)));
        const body = new CK.PathBuilder();
        body.addRRect(CK.RRectXY(R(x - 8 * s, y - 34 * s, 16 * s, 26 * s), 6 * s, 6 * s));
        c.drawPath(body.detachAndDelete(), fill(gi));
        c.drawLine(x - 3 * s, y - 31 * s, x + 4 * s, y - 18 * s, stroke(mixHex(gi, "#000000", 0.3), 1.2 * s));
        c.drawRect(R(x - 8 * s, y - 16 * s, 16 * s, 3 * s), fill(r() < 0.5 ? "#111827" : "#7F1D1D"));
        c.drawCircle(x, y - 40 * s, 6.5 * s, fill(skin));
        c.drawArc(R(x - 6.8 * s, y - 47.5 * s, 13.6 * s, 11 * s), 180, 180, true, fill("#1C1917"));
      }
      // sombra na base
      c.drawRect(R(L.left, -6, L.right - L.left, 8), vgrad(-6, 2, [[0, "#000000", 0], [1, "#000000", 0.35]]));
    }),
  );
  // chão de madeira encerada em perspectiva com reflexo das lanternas
  out.push(
    layer(id, "floor", 1, -4, 60, (c, L) => {
      c.drawRect(R(L.left, -4, L.right - L.left, 64), vgrad(-4, 60, [[0, "#B07A45"], [0.4, "#9A6436"], [1, "#6E4222"]]));
      const rows = floorRows(0, 60, 9);
      rows.forEach(([y0, y1], i) => {
        c.drawLine(L.left, y1, L.right, y1, stroke("#4A2A12", 0.6 + i * 0.12, 0.7));
        const scale = 0.55 + (i / rows.length) * 0.9;
        const step = 60 * scale;
        const off = (i * 37) % step;
        for (let x = L.left - off; x < L.right; x += step) c.drawLine(x, y0, x, y1, stroke("#4A2A12", 0.5 + i * 0.08, 0.5));
      });
      // veios
      const r = rng(3);
      for (let k = 0; k < 220; k++) {
        const x = L.left + r() * (L.right - L.left);
        const y = r() * 58;
        c.drawLine(x, y, x + 8 + r() * 20, y + r() * 0.6, stroke("#7A4A24", 0.4, 0.35));
      }
      // reflexos das lanternas
      for (let i = -4; i <= 4; i++) c.drawOval(R(i * 120 + 26 - 14, 6, 28, 40), glow("#FFC98A", 8, 0.22));
      c.drawRect(R(L.left, -4, L.right - L.left, 6), fill("#2E1A0C", 0.6));
    }, { opaque: true }),
  );
  return { id, sky: ["#3B1D4E", "#FCD9A0"], layers: out };
}

// ------------------------------------------------------------- pelourinho

function pelourinho() {
  const id = "pelourinho";
  const out = [];
  out.push(
    layer(id, "sky", 0.15, -260, 10, (c, L) => {
      c.drawRect(R(L.left, L.top, L.right - L.left, L.bottom - L.top), vgrad(L.top, 0, [[0, "#1E6FD9"], [0.6, "#5EB4F2"], [1, "#BFE6FF"]]));
      c.drawCircle(-150, -200, 30, glow("#FFF7D6", 18, 0.8));
      c.drawCircle(-150, -200, 16, fill("#FFFBEA"));
      const r = rng(11);
      for (let k = 0; k < 9; k++) {
        const x = L.left + r() * (L.right - L.left);
        const y = -230 + r() * 120;
        const s = 0.6 + r() * 0.9;
        for (let j = 0; j < 5; j++) c.drawOval(R(x + (j - 2) * 14 * s, y - (j % 2) * 7 * s, 30 * s, 16 * s), glow("#FFFFFF", 3, 0.85));
      }
      // mar da Baía de Todos os Santos ao longe
      c.drawRect(R(L.left, -40, L.right - L.left, 50), vgrad(-40, 10, [[0, "#2B7FC2"], [1, "#1E5A91"]]));
      for (let k = 0; k < 40; k++) c.drawLine(L.left + r() * (L.right - L.left), -36 + r() * 40, L.left + r() * (L.right - L.left) + 6, -36 + r() * 40, stroke("#BFE6FF", 0.6, 0.6));
    }, { opaque: true }),
  );
  // morro com a igreja azul barroca e casario distante
  out.push(
    layer(id, "far", 0.4, -250, 2, (c, L) => {
      c.drawPath(poly([[L.left, -30], [-200, -70], [-60, -110], [80, -120], [220, -85], [L.right, -50], [L.right, 2], [L.left, 2]]), vgrad(-120, 0, [[0, "#6E9A52"], [1, "#4F7A3A"]]));
      const r = rng(5);
      const cols = ["#F2C14E", "#E76F51", "#F4A261", "#E9C46A", "#90BE6D", "#F28482", "#84A59D", "#F7EDE2"];
      for (let x = L.left; x < L.right; x += 16 + r() * 8) {
        const h = 22 + r() * 22;
        const base = -55 - Math.max(0, 60 - Math.abs(x - 40) * 0.25) * 0.8;
        c.drawRect(R(x, base - h, 15, h + 60), fill(cols[Math.floor(r() * cols.length)]));
        c.drawPath(poly([[x - 2, base - h], [x + 7.5, base - h - 6], [x + 17, base - h]]), fill("#B5532E"));
        c.drawRect(R(x + 4, base - h + 6, 3, 5), fill("#2B3A67", 0.8));
        c.drawRect(R(x + 9, base - h + 6, 3, 5), fill("#2B3A67", 0.8));
      }
      // igreja
      const cx = 60;
      const by = -112;
      const blue = "#3E7CC7";
      c.drawRect(R(cx - 40, by - 70, 80, 72), fill(blue));
      for (const tx of [cx - 52, cx + 30]) {
        c.drawRect(R(tx, by - 110, 22, 112), fill(blue));
        c.drawRect(R(tx - 2, by - 112, 26, 5), fill("#FFFFFF"));
        c.drawPath(poly([[tx - 2, by - 112], [tx + 11, by - 138], [tx + 24, by - 112]]), fill("#F5F5F5"));
        c.drawRect(R(tx + 7, by - 100, 8, 14), fill("#1E2A44"));
        c.drawLine(tx + 11, by - 138, tx + 11, by - 148, stroke("#F5F5F5", 1.2));
        c.drawLine(tx + 7, by - 144, tx + 15, by - 144, stroke("#F5F5F5", 1.2));
      }
      c.drawPath(poly([[cx - 40, by - 70], [cx, by - 96], [cx + 40, by - 70]]), fill("#FFFFFF"));
      c.drawRect(R(cx - 10, by - 30, 20, 32), fill("#3A2414"));
      for (const wx of [cx - 28, cx + 18]) c.drawRect(R(wx, by - 55, 10, 16), fill("#1E2A44"));
      c.drawRect(R(cx - 40, by - 72, 80, 4), fill("#FFFFFF"));
    }),
  );
  // casarões coloniais coloridos com sacadas, telhados e fitas
  out.push(
    layer(id, "houses", 0.75, -235, 2, (c, L) => {
      const r = rng(21);
      const cols = ["#F2B33D", "#2F80C9", "#E2557A", "#21A67A", "#EE7B2C", "#8B5CF6", "#F5D547", "#1BB3C8", "#F7EDE2"];
      let x = Math.floor(L.left / 70) * 70 - 70;
      while (x < L.right + 70) {
        const w = 62 + Math.floor(r() * 3) * 8;
        const floors = 2 + (r() < 0.45 ? 1 : 0);
        const h = floors * 54 + 20;
        const col = cols[Math.floor(r() * cols.length)];
        const top = -h;
        c.drawRect(R(x, top, w, h + 2), vgrad(top, 0, [[0, col], [1, mixHex(col, "#3A2A2A", 0.25)]]));
        // cornija e telhado
        c.drawRect(R(x - 2, top - 6, w + 4, 6), fill("#FAF7F0"));
        c.drawPath(poly([[x - 4, top - 6], [x + 6, top - 18], [x + w - 6, top - 18], [x + w + 4, top - 6]]), vgrad(top - 18, top - 6, [[0, "#C0603A"], [1, "#8E3B22"]]));
        for (let tx = x; tx < x + w; tx += 5) c.drawLine(tx, top - 17, tx - 2, top - 7, stroke("#7A2F18", 0.5, 0.6));
        // janelas com moldura branca e venezianas
        for (let f = 0; f < floors; f++) {
          const wy = top + 14 + f * 54;
          const n = w > 70 ? 3 : 2;
          for (let j = 0; j < n; j++) {
            const wx = x + 8 + j * ((w - 16) / n) + ((w - 16) / n - 14) / 2;
            c.drawRect(R(wx - 2, wy - 2, 18, 34), fill("#FAF7F0"));
            const ground = f === floors - 1;
            if (ground && j === 1) {
              c.drawRect(R(wx, wy + 2, 14, 30 + 8), fill("#5A3A20"));
              c.drawPath(poly([[wx - 2, wy - 2], [wx + 7, wy - 9], [wx + 16, wy - 2]]), fill("#FAF7F0"));
            } else {
              c.drawRect(R(wx, wy, 14, 30), fill("#1F3D6B"));
              c.drawRect(R(wx, wy, 6, 30), fill("#2E8B57"));
              c.drawRect(R(wx + 8, wy, 6, 30), fill("#2E8B57"));
              for (let k = 2; k < 30; k += 4) {
                c.drawLine(wx, wy + k, wx + 6, wy + k, stroke("#1E5C3A", 0.5));
                c.drawLine(wx + 8, wy + k, wx + 14, wy + k, stroke("#1E5C3A", 0.5));
              }
            }
            if (!ground) {
              // sacada de ferro
              c.drawRect(R(wx - 4, wy + 30, 22, 2.5), fill("#1F1F24"));
              for (let k = 0; k <= 6; k++) c.drawLine(wx - 3 + k * 3.3, wy + 30, wx - 3 + k * 3.3, wy + 22, stroke("#1F1F24", 0.7));
              c.drawLine(wx - 4, wy + 22, wx + 18, wy + 22, stroke("#1F1F24", 0.9));
            }
          }
        }
        c.drawRect(R(x + w - 1, top, 2, h), fill("#000000", 0.18));
        x += w;
      }
      // fitas do Bonfim penduradas atravessando a rua
      const fitas = ["#E63946", "#F1C40F", "#2ECC71", "#3498DB", "#9B59B6", "#FFFFFF", "#E67E22"];
      for (let row = 0; row < 2; row++) {
        const y0 = -150 + row * 22;
        for (let x0 = L.left; x0 < L.right; x0 += 90) {
          const pb = new CK.PathBuilder();
          pb.moveTo(x0, y0);
          pb.quadTo(x0 + 45, y0 + 14, x0 + 90, y0);
          c.drawPath(pb.detachAndDelete(), stroke("#333333", 0.6));
          for (let k = 1; k < 9; k++) {
            const t = k / 9;
            const fx = x0 + 90 * t;
            const fy = y0 + 4 * 14 * t * (1 - t) * 0.5 * 2;
            c.drawLine(fx, fy, fx + 1, fy + 12, stroke(fitas[(k + row * 3) % fitas.length], 1.6));
          }
        }
      }
    }),
  );
  // roda de capoeira: plateia batendo palmas, berimbaus
  out.push(
    layer(id, "crowd", 0.9, -70, 2, (c, L) => {
      const r = rng(31);
      const pal = ["#F8FAFC", "#FACC15", "#16A34A", "#2563EB", "#DC2626", "#F97316", "#A855F7", "#0EA5E9"];
      for (let x = L.left + 8; x < L.right; x += 15 + r() * 10) {
        if (Math.abs(x) < 60) continue;
        person(c, x, 0, 0.85 + r() * 0.15, r, pal, { cheer: true, dark: 0.12 });
        if (r() < 0.08) {
          // berimbau
          c.drawLine(x + 10, -62, x + 6, -8, stroke("#7C4A1E", 1.4));
          c.drawCircle(x + 7, -18, 4, fill("#C08A3E"));
        }
      }
      c.drawRect(R(L.left, -8, L.right - L.left, 10), vgrad(-8, 2, [[0, "#000000", 0], [1, "#000000", 0.3]]));
    }),
    // ver 'bob' em stages.ts: a plateia balança um pouco
  );
  out[out.length - 1].bob = 0.8;
  // calçamento de pedras (pé-de-moleque) em perspectiva
  out.push(
    layer(id, "floor", 1, -4, 60, (c, L) => {
      c.drawRect(R(L.left, -4, L.right - L.left, 64), vgrad(-4, 60, [[0, "#B9AE9C"], [1, "#857865"]]));
      const r = rng(9);
      const rows = floorRows(0, 60, 11);
      rows.forEach(([y0, y1], i) => {
        const hh = y1 - y0;
        const w = hh * 1.6 + 2;
        const off = (i % 2) * w * 0.5;
        for (let x = L.left - off; x < L.right; x += w) {
          const tone = mixHex("#C9BFAE", "#7D705E", r() * 0.7);
          c.drawRRect(CK.RRectXY(R(x + 0.6, y0 + 0.4, w - 1.2, hh - 0.8), hh * 0.35, hh * 0.35), fill(tone));
          c.drawRect(R(x + 1.5, y0 + 0.8, w - 3, hh * 0.25), fill("#FFFFFF", 0.12));
        }
      });
      c.drawRect(R(L.left, -4, L.right - L.left, 6), fill("#3A2F25", 0.5));
    }, { opaque: true }),
  );
  return { id, sky: ["#1E6FD9", "#BFE6FF"], layers: out };
}

// -------------------------------------------------------------- metrópole

function metro() {
  const id = "metro";
  const out = [];
  out.push(
    layer(id, "sky", 0.1, -260, 10, (c, L) => {
      c.drawRect(R(L.left, L.top, L.right - L.left, L.bottom - L.top), vgrad(L.top, 0, [[0, "#050816"], [0.55, "#1B1747"], [0.85, "#4C1D6B"], [1, "#B5367B"]]));
      const r = rng(2);
      for (let k = 0; k < 140; k++) c.drawCircle(L.left + r() * (L.right - L.left), -255 + r() * 160, 0.3 + r() * 0.6, fill("#FFFFFF", 0.3 + r() * 0.6));
      c.drawCircle(-110, -200, 34, glow("#FDE9C8", 16, 0.6));
      c.drawCircle(-110, -200, 18, fill("#FEF3DD"));
      c.drawCircle(-104, -204, 4, fill("#E8DCC4"));
      c.drawCircle(-115, -194, 3, fill("#E8DCC4"));
    }, { opaque: true }),
  );
  const skyline = (name, parallax, base, seed, colTop, colBottom, litA, opts = {}) =>
    layer(id, name, parallax, -(base + 120), 2, (c, L) => {
      const r = rng(seed);
      let x = L.left - 20;
      while (x < L.right) {
        const w = 30 + r() * 40;
        const h = base * (0.55 + r() * 0.75);
        c.drawRect(R(x, -h, w, h + 2), vgrad(-h, 0, [[0, colTop], [1, colBottom]]));
        if (r() < 0.25) c.drawRect(R(x + w * 0.3, -h - 14, w * 0.4, 14), fill(colTop));
        if (r() < 0.2) c.drawLine(x + w / 2, -h - 14, x + w / 2, -h - 34, stroke(colTop, 1.2));
        if (r() < 0.2) c.drawCircle(x + w / 2, -h - 34, 1.6, glow("#FF3B3B", 1.5, 1));
        for (let wy = -h + 6; wy < -6; wy += 9) {
          for (let wx = x + 4; wx < x + w - 5; wx += 7) {
            if (r() < litA) c.drawRect(R(wx, wy, 4, 5), fill(["#FFE7A3", "#FFD27A", "#BFE3FF"][Math.floor(r() * 3)], 0.55 + r() * 0.4));
          }
        }
        x += w + 2 + r() * 6;
      }
      if (opts.haze) c.drawRect(R(L.left, -60, L.right - L.left, 62), vgrad(-60, 2, [[0, "#B5367B", 0], [1, "#B5367B", 0.35]]));
    });
  out.push(skyline("far", 0.3, 170, 41, "#1A1440", "#2A1E55", 0.18, { haze: true }));
  // prédios próximos com letreiros de neon brilhando
  out.push(
    layer(id, "street", 0.7, -250, 2, (c, L) => {
      const r = rng(77);
      let x = L.left - 20;
      const neon = ["#FF2E88", "#22D3EE", "#A3E635", "#FACC15", "#F472B6"];
      while (x < L.right) {
        const w = 70 + r() * 50;
        const h = 150 + r() * 90;
        c.drawRect(R(x, -h, w, h + 2), vgrad(-h, 0, [[0, "#141022"], [1, "#0C0A16"]]));
        c.drawRect(R(x, -h, 3, h), fill("#2A2340"));
        for (let wy = -h + 10; wy < -40; wy += 14) {
          for (let wx = x + 8; wx < x + w - 10; wx += 12) {
            if (r() < 0.32) c.drawRect(R(wx, wy, 7, 8), fill(r() < 0.8 ? "#FFD88A" : "#9AD7FF", 0.7));
          }
        }
        // letreiro vertical ou horizontal
        const nc = neon[Math.floor(r() * neon.length)];
        if (r() < 0.6) {
          const sx = x + w * (0.2 + r() * 0.5);
          const sy = -h + 30 + r() * 40;
          c.drawRRect(CK.RRectXY(R(sx - 8, sy, 16, 60), 3, 3), glow(nc, 6, 0.5));
          c.drawRRect(CK.RRectXY(R(sx - 8, sy, 16, 60), 3, 3), stroke(nc, 1.6));
          for (let k = 0; k < 4; k++) c.drawRect(R(sx - 4, sy + 6 + k * 13, 8, 8), fill(nc, 0.9));
        } else {
          const sy = -h + 40 + r() * 30;
          c.drawRRect(CK.RRectXY(R(x + 10, sy, w - 20, 20), 4, 4), glow(nc, 7, 0.45));
          c.drawRRect(CK.RRectXY(R(x + 10, sy, w - 20, 20), 4, 4), stroke(nc, 1.8));
          for (let k = 0; k < (w - 30) / 10; k++) c.drawRect(R(x + 16 + k * 10, sy + 6, 6, 8), fill(nc, 0.85));
        }
        // loja no térreo
        c.drawRect(R(x + 6, -38, w - 12, 30), fill("#1E1B2E"));
        c.drawRect(R(x + 10, -34, w - 20, 22), vgrad(-34, -12, [[0, "#FFB86B", 0.75], [1, "#FF7A59", 0.5]]));
        c.drawRect(R(x + 4, -44, w - 8, 7), fill(neon[Math.floor(r() * neon.length)], 0.9));
        x += w + 4;
      }
      // postes com luz
      for (let px = Math.floor(L.left / 140) * 140; px < L.right; px += 140) {
        c.drawLine(px, 0, px, -110, stroke("#2B2B33", 3));
        c.drawLine(px, -110, px + 14, -114, stroke("#2B2B33", 2.4));
        c.drawCircle(px + 14, -112, 24, glow("#FFE2A8", 12, 0.5));
        c.drawCircle(px + 14, -112, 3, fill("#FFF4D6"));
        c.drawPath(poly([[px + 10, -110], [px + 18, -110], [px + 50, 0], [px - 22, 0]]), fill("#FFE2A8", 0.07));
      }
    }),
  );
  // plateia de rua com luz neon atrás
  out.push(
    layer(id, "crowd", 0.9, -70, 2, (c, L) => {
      const r = rng(55);
      const pal = ["#22D3EE", "#F472B6", "#A3E635", "#FACC15", "#F8FAFC", "#6366F1", "#EF4444"];
      for (let x = L.left + 8; x < L.right; x += 14 + r() * 10) {
        if (Math.abs(x) < 60) continue;
        person(c, x, 0, 0.85 + r() * 0.15, r, pal, { cheer: true, dark: 0.45 });
      }
      // grade de proteção
      c.drawLine(L.left, -20, L.right, -20, stroke("#3A3A48", 1.6));
      for (let x = Math.floor(L.left / 12) * 12; x < L.right; x += 12) c.drawLine(x, -20, x, 0, stroke("#3A3A48", 0.9, 0.8));
    }),
  );
  out[out.length - 1].bob = 0.8;
  // asfalto molhado com reflexo dos neons
  out.push(
    layer(id, "floor", 1, -4, 60, (c, L) => {
      c.drawRect(R(L.left, -4, L.right - L.left, 64), vgrad(-4, 60, [[0, "#26222F"], [1, "#121018"]]));
      const r = rng(4);
      const neon = ["#FF2E88", "#22D3EE", "#A3E635", "#FACC15", "#FFB86B"];
      for (let k = 0; k < 60; k++) {
        const x = L.left + r() * (L.right - L.left);
        c.drawRect(R(x - 2, 0, 4 + r() * 6, 20 + r() * 35), glow(neon[Math.floor(r() * neon.length)], 4, 0.18));
      }
      for (let k = 0; k < 900; k++) c.drawCircle(L.left + r() * (L.right - L.left), r() * 60, 0.25 + r() * 0.35, fill("#FFFFFF", 0.05 + r() * 0.08));
      // faixas da rua em perspectiva
      for (let x = Math.floor(L.left / 80) * 80; x < L.right; x += 80) {
        c.drawPath(poly([[x, 28], [x + 26, 28], [x + 30, 34], [x - 4, 34]]), fill("#E5E7EB", 0.55));
      }
      c.drawRect(R(L.left, -4, L.right - L.left, 5), fill("#4A4458"));
    }, { opaque: true }),
  );
  return { id, sky: ["#050816", "#B5367B"], layers: out };
}

// --------------------------------------------------------- praia (Rio)

function palm(c, x, base, h, lean, r) {
  const pb = new CK.PathBuilder();
  pb.moveTo(x - 3, base);
  pb.quadTo(x + lean * 0.4, base - h * 0.5, x + lean, base - h);
  pb.lineTo(x + lean + 3, base - h);
  pb.quadTo(x + lean * 0.4 + 4, base - h * 0.5, x + 3, base);
  pb.close();
  c.drawPath(pb.detachAndDelete(), vgrad(base - h, base, [[0, "#6B4A2B"], [1, "#4A3020"]]));
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + r() * 0.3;
    const tip = [x + lean + Math.cos(a) * 34, base - h + Math.sin(a) * 14 + 10];
    const fb = new CK.PathBuilder();
    fb.moveTo(x + lean, base - h);
    fb.quadTo((x + lean + tip[0]) / 2, base - h - 12, tip[0], tip[1]);
    fb.quadTo((x + lean + tip[0]) / 2, base - h - 4, x + lean, base - h);
    c.drawPath(fb.detachAndDelete(), fill(k % 2 ? "#2F7D3A" : "#3E9A47"));
  }
}

function praia() {
  const id = "praia";
  const out = [];
  out.push(
    layer(id, "sky", 0.12, -260, 10, (c, L) => {
      c.drawRect(R(L.left, L.top, L.right - L.left, L.bottom - L.top), vgrad(L.top, 0, [[0, "#2B1055"], [0.4, "#D53A6B"], [0.7, "#FF8A3D"], [1, "#FFD39A"]]));
      c.drawCircle(-60, -55, 40, glow("#FFE4A8", 20, 0.8));
      c.drawCircle(-60, -55, 22, fill("#FFF1C9"));
      // morros à beira-mar
      c.drawPath(poly([[60, -40], [100, -150], [118, -170], [134, -150], [150, -95], [175, -40]]), fill("#3B1F3F"));
      c.drawPath(poly([[150, -40], [185, -85], [205, -90], [230, -40]]), fill("#3B1F3F"));
      c.drawPath(poly([[L.left, -40], [-300, -70], [-200, -55], [-120, -78], [-30, -40]]), fill("#4A2847"));
      // mar com reflexo
      c.drawRect(R(L.left, -40, L.right - L.left, 50), vgrad(-40, 10, [[0, "#B2507A"], [1, "#3D2A6B"]]));
      const r = rng(13);
      for (let k = 0; k < 70; k++) {
        const y = -36 + r() * 44;
        const x = -60 + (r() - 0.5) * (30 + (y + 40) * 1.4);
        c.drawLine(x, y, x + 6 + r() * 10, y, stroke("#FFD39A", 0.8, 0.7));
      }
    }, { opaque: true }),
  );
  out.push(
    layer(id, "orla", 0.7, -200, 2, (c, L) => {
      const r = rng(17);
      // calçada e areia ao fundo
      c.drawRect(R(L.left, -30, L.right - L.left, 32), vgrad(-30, 2, [[0, "#E9C99A"], [1, "#D9B27E"]]));
      // quiosques e palmeiras
      for (let x = Math.floor(L.left / 120) * 120; x < L.right; x += 120) {
        palm(c, x + 20, -26, 120 + r() * 50, (r() - 0.5) * 40, r);
        const kx = x + 70;
        c.drawRect(R(kx - 22, -58, 44, 30), fill("#F8FAFC"));
        c.drawPath(poly([[kx - 30, -58], [kx, -78], [kx + 30, -58]]), fill(["#DC2626", "#16A34A", "#2563EB"][Math.floor(r() * 3)]));
        c.drawRect(R(kx - 16, -50, 32, 10), fill("#1E293B"));
        c.drawLine(kx + 26, -28, kx + 26, -66, stroke("#475569", 1.4));
        c.drawCircle(kx + 26, -68, 3, glow("#FFE2A8", 3, 0.9));
      }
      // guarda-sóis
      for (let x = L.left; x < L.right; x += 45 + r() * 30) {
        const col = ["#F97316", "#FACC15", "#22C55E", "#3B82F6", "#EC4899"][Math.floor(r() * 5)];
        c.drawLine(x, -6, x + 2, -34, stroke("#F8FAFC", 1));
        c.drawArc(R(x - 16, -44, 36, 20), 180, 180, true, fill(col));
      }
    }),
  );
  out.push(
    layer(id, "crowd", 0.9, -70, 2, (c, L) => {
      const r = rng(23);
      const pal = ["#FACC15", "#22C55E", "#F97316", "#38BDF8", "#EC4899", "#F8FAFC", "#EF4444"];
      for (let x = L.left + 8; x < L.right; x += 16 + r() * 12) {
        if (Math.abs(x) < 60) continue;
        person(c, x, 0, 0.85 + r() * 0.15, r, pal, { cheer: true, dark: 0.25 });
      }
    }),
  );
  out[out.length - 1].bob = 0.8;
  out.push(
    layer(id, "floor", 1, -4, 60, (c, L) => {
      // calçadão de ondas pretas e brancas
      c.drawRect(R(L.left, -4, L.right - L.left, 64), fill("#F2EEE6"));
      const rows = floorRows(0, 60, 8);
      rows.forEach(([y0, y1]) => {
        const hh = y1 - y0;
        const wl = hh * 5;
        const pb = new CK.PathBuilder();
        pb.moveTo(L.left, y0 + hh * 0.5);
        for (let x = L.left; x < L.right; x += wl) {
          pb.quadTo(x + wl * 0.25, y0, x + wl * 0.5, y0 + hh * 0.5);
          pb.quadTo(x + wl * 0.75, y1, x + wl, y0 + hh * 0.5);
        }
        pb.lineTo(L.right, y1);
        pb.lineTo(L.left, y1);
        pb.close();
        c.drawPath(pb.detachAndDelete(), fill("#1F1F24"));
      });
      c.drawRect(R(L.left, -4, L.right - L.left, 64), vgrad(-4, 60, [[0, "#FF8A3D", 0.18], [1, "#000000", 0.2]]));
    }, { opaque: true }),
  );
  return { id, sky: ["#2B1055", "#FFD39A"], layers: out };
}

// ------------------------------------------------ ruínas na Amazônia

function templo() {
  const id = "templo";
  const out = [];
  out.push(
    layer(id, "sky", 0.15, -260, 10, (c, L) => {
      c.drawRect(R(L.left, L.top, L.right - L.left, L.bottom - L.top), vgrad(L.top, 0, [[0, "#0F3B2E"], [0.5, "#2F7A4F"], [1, "#B7D9A8"]]));
      c.drawCircle(80, -230, 60, glow("#F4FFD6", 30, 0.6));
      const r = rng(41);
      for (let k = 0; k < 40; k++) {
        const x = L.left + r() * (L.right - L.left);
        c.drawCircle(x, -40 - r() * 60, 30 + r() * 40, fill(mixHex("#1F5A3C", "#3E8A5A", r()), 0.9));
      }
      // cachoeira
      c.drawRect(R(-40, -200, 40, 200), vgrad(-200, 0, [[0, "#D9F5FF", 0.95], [1, "#8FD3E8", 0.9]]));
      for (let k = 0; k < 20; k++) c.drawLine(-38 + k * 2, -200, -38 + k * 2, 0, stroke("#FFFFFF", 0.6, 0.4 + r() * 0.4));
      c.drawOval(R(-70, -20, 100, 30), glow("#FFFFFF", 8, 0.8));
    }, { opaque: true }),
  );
  out.push(
    layer(id, "ruins", 0.7, -240, 2, (c, L) => {
      const r = rng(43);
      for (let x = Math.floor(L.left / 160) * 160; x < L.right; x += 160) {
        // pirâmide em degraus
        const w = 120;
        for (let k = 0; k < 5; k++) {
          c.drawRect(R(x - w / 2 + k * 10, -30 - k * 28, w - k * 20, 30), vgrad(-30 - k * 28, -k * 28, [[0, "#8C8A6A"], [1, "#5E5C45"]]));
          for (let b = 0; b < (w - k * 20) / 14; b++) c.drawLine(x - w / 2 + k * 10 + b * 14, -30 - k * 28, x - w / 2 + k * 10 + b * 14, -k * 28, stroke("#4A4836", 0.7, 0.7));
        }
        c.drawRect(R(x - 12, -170, 24, 30), fill("#2A291E"));
        // cipós e musgo
        for (let k = 0; k < 6; k++) {
          const vx = x - w / 2 + r() * w;
          const pb = new CK.PathBuilder();
          pb.moveTo(vx, -170 + r() * 40);
          pb.quadTo(vx + 8, -100, vx - 4, -20 - r() * 40);
          c.drawPath(pb.detachAndDelete(), stroke("#2F6B2F", 2));
        }
        c.drawOval(R(x - 70, -40, 50, 20), fill("#3E7A3A", 0.8));
      }
      // folhagem alta nas bordas de cada vão
      for (let x = L.left; x < L.right; x += 22) {
        const h = 14 + r() * 34;
        c.drawPath(poly([[x, 0], [x + 8, -h], [x + 16, 0]]), fill(mixHex("#1E5E2E", "#3F9A4A", r())));
      }
    }),
  );
  out.push(
    layer(id, "crowd", 0.9, -70, 2, (c, L) => {
      // vagalumes e folhas em primeiro plano baixo
      const r = rng(47);
      for (let x = L.left; x < L.right; x += 14) {
        const h = 20 + r() * 30;
        const pb = new CK.PathBuilder();
        pb.moveTo(x, 0);
        pb.quadTo(x + 6, -h, x + 14 + r() * 6, -h * 0.9);
        pb.quadTo(x + 8, -h * 0.4, x + 6, 0);
        c.drawPath(pb.detachAndDelete(), fill(mixHex("#174A24", "#2E7D3A", r())));
      }
      for (let k = 0; k < 60; k++) c.drawCircle(L.left + r() * (L.right - L.left), -10 - r() * 55, 1.2, glow("#EFFF8A", 2, 0.9));
    }),
  );
  out.push(
    layer(id, "floor", 1, -4, 60, (c, L) => {
      c.drawRect(R(L.left, -4, L.right - L.left, 64), vgrad(-4, 60, [[0, "#6F6B52"], [1, "#3F3D2E"]]));
      const r = rng(49);
      floorRows(0, 60, 7).forEach(([y0, y1], i) => {
        const hh = y1 - y0;
        const w = hh * 2.6;
        const off = (i % 2) * w * 0.5;
        for (let x = L.left - off; x < L.right; x += w) {
          c.drawRect(R(x + 0.8, y0 + 0.6, w - 1.6, hh - 1.2), fill(mixHex("#7D7860", "#55523F", r())));
          if (r() < 0.3) c.drawOval(R(x + r() * w * 0.6, y0, w * 0.4, hh * 0.6), fill("#4C7A3A", 0.7));
        }
      });
    }, { opaque: true }),
  );
  return { id, sky: ["#0F3B2E", "#B7D9A8"], layers: out };
}

// ----------------------------------------------- heliponto à noite

function telhado() {
  const id = "telhado";
  const out = [];
  out.push(
    layer(id, "sky", 0.1, -260, 10, (c, L) => {
      c.drawRect(R(L.left, L.top, L.right - L.left, L.bottom - L.top), vgrad(L.top, 0, [[0, "#020617"], [0.6, "#0F1E45"], [1, "#3B4C8C"]]));
      const r = rng(61);
      for (let k = 0; k < 160; k++) c.drawCircle(L.left + r() * (L.right - L.left), -255 + r() * 170, 0.3 + r() * 0.6, fill("#FFFFFF", 0.3 + r() * 0.6));
      // cidade lá embaixo: luzes
      for (let k = 0; k < 900; k++) c.drawCircle(L.left + r() * (L.right - L.left), -30 + r() * 38, 0.4 + r() * 0.6, fill(["#FFD88A", "#FFFFFF", "#FF7A59", "#9AD7FF"][Math.floor(r() * 4)], 0.5 + r() * 0.5));
      c.drawRect(R(L.left, -40, L.right - L.left, 12), vgrad(-40, -28, [[0, "#3B4C8C", 0], [1, "#F59E0B", 0.25]]));
    }, { opaque: true }),
  );
  out.push(
    layer(id, "towers", 0.45, -250, 2, (c, L) => {
      const r = rng(63);
      let x = L.left;
      while (x < L.right) {
        const w = 40 + r() * 50;
        const h = 120 + r() * 120;
        c.drawRect(R(x, -h, w, h + 2), vgrad(-h, 0, [[0, "#1A2246"], [1, "#0B1026"]]));
        for (let wy = -h + 8; wy < -6; wy += 10) for (let wx = x + 5; wx < x + w - 5; wx += 8) if (r() < 0.25) c.drawRect(R(wx, wy, 4, 5), fill("#FFE7A3", 0.7));
        c.drawCircle(x + w / 2, -h - 4, 2, glow("#FF3B3B", 2, 1));
        x += w + 20 + r() * 40;
      }
    }),
  );
  out.push(
    layer(id, "deck", 0.88, -120, 2, (c, L) => {
      // grade do heliponto e holofotes
      c.drawLine(L.left, -24, L.right, -24, stroke("#94A3B8", 1.6));
      for (let x = Math.floor(L.left / 14) * 14; x < L.right; x += 14) c.drawLine(x, -24, x, 0, stroke("#64748B", 1));
      for (let x = Math.floor(L.left / 180) * 180; x < L.right; x += 180) {
        c.drawRect(R(x - 4, -60, 8, 60), fill("#334155"));
        c.drawPath(poly([[x - 2, -60], [x + 2, -60], [x + 90, -260], [x - 40, -260]]), fill("#E0F2FE", 0.06));
        c.drawCircle(x, -62, 6, glow("#E0F2FE", 5, 0.9));
      }
      // luzes de pouso
      for (let x = Math.floor(L.left / 30) * 30; x < L.right; x += 30) c.drawCircle(x, -2, 1.6, glow("#22C55E", 2, 1));
    }),
  );
  out.push(
    layer(id, "floor", 1, -4, 60, (c, L) => {
      c.drawRect(R(L.left, -4, L.right - L.left, 64), vgrad(-4, 60, [[0, "#3A4152"], [1, "#1C2029"]]));
      const r = rng(67);
      for (let k = 0; k < 500; k++) c.drawCircle(L.left + r() * (L.right - L.left), r() * 60, 0.3, fill("#FFFFFF", 0.06));
      // o "H" e o círculo pintados no chão, em perspectiva
      c.drawOval(R(-120, 6, 240, 46), stroke("#F8FAFC", 3, 0.75));
      c.drawPath(poly([[-30, 12], [-20, 12], [-24, 48], [-38, 48]]), fill("#FACC15", 0.85));
      c.drawPath(poly([[20, 12], [30, 12], [38, 48], [24, 48]]), fill("#FACC15", 0.85));
      c.drawPath(poly([[-22, 27], [22, 27], [24, 33], [-24, 33]]), fill("#FACC15", 0.85));
      for (let x = Math.floor(L.left / 60) * 60; x < L.right; x += 60) c.drawRect(R(x, 1, 30, 2), fill("#F8FAFC", 0.4));
    }, { opaque: true }),
  );
  return { id, sky: ["#020617", "#3B4C8C"], layers: out };
}

// ------------------------------------------------ templo na neve

function neve() {
  const id = "neve";
  const out = [];
  out.push(
    layer(id, "sky", 0.12, -260, 10, (c, L) => {
      c.drawRect(R(L.left, L.top, L.right - L.left, L.bottom - L.top), vgrad(L.top, 0, [[0, "#7DA2D6"], [0.7, "#C9DAF2"], [1, "#EEF3FB"]]));
      const peaks = [[-300, -150], [-170, -200], [-40, -170], [90, -215], [230, -160], [330, -190]];
      for (const [x, h] of peaks) {
        c.drawPath(poly([[x - 140, 10], [x, h], [x + 140, 10]]), fill("#8BA3C7"));
        c.drawPath(poly([[x - 40, h + 45], [x, h], [x + 40, h + 45], [x + 18, h + 35], [x, h + 48], [x - 16, h + 34]]), fill("#F8FAFC"));
      }
      c.drawRect(R(L.left, -60, L.right - L.left, 70), vgrad(-60, 10, [[0, "#EEF3FB", 0], [1, "#EEF3FB", 0.9]]));
    }, { opaque: true }),
  );
  out.push(
    layer(id, "gate", 0.7, -230, 2, (c, L) => {
      const r = rng(71);
      for (let x = Math.floor(L.left / 200) * 200; x < L.right; x += 200) {
        // portal de templo
        const red = "#B91C1C";
        c.drawRect(R(x - 50, -150, 10, 150), fill(red));
        c.drawRect(R(x + 40, -150, 10, 150), fill(red));
        c.drawRect(R(x - 64, -160, 128, 10), fill("#1F1F24"));
        c.drawRect(R(x - 56, -135, 112, 7), fill(red));
        c.drawPath(poly([[x - 70, -160], [x - 64, -168], [x + 64, -168], [x + 70, -160]]), fill("#F8FAFC"));
        // lanternas de pedra e pinheiros
        c.drawRect(R(x + 80, -40, 10, 40), fill("#9CA3AF"));
        c.drawRect(R(x + 74, -52, 22, 12), fill("#6B7280"));
        c.drawRect(R(x + 80, -50, 10, 7), glow("#FFD38A", 2, 0.9));
        for (let k = 0; k < 2; k++) {
          const px = x - 110 + k * 26;
          for (let t = 0; t < 4; t++) c.drawPath(poly([[px - 20 + t * 4, -20 - t * 22], [px, -48 - t * 22], [px + 20 - t * 4, -20 - t * 22]]), fill(t % 2 ? "#2F5D50" : "#3B6E5E"));
          c.drawPath(poly([[px - 10, -60], [px, -70], [px + 10, -60]]), fill("#F8FAFC", 0.9));
        }
      }
      for (let k = 0; k < 160; k++) c.drawCircle(L.left + r() * (L.right - L.left), -230 + r() * 230, 0.6 + r() * 1.2, fill("#FFFFFF", 0.8));
    }),
  );
  out.push(
    layer(id, "crowd", 0.88, -60, 2, (c, L) => {
      const r = rng(73);
      for (let x = L.left + 10; x < L.right; x += 26 + r() * 12) {
        if (Math.abs(x) < 70) continue;
        // monges de manto
        const s = 0.8;
        const robe = ["#EA580C", "#B45309", "#9A3412"][Math.floor(r() * 3)];
        c.drawPath(poly([[x - 10 * s, 0], [x - 6 * s, -32 * s], [x + 6 * s, -32 * s], [x + 10 * s, 0]]), fill(robe));
        c.drawCircle(x, -38 * s, 6 * s, fill("#C68B59"));
      }
      c.drawRect(R(L.left, -4, L.right - L.left, 6), fill("#FFFFFF", 0.7));
    }),
  );
  out.push(
    layer(id, "floor", 1, -4, 60, (c, L) => {
      c.drawRect(R(L.left, -4, L.right - L.left, 64), vgrad(-4, 60, [[0, "#F8FAFC"], [1, "#C7D4E8"]]));
      const r = rng(79);
      for (let k = 0; k < 120; k++) {
        const x = L.left + r() * (L.right - L.left);
        const y = r() * 58;
        c.drawOval(R(x, y, 6 + y * 0.2, 2 + y * 0.05), fill("#A9B9D6", 0.35));
      }
    }, { opaque: true }),
  );
  return { id, sky: ["#7DA2D6", "#EEF3FB"], layers: out };
}

// ------------------------------------------------------ ringue

function ringue() {
  const id = "ringue";
  const out = [];
  out.push(
    layer(id, "sky", 0.2, -260, 10, (c, L) => {
      c.drawRect(R(L.left, L.top, L.right - L.left, L.bottom - L.top), vgrad(L.top, 0, [[0, "#05050A"], [1, "#1A1028"]]));
      // telão e treliça de luz
      c.drawRect(R(-90, -245, 180, 70), fill("#0F172A"));
      c.drawRect(R(-84, -240, 168, 60), vgrad(-240, -180, [[0, "#7C3AED"], [1, "#DB2777"]]));
      c.drawRect(R(L.left, -255, L.right - L.left, 6), fill("#1F2937"));
      for (let x = Math.floor(L.left / 60) * 60; x < L.right; x += 60) c.drawCircle(x, -246, 5, glow("#FFFFFF", 6, 0.8));
      // arquibancada lotada com luzes de celular
      const r = rng(83);
      for (let row = 0; row < 9; row++) {
        const y = -170 + row * 18;
        for (let x = L.left; x < L.right; x += 7 + r() * 4) {
          c.drawCircle(x, y, 3.5, fill(mixHex("#1F1830", "#3A2D52", r())));
          if (r() < 0.06) c.drawCircle(x + 1, y - 4, 1.2, glow("#FFFFFF", 1.5, 1));
        }
      }
    }, { opaque: true }),
  );
  out.push(
    layer(id, "cage", 0.85, -150, 2, (c, L) => {
      // alambrado do octógono
      c.drawRect(R(L.left, -120, L.right - L.left, 120), fill("#0B0B12", 0.25));
      for (let x = Math.floor(L.left / 8) * 8; x < L.right; x += 8) {
        c.drawLine(x, -120, x + 60, 0, stroke("#9CA3AF", 0.5, 0.35));
        c.drawLine(x, -120, x - 60, 0, stroke("#9CA3AF", 0.5, 0.35));
      }
      for (let x = Math.floor(L.left / 140) * 140; x < L.right; x += 140) {
        c.drawRect(R(x - 4, -130, 8, 130), vgrad(-130, 0, [[0, "#111827"], [1, "#374151"]]));
        c.drawRect(R(x - 6, -60, 12, 30), fill("#DC2626"));
      }
      c.drawRect(R(L.left, -124, L.right - L.left, 6), fill("#111827"));
      c.drawRect(R(L.left, -6, L.right - L.left, 8), fill("#111827"));
      // luz forte de cima
      c.drawPath(poly([[-160, -260], [160, -260], [260, 0], [-260, 0]]), fill("#FFFFFF", 0.05));
    }),
  );
  out.push(
    layer(id, "floor", 1, -4, 60, (c, L) => {
      c.drawRect(R(L.left, -4, L.right - L.left, 64), vgrad(-4, 60, [[0, "#E5E7EB"], [1, "#9CA3AF"]]));
      c.drawOval(R(-160, 4, 320, 52), fill("#DC2626", 0.25));
      c.drawOval(R(-70, 12, 140, 30), stroke("#111827", 2, 0.5));
      for (let k = 0; k < 6; k++) c.drawLine(-50 + k * 20, 20, -46 + k * 20, 36, stroke("#111827", 3, 0.35));
      c.drawRect(R(L.left, 50, L.right - L.left, 10), fill("#000000", 0.2));
    }, { opaque: true }),
  );
  return { id, sky: ["#05050A", "#1A1028"], layers: out };
}

// ------------------------------------------------------------------ saída

mkdirSync(OUT, { recursive: true });
const stages = [dojo(), pelourinho(), metro(), praia(), templo(), telhado(), neve(), ringue()];
const lines = [
  "/* eslint-disable */",
  "// GERADO por scripts/stages/paint-stages.mjs — não edite à mão.",
  "",
  'import type { StageArt } from "./stages";',
  "",
  "export const STAGE_ART: Record<string, StageArt> = {",
];
for (const s of stages) {
  lines.push(`  ${JSON.stringify(s.id)}: {`, `    sky: ${JSON.stringify(s.sky)},`, "    layers: [");
  for (const l of s.layers) {
    lines.push(
      `      { name: ${JSON.stringify(l.name)}, parallax: ${l.parallax}, x: ${l.x.toFixed(1)}, y: ${l.y}, w: ${l.w.toFixed(1)}, h: ${l.h}, pw: ${l.pw}, ph: ${l.ph}, bob: ${l.bob}, module: require("../../assets/stages/${l.file}") },`,
    );
  }
  lines.push("    ],", "  },");
}
lines.push("};", "");
writeFileSync(path.join(root, "src/game/stages.generated.ts"), lines.join("\n"));
for (const s of stages) console.log(`${s.id}: ${s.layers.map((l) => l.file).join(", ")}`);
