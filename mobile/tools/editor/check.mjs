#!/usr/bin/env node
// Abre o editor (tools/editor/dist) no Chromium com Playwright, mexe numa caixa, confere
// o .air exportado, abre a pasta de exemplo do importador e tira a captura
// docs/screenshots/editor.png. Rode `npm run editor` antes.
//   node tools/editor/check.mjs [saida.png]
import { createReadStream, existsSync, mkdtempSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeSampleFolder } from "../../scripts/sprites/sample.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const shot = path.resolve(process.argv[2] ?? path.join(here, "../../../docs/screenshots/editor.png"));
if (!existsSync(path.join(dist, "editor.js"))) throw new Error("rode npm run editor antes");

// pasta de exemplo do importador servida em /pasta/
const sample = mkdtempSync(path.join(tmpdir(), "editor-pasta-"));
await writeSampleFolder(sample);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".json": "application/json" };
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = url.startsWith("/pasta/") ? path.join(sample, url.slice(7)) : path.join(dist, url === "/" ? "index.html" : url);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "text/plain" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (ok, msg) => {
  if (!ok) throw new Error(`falhou: ${msg}`);
  console.log(`ok - ${msg}`);
};

try {
  // ---- personagem embutido: jab do Kaze, quadro 2 (o do Clsn1)
  await page.goto(`${base}/?char=kaze&action=200&frame=2`);
  await page.waitForSelector("body[data-ready]");
  await page.waitForFunction(() => window.editor.frameData().length > 0);
  let st = await page.evaluate(() => window.editor.state());
  check(st.char === "kaze" && st.actionId === 200 && st.frameIdx === 1, "abre o Kaze na ação 200, quadro 2");
  check(st.frame.clsn1.length === 1, "quadro ativo tem 1 Clsn1");
  const fd = await page.evaluate(() => window.editor.frameData().find((m) => m.state === 200));
  check(fd.startup === 3 && fd.active === 3 && fd.onHit === 5, `frame data no editor = tabela (startup ${fd.startup}, ativos ${fd.active}, acerto +${fd.onHit})`);

  // arrasta a borda direita da Clsn1 20 px de tela para a direita
  const before = st.frame.clsn1[0];
  const geo = await page.evaluate(() => {
    const c = document.getElementById("view").getBoundingClientRect();
    return { left: c.left, top: c.top, w: c.width, h: c.height };
  });
  const zoom = await page.evaluate(() => Number(document.getElementById("info").textContent.match(/zoom ([\d.]+)/)[1]));
  const ox = geo.left + geo.w / 2;
  const oy = geo.top + geo.h * 0.84;
  // ponto da Clsn1 fora da Clsn2 do braço (o clique escolhe a menor caixa sob o mouse)
  const cx = ox + (before.x2 - 1.5) * zoom;
  const cy = oy + (before.y1 + 1.5) * zoom;
  const my = oy + ((before.y1 + before.y2) / 2) * zoom;
  await page.mouse.click(cx, cy);
  st = await page.evaluate(() => window.editor.state());
  check(st.selected?.kind === 1 && st.selected.i === 0, "clique seleciona a Clsn1");
  const ex = ox + before.x2 * zoom;
  await page.mouse.move(ex, my);
  await page.mouse.down();
  await page.mouse.move(ex + 10, my, { steps: 3 });
  await page.mouse.move(ex + 20, my, { steps: 3 });
  await page.mouse.up();
  st = await page.evaluate(() => window.editor.state());
  const after = st.frame.clsn1[0];
  check(after.x2 > before.x2 && after.x1 === before.x1 && after.y1 === before.y1, `arrastar a borda redimensiona (x2 ${before.x2} → ${after.x2})`);

  // ticks do quadro
  await page.fill("#ticks", "6");
  await page.dispatchEvent("#ticks", "change");
  const air = await page.evaluate(() => window.editor.exportAir());
  const block = air.split("[Begin Action 200]")[1].split("[Begin Action")[0];
  check(block.includes(`Clsn1[0] = ${after.x1}, ${after.y1}, ${after.x2}, ${after.y2}`), ".air exportado traz a caixa nova");
  check(/\n\d+, 0, 0, 0, 6\n/.test(block), ".air exportado traz os ticks novos");
  await page.waitForFunction(() => window.editor.frameData().find((m) => m.state === 200)?.active === 5);
  check(true, "frame data remedida com o quadro ativo de 6 ticks (5 ativos)");

  // captura: seleciona de novo a caixa para mostrar as alças
  await page.mouse.click(ox + (after.x2 - 1.5) * zoom, cy);
  await page.screenshot({ path: shot });
  console.log(`captura: ${shot}`);

  // ---- pasta do importador (manifest.json + PNGs)
  await page.goto(`${base}/?manifest=/pasta/manifest.json&action=200&frame=2`);
  await page.waitForSelector("body[data-ready]");
  st = await page.evaluate(() => window.editor.state());
  check(st.char === "exemplo" && st.frame.file === "jab_001.png", "abre a pasta do importador (manifest.json + PNG)");
  await page.click("#add2");
  const manifest = await page.evaluate(() => window.editor.exportManifest());
  const f = manifest.anims["200"].frames[1];
  check(f.clsn2.length === 3 && f.axis[0] === 80 && manifest.pixelsPerUnit === 2 && manifest.cns === "exemplo.cns", "manifest.json exportado com a caixa nova, axis e campos originais");
  await page.waitForFunction(() => window.editor.frameData().length > 0);
  const fd2 = await page.evaluate(() => window.editor.frameData());
  check(fd2.length === 1 && fd2[0].state === 200 && fd2[0].startup !== null, `frame data da pasta (soco: startup ${fd2[0].startup})`);
  check(errors.length === 0, `sem erros de página${errors.length ? `: ${errors.join("; ")}` : ""}`);
} finally {
  await browser.close();
  server.close();
}
