#!/usr/bin/env node
// Empacota o editor de hitbox/frame data em tools/editor/dist (editor.js + atlas + index.html).
//   npm run editor            # gera o dist
//   npm run editor -- --serve # gera e serve em http://localhost:4320
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(here, "main.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  outfile: path.join(out, "editor.js"),
  tsconfig: path.join(here, "..", "..", "tsconfig.json"),
  loader: { ".png": "file", ".jpg": "file", ".webp": "file" },
  assetNames: "[name]-[hash]",
  publicPath: "./",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});
copyFileSync(path.join(here, "index.html"), path.join(out, "index.html"));

if (process.argv.includes("--serve")) {
  const { spawn } = await import("node:child_process");
  spawn("npx", ["serve", out, "-l", "4320"], { stdio: "inherit" });
}
