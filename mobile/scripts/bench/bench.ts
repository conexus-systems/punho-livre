/**
 * Benchmark da engine: simula lutas CPU × CPU e mede frames/s da simulação
 * pura e do custo do rollback (clone + re-simulação de 8 frames por frame).
 * Rodar com `npm run bench`; `BENCH_JSON=arquivo.json` grava também os números
 * em JSON (CI publica como artifact).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import { checksum, deepClone } from "@/src/engine/clone";
import type { Roster } from "@/src/engine/fighter";
import type { WorldState } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";
import { CpuController } from "@/src/game/ai";

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const roster: Roster = {};
const t0 = performance.now();
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);
const loadMs = performance.now() - t0;

const FRAMES = Number(process.env.BENCH_FRAMES ?? 20000);

function fight(seed: number, rollback: number): { ms: number; frames: number } {
  const ids = BUILTIN_ORDER;
  const a = ids[seed % ids.length];
  const b = ids[(seed * 7 + 3) % ids.length];
  const w: WorldState = createWorld({ chars: [a, b], stageId: "dojo", seed, roundsToWin: 99, roundTime: 99 }, roster);
  const r = rng(seed);
  const cpu = [new CpuController(0, roster, 3, r), new CpuController(1, roster, 3, r)];
  const history: [number, number][] = [];
  let snaps: WorldState[] = [];
  const start = performance.now();
  let n = 0;
  while (n < FRAMES / 4 && w.matchWinner < 0) {
    const inputs: [number, number] = [cpu[0].next(w), cpu[1].next(w)];
    if (rollback > 0) {
      snaps.push(deepClone(w));
      if (snaps.length > rollback) snaps = snaps.slice(-rollback);
      history.push(inputs);
      // re-simula os últimos `rollback` frames a partir do snapshot mais antigo
      const base = deepClone(snaps[0]);
      for (let i = history.length - snaps.length; i < history.length - 1; i++) stepWorld(base, history[i], roster);
    }
    stepWorld(w, inputs, roster);
    n++;
  }
  if (rollback > 0) checksum(w);
  return { ms: performance.now() - start, frames: n };
}

const results: { label: string; frames: number; ms_per_frame: number; frames_per_s: number; realtime_x: number }[] = [];

function run(label: string, rollback: number): void {
  let ms = 0;
  let frames = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const r = fight(seed, rollback);
    ms += r.ms;
    frames += r.frames;
  }
  const fps = (frames / ms) * 1000;
  results.push({ label, frames, ms_per_frame: Number((ms / frames).toFixed(4)), frames_per_s: Math.round(fps), realtime_x: Math.round(fps / 60) });
  console.log(`${label.padEnd(28)} ${frames} frames  ${(ms / frames).toFixed(4)} ms/frame  ${Math.round(fps)} frames/s  (${(fps / 60).toFixed(0)}× tempo real)`);
}

console.log(`carregar ${BUILTIN_ORDER.length} personagens: ${loadMs.toFixed(1)} ms`);
run("simulação", 0);
run("rollback (8 frames/frame)", 8);

if (process.env.BENCH_JSON) {
  const out = path.resolve(process.env.BENCH_JSON);
  mkdirSync(path.dirname(out), { recursive: true });
  const report = {
    format: "mugen-arena-engine-bench/1",
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    characters: BUILTIN_ORDER.length,
    load_ms: Number(loadMs.toFixed(1)),
    frames_per_run: FRAMES,
    results,
  };
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
}
