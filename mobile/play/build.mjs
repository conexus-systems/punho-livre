#!/usr/bin/env node
// Empacota a versão web jogável em play/dist (play.js + atlas PNG + index.html).
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
  outfile: path.join(out, "play.js"),
  tsconfig: path.join(here, "..", "tsconfig.json"),
  alias: {
    "@shopify/react-native-skia": path.join(here, "skia-canvas2d.ts"),
    "react-native": path.join(here, "react-native-shim.ts"),
  },
  loader: { ".png": "file", ".jpg": "file" },
  assetNames: "[name]-[hash]",
  publicPath: "./",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});
copyFileSync(path.join(here, "index.html"), path.join(out, "index.html"));
