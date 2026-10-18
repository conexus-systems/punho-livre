/**
 * Opções ocultas de QA (Ajustes › Sobre: tocar 7 vezes na versão libera).
 * - overlay de desempenho na luta (no dev fica sempre disponível);
 * - modo bench (tela /bench).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { createStore } from "@/src/store";

const KEY = "mugen-arena.dev";

export const devOptions = createStore<{ unlocked: boolean; perfOverlay: boolean }>({ unlocked: false, perfOverlay: false });

export async function loadDevOptions(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as { unlocked?: unknown; perfOverlay?: unknown };
    devOptions.set({ unlocked: s.unlocked === true, perfOverlay: s.perfOverlay === true });
  } catch {
    // padrões
  }
}

export function setDevOption(patch: Partial<{ unlocked: boolean; perfOverlay: boolean }>): void {
  devOptions.set(patch);
  void AsyncStorage.setItem(KEY, JSON.stringify(devOptions.get())).catch(() => undefined);
}

/** Overlay ligado? (no build de desenvolvimento, sempre.) */
export function perfOverlayOn(s: { perfOverlay: boolean }): boolean {
  return s.perfOverlay || (typeof __DEV__ !== "undefined" && __DEV__);
}
