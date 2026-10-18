// node --test scripts/__tests__
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { decodePng, readAct, readSff, __test } from "../lib/sff.mjs";
import { buildPack } from "../mugen-pack.mjs";
import { rgbaToPNG } from "../roster/raster.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------ encoders de teste

function pcx(w, h, pixels, pal) {
  const head = Buffer.alloc(128);
  head[0] = 10; head[1] = 5; head[2] = 1; head[3] = 8;
  head.writeUInt16LE(0, 4); head.writeUInt16LE(0, 6);
  head.writeUInt16LE(w - 1, 8); head.writeUInt16LE(h - 1, 10);
  head[65] = 1; head.writeUInt16LE(w, 66);
  const body = [];
  for (let i = 0; i < w * h; ) {
    let n = 1;
    while (n < 63 && i + n < w * h && (i + n) % w !== 0 && pixels[i + n] === pixels[i]) n++;
    if (n > 1 || (pixels[i] & 0xc0) === 0xc0) body.push(0xc0 | n, pixels[i]);
    else body.push(pixels[i]);
    i += n;
  }
  return Buffer.concat([head, Buffer.from(body), Buffer.from([0x0c]), Buffer.from(pal)]);
}

function sffV1(sprites) {
  const header = Buffer.alloc(512);
  header.write("ElecbyteSpr\0", 0, "latin1");
  header[12] = 0; header[13] = 1; header[14] = 0; header[15] = 1;
  header.writeUInt32LE(1, 16);
  header.writeUInt32LE(sprites.length, 20);
  header.writeUInt32LE(512, 24);
  header.writeUInt32LE(32, 28);
  const chunks = [header];
  let offset = 512;
  sprites.forEach((s, n) => {
    const data = pcx(s.w, s.h, s.pixels, s.pal);
    const sub = Buffer.alloc(32);
    const next = n === sprites.length - 1 ? 0 : offset + 32 + data.length;
    sub.writeUInt32LE(next, 0);
    sub.writeUInt32LE(data.length, 4);
    sub.writeInt16LE(s.axisX, 8); sub.writeInt16LE(s.axisY, 10);
    sub.writeUInt16LE(s.group, 12); sub.writeUInt16LE(s.index, 14);
    sub[18] = s.samePal ? 1 : 0;
    chunks.push(sub, data);
    offset += 32 + data.length;
  });
  return Buffer.concat(chunks);
}

function rle8Encode(px) {
  const out = [];
  for (let i = 0; i < px.length; ) {
    let n = 1;
    while (n < 63 && i + n < px.length && px[i + n] === px[i]) n++;
    if (n > 1 || (px[i] & 0xc0) === 0x40) out.push(0x40 | n, px[i]);
    else out.push(px[i]);
    i += n;
  }
  return Buffer.from(out);
}

function sffV2(sprites, pal) {
  const header = Buffer.alloc(72);
  header.write("ElecbyteSpr\0", 0, "latin1");
  header[15] = 2;
  const palHeaders = Buffer.alloc(16);
  palHeaders.writeUInt16LE(1, 0); palHeaders.writeUInt16LE(1, 2); palHeaders.writeUInt16LE(256, 4);
  palHeaders.writeUInt32LE(0, 8); palHeaders.writeUInt32LE(1024, 12);
  const palData = Buffer.alloc(1024);
  for (let i = 0; i < 256; i++) { palData[i * 4] = pal[i * 3]; palData[i * 4 + 1] = pal[i * 3 + 1]; palData[i * 4 + 2] = pal[i * 3 + 2]; }
  const datas = [palData];
  let ldataLen = 1024;
  const sprHeaders = Buffer.alloc(28 * sprites.length);
  sprites.forEach((s, n) => {
    let data;
    if (s.fmt === 0) data = Buffer.from(s.pixels);
    else if (s.fmt === 2) { const size = Buffer.alloc(4); size.writeUInt32LE(s.pixels.length); data = Buffer.concat([size, rle8Encode(s.pixels)]); }
    else if (s.fmt === 12) { const size = Buffer.alloc(4); size.writeUInt32LE(s.w * s.h * 4); data = Buffer.concat([size, rgbaToPNG(s.w, s.h, Buffer.from(s.rgba))]); }
    const o = n * 28;
    sprHeaders.writeUInt16LE(s.group, o); sprHeaders.writeUInt16LE(s.index, o + 2);
    sprHeaders.writeUInt16LE(s.w, o + 4); sprHeaders.writeUInt16LE(s.h, o + 6);
    sprHeaders.writeInt16LE(s.axisX, o + 8); sprHeaders.writeInt16LE(s.axisY, o + 10);
    sprHeaders[o + 14] = s.fmt; sprHeaders[o + 15] = 8;
    sprHeaders.writeUInt32LE(ldataLen, o + 16); sprHeaders.writeUInt32LE(data.length, o + 20);
    datas.push(data);
    ldataLen += data.length;
  });
  const sprOff = 72;
  const palOff = sprOff + sprHeaders.length;
  const ldataOff = palOff + 16;
  header.writeUInt32LE(sprOff, 36); header.writeUInt32LE(sprites.length, 40);
  header.writeUInt32LE(palOff, 44); header.writeUInt32LE(1, 48);
  header.writeUInt32LE(ldataOff, 52); header.writeUInt32LE(ldataLen, 56);
  header.writeUInt32LE(ldataOff + ldataLen, 60);
  return Buffer.concat([header, sprHeaders, palHeaders, ...datas]);
}

