/** Configuração da próxima luta (passada do menu/seleção para a tela de luta). */

import type { MatchInfo } from "@/src/net/online";
import { createStore } from "@/src/store";

export type Mode = "arcade" | "versus" | "training" | "online" | "team";

export interface MatchSetup {
  mode: Mode;
  p1: string | null;
  p2: string | null;
  stage: string;
  /** Arcade: oponentes restantes, em ordem. */
  ladder: string[];
  /** Arcade: índice da luta atual (1-based) e total. */
  stageNo: number;
  continues: number;
  online: MatchInfo | null;
  /** Equipes 3×3 (KOF): lutadores na ordem de entrada. */
  team1: string[];
  team2: string[];
}

export const matchSetup = createStore<MatchSetup>({
  mode: "versus",
  p1: null,
  p2: null,
  stage: "dojo",
  ladder: [],
  stageNo: 0,
  continues: 0,
  online: null,
  team1: [],
  team2: [],
});

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
