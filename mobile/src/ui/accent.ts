/**
 * Cor de destaque W10M (porte de conexus-launcher `ui/Accent.kt`). Cores em "#RRGGBB".
 * Blocos levam texto branco, então todo destaque é escurecido até o branco passar
 * de 4,5:1 (WCAG AA); como texto na página, é ajustado ao fundo.
 */

export type Hex = string;

export const DEFAULT_ACCENT: Hex = "#E51400"; // vermelho: cor de jogo de luta

/** 20 cores genéricas no espírito do seletor do Windows Phone (só cores, sem marcas). */
export const PALETTE: [string, Hex][] = [
  ["Lima", "#A4C400"], ["Verde", "#60A917"], ["Esmeralda", "#008A00"], ["Azul-petróleo", "#00ABA9"],
  ["Ciano", "#1BA1E2"], ["Cobalto", "#0050EF"], ["Índigo", "#6A00FF"], ["Violeta", "#AA00FF"],
  ["Rosa", "#F472D0"], ["Magenta", "#D80073"], ["Carmim", "#A20025"], ["Vermelho", "#E51400"],
  ["Laranja", "#FA6800"], ["Âmbar", "#F0A30A"], ["Amarelo", "#E3C800"], ["Marrom", "#825A2C"],
  ["Oliva", "#6D8764"], ["Aço", "#647687"], ["Malva", "#76608A"], ["Areia", "#87794E"],
];

/** As dez cores clássicas, oferecidas primeiro em Ajustes › Personalização. */
export const ESSENTIALS: [string, Hex][] = [
  ["Azul", "#0050EF"], ["Ciano", "#1BA1E2"], ["Verde", "#60A917"], ["Lima", "#A4C400"], ["Laranja", "#FA6800"],
  ["Amarelo", "#E3C800"], ["Vermelho", "#E51400"], ["Magenta", "#D80073"], ["Roxo", "#AA00FF"], ["Cinza", "#647687"],
];

export const MORE: [string, Hex][] = PALETTE.filter(([, c]) => !ESSENTIALS.some(([, e]) => e === c));

export function toInt(hex: Hex): number {
  return Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
}

export function toHex(rgb: number): Hex {
  return `#${(rgb & 0xffffff).toString(16).padStart(6, "0").toUpperCase()}`;
}

export function colorName(hex: Hex): string {
  const up = hex.toUpperCase();
  return [...ESSENTIALS, ...PALETTE].find(([, c]) => c === up)?.[0] ?? `Personalizada (${up})`;
}

/** Aceita o que a pessoa digita: "#1ba1e2", "1BA1E2" ou "#1BE". */
export function parseLoose(value: string | null | undefined): Hex | null {
  const raw = (value ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) return `#${raw.split("").map((c) => c + c).join("").toUpperCase()}`;
  return null;
}

export function luminance(hex: Hex): number {
  const v = toInt(hex);
  const ch = (shift: number) => {
    const c = ((v >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(16) + 0.7152 * ch(8) + 0.0722 * ch(0);
}

export function contrast(a: Hex, b: Hex): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function scale(hex: Hex, factor: number): Hex {
  const v = toInt(hex);
  const c = (shift: number) => Math.max(0, Math.min(255, Math.trunc(((v >> shift) & 0xff) * factor)));
  return toHex((c(16) << 16) | (c(8) << 8) | c(0));
}

/** [amount] (0–1) de `other` misturado em `color`. */
export function mix(color: Hex, other: Hex, amount: number): Hex {
  const a = toInt(color);
  const b = toInt(other);
  const c = (shift: number) =>
    Math.max(0, Math.min(255, Math.trunc(((a >> shift) & 0xff) * (1 - amount) + ((b >> shift) & 0xff) * amount)));
  return toHex((c(16) << 16) | (c(8) << 8) | c(0));
}

/** Escurece em passos de 5% até o texto branco passar de AA; cores que já passam voltam iguais. */
export function forWhiteText(color: Hex): Hex {
  let current = color.toUpperCase();
  for (let i = 0; i < 40; i++) {
    if (contrast(current, "#FFFFFF") >= 4.5) return current;
    current = scale(current, 0.95);
  }
  return current;
}

/** Ajusta a cor até 4,5:1 como texto sobre `background`: clareia no escuro, escurece no claro. */
export function forBackground(color: Hex, background: Hex): Hex {
  let current = color.toUpperCase();
  const dark = luminance(background) < 0.5;
  for (let i = 0; i < 40; i++) {
    if (contrast(current, background) >= 4.5) return current;
    current = dark ? mix(current, "#FFFFFF", 0.1) : scale(current, 0.92);
  }
  return current;
}

/** "#RRGGBB" + alfa 0–1 → "#RRGGBBAA". */
export function withAlpha(hex: Hex, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${hex.slice(0, 7)}${a}`;
}
