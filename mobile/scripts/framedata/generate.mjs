#!/usr/bin/env node
// Frame data do elenco embutido, medida na engine (src/engine/framedata.ts).
//
//   npm run framedata                      # todos → docs/framedata/<id>.md + framedata.json
//   npm run framedata -- kaze lua          # só alguns (não reescreve o framedata.json)
//   npm run framedata -- --dummy tita      # outro boneco (padrão: o primeiro do elenco)
//   npm run framedata -- --check           # falha se docs/framedata estiver desatualizado
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadTs } from "../lib/ts-bundle.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../../docs/framedata");

const args = process.argv.slice(2);
const check = args.includes("--check");
const di = args.indexOf("--dummy");
const dummy = di >= 0 ? args[di + 1] : undefined;
const ids = args.filter((a, i) => !a.startsWith("--") && !(di >= 0 && i === di + 1));

const mod = await loadTs("scripts/framedata/main.ts");
const { data, markdown } = mod.builtinFrameData(ids.length ? ids : undefined, dummy);
const files = {};
for (const [id, md] of Object.entries(markdown)) files[`${id}.md`] = md;
if (!ids.length) {
  const json = { format: "mugen-arena-framedata/1", dummy: dummy ?? mod.BUILTIN_ORDER[0], characters: data };
  files["framedata.json"] = `${JSON.stringify(json, null, 1)}\n`;
}

if (check) {
  const stale = Object.entries(files).filter(([f, text]) => !existsSync(path.join(out, f)) || readFileSync(path.join(out, f), "utf8") !== text);
  if (stale.length) {
    console.error(`frame data desatualizada — rode "npm run framedata":\n  ${stale.map(([f]) => f).join("\n  ")}`);
    process.exit(1);
  }
  console.log("frame data atualizada");
} else {
  mkdirSync(out, { recursive: true });
  for (const [f, text] of Object.entries(files)) writeFileSync(path.join(out, f), text);
  const moves = data.reduce((n, c) => n + c.moves.length, 0);
  console.log(`frame data: ${data.length} personagem(ns), ${moves} golpes → ${path.relative(process.cwd(), out)}`);
}
