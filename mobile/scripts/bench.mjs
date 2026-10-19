#!/usr/bin/env node
// Empacota e roda o benchmark da engine (scripts/bench/bench.ts).
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(mkdtempSync(path.join(os.tmpdir(), "mugen-bench-")), "bench.cjs");
await build({
  entryPoints: [path.join(here, "bench", "bench.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: out,
  tsconfig: path.join(here, "..", "tsconfig.json"),
  loader: { ".png": "empty", ".jpg": "empty", ".webp": "empty" },
  logLevel: "warning",
});
execFileSync(process.execPath, [out], { stdio: "inherit", env: process.env });
