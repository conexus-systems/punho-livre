/**
 * Benchmark do renderer (efeitos, câmera, HUD) com o Skia real (CanvasKit/WASM).
 * Mede o custo de gravar o quadro (as chamadas de desenho do JS) e o de
 * rasterizar em software. Só roda com RENDER_BENCH=1 (`npm run bench:render`).
 * Os números servem para comparar versões na mesma máquina, não aparelhos.
 */
import { performance } from "node:perf_hooks";

jest.mock("react-native", () => ({ Platform: { select: (o: any) => o.default, OS: "android" } }));

import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import type { CharacterData } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";
import { CpuController } from "@/src/game/ai";

import { initSkia, state } from "./skia-node";

const run = process.env.RENDER_BENCH ? test : test.skip;
const FRAMES = Number(process.env.RENDER_BENCH_FRAMES ?? 1500);

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

run("custo do renderer por quadro", async () => {
  await initSkia();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FightRenderer } = require("@/src/game/renderer");
  const roster: Record<string, CharacterData> = {};
  for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);
  const atlases: Record<string, any[]> = {};
  const fs = require("node:fs");
  for (const id of BUILTIN_ORDER) {
    atlases[id] = BUILTIN[id].pack.sprites!.atlas.map((_: string, i: number) => {
      const bytes = fs.readFileSync(`${__dirname}/../../characters/${id}/sprites${i}.webp`);
      return state.Skia.Image.MakeImageFromEncoded(state.Skia.Data.fromBytes(new Uint8Array(bytes)));
    });
  }
  const W = 844, H = 390;
  const surface = state.CK.MakeSurface(W, H);
  const lines: string[] = [];
  let recTotal = 0, rasterTotal = 0, frames = 0, worst = 0, events = 0;
  for (const seed of [1, 2, 3]) {
    const a = BUILTIN_ORDER[seed % BUILTIN_ORDER.length];
    const b = BUILTIN_ORDER[(seed * 7 + 3) % BUILTIN_ORDER.length];
    const w = createWorld({ chars: [a, b], stageId: "dojo", seed, roundsToWin: 99, roundTime: 99 }, roster);
    const r = rng(seed);
    const cpu = [new CpuController(0, roster, 3, r), new CpuController(1, roster, 3, r)];
    const rend = new FightRenderer();
    for (let f = 0; f < FRAMES; f++) {
      stepWorld(w, [cpu[0].next(w), cpu[1].next(w)], roster);
      events += w.events.length;
      rend.addEvents(w.events, w, roster);
      const t0 = performance.now();
      const rec = state.Skia.PictureRecorder();
      const c = rec.beginRecording(state.Skia.XYWHRect(0, 0, W, H));
      rend.draw(c, { world: w, roster, atlases, width: W, height: H });
      const pic = rec.finishRecordingAsPicture();
      const t1 = performance.now();
      surface.getCanvas().drawPicture(pic.ref);
      surface.flush();
      const t2 = performance.now();
      if (f >= 60) {
        // ignora o aquecimento do JIT
        recTotal += t1 - t0;
        rasterTotal += t2 - t1;
        worst = Math.max(worst, t1 - t0);
        frames++;
      }
      pic.dispose?.();
    }
  }
  // estresse: uma rajada de impactos a cada 4 quadros (pior caso dos efeitos)
  {
    const w = createWorld({ chars: ["kaze", "tita"], stageId: "dojo", seed: 9, roundsToWin: 99, roundTime: 99 }, roster);
    for (let f = 0; f < 120; f++) stepWorld(w, [0, 0], roster);
    const rend = new FightRenderer();
    const kinds = ["hit", "hit", "hit", "guard", "counter", "hit", "guardcrush", "super"];
    let rec = 0, n = 0, worstS = 0, peak = 0;
    for (let f = 0; f < FRAMES; f++) {
      stepWorld(w, [0, 0], roster);
      if (f % 4 === 0) {
        const kind = kinds[(f / 4) % kinds.length];
        const ev = [{ kind: kind === "counter" ? "hit" : kind, x: 0, y: -60, side: 0, level: (f / 4) % 3, frame: w.frame }];
        if (kind === "counter") ev.push({ kind: "counter", x: 0, y: -70, side: 0, level: 0, frame: w.frame });
        rend.addEvents(ev, w, roster);
      }
      const t0 = performance.now();
      const r = state.Skia.PictureRecorder();
      const c = r.beginRecording(state.Skia.XYWHRect(0, 0, W, H));
      rend.draw(c, { world: w, roster, atlases, width: W, height: H });
      const pic = r.finishRecordingAsPicture();
      const t1 = performance.now();
      peak = Math.max(peak, rend.liveParticles ?? 0);
      if (f >= 60) {
        rec += t1 - t0;
        worstS = Math.max(worstS, t1 - t0);
        n++;
      }
      pic.dispose?.();
    }
    lines.push(`render-bench estresse ${n} quadros (impacto a cada 4)`);
    lines.push(`  gravar (JS):      ${(rec / n).toFixed(3)} ms/quadro  pior ${worstS.toFixed(2)} ms  pico de partículas ${peak || "n/d"}`);
  }
  lines.push(`render-bench ${frames} quadros (${events} eventos)`);
  lines.push(`  gravar (JS):      ${(recTotal / frames).toFixed(3)} ms/quadro  pior ${worst.toFixed(2)} ms`);
  lines.push(`  rasterizar (CK):  ${(rasterTotal / frames).toFixed(3)} ms/quadro`);
  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}, 600_000);
