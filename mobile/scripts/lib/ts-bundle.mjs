// Empacota um módulo TypeScript do app (engine, ferramentas) para rodar no Node,
// como o scripts/bench.mjs. Os imports "@/..." e o tsconfig do app valem; imagens
// (require de .webp/.png) viram módulos vazios.
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

/** Empacota `entry` (relativo a mobile/) em CommonJS e devolve o módulo carregado. */
export async function loadTs(entry) {
  const dir = mkdtempSync(path.join(tmpdir(), "mugen-tools-"));
  const outfile = path.join(dir, `${path.basename(entry).replace(/\.[^.]+$/, "")}.cjs`);
  await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile,
    tsconfig: path.join(root, "tsconfig.json"),
    loader: { ".png": "empty", ".jpg": "empty", ".webp": "empty" },
    logLevel: "warning",
  });
  try {
    return require(outfile);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
