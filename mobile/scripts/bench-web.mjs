#!/usr/bin/env node
// Roda o `?bench=1` da versão web num Chromium headless (Playwright) e imprime o
// resultado (docs/DEVICE_LAB.md). Números de headless/sem GPU NÃO representam
// aparelho: servem para comparar versões na mesma máquina (CI).
//
//   npm run bench:web                       # imprime o JSON
//   BENCH_JSON=out/bench-web.json npm run bench:web
//   CHROMIUM_PATH=/caminho/chrome npm run bench:web
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "play", "dist");
execFileSync(process.execPath, [path.join(root, "play", "build.mjs")], { stdio: "ignore" });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
  const file = path.join(dist, rel);
  if (!file.startsWith(dist) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const defaultChrome = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(defaultChrome) ? defaultChrome : undefined);
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${port}/index.html?bench=1`);
  await page.waitForFunction(() => window.__MUGEN_BENCH__ !== undefined, null, { timeout: 120_000, polling: 1000 });
  const report = await page.evaluate(() => window.__MUGEN_BENCH__);
  report.device = `headless ${report.device}`;
  const out = JSON.stringify(report, null, 2);
  console.log(out);
  if (process.env.BENCH_JSON) {
    mkdirSync(path.dirname(path.resolve(process.env.BENCH_JSON)), { recursive: true });
    writeFileSync(process.env.BENCH_JSON, out + "\n");
  }
} finally {
  await browser.close();
  server.close();
}
