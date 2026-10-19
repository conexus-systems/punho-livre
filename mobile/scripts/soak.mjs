#!/usr/bin/env node
// Empacota e roda o soak do online (scripts/soak/soak.ts): `npm run soak -- 1000`.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(mkdtempSync(path.join(os.tmpdir(), "mugen-soak-")), "soak.cjs");
await build({
  entryPoints: [path.join(here, "soak", "soak.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: out,
  tsconfig: path.join(here, "..", "tsconfig.json"),
  loader: { ".png": "empty", ".jpg": "empty", ".webp": "empty" },
  logLevel: "warning",
});
try {
  execFileSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
} catch (err) {
  process.exit(typeof err.status === "number" ? err.status : 1);
}
