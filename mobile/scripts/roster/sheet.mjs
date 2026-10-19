// Folha de prova: algumas poses de cada personagem lado a lado (para conferir a arte).
//   node scripts/roster/sheet.mjs out.png kaze lua
import { writeFileSync } from "node:fs";

import { ROSTER } from "./characters.mjs";
import { initPainter, paintFighter } from "./paint.mjs";
import { POSES } from "./poses.mjs";
import { Canvas } from "./raster.mjs";
import { proportions, solve } from "./rig.mjs";

const [out = "sheet.png", ...ids] = process.argv.slice(2);
const poseNames = (process.env.POSES ?? "stand1,walk2,jab,hook,roundhouse,crouchKick,airKick,guard,hitHard,win2").split(",");
await initPainter();
const K = 3;
const rows = [];
for (const ch of ROSTER.filter((c) => !ids.length || ids.includes(c.id))) {
  const P = proportions(ch.H, ch.build);
  const poses = { ...POSES, ...(ch.poses ?? {}) };
  rows.push(poseNames.map((n) => paintFighter(P, solve(P, poses[n]), ch.look, K)));
}
const cellW = 130 * K, cellH = 150 * K;
const sheet = new Canvas(cellW * poseNames.length, cellH * rows.length);
for (let i = 0; i < sheet.px.length; i += 4) { sheet.px[i] = 0.32; sheet.px[i + 1] = 0.3; sheet.px[i + 2] = 0.38; sheet.px[i + 3] = 1; }
rows.forEach((row, r) =>
  row.forEach((s, c) => {
    const dx = Math.round(c * cellW + cellW / 2 - s.axisX);
    const dy = Math.round(r * cellH + cellH - 8 - s.axisY);
    for (let y = 0; y < s.canvas.h; y++) for (let x = 0; x < s.canvas.w; x++) {
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= sheet.w || ty >= sheet.h) continue;
      const si = (y * s.canvas.w + x) * 4, di = (ty * sheet.w + tx) * 4, a = s.canvas.px[si + 3];
      for (let k = 0; k < 3; k++) sheet.px[di + k] = s.canvas.px[si + k] + sheet.px[di + k] * (1 - a);
    }
  }),
);
writeFileSync(out, sheet.toPNG());
