#!/usr/bin/env node
// Gera src/characters/builtin.generated.ts a partir de characters/<id>/.
// Os textos MUGEN viram strings e os PNGs viram require() (assets do Metro).

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const charsDir = path.join(root, "characters");
const out = path.join(root, "src/characters/builtin.generated.ts");

const ids = readdirSync(charsDir).filter((d) => statSync(path.join(charsDir, d)).isDirectory()).sort();
const order = ["kaze", "brasa", "tita", "yuki", "volt", "sombra"];
ids.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));

const entries = ids.map((id) => {
  const dir = path.join(charsDir, id);
  const files = {};
  for (const f of readdirSync(dir).sort()) {
    if (/\.(def|air|cmd|cns|st)$/i.test(f)) files[f] = readFileSync(path.join(dir, f), "utf8");
  }
  const sprites = JSON.parse(readFileSync(path.join(dir, "sprites.json"), "utf8"));
  const meta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf8"));
  const pages = Array.from({ length: sprites.pages }, (_, i) => `require("../../characters/${id}/sprites${i}.png")`);
  return `  ${JSON.stringify(id)}: {
    meta: ${JSON.stringify(meta)},
    pack: {
      format: "mugen-arena-pack/1",
      id: ${JSON.stringify(id)},
      name: ${JSON.stringify(meta.name)},
      author: "CONEXUS Arena",
      version: "1.0.0",
      def: ${JSON.stringify(`${id}.def`)},
      files: ${JSON.stringify(files)},
      sprites: { atlas: ${JSON.stringify(Array.from({ length: sprites.pages }, (_, i) => `builtin:${id}:${i}`))}, scale: ${sprites.scale}, frames: ${JSON.stringify(sprites.frames)} },
    },
    atlasModules: [${pages.join(", ")}],
  },`;
});

writeFileSync(
  out,
  `/* eslint-disable */
// GERADO por scripts/build-character-index.mjs — não edite à mão.
// Fonte: characters/<id>/ (gerados por scripts/roster/generate.mjs).

import type { BuiltinCharacter } from "./types";

export const BUILTIN: Record<string, BuiltinCharacter> = {
${entries.join("\n")}
};

export const BUILTIN_ORDER: string[] = ${JSON.stringify(ids)};
`,
);
console.log(`builtin.generated.ts: ${ids.length} personagens`);
