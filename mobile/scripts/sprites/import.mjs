#!/usr/bin/env node
// Importa sprites de arte final (PNGs + manifest.json) para o formato do elenco:
// .def/.air/.cns/.cmd + atlas WebP (sprites.json + spritesN.webp) + meta.json, e
// opcionalmente um pack `mugen-arena-pack/1` pronto para o app/backend.
//
//   npm run import-sprites -- <pasta> [--out <pasta-de-saída>] [--pack] [--allow-missing]
//
// Formato do manifest e fluxo de produção: docs/SPRITE_PIPELINE.md.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadTs } from "../lib/ts-bundle.mjs";
import { encodeWebP, initPainter } from "../roster/paint.mjs";
import { Canvas, packAtlas } from "../roster/raster.mjs";
import { RECOMMENDED_ACTIONS, REQUIRED_ACTIONS } from "./actions.mjs";

export class ImportError extends Error {
  constructor(errors, warnings = []) {
    super(`importação falhou com ${errors.length} erro(s):\n  - ${errors.join("\n  - ")}`);
    this.errors = errors;
    this.warnings = warnings;
  }
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;
const ATLAS_MAX = 2048;
const STYLE_KEYS = ["body", "accent", "skin", "trim", "energy"];

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isPair = (v) => Array.isArray(v) && v.length === 2 && v.every(isNum);
const isBox = (v) => Array.isArray(v) && v.length === 4 && v.every(isNum);

/** PNG → Canvas (RGBA pré-multiplicado 0..1, como o raster.mjs). */
function decodePng(CK, bytes) {
  const img = CK.MakeImageFromEncoded(new Uint8Array(bytes));
  if (!img) return null;
  const w = img.width();
  const h = img.height();
  const px = img.readPixels(0, 0, { width: w, height: h, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB });
  img.delete();
  const cv = new Canvas(w, h);
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3] / 255;
    cv.px[i * 4] = (px[i * 4] / 255) * a;
    cv.px[i * 4 + 1] = (px[i * 4 + 1] / 255) * a;
    cv.px[i * 4 + 2] = (px[i * 4 + 2] / 255) * a;
    cv.px[i * 4 + 3] = a;
  }
  return cv;
}

/** Texto do .def no mesmo molde do elenco embutido (scripts/roster/generate.mjs). */
function defFile(m, files) {
  const style = m.style ?? {};
  return [
    `; ${m.name} — importado de sprites por scripts/sprites/import.mjs`,
    "",
    "[Info]",
    `name = "${m.name}"`,
    `displayname = "${m.name}"`,
    "mugenversion = 1.0",
    `author = "${m.author ?? "BAMBA"}"`,
    "localcoord = 320, 240",
    "",
    "[Files]",
    `cmd = ${files.cmd}`,
    `cns = ${files.cns}`,
    ...files.st.map((f, i) => `st${i || ""} = ${f}`),
    "stcommon = common1.cns ; fornecido pela engine",
    `anim = ${m.id}.air`,
    "",
    ...(STYLE_KEYS.some((k) => style[k])
      ? ["; Extensão do BAMBA (ignorada pelo MUGEN): cores do HUD/efeitos", "[Arena]", ...STYLE_KEYS.filter((k) => style[k]).map((k) => `${k} = ${style[k]}`), ""]
      : []),
  ].join("\n");
}

/** Ações referenciadas com número literal nos estados (anim =, ChangeAnim value =, projanim...). */
function referencedActions(texts) {
  const refs = new Map();
  for (const [file, text] of Object.entries(texts)) {
    let state = "";
    let type = "";
    let statedef = false;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/;.*$/, "").trim();
      const sec = /^\[(statedef|state)\s+(-?\d+)/i.exec(line);
      if (sec) {
        state = sec[2];
        statedef = sec[1].toLowerCase() === "statedef";
        type = "";
        continue;
      }
      const kv = /^([a-z0-9_.]+)\s*=\s*(.+)$/i.exec(line);
      if (!kv) continue;
      const key = kv[1].toLowerCase();
      const val = kv[2].trim();
      if (key === "type" && !statedef) type = val.toLowerCase();
      const literal = /^-?\d+$/.test(val) ? Number(val) : null;
      if (literal === null || literal < 0) continue;
      const isRef =
        (key === "anim" && statedef) ||
        (key === "value" && (type === "changeanim" || type === "changeanim2")) ||
        key === "projanim" ||
        key === "projhitanim" ||
        key === "projremanim" ||
        (key === "anim" && (type === "explod" || type === "helper"));
      if (isRef && !refs.has(literal)) refs.set(literal, `${file}, estado ${state}`);
    }
  }
  return refs;
}

