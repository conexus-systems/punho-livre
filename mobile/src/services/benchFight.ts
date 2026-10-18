/**
 * Luta de referência do laboratório de aparelhos (docs/DEVICE_LAB.md): CPU × CPU
 * fixa (mesmos lutadores, cenário, semente e IA com gerador próprio), 60 s de
 * relógio. Usada pela tela /bench do app e pelo `?bench=1` da versão web, para
 * que os números de aparelhos diferentes sejam comparáveis.
 */

import type { Roster } from "@/src/engine/fighter";
import type { WorldState } from "@/src/engine/types";
import { createWorld } from "@/src/engine/world";
import { CpuController } from "@/src/game/ai";

import type { PerfSnapshot } from "./perf";

export const BENCH = {
  seconds: 60,
  seed: 20261018,
  chars: ["kaze", "brasa"] as [string, string],
  stage: "dojo",
  level: 3 as const,
};

/** xorshift32: a IA do bench não usa Math.random (mesma luta em todo aparelho). */
export function xorshift(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export interface BenchFight {
  world: WorldState;
  cpus: [CpuController, CpuController];
}

/** Monta a luta fixa. `n` = quantas lutas já houve (se uma acabar antes dos 60 s, recomeça com semente derivada). */
export function createBenchFight(roster: Roster, n = 0): BenchFight {
  const seed = BENCH.seed + n;
  const world = createWorld({ chars: BENCH.chars, stageId: BENCH.stage, seed, roundsToWin: 99, roundTime: 99 }, roster);
  return { world, cpus: [new CpuController(0, roster, BENCH.level, xorshift(seed)), new CpuController(1, roster, BENCH.level, xorshift(seed ^ 0x9e3779b9))] };
}

export interface BenchReport extends PerfSnapshot {
  format: "mugen-arena-bench/1";
  /** android | ios | web */
  platform: string;
  os_version: string;
  app_version: string;
  /** Descrição livre do aparelho/navegador (o app não lê o modelo; preencha na planilha do laboratório). */
  device: string;
  width: number;
  height: number;
  pixel_ratio: number;
  duration_s: number;
  /** Passos de simulação (60 por segundo se acompanhou o relógio). */
  sim_steps: number;
  started_at: string;
}
