/**
 * Layout dos controles touch: posição (fração da tela, pelo centro) e tamanho
 * (dp) de cada botão e do direcional fixo, por esquema. Editado em
 * app/controls.tsx e salvo nos ajustes (src/settings.ts).
 *
 * Posições em fração da tela para o mesmo layout servir em celulares de
 * proporções diferentes; tamanhos em dp, com mínimo de 48 dp (alvo W10M).
 */

import { Btn } from "@/src/engine/input";

import { SimpleBtn } from "./simpleMode";

export type Scheme = "snk" | "mugen" | "simple";
export const SCHEMES: readonly Scheme[] = ["snk", "mugen", "simple"];
export const SCHEME_NAME: Record<Scheme, string> = { snk: "Clássico · 4 botões", mugen: "Clássico · 6 botões", simple: "Simples" };

export interface LayoutItem {
  id: string;
  /** Centro, em fração da largura (0–1). */
  x: number;
  /** Centro, em fração da altura (0–1). */
  y: number;
  /** Lado do botão (dp). */
  size: number;
}

export interface ButtonDef {
  id: string;
  label: string;
  /** Rótulo para leitor de tela. */
  a11y: string;
  bit: number;
  /** Atalho de dois botões (desenhado com borda fina). */
  small?: boolean;
}

/** Alvo mínimo W10M (TARGET em src/ui/theme.ts; repetido aqui para a versão web não puxar o tema do app). */
export const MIN_SIZE = 48;
export const MAX_SIZE = 140;
const EDGE = 0.03;

export const STICK_ID = "stick";

/** Botões de cada esquema. Os do modo simples usam bits virtuais (≥ 1<<16), traduzidos por SimpleController. */
export const BUTTONS: Record<Scheme, ButtonDef[]> = {
  // SNK: A/B fracos embaixo, C/D fortes em cima; atalhos de dois botões à esquerda
  snk: [
    { id: "cd", label: "C+D", a11y: "Botão C+D", bit: Btn.z | Btn.c, small: true },
    { id: "C", label: "C", a11y: "Botão C", bit: Btn.z },
    { id: "D", label: "D", a11y: "Botão D", bit: Btn.c },
    { id: "ab", label: "A+B", a11y: "Botão A+B", bit: Btn.x | Btn.a, small: true },
    { id: "A", label: "A", a11y: "Botão A", bit: Btn.x },
    { id: "B", label: "B", a11y: "Botão B", bit: Btn.a },
  ],
  mugen: [
    { id: "x", label: "x", a11y: "Botão x", bit: Btn.x },
    { id: "y", label: "y", a11y: "Botão y", bit: Btn.y },
    { id: "z", label: "z", a11y: "Botão z", bit: Btn.z },
    { id: "a", label: "a", a11y: "Botão a", bit: Btn.a },
    { id: "b", label: "b", a11y: "Botão b", bit: Btn.b },
    { id: "c", label: "c", a11y: "Botão c", bit: Btn.c },
  ],
  simple: [
    { id: "punch", label: "Soco", a11y: "Botão Soco", bit: SimpleBtn.punch },
    { id: "kick", label: "Chute", a11y: "Botão Chute", bit: SimpleBtn.kick },
    { id: "special", label: "Especial", a11y: "Botão Especial", bit: SimpleBtn.special },
    { id: "super", label: "Super", a11y: "Botão Super", bit: SimpleBtn.super },
  ],
};

const STICK: LayoutItem = { id: STICK_ID, x: 0.14, y: 0.72, size: 120 };

