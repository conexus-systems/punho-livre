/**
 * Vibração na luta: decide, a partir dos eventos do frame, se o jogador local
 * deve sentir algo. Puro e fora da engine (só lê `w.events`); quem chama
 * (app/fight.tsx) é que aciona o expo-haptics.
 */

import type { GameEvent } from "@/src/engine/types";

/** Do mais forte para o mais fraco. */
export type HitFeel = "hurt" | "hit" | "guard";

const RANK: Record<HitFeel, number> = { hurt: 3, hit: 2, guard: 1 };

/**
 * `hit`/`guard` trazem em `side` quem atacou. Apanhar ("hurt") pesa mais que
 * acertar; defender (dos dois lados) é o mais leve. Devolve o mais forte do lote.
 */
export function hitFeel(events: readonly GameEvent[], localSide: 0 | 1): HitFeel | null {
  let best: HitFeel | null = null;
  for (const e of events) {
    let f: HitFeel | null = null;
    if (e.kind === "hit" || e.kind === "counter") f = e.side === localSide ? "hit" : "hurt";
    else if (e.kind === "guard" || e.kind === "justdefend" || e.kind === "guardcrush") f = "guard";
    if (f && (!best || RANK[f] > RANK[best])) best = f;
  }
  return best;
}

/** Limita a vibração a uma a cada `minGapMs` (combos não viram um zumbido contínuo). */
export class HapticGate {
  private last = -Infinity;
  constructor(private minGapMs = 70) {}

  allow(nowMs: number): boolean {
    if (nowMs - this.last < this.minGapMs) return false;
    this.last = nowMs;
    return true;
  }
}
