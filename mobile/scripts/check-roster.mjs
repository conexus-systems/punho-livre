#!/usr/bin/env node
// Confere que o elenco gerado (texto MUGEN + índice) está atualizado com o gerador.
// PNGs ficam de fora: o zlib pode variar entre versões do Node.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chars = path.join(root, "characters");
const before = new Map();
for (const id of readdirSync(chars)) {
  if (!statSync(path.join(chars, id)).isDirectory()) continue;
  for (const f of readdirSync(path.join(chars, id))) {
    if (!f.endsWith(".png")) before.set(`${id}/${f}`, readFileSync(path.join(chars, id, f), "utf8"));
  }
}
const index = path.join(root, "src/characters/builtin.generated.ts");
const indexBefore = readFileSync(index, "utf8");

execFileSync("node", [path.join(root, "scripts/roster/generate.mjs")], { stdio: "ignore" });
execFileSync("node", [path.join(root, "scripts/build-character-index.mjs")], { stdio: "ignore" });

const stale = [];
for (const [rel, text] of before) if (readFileSync(path.join(chars, rel), "utf8") !== text) stale.push(rel);
// frames do atlas dependem só da geometria; o índice inteiro deve bater
if (readFileSync(index, "utf8") !== indexBefore) stale.push("src/characters/builtin.generated.ts");
void mkdtempSync(path.join(tmpdir(), "roster-"));
if (stale.length) {
  console.error(`Elenco desatualizado — rode "npm run roster" e commite:\n  ${stale.join("\n  ")}`);
  process.exit(1);
}
console.log("elenco gerado está atualizado");
