// Rasterizador mínimo (sem dependências) usado para gerar os sprites do elenco
// nativo: formas por distância com sinal (círculo, cápsula, polígono), contorno,
// sombreamento simples e encoder PNG.

import { deflateSync } from "node:zlib";

export function hex(c) {
  const v = c.replace("#", "");
  return [Number.parseInt(v.slice(0, 2), 16), Number.parseInt(v.slice(2, 4), 16), Number.parseInt(v.slice(4, 6), 16)];
}

export function shade([r, g, b], f) {
  const k = (x) => Math.max(0, Math.min(255, Math.round(f >= 1 ? x + (255 - x) * (f - 1) : x * f)));
  return [k(r), k(g), k(b)];
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Float32Array(w * h * 4); // RGBA pré-multiplicado 0..1
  }

  // sdf(x, y) → distância (negativa dentro); color(x, y, d) → [r,g,b,a 0..1]
  fill(bbox, sdf, color) {
    const x0 = Math.max(0, Math.floor(bbox[0] - 2));
    const y0 = Math.max(0, Math.floor(bbox[1] - 2));
    const x1 = Math.min(this.w - 1, Math.ceil(bbox[2] + 2));
    const y1 = Math.min(this.h - 1, Math.ceil(bbox[3] + 2));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = sdf(x + 0.5, y + 0.5);
        const cov = clamp01(0.5 - d);
        if (cov <= 0) continue;
        const [r, g, b, a = 1] = color(x + 0.5, y + 0.5, d);
        const alpha = a * cov;
        const i = (y * this.w + x) * 4;
        const inv = 1 - alpha;
        this.px[i] = (r / 255) * alpha + this.px[i] * inv;
        this.px[i + 1] = (g / 255) * alpha + this.px[i + 1] * inv;
        this.px[i + 2] = (b / 255) * alpha + this.px[i + 2] * inv;
        this.px[i + 3] = alpha + this.px[i + 3] * inv;
      }
    }
  }

  // Copia outro canvas para (dx, dy).
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const si = (y * src.w + x) * 4;
        const di = ((y + dy) * this.w + (x + dx)) * 4;
        for (let k = 0; k < 4; k++) this.px[di + k] = src.px[si + k];
      }
    }
  }

  /** Bounding box dos pixels não transparentes, ou null. */
  bounds() {
    let minX = this.w, minY = this.h, maxX = -1, maxY = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.px[(y * this.w + x) * 4 + 3] > 0.01) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return maxX < 0 ? null : [minX, minY, maxX, maxY];
  }

  crop(x0, y0, x1, y1) {
    const out = new Canvas(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        const si = ((y + y0) * this.w + (x + x0)) * 4;
        const di = (y * out.w + x) * 4;
        for (let k = 0; k < 4; k++) out.px[di + k] = this.px[si + k];
      }
    }
    return out;
  }

  toPNG() {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        const a = this.px[i + 3];
        const o = y * (this.w * 4 + 1) + 1 + x * 4;
        const un = (v) => (a > 0 ? Math.round(Math.min(1, v / a) * 255) : 0);
        raw[o] = un(this.px[i]);
        raw[o + 1] = un(this.px[i + 1]);
        raw[o + 2] = un(this.px[i + 2]);
        raw[o + 3] = Math.round(a * 255);
      }
    }
    return encodePNG(this.w, this.h, raw);
  }
}

// ------------------------------------------------------------ formas

export function sdCircle(cx, cy, r) {
  return (x, y) => Math.hypot(x - cx, y - cy) - r;
}

// Cápsula com raio variando de r1 (em a) a r2 (em b).
export function sdCapsule(ax, ay, bx, by, r1, r2 = r1) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-6;
  return (x, y) => {
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / len2);
    const px = ax + dx * t;
    const py = ay + dy * t;
    return Math.hypot(x - px, y - py) - (r1 + (r2 - r1) * t);
  };
}

// Polígono convexo (pontos em sentido horário na tela).
export function sdPolygon(points) {
  const edges = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const ex = q[0] - p[0];
    const ey = q[1] - p[1];
    const len = Math.hypot(ex, ey) || 1;
    return [p[0], p[1], ey / len, -ex / len];
  });
  return (x, y) => {
    let d = -Infinity;
    for (const [px, py, nx, ny] of edges) d = Math.max(d, (x - px) * nx + (y - py) * ny);
    return d;
  };
}

export function sdEllipse(cx, cy, rx, ry) {
  return (x, y) => {
    const k = Math.hypot((x - cx) / rx, (y - cy) / ry);
    return (k - 1) * Math.min(rx, ry);
  };
}

export function bboxOfPoints(points, pad) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

// ------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePNG(w, h, rawWithFilterBytes, colorType = 6) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rawWithFilterBytes, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** RGBA (Uint8, sem bytes de filtro) → PNG. */
export function rgbaToPNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) : raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  return encodePNG(w, h, raw);
}

// ------------------------------------------------------------ atlas

// Empacotamento em prateleiras. items: [{key, canvas}] → {pages:[Canvas], places:{key:[x,y,page]}}
export function packAtlas(items, maxSize = 2048, pad = 2) {
  const sorted = [...items].sort((a, b) => b.canvas.h - a.canvas.h);
  const pages = [];
  const places = {};
  let page = null;
  let x = pad, y = pad, shelf = 0;
  const pageLayouts = [];
  let layout = null;
  for (const it of sorted) {
    const { w, h } = it.canvas;
    if (!layout || x + w + pad > maxSize) {
      if (layout && y + shelf + h + pad * 2 <= maxSize) {
        y += shelf + pad;
        x = pad;
        shelf = 0;
      } else {
        layout = { items: [], width: 0, height: 0 };
        pageLayouts.push(layout);
        x = pad;
        y = pad;
        shelf = 0;
      }
    }
    if (x + w + pad > maxSize) {
      // linha nova
      y += shelf + pad;
      x = pad;
      shelf = 0;
    }
    layout.items.push({ it, x, y });
    places[it.key] = [x, y, pageLayouts.length - 1];
    layout.width = Math.max(layout.width, x + w + pad);
    layout.height = Math.max(layout.height, y + h + pad);
    x += w + pad;
    shelf = Math.max(shelf, h);
  }
  for (const l of pageLayouts) {
    page = new Canvas(Math.max(1, l.width), Math.max(1, l.height));
    for (const { it, x: px, y: py } of l.items) page.blit(it.canvas, px, py);
    pages.push(page);
  }
  return { pages, places };
}
