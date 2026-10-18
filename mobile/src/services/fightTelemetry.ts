/**
 * Eventos de uma luta: `fight_start`, `fight_end` e o resumo `perf` da luta
 * inteira (PerfMonitor). Sem consentimento, `track` não faz nada.
 */

import type { PerfMonitor } from "./perf";
import { track } from "./telemetry";
import type { FIGHT_MODES } from "./telemetrySchema";

export type FightMode = (typeof FIGHT_MODES)[number];
export type FightResult = "win" | "loss" | "draw" | "abandoned" | "quit";

export class FightTelemetry {
  private startedAt = 0;
  private ended = false;

  constructor(private readonly base: { mode: FightMode; p1: string; p2: string; stage: string; difficulty?: number }) {}

  start(): void {
    this.startedAt = Date.now();
    track("fight_start", this.base);
  }

  /** Só a primeira chamada conta (resultado na tela ou saída no meio da luta). */
  end(result: FightResult, perf: PerfMonitor): void {
    if (this.ended || this.startedAt === 0) return;
    this.ended = true;
    const { mode, p1, p2 } = this.base;
    track("fight_end", { mode, p1, p2, result, duration_s: Math.round((Date.now() - this.startedAt) / 1000) });
    const s = perf.totalSnapshot();
    if (s.frames > 0) track("perf", { mode, ...s });
  }
}

/** Resultado do ponto de vista do jogador local (`matchWinner`: 0, 1 ou 2 = empate). */
export function resultFor(matchWinner: number, localSide: 0 | 1): FightResult {
  return matchWinner === 2 ? "draw" : matchWinner === localSide ? "win" : "loss";
}
