// Leitor de SFF (sprites do MUGEN), versões 1.01 (WinMUGEN, PCX) e 2.0x (MUGEN 1.x).
// Saída: [{ group, index, axisX, axisY, w, h, rgba: Uint8Array }]
//
// Formatos SFF v2 suportados: raw, RLE8, RLE5, LZ5, PNG8/24/32.
// A decodificação de RLE5/LZ5 segue a implementação de referência do Ikemen GO.

import { inflateSync } from "node:zlib";

const SIGNATURE = "ElecbyteSpr\0";

// ---------------------------------------------------------- paletas

/** Arquivo .act do MUGEN: 256 cores RGB gravadas em ordem invertida. */
export function readAct(buf) {
  const pal = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const src = (255 - i) * 3;
    pal[i * 3] = buf[src];
    pal[i * 3 + 1] = buf[src + 1];
    pal[i * 3 + 2] = buf[src + 2];
  }
  return pal;
}

function indexedToRgba(pixels, w, h, pal) {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const c = pixels[i];
    if (c === 0) continue; // índice 0 = transparente
    out[i * 4] = pal[c * 3];
    out[i * 4 + 1] = pal[c * 3 + 1];
    out[i * 4 + 2] = pal[c * 3 + 2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

// --------------------------------------------------------------- PCX

function decodePcx(buf) {
  const xmin = buf.readUInt16LE(4);
  const ymin = buf.readUInt16LE(6);
  const xmax = buf.readUInt16LE(8);
  const ymax = buf.readUInt16LE(10);
  const bpl = buf.readUInt16LE(66);
  const w = xmax - xmin + 1;
  const h = ymax - ymin + 1;
  const pixels = new Uint8Array(w * h);
  let i = 128;
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < bpl) {
      let c = buf[i++];
      let n = 1;
      if ((c & 0xc0) === 0xc0) {
        n = c & 0x3f;
        c = buf[i++];
      }
      for (let k = 0; k < n && x < bpl; k++, x++) if (x < w) pixels[y * w + x] = c;
    }
  }
  let pal = null;
  if (buf.length >= 769 && buf[buf.length - 769] === 0x0c) {
    pal = new Uint8Array(buf.subarray(buf.length - 768));
  }
  return { w, h, pixels, pal };
}

function readSffV1(buf, act) {
  const count = buf.readUInt32LE(20);
  let offset = buf.readUInt32LE(24);
  const sprites = [];
  let prevPal = null;
  for (let n = 0; n < count && offset > 0 && offset < buf.length; n++) {
    const next = buf.readUInt32LE(offset);
    const length = buf.readUInt32LE(offset + 4);
    const axisX = buf.readInt16LE(offset + 8);
    const axisY = buf.readInt16LE(offset + 10);
    const group = buf.readUInt16LE(offset + 12);
    const index = buf.readUInt16LE(offset + 14);
    const linked = buf.readUInt16LE(offset + 16);
    const samePal = buf[offset + 18] === 1;
    if (length === 0) {
      const src = sprites[linked];
      if (src) sprites.push({ ...src, group, index, axisX, axisY });
    } else {
      const pcx = decodePcx(buf.subarray(offset + 32, offset + 32 + length));
      let pal = samePal && prevPal ? prevPal : (pcx.pal ?? prevPal);
      // a paleta do personagem (.act) vale para os sprites de paleta compartilhada
      if (act && (samePal || (group === 0 && index === 0))) pal = act;
      if (!samePal && pcx.pal) prevPal = pcx.pal;
      if (pal) sprites.push({ group, index, axisX, axisY, w: pcx.w, h: pcx.h, rgba: indexedToRgba(pcx.pixels, pcx.w, pcx.h, pal) });
    }
    offset = next;
  }
  return sprites;
}

// -------------------------------------------------------- SFF v2

function rle8(src, size) {
  const out = new Uint8Array(size);
  let i = 0;
  let j = 0;
  while (j < size && i < src.length) {
    let c = src[i++];
    let n = 1;
    if ((c & 0xc0) === 0x40) {
      n = c & 0x3f;
      c = src[i++];
    }
    for (let k = 0; k < n && j < size; k++) out[j++] = c;
  }
  return out;
}

function rle5(src, size) {
  const out = new Uint8Array(size);
  let i = 0;
  let j = 0;
  while (j < size && i < src.length) {
    let rl = src[i++];
    let dl = src[i] & 0x7f;
    let c = 0;
    if (src[i] >> 7 !== 0) {
      i++;
      c = src[i];
    }
    i++;
    for (;;) {
      if (j < size) out[j++] = c;
      rl--;
      if (rl < 0) {
        dl--;
        if (dl < 0) break;
        c = src[i] & 0x1f;
        rl = src[i] >> 5;
        i++;
      }
    }
  }
  return out;
}

function lz5(src, size) {
  const out = new Uint8Array(size);
  const last = src.length - 1;
  let i = 0;
  let j = 0;
  let n = 0;
  let ct = src[i];
  let cts = 0;
  let rb = 0;
  let rbc = 0;
  if (i < last) i++;
  while (j < size) {
    let d = src[i];
    if (i < last) i++;
    if (ct & (1 << cts)) {
      if ((d & 0x3f) === 0) {
        d = ((d << 2) | src[i]) + 1;
        if (i < last) i++;
        n = src[i] + 2;
        if (i < last) i++;
      } else {
        rb |= (d & 0xc0) >> rbc;
        rbc += 2;
        n = d & 0x3f;
        if (rbc < 8) {
          d = src[i] + 1;
          if (i < last) i++;
        } else {
          d = rb + 1;
          rb = 0;
          rbc = 0;
        }
      }
      for (;;) {
        if (j < size) {
          out[j] = out[j - d] ?? 0;
          j++;
        }
        n--;
        if (n < 0) break;
      }
    } else {
      if ((d & 0xe0) === 0) {
        n = src[i] + 8;
        if (i < last) i++;
      } else {
        n = d >> 5;
        d &= 0x1f;
      }
      for (; n > 0; n--) if (j < size) out[j++] = d;
    }
    cts++;
    if (cts >= 8) {
      ct = src[i];
      cts = 0;
      if (i < last) i++;
    }
  }
  return out;
}

