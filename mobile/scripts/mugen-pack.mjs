#!/usr/bin/env node
// Converte um personagem do MUGEN (pasta com .def) em pack do BAMBA.
//
//   npm run pack -- <pasta-do-personagem> [--def kfm.def] [--id kfm] [--pal 1]
//                   [--no-sound] [--out kfm.pack.json] [--upload https://host --token <JWT>]
//
// O que entra no pack: .def, .cmd, .cns, st*, .air (texto) e os sprites usados
// pelo .air, convertidos do .sff para atlas PNG (data URI), e os sons do .snd
// referenciados nos estados (PlaySnd, hitsound, guardsound) como WAV (data URI;
// até 4 MB, sem --no-sound). Verifique se você tem direito de distribuir o personagem.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readAct, readSff } from "./lib/sff.mjs";
import { readSnd, usedSounds } from "./lib/snd.mjs";
import { Canvas, packAtlas } from "./roster/raster.mjs";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) args[a.slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i];
    else args._.push(a);
  }
  return args;
}

function ini(text) {
  const out = {};
  let section = "";
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, "").trim();
    if (!line) continue;
    const m = /^\[(.+)\]$/.exec(line);
    if (m) {
      section = m[1].trim().toLowerCase();
      out[section] ??= {};
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0 && section) {
      const k = line.slice(0, eq).trim().toLowerCase();
      out[section][k] ??= line.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    }
  }
  return out;
}

function findFile(dir, name) {
  if (!name) return null;
  const wanted = name.replace(/\\/g, "/").split("/").pop().toLowerCase();
  const hit = readdirSync(dir).find((f) => f.toLowerCase() === wanted);
  return hit ? path.join(dir, hit) : null;
}

/** Sprites referenciados pelo .air ("grupo,índice"). */
function usedSprites(airText) {
  const used = new Set();
  for (const raw of airText.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, "").trim();
    const m = /^(-?\d+)\s*,\s*(-?\d+)\s*,/.exec(line);
    if (m) used.add(`${Number(m[1])},${Number(m[2])}`);
  }
  return used;
}

function toCanvas(sprite) {
  const cv = new Canvas(sprite.w, sprite.h);
  for (let i = 0; i < sprite.w * sprite.h; i++) {
    const a = sprite.rgba[i * 4 + 3] / 255;
    cv.px[i * 4] = (sprite.rgba[i * 4] / 255) * a;
    cv.px[i * 4 + 1] = (sprite.rgba[i * 4 + 1] / 255) * a;
    cv.px[i * 4 + 2] = (sprite.rgba[i * 4 + 2] / 255) * a;
    cv.px[i * 4 + 3] = a;
  }
  return cv;
}

export function buildPack(dir, opts = {}) {
  const defPath = opts.def ? path.join(dir, opts.def) : path.join(dir, readdirSync(dir).find((f) => f.toLowerCase().endsWith(".def")) ?? "");
  if (!existsSync(defPath)) throw new Error(`nenhum .def encontrado em ${dir}`);
  const defText = readFileSync(defPath, "latin1");
  const def = ini(defText);
  const info = def.info ?? {};
  const files = def.files ?? {};
  const id = (opts.id ?? path.basename(defPath, ".def")).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(id)) throw new Error(`id inválido: "${id}" (use --id)`);

  const texts = { [path.basename(defPath)]: defText };
  for (const key of ["cmd", "cns", "anim", "st", ...Array.from({ length: 10 }, (_, i) => `st${i}`)]) {
    const p = findFile(dir, files[key]);
    if (p) texts[path.basename(p)] = readFileSync(p, "latin1");
    else if (["cmd", "cns", "anim"].includes(key)) throw new Error(`[Files] ${key} = ${files[key] ?? "(vazio)"} não encontrado`);
  }
  const airName = path.basename(findFile(dir, files.anim));

  let sprites = null;
  const sffPath = findFile(dir, files.sprite);
  if (sffPath) {
    const palKey = `pal${opts.pal ?? 1}`;
    const actPath = findFile(dir, files[palKey]);
    const act = actPath ? readAct(readFileSync(actPath)) : null;
    const all = readSff(readFileSync(sffPath), act);
    const used = usedSprites(texts[airName]);
    const items = all
      .filter((s) => used.has(`${s.group},${s.index}`) && s.w > 0 && s.h > 0)
      .map((s) => ({ key: `${s.group},${s.index}`, canvas: toCanvas(s), axisX: s.axisX, axisY: s.axisY }));
    const { pages, places } = packAtlas(items, 2048);
    const frames = {};
    for (const it of items) {
      const [x, y, page] = places[it.key];
      frames[it.key] = [x, y, it.canvas.w, it.canvas.h, it.axisX, it.axisY, page];
    }
    sprites = {
      atlas: pages.map((p) => `data:image/png;base64,${p.toPNG().toString("base64")}`),
      scale: 1,
      frames,
    };
    console.log(`sprites: ${items.length} usados de ${all.length} no SFF, ${pages.length} página(s)`);
  } else {
    console.warn("sem .sff: o app vai desenhar o personagem pelas caixas de colisão");
  }

  let sounds = null;
  const sndPath = opts.sound === false ? null : findFile(dir, files.sound);
  if (sndPath) {
    const used = usedSounds(Object.values(texts));
    const all = readSnd(readFileSync(sndPath));
    sounds = {};
    let total = 0;
    for (const snd of all) {
      const key = `${snd.group},${snd.index}`;
      if (!used.has(key) || total + snd.data.length > 4_000_000) continue;
      sounds[key] = `data:audio/wav;base64,${snd.data.toString("base64")}`;
      total += snd.data.length;
    }
    console.log(`sons: ${Object.keys(sounds).length} usados de ${all.length} no SND (${Math.round(total / 1024)} KB)`);
  }

  return {
    format: "mugen-arena-pack/1",
    id,
    name: info.displayname || info.name || id,
    author: info.author || "desconhecido",
    version: opts.version ?? "1.0.0",
    def: path.basename(defPath),
    files: texts,
    sprites,
    ...(sounds && Object.keys(sounds).length ? { sounds } : {}),
  };
}

async function upload(pack, host, token) {
  const res = await fetch(`${host.replace(/\/$/, "")}/api/v1/characters`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pack }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`upload falhou (${res.status}): ${body}`);
  console.log(`enviado para revisão: ${body}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const dir = args._[0];
  if (!dir) {
    console.error("uso: npm run pack -- <pasta-do-personagem> [--def x.def] [--id slug] [--pal 1] [--no-sound] [--out arquivo] [--upload URL --token JWT]");
    process.exit(1);
  }
  const pack = buildPack(path.resolve(dir), { def: args.def, id: args.id, pal: args.pal, version: args.version, sound: !args["no-sound"] });
  const body = JSON.stringify(pack);
  const out = args.out ?? `${pack.id}.pack.json`;
  writeFileSync(out, body);
  const sha = createHash("sha256").update(body).digest("hex");
  console.log(`${out}: ${(body.length / 1024).toFixed(0)} KB, sha256 ${sha}`);
  if (args.upload) {
    if (!args.token) throw new Error("--upload precisa de --token (access token do bff-auth)");
    await upload(pack, args.upload, args.token);
  }
}