/** Padrões pensados para celular deitado (~19,5:9); continuam válidos em outras proporções. */
export const DEFAULT_LAYOUTS: Record<Scheme, LayoutItem[]> = {
  snk: [
    STICK,
    { id: "cd", x: 0.69, y: 0.64, size: 52 },
    { id: "C", x: 0.79, y: 0.64, size: 66 },
    { id: "D", x: 0.89, y: 0.64, size: 66 },
    { id: "ab", x: 0.71, y: 0.85, size: 52 },
    { id: "A", x: 0.81, y: 0.85, size: 66 },
    { id: "B", x: 0.91, y: 0.85, size: 66 },
  ],
  mugen: [
    STICK,
    { id: "x", x: 0.7, y: 0.65, size: 60 },
    { id: "y", x: 0.8, y: 0.65, size: 60 },
    { id: "z", x: 0.9, y: 0.65, size: 60 },
    { id: "a", x: 0.72, y: 0.86, size: 60 },
    { id: "b", x: 0.82, y: 0.86, size: 60 },
    { id: "c", x: 0.92, y: 0.86, size: 60 },
  ],
  simple: [
    STICK,
    { id: "kick", x: 0.77, y: 0.86, size: 64 },
    { id: "punch", x: 0.89, y: 0.84, size: 76 },
    { id: "special", x: 0.85, y: 0.6, size: 68 },
    { id: "super", x: 0.94, y: 0.38, size: 56 },
  ],
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function clampItem(it: LayoutItem): LayoutItem {
  return {
    id: it.id,
    x: clamp(it.x, EDGE, 1 - EDGE),
    y: clamp(it.y, EDGE, 1 - EDGE),
    size: Math.round(clamp(it.size, MIN_SIZE, MAX_SIZE)),
  };
}

/**
 * Layout válido para o esquema a partir de algo salvo (pode estar velho ou
 * corrompido): ids desconhecidos saem, os que faltam voltam ao padrão, números
 * fora da faixa são presos.
 */
export function sanitizeLayout(scheme: Scheme, raw: unknown): LayoutItem[] {
  const saved = new Map<string, LayoutItem>();
  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      if (typeof o.id !== "string" || ![o.x, o.y, o.size].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
      saved.set(o.id, clampItem({ id: o.id, x: o.x as number, y: o.y as number, size: o.size as number }));
    }
  }
  return DEFAULT_LAYOUTS[scheme].map((d) => saved.get(d.id) ?? { ...d });
}

export function layoutFor(scheme: Scheme, layouts: Partial<Record<Scheme, LayoutItem[]>> | undefined): LayoutItem[] {
  return sanitizeLayout(scheme, layouts?.[scheme]);
}

// ------------------------------------------------------------ ajustes

export interface ControlSettings {
  /** Simples (Especial + direção, auto-combo) ou clássico (botões da engine). */
  mode: "simple" | "classic";
  /** Direcional que aparece onde o polegar toca ou fixo no lugar do layout. */
  stick: "floating" | "fixed";
  /** Zona morta do direcional (dp). */
  deadZone: number;
  /** Opacidade dos controles (0,2–1). */
  opacity: number;
  /** Vibra ao acertar, ser acertado e defender. */
  hitHaptics: boolean;
  layouts: Partial<Record<Scheme, LayoutItem[]>>;
}

export const DEFAULT_CONTROLS: ControlSettings = {
  mode: "simple",
  stick: "floating",
  deadZone: 14,
  opacity: 0.8,
  hitHaptics: true,
  layouts: {},
};

export function sanitizeControls(raw: unknown): ControlSettings {
  const d = DEFAULT_CONTROLS;
  if (!raw || typeof raw !== "object") return { ...d, layouts: {} };
  const o = raw as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, def: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : def);
  const layouts: Partial<Record<Scheme, LayoutItem[]>> = {};
  if (o.layouts && typeof o.layouts === "object") {
    for (const s of SCHEMES) {
      const l = (o.layouts as Record<string, unknown>)[s];
      if (Array.isArray(l)) layouts[s] = sanitizeLayout(s, l);
    }
  }
  return {
    mode: o.mode === "classic" || o.mode === "simple" ? o.mode : d.mode,
    stick: o.stick === "fixed" || o.stick === "floating" ? o.stick : d.stick,
    deadZone: Math.round(num(o.deadZone, 6, 40, d.deadZone)),
    opacity: Math.round(num(o.opacity, 0.2, 1, d.opacity) * 100) / 100,
    hitHaptics: typeof o.hitHaptics === "boolean" ? o.hitHaptics : d.hitHaptics,
    layouts,
  };
}

export function schemeOf(controls: Pick<ControlSettings, "mode">, buttons: "snk" | "mugen"): Scheme {
  return controls.mode === "simple" ? "simple" : buttons;
}
