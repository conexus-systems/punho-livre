/**
 * Escala tipográfica W10M (porte de `ui/Type.kt`). A referência é a Segoe UI
 * (licenciada, não distribuível); usamos a sans-serif do sistema em leve/regular/
 * seminegrito. Tudo em sp: a escala de fonte do sistema vale.
 */

import type { TextStyle } from "react-native";

export type Style = "DISPLAY" | "HEADER" | "TITLE" | "SUBTITLE" | "GROUP" | "BODY" | "CAPTION" | "KICKER";

export const TYPE: Record<Style, TextStyle> = {
  DISPLAY: { fontSize: 64, fontWeight: "300", letterSpacing: -1 },
  HEADER: { fontSize: 34, fontWeight: "300" },
  TITLE: { fontSize: 28, fontWeight: "300" },
  SUBTITLE: { fontSize: 20, fontWeight: "400" },
  GROUP: { fontSize: 16, fontWeight: "400" },
  BODY: { fontSize: 15, fontWeight: "400" },
  CAPTION: { fontSize: 12, fontWeight: "400" },
  KICKER: { fontSize: 12, fontWeight: "600", letterSpacing: 0.72, textTransform: "uppercase" },
};