// --------------------------------------------------------------- PNG

/** Decodifica PNG (8 bits; tipos 0, 2, 3, 4, 6). Retorna {w, h, type, data (por pixel), plte}. */
export function decodePng(buf) {
  let off = 8;
  let w = 0;
  let h = 0;
  let depth = 8;
  let type = 6;
  let plte = null;
  let trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (kind === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
    } else if (kind === "PLTE") plte = new Uint8Array(data);
    else if (kind === "tRNS") trns = new Uint8Array(data);
    else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`PNG com ${depth} bits por canal não suportado`);
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return { w, h, type, bpp, data: out, plte, trns };
}

export function pngToRgba(png, palOverride) {
  const { w, h, type, data } = png;
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (type === 3) {
      const c = data[i];
      const pal = palOverride ?? png.plte;
      if (c === 0 && palOverride) continue;
      out[i * 4] = pal[c * 3];
      out[i * 4 + 1] = pal[c * 3 + 1];
      out[i * 4 + 2] = pal[c * 3 + 2];
      out[i * 4 + 3] = palOverride ? 255 : (png.trns?.[c] ?? 255);
    } else if (type === 2) {
      out.set([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 255], i * 4);
    } else if (type === 6) {
      out.set(data.subarray(i * 4, i * 4 + 4), i * 4);
    } else if (type === 0) {
      out.set([data[i], data[i], data[i], 255], i * 4);
    } else if (type === 4) {
      out.set([data[i * 2], data[i * 2], data[i * 2], data[i * 2 + 1]], i * 4);
    }
  }
  return out;
}

function readSffV2(buf, act) {
  const spriteOff = buf.readUInt32LE(36);
  const spriteCount = buf.readUInt32LE(40);
  const palOff = buf.readUInt32LE(44);
  const palCount = buf.readUInt32LE(48);
  const ldata = buf.readUInt32LE(52);
  const tdata = buf.readUInt32LE(60);

  const palettes = [];
  for (let n = 0; n < palCount; n++) {
    const o = palOff + n * 16;
    const numColors = buf.readUInt16LE(o + 4);
    const link = buf.readUInt16LE(o + 6);
    const dataOff = buf.readUInt32LE(o + 8);
    const len = buf.readUInt32LE(o + 12);
    if (len === 0 && palettes[link]) {
      palettes.push(palettes[link]);
      continue;
    }
    const pal = new Uint8Array(256 * 3);
    for (let c = 0; c < Math.min(256, numColors); c++) {
      pal[c * 3] = buf[ldata + dataOff + c * 4];
      pal[c * 3 + 1] = buf[ldata + dataOff + c * 4 + 1];
      pal[c * 3 + 2] = buf[ldata + dataOff + c * 4 + 2];
    }
    palettes.push(pal);
  }
  // a paleta 1,1 do personagem pode ser trocada pelo .act escolhido
  if (act && palettes.length > 0) palettes[0] = act;

  const sprites = [];
  for (let n = 0; n < spriteCount; n++) {
    const o = spriteOff + n * 28;
    const group = buf.readUInt16LE(o);
    const index = buf.readUInt16LE(o + 2);
    const w = buf.readUInt16LE(o + 4);
    const h = buf.readUInt16LE(o + 6);
    const axisX = buf.readInt16LE(o + 8);
    const axisY = buf.readInt16LE(o + 10);
    const link = buf.readUInt16LE(o + 12);
    const fmt = buf[o + 14];
    const dataOff = buf.readUInt32LE(o + 16);
    const len = buf.readUInt32LE(o + 20);
    const palIndex = buf.readUInt16LE(o + 24);
    const flags = buf.readUInt16LE(o + 26);
    if (len === 0) {
      const src = sprites[link];
      sprites.push(src ? { ...src, group, index, axisX, axisY } : null);
      continue;
    }
    const base = (flags & 1 ? tdata : ldata) + dataOff;
    const pal = palettes[palIndex] ?? palettes[0];
    try {
      let rgba;
      if (fmt === 0) {
        rgba = indexedToRgba(buf.subarray(base, base + w * h), w, h, pal);
      } else if (fmt >= 10) {
        const png = decodePng(buf.subarray(base + 4, base + len));
        rgba = pngToRgba(png, fmt === 10 ? pal : null);
      } else {
        const size = buf.readUInt32LE(base);
        const src = buf.subarray(base + 4, base + len);
        const px = fmt === 2 ? rle8(src, size) : fmt === 3 ? rle5(src, size) : fmt === 4 ? lz5(src, size) : null;
        if (!px) throw new Error(`formato ${fmt}`);
        rgba = indexedToRgba(px, w, h, pal);
      }
      sprites.push({ group, index, axisX, axisY, w, h, rgba });
    } catch (err) {
      console.warn(`sprite ${group},${index}: ${err.message} — ignorado`);
      sprites.push(null);
    }
  }
  return sprites.filter(Boolean);
}

export function readSff(buf, act = null) {
  if (buf.toString("latin1", 0, 12) !== SIGNATURE) throw new Error("não é um arquivo SFF");
  const major = buf[15];
  if (major === 1) return readSffV1(buf, act);
  if (major === 2) return readSffV2(buf, act);
  throw new Error(`SFF versão ${major} não suportada`);
}

export const __test = { rle8, rle5, lz5, decodePcx };