const pal = new Uint8Array(768);
for (let i = 0; i < 256; i++) { pal[i * 3] = i; pal[i * 3 + 1] = 255 - i; pal[i * 3 + 2] = (i * 7) & 255; }
const box = (w, h, color) => Uint8Array.from({ length: w * h }, (_, i) => (i % w < 2 ? 0 : color));

test("SFF v1 (PCX): índice 0 transparente, eixo e paleta", () => {
  const buf = sffV1([
    { group: 0, index: 0, w: 10, h: 12, axisX: 5, axisY: 12, pixels: box(10, 12, 200), pal, samePal: false },
    { group: 20, index: 1, w: 8, h: 8, axisX: 4, axisY: 8, pixels: box(8, 8, 50), pal, samePal: true },
  ]);
  const sprites = readSff(buf);
  assert.equal(sprites.length, 2);
  const [a, b] = sprites;
  assert.deepEqual([a.group, a.index, a.w, a.h, a.axisX, a.axisY], [0, 0, 10, 12, 5, 12]);
  assert.equal(a.rgba[3], 0); // x=0 é índice 0
  assert.deepEqual([...a.rgba.subarray(8, 12)], [200, 55, (200 * 7) & 255, 255]);
  assert.deepEqual([...b.rgba.subarray(8, 12)], [50, 205, (50 * 7) & 255, 255]);
});

test("SFF v1 com .act: paleta invertida aplicada aos sprites compartilhados", () => {
  const act = Buffer.alloc(768);
  for (let i = 0; i < 256; i++) { act[(255 - i) * 3] = 9; act[(255 - i) * 3 + 1] = i; act[(255 - i) * 3 + 2] = 1; }
  const p = readAct(act);
  assert.deepEqual([p[30 * 3], p[30 * 3 + 1]], [9, 30]);
  const buf = sffV1([{ group: 0, index: 0, w: 4, h: 4, axisX: 0, axisY: 0, pixels: box(4, 4, 30), pal, samePal: false }]);
  const [s] = readSff(buf, p);
  assert.deepEqual([...s.rgba.subarray(8, 11)], [9, 30, 1]);
});

test("SFF v2: raw, RLE8 e PNG32", () => {
  const rgba = new Uint8Array(3 * 2 * 4).fill(0);
  rgba.set([10, 20, 30, 255], 4);
  const buf = sffV2([
    { group: 0, index: 0, w: 6, h: 5, axisX: 3, axisY: 5, fmt: 0, pixels: box(6, 5, 77) },
    { group: 0, index: 1, w: 6, h: 5, axisX: 3, axisY: 5, fmt: 2, pixels: box(6, 5, 99) },
    { group: 5, index: 0, w: 3, h: 2, axisX: 1, axisY: 2, fmt: 12, rgba },
  ], pal);
  const s = readSff(buf);
  assert.equal(s.length, 3);
  assert.deepEqual([...s[0].rgba.subarray(8, 12)], [77, 178, (77 * 7) & 255, 255]);
  assert.deepEqual([...s[1].rgba.subarray(8, 12)], [99, 156, (99 * 7) & 255, 255]);
  assert.deepEqual([...s[2].rgba.subarray(4, 8)], [10, 20, 30, 255]);
});

test("PNG: filtros decodificados", () => {
  const w = 5, h = 4;
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 37) & 255;
  const png = decodePng(rgbaToPNG(w, h, rgba));
  assert.deepEqual(Buffer.from(png.data), rgba);
});

test("RLE5 e LZ5 decodificam fluxos literais simples", () => {
  // RLE5: run=3 (4 pixels), dl=0 com cor 7
  assert.deepEqual([...__test.rle5(Buffer.from([3, 0x80, 7]), 4)], [7, 7, 7, 7]);
  // LZ5: controle 0 (só pacotes de cor), pacote curto: n = d>>5, cor = d & 0x1f
  assert.deepEqual([...__test.lz5(Buffer.from([0x00, (3 << 5) | 5, (2 << 5) | 9]), 5)], [5, 5, 5, 9, 9]);
});

test("pack completo a partir de uma pasta MUGEN", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mugen-pack-"));
  const src = path.join(here, "../../characters/kaze");
  for (const f of ["kaze.cmd", "kaze.cns", "kaze.air"]) cpSync(path.join(src, f), path.join(dir, f));
  const def = readFileSync(path.join(src, "kaze.def"), "utf8").replace("anim = kaze.air", "anim = kaze.air\nsprite = kaze.sff");
  writeFileSync(path.join(dir, "kaze.def"), def);
  writeFileSync(path.join(dir, "kaze.sff"), sffV1([
    { group: 0, index: 0, w: 10, h: 12, axisX: 5, axisY: 12, pixels: box(10, 12, 200), pal, samePal: false },
    { group: 7777, index: 0, w: 8, h: 8, axisX: 4, axisY: 8, pixels: box(8, 8, 50), pal, samePal: true },
  ]));
  const pack = buildPack(dir, { id: "kaze-test" });
  assert.equal(pack.format, "mugen-arena-pack/1");
  assert.equal(pack.id, "kaze-test");
  assert.deepEqual(Object.keys(pack.files).sort(), ["kaze.air", "kaze.cmd", "kaze.cns", "kaze.def"]);
  // só o sprite 0,0 é usado pelo .air (7777 não)
  assert.deepEqual(Object.keys(pack.sprites.frames), ["0,0"]);
  assert.match(pack.sprites.atlas[0], /^data:image\/png;base64,/);
});
