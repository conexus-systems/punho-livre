/**
 * Tema W10M (porte de `ui/Theme.kt` + `ui/Conexus.kt`): modo escuro/claro, destaque,
 * espaçamento em grade de 8, alvos de 48 dp. Nenhuma tela define cor, raio ou
 * duração própria: usa estes tokens. Preferências persistidas no AsyncStorage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { createStore } from "@/src/store";

import { DEFAULT_ACCENT, forBackground, forWhiteText, parseLoose, withAlpha, type Hex } from "./accent";

export type Mode = "dark" | "light";

export interface ThemePrefs {
  mode: Mode;
  accent: Hex;
  /** "Animações" (o "Remover animações" do sistema também desliga). */
  animations: boolean;
  /** Velocidade das animações: 50 lenta, 100 normal, 150 rápida. */
  speed: 50 | 100 | 150;
}

const KEY = "mugen-arena.theme";

export const themeStore = createStore<ThemePrefs>({ mode: "dark", accent: DEFAULT_ACCENT, animations: true, speed: 100 });

export async function loadTheme(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<ThemePrefs>;
    themeStore.set({
      mode: saved.mode === "light" ? "light" : "dark",
      accent: parseLoose(saved.accent) ?? DEFAULT_ACCENT,
      animations: saved.animations !== false,
      speed: saved.speed === 50 || saved.speed === 150 ? saved.speed : 100,
    });
  } catch {
    // preferência corrompida: fica o padrão
  }
}

export function setTheme(patch: Partial<ThemePrefs>): void {
  themeStore.set(patch);
  void AsyncStorage.setItem(KEY, JSON.stringify(themeStore.get())).catch(() => undefined);
}

const PALETTES = {
  dark: {
    bg: "#000000",
    text: "#FFFFFF",
    muted: "#CCCCCC",
    chrome: "#1A1A1A",
    surface: "#2B2B2B",
    edge: "rgba(255,255,255,0.2)",
    disabled: "rgba(255,255,255,0.4)",
    scrim: "rgba(0,0,0,0.6)",
  },
  light: {
    bg: "#FFFFFF",
    text: "#000000",
    muted: "#505050",
    chrome: "#F2F2F2",
    surface: "#E6E6E6",
    edge: "rgba(0,0,0,0.2)",
    disabled: "rgba(0,0,0,0.4)",
    scrim: "rgba(0,0,0,0.6)",
  },
} as const;

export interface Tokens {
  mode: Mode;
  bg: string;
  text: string;
  muted: string;
  chrome: string;
  surface: string;
  edge: string;
  disabled: string;
  scrim: string;
  /** Fundo de bloco/botão primário (texto branco ≥ 4,5:1). */
  accent: Hex;
  /** Destaque como texto/linha sobre a página (≥ 4,5:1). */
  accentText: Hex;
  /** Bloco translúcido sobre o fundo. */
  accentSoft: string;
  danger: Hex;
  onAccent: "#FFFFFF";
}

export function tokensFor(prefs: Pick<ThemePrefs, "mode" | "accent">): Tokens {
  const p = PALETTES[prefs.mode];
  const accent = forWhiteText(prefs.accent);
  return {
    mode: prefs.mode,
    ...p,
    accent,
    accentText: forBackground(prefs.accent, p.bg),
    accentSoft: withAlpha(accent, 0.85),
    danger: prefs.mode === "dark" ? "#E81123" : "#C50F1F",
    onAccent: "#FFFFFF",
  };
}

const cache = new Map<string, Tokens>();

export function useTokens(): Tokens {
  const mode = themeStore.use((s) => s.mode);
  const accent = themeStore.use((s) => s.accent);
  const key = `${mode}:${accent}`;
  let t = cache.get(key);
  if (!t) {
    t = tokensFor({ mode, accent });
    cache.set(key, t);
  }
  return t;
}

/** Espaçamento (grade de 8) e alvos — iguais ao launcher. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const TARGET = 48;
export const ROW_HEIGHT = 56;
