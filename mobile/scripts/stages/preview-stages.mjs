#!/usr/bin/env node
// Compõe as camadas de cada cenário (câmera no centro) para conferir a arte.
//   node scripts/stages/preview-stages.mjs <pasta-de-saída> [camX]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = process.argv[2] ?? "/tmp/stages";
const cam = Number(process.argv[3] ?? 0);
mkdirSync(out, { recursive: true });
const CK = await require("canvaskit-wasm/bin/full/canvaskit.js")();
const src = readFileSync(path.join(root, "src/game/stages.generated.ts"), "utf8");
const W = 1280, H = 720, k = H / 250, ground = H * 0.8;
for (const [, id, body] of src.matchAll(/"(\w+)": \{\n([\s\S]*?)\n  \},/g)) {
  const s = CK.MakeSurface(W, H);
  const c = s.getCanvas();
  c.clear(CK.BLACK);
  for (const m of body.matchAll(/parallax: ([\d.]+), x: ([-\d.]+), y: ([-\d.]+), w: ([\d.]+), h: ([\d.]+).*?stages\/([\w.-]+)"/g)) {
    const [, par, x, y, w, h, file] = m;
    const img = CK.MakeImageFromEncoded(readFileSync(path.join(root, "assets/stages", file)));
    const p = new CK.Paint();
    const dx = W / 2 + (Number(x) - cam * Number(par)) * k;
    c.drawImageRect(img, CK.XYWHRect(0, 0, img.width(), img.height()), CK.XYWHRect(dx, ground + Number(y) * k, Number(w) * k, Number(h) * k), p);
  }
  s.flush();
  writeFileSync(path.join(out, `${id}.png`), s.makeImageSnapshot().encodeToBytes());
}
