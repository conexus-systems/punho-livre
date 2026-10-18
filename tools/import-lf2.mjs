// Converte os dados do LF2 (formato F.LF: módulos AMD com objetos JS) num
// pacote que o jogo carrega direto do disco, inclusive por file:// e no APK:
//   assets/data.js        window.LF2_DATA com objetos, cenários, interface e sons
//   assets/sound-ogg.js   trilha de sons em base64 (e sound-mp3.js de reserva)
//   assets/sprite|bg|UI   imagens; o preto vira transparente onde o LF2 espera
//
// Os arquivos de dados são lidos como literais (tools/literal.mjs), nunca executados.
//
// Uso: node tools/import-lf2.mjs <pasta LF2_19> <pasta de saída>
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import zlib from 'node:zlib';
import { parseDefine, parseLiteral } from './literal.mjs';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('Uso: node tools/import-lf2.mjs <pasta LF2_19> <pasta de saída>');
  process.exit(1);
}

const read = (file) => readFileSync(join(src, file), 'utf8');

// ---- dados ----

const manifest = parseDefine(read('data/data.js'));
const objects = manifest.object.map((o) => ({ ...o }));

for (const o of objects) o.data = parseDefine(read(o.file));

const backgrounds = manifest.background
  .filter((b) => !/template/i.test(b.file))
  .map((b) => ({ id: b.id, name: b.name, data: parseDefine(read(b.file)) }));
const ui = parseDefine(read(manifest.UI.file));
const soundpack = parseDefine(read(manifest.sound[0].file));

// properties.js define uma função que preenche ID[n] = {...}
const properties = {};
const propText = read(manifest.properties.file);
for (const m of propText.matchAll(/ID\s*\[\s*(\d+)\s*\]\s*=\s*\{/g)) {
  properties[m[1]] = parseLiteral(propText, m.index + m[0].length - 1).value;
}

// ---- imagens ----

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = zlib.crc32 || ((buf) => {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
});

function chunks(png) {
  const list = [];
  for (let p = 8; p < png.length;) {
    const len = png.readUInt32BE(p);
    list.push({ type: png.toString('ascii', p + 4, p + 8), data: png.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  return list;
}

function encodeChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

// Marca o preto (0,0,0) como transparente acrescentando um bloco tRNS,
// sem decodificar os pixels. Imagens com canal alfa ficam como estão.
function blackToTransparent(png) {
  const list = chunks(png);
  const colorType = list.find((c) => c.type === 'IHDR').data[9];
  let trns = null;
  if (colorType === 3) {
    const plte = list.find((c) => c.type === 'PLTE').data;
    const old = list.find((c) => c.type === 'tRNS');
    const n = plte.length / 3;
    const alpha = Buffer.alloc(n, 255);
    if (old) old.data.copy(alpha);
    let any = false;
    for (let i = 0; i < n; i++) {
      if (plte[i * 3] === 0 && plte[i * 3 + 1] === 0 && plte[i * 3 + 2] === 0) { alpha[i] = 0; any = true; }
    }
    if (!any) return png;
    trns = alpha;
  } else if (colorType === 2) {
    if (list.some((c) => c.type === 'tRNS')) return png;
    trns = Buffer.alloc(6);
  } else {
    return png;
  }
  const parts = [png.subarray(0, 8)];
  for (const c of list) {
    if (c.type === 'tRNS') continue;
    if (c.type === 'IDAT' && trns) { parts.push(encodeChunk('tRNS', trns)); trns = null; }
    parts.push(encodeChunk(c.type, c.data));
  }
  return Buffer.concat(parts);
}

const images = new Map(); // caminho -> precisa de transparência
const addImage = (rel, transparent) => { if (rel) images.set(rel, images.get(rel) || transparent); };

for (const o of objects) {
  const bmp = o.data.bmp;
  for (const f of bmp.file) {
    for (const k in f) if (k.startsWith('file') && typeof f[k] === 'string') addImage(f[k], true);
  }
  addImage(bmp.head, false);
  addImage(bmp.small, false);
}
for (const b of backgrounds) {
  addImage(b.data.shadow, true);
  for (const l of b.data.layer) if (l.pic && !l.rect) addImage(l.pic, l.transparency === 1);
}
for (const f of readdirSync(join(src, 'UI'))) if (f.endsWith('.png')) addImage('UI/' + f, false);

for (const [rel, transparent] of images) {
  const to = join(out, rel);
  mkdirSync(dirname(to), { recursive: true });
  const png = readFileSync(join(src, rel));
  writeFileSync(to, transparent ? blackToTransparent(png) : png);
}

// ---- sons ----

mkdirSync(out, { recursive: true });
const sounds = {};
for (const [k, v] of Object.entries(soundpack.sound)) sounds[k] = [v.start, v.end - v.start];
for (const ext of ['ogg', 'mp3']) {
  const file = join(src, soundpack.file + '.' + ext);
  if (!existsSync(file)) continue;
  const b64 = readFileSync(file).toString('base64');
  writeFileSync(join(out, `sound-${ext}.js`), `window.LF2_SOUND_${ext.toUpperCase()}="${b64}";\n`);
}

const bundle = {
  objects: objects.map((o) => ({ id: o.id, type: o.type, name: o.name || o.data.bmp.name || '', AI: o.AI, data: o.data })),
  backgrounds,
  ui,
  properties,
  sounds,
};
writeFileSync(join(out, 'data.js'), 'window.LF2_DATA=' + JSON.stringify(bundle) + ';\n');
console.log(`${objects.length} objetos, ${backgrounds.length} cenários, ${images.size} imagens, ${Object.keys(sounds).length} sons -> ${out}`);