/**
 * Importa uma pasta. Devolve { id, out, files, pack, warnings }; lança ImportError com a
 * lista de problemas se algo impedir a importação.
 */
export async function importSprites(dir, opts = {}) {
  const errors = [];
  const warnings = [];
  const manifestPath = path.join(dir, "manifest.json");
  if (!existsSync(manifestPath)) throw new ImportError([`manifest.json não encontrado em ${dir}`]);
  let m;
  try {
    m = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    throw new ImportError([`manifest.json inválido: ${err.message}`]);
  }

  // ------------------------------------------------ campos de topo
  if (typeof m.id !== "string" || !ID_RE.test(m.id)) errors.push(`"id" inválido: ${JSON.stringify(m.id)} (minúsculas, números, "-" ou "_", 2 a 32 caracteres)`);
  if (typeof m.name !== "string" || !m.name.trim()) errors.push('"name" ausente');
  if (!isNum(m.pixelsPerUnit) || m.pixelsPerUnit <= 0) errors.push(`"pixelsPerUnit" precisa ser um número > 0 (recebido ${JSON.stringify(m.pixelsPerUnit)})`);
  if (!m.anims || typeof m.anims !== "object" || Array.isArray(m.anims)) errors.push('"anims" ausente (objeto "número da ação" → animação)');
  const texts = {};
  const files = { cns: null, cmd: null, st: [] };
  for (const key of ["cns", "cmd"]) {
    if (typeof m[key] !== "string") errors.push(`"${key}" ausente (nome do arquivo .${key} na pasta)`);
    else if (!existsSync(path.join(dir, m[key]))) errors.push(`${key}: arquivo "${m[key]}" não existe na pasta`);
    else {
      files[key] = path.basename(m[key]);
      texts[files[key]] = readFileSync(path.join(dir, m[key]), "latin1");
    }
  }
  for (const st of [].concat(m.st ?? [])) {
    if (!existsSync(path.join(dir, st))) errors.push(`st: arquivo "${st}" não existe na pasta`);
    else {
      files.st.push(path.basename(st));
      texts[path.basename(st)] = readFileSync(path.join(dir, st), "latin1");
    }
  }
  for (const k of Object.keys(m.style ?? {})) {
    if (!STYLE_KEYS.includes(k)) warnings.push(`style.${k} ignorado (use ${STYLE_KEYS.join(", ")})`);
    else if (!/^#[0-9a-fA-F]{6}$/.test(m.style[k])) errors.push(`style.${k} precisa ser uma cor #RRGGBB`);
  }
  if (errors.length) throw new ImportError(errors, warnings);

  // ------------------------------------------------ quadros e imagens
  const CK = await initPainter();
  const ppu = m.pixelsPerUnit;
  const images = new Map(); // arquivo → { canvas, w, h, crop: [x0, y0] } | null
  const loadImage = (file) => {
    if (images.has(file)) return images.get(file);
    const p = path.join(dir, file);
    let entry = null;
    if (!existsSync(p)) entry = { error: `arquivo "${file}" não existe` };
    else {
      const cv = decodePng(CK, readFileSync(p));
      if (!cv) entry = { error: `"${file}" não é um PNG legível` };
      else {
        const b = cv.bounds();
        if (!b) entry = { error: `"${file}" é totalmente transparente (para um quadro vazio use "file": null)` };
        else {
          const canvas = cv.crop(b[0], b[1], b[2], b[3]);
          if (canvas.w + 4 > ATLAS_MAX || canvas.h + 4 > ATLAS_MAX) entry = { error: `"${file}" tem ${canvas.w}x${canvas.h} px depois do recorte; o máximo é ${ATLAS_MAX - 4}` };
          else entry = { canvas, w: cv.w, h: cv.h, crop: [b[0], b[1]] };
        }
      }
    }
    images.set(file, entry);
    return entry;
  };

  const toUnits = (v) => Math.round(v / ppu);
  const box = (b) => {
    const [x1, y1, x2, y2] = b.map(toUnits);
    return { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) };
  };

  // sprite por arquivo: grupo = ação onde aparece primeiro, índice sequencial no grupo
  const sprites = new Map(); // arquivo → { group, index }
  const groupCount = new Map();
  const spriteOf = (file, action) => {
    if (!sprites.has(file)) {
      const index = groupCount.get(action) ?? 0;
      groupCount.set(action, index + 1);
      sprites.set(file, { group: action, index });
    }
    return sprites.get(file);
  };
  // eixo de cada sprite (o mesmo PNG precisa do mesmo axis em todos os quadros)
  const axisOf = new Map();

  const ids = Object.keys(m.anims)
    .map((k) => {
      if (!/^\d+$/.test(k)) errors.push(`anims: chave "${k}" não é um número de ação`);
      return Number(k);
    })
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);

  const anims = {};
  for (const id of ids) {
    const a = m.anims[String(id)];
    const where = `ação ${id}`;
    if (!a || !Array.isArray(a.frames) || a.frames.length === 0) {
      errors.push(`${where}: "frames" vazio ou ausente`);
      continue;
    }
    const loop = a.loop !== false;
    const loopStart = a.loopStart ?? 0;
    if (!Number.isInteger(loopStart) || loopStart < 0 || loopStart >= a.frames.length) {
      errors.push(`${where}: loopStart ${JSON.stringify(a.loopStart)} fora dos quadros (0..${a.frames.length - 1})`);
    }
    const frames = [];
    a.frames.forEach((f, i) => {
      const at = `${where}, quadro ${i}`;
      if (!Number.isInteger(f.ticks) || (f.ticks < 1 && f.ticks !== -1)) errors.push(`${at}: "ticks" precisa ser inteiro ≥ 1 ou -1 (infinito); recebido ${JSON.stringify(f.ticks)}`);
      if (f.ticks === -1 && i !== a.frames.length - 1) warnings.push(`${at}: ticks = -1 antes do último quadro — os quadros seguintes nunca aparecem`);
      for (const kind of ["clsn1", "clsn2"]) {
        const list = f[kind] ?? [];
        if (!Array.isArray(list) || !list.every(isBox)) errors.push(`${at}: "${kind}" precisa ser uma lista de [x1, y1, x2, y2]`);
      }
      if (f.offset !== undefined && !isPair(f.offset)) errors.push(`${at}: "offset" precisa ser [x, y]`);
      let group = -1;
      let index = 0;
      if (f.file !== null) {
        if (typeof f.file !== "string" || !f.file) {
          errors.push(`${at}: "file" ausente (use null para quadro vazio)`);
        } else {
          const img = loadImage(f.file);
          if (img.error) errors.push(`${at}: ${img.error}`);
          if (!isPair(f.axis)) errors.push(`${at}: "axis" precisa ser [x, y] em pixels da imagem`);
          else if (!img.error) {
            const [ax, ay] = f.axis;
            if (ax < 0 || ay < 0 || ax > img.w || ay > img.h) errors.push(`${at}: axis [${ax}, ${ay}] fora da imagem "${f.file}" (${img.w}x${img.h})`);
            const prev = axisOf.get(f.file);
            if (prev && (prev[0] !== ax || prev[1] !== ay)) errors.push(`${at}: "${f.file}" já foi usado com axis [${prev}]; o mesmo PNG precisa do mesmo axis (duplique o arquivo ou use "offset")`);
            axisOf.set(f.file, [ax, ay]);
          }
          ({ group, index } = spriteOf(f.file, id));
        }
      }
      if (errors.length) return;
      const [ox, oy] = f.offset ?? [0, 0];
      frames.push({
        group,
        index,
        ox: toUnits(ox),
        oy: toUnits(oy),
        time: f.ticks,
        flipH: f.flipH === true,
        flipV: f.flipV === true,
        clsn1: (f.clsn1 ?? []).map(box),
        clsn2: (f.clsn2 ?? []).map(box),
      });
    });
    if (frames.length === a.frames.length) anims[id] = { frames, loopStart: loop ? loopStart : 0 };
  }

  // ------------------------------------------------ ações obrigatórias e referências
  const missing = REQUIRED_ACTIONS.filter(([n]) => !m.anims?.[String(n)]);
  if (missing.length) {
    const list = missing.map(([n, d]) => `${n} (${d})`).join(", ");
    if (opts.allowMissing) warnings.push(`ações obrigatórias ausentes (a engine usa substitutas): ${list}`);
    else errors.push(`ações obrigatórias do common1 ausentes: ${list}. Lista completa em docs/SPRITE_PIPELINE.md (ou use --allow-missing num rascunho)`);
  }
  const softMissing = RECOMMENDED_ACTIONS.filter(([n]) => !m.anims?.[String(n)]);
  if (softMissing.length) warnings.push(`ações recomendadas ausentes (a engine usa substitutas): ${softMissing.map(([n]) => n).join(", ")}`);
  for (const [n, where] of referencedActions(texts)) {
    if (!m.anims?.[String(n)]) errors.push(`a ação ${n} é usada em ${where}, mas não está no manifest`);
  }
  if (errors.length) throw new ImportError(errors, warnings);

  // ------------------------------------------------ AIR, atlas e pack
  const engine = await loadTs("scripts/sprites/engine.ts");
  const animations = {};
  for (const [id, a] of Object.entries(anims)) animations[id] = engine.finalizeAnimation(Number(id), a.frames, a.loopStart);
  const air = engine.serializeAir(animations, `${m.name} — animações (formato MUGEN .air)\nGerado por scripts/sprites/import.mjs a partir de manifest.json — edite o manifest, não este arquivo.`);

  const items = [...sprites.entries()].map(([file, s]) => ({ key: `${s.group},${s.index}`, file, canvas: images.get(file).canvas }));
  const { pages, places } = packAtlas(items, ATLAS_MAX);
  const frames = {};
  for (const it of items) {
    const [x, y, page] = places[it.key];
    const img = images.get(it.file);
    const [ax, ay] = axisOf.get(it.file);
    frames[it.key] = [x, y, it.canvas.w, it.canvas.h, Math.round(ax - img.crop[0]), Math.round(ay - img.crop[1]), page];
  }
  const webp = pages.map((p) => encodeWebP(p, opts.quality ?? 85));
  const sheet = { scale: ppu, pages: pages.length, frames };

  const def = defFile(m, files);
  const packFiles = { [`${m.id}.def`]: def, [`${m.id}.air`]: air, ...texts };
  const pack = {
    format: engine.PACK_FORMAT,
    id: m.id,
    name: m.name,
    author: m.author ?? "BAMBA",
    version: m.version ?? "1.0.0",
    def: `${m.id}.def`,
    files: packFiles,
    sprites: { atlas: webp.map((b) => `data:image/webp;base64,${b.toString("base64")}`), scale: ppu, frames },
  };
  // a engine precisa conseguir carregar o resultado
  try {
    const ch = engine.loadCharacter(pack);
    if (ch.unsupported.length) warnings.push(`controladores não suportados pela engine: ${[...new Set(ch.unsupported)].join(", ")}`);
  } catch (err) {
    throw new ImportError([`a engine não carrega o personagem gerado: ${err.message}`], warnings);
  }

  const meta = {
    id: m.id,
    name: m.name,
    bio: m.meta?.bio ?? "",
    specials: m.meta?.specials ?? [],
    super: m.meta?.super ?? { name: "", cmd: "" },
    ...(m.meta?.super2 ? { super2: m.meta.super2 } : {}),
    quotes: m.meta?.quotes ?? [],
  };

  const out = path.resolve(opts.out ?? path.join(dir, "out"));
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) if (/^sprites\d+\.(png|webp)$/.test(f)) rmSync(path.join(out, f));
  const written = [];
  const write = (name, data) => {
    writeFileSync(path.join(out, name), data);
    written.push(name);
  };
  for (const [name, text] of Object.entries(packFiles)) write(name, text);
  webp.forEach((b, i) => write(`sprites${i}.webp`, b));
  write("sprites.json", `${JSON.stringify(sheet, null, 0)}\n`);
  write("meta.json", `${JSON.stringify(meta, null, 2)}\n`);
  if (opts.pack) write(`${m.id}.pack.json`, JSON.stringify(pack));

  return { id: m.id, out, files: written, pack, sheet, air, warnings, sprites: items.length, pages: pages.length };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" || a === "--quality") args[a.slice(2)] = argv[++i];
    else if (a.startsWith("--")) args[a.slice(2)] = true;
    else args._.push(a);
  }
  return args;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const dir = args._[0];
  if (!dir) {
    console.error("uso: npm run import-sprites -- <pasta-com-manifest.json> [--out pasta] [--pack] [--allow-missing] [--quality 85]");
    process.exit(1);
  }
  try {
    const r = await importSprites(path.resolve(dir), { out: args.out, pack: args.pack === true, allowMissing: args["allow-missing"] === true, quality: args.quality ? Number(args.quality) : undefined });
    for (const w of r.warnings) console.warn(`aviso: ${w}`);
    console.log(`${r.id}: ${r.sprites} sprites em ${r.pages} página(s) → ${path.relative(process.cwd(), r.out) || "."}`);
    console.log(`  ${r.files.join(", ")}`);
  } catch (err) {
    if (err instanceof ImportError) {
      for (const w of err.warnings) console.warn(`aviso: ${w}`);
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}
