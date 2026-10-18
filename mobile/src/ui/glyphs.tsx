/**
 * Catálogo único de ícones (como `Glyphs` do launcher): vetores de traço 1,7 numa
 * grade de 24, da mesma família, monocromáticos na cor do texto. Ícone novo = um
 * caminho aqui; não misture bibliotecas.
 */

import Svg, { Circle, Path, Rect } from "react-native-svg";

export type GlyphName =
  | "arcade"
  | "online"
  | "versus"
  | "team"
  | "training"
  | "characters"
  | "profile"
  | "ranking"
  | "premium"
  | "settings"
  | "back"
  | "pause"
  | "play"
  | "download"
  | "delete"
  | "check"
  | "close"
  | "refresh"
  | "room"
  | "history"
  | "upload"
  | "chevron";

const PATHS: Record<GlyphName, string[]> = {
  arcade: ["M6 20h12", "M8 20v-4h8v4", "M12 16V9", "M12 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  online: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M3 12h18", "M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9", "M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9"],
  team: [
    "M12 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    "M5 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
    "M19 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
    "M7.5 19v-3a4.5 4.5 0 0 1 9 0v3",
    "M2 18v-2a3 3 0 0 1 4-2.8",
    "M22 18v-2a3 3 0 0 0-4-2.8",
  ],
  versus: ["M4 4l9 9", "M20 4l-9 9", "M7 14l-3 3 3 3 3-3", "M17 14l3 3-3 3-3-3"],
  training: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "M12 11v2", "M11 12h2"],
  characters: ["M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6", "M16 5a3 3 0 0 1 0 6", "M17 14c2.4.6 4 2.9 4 6"],
  profile: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"],
  ranking: ["M8 4h8v5a4 4 0 0 1-8 0V4z", "M8 6H5a3 3 0 0 0 3 4", "M16 6h3a3 3 0 0 1-3 4", "M12 13v4", "M8 20h8"],
  premium: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
  settings: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  ],
  back: ["M19 12H5", "M11 6l-6 6 6 6"],
  pause: ["M8 5v14", "M16 5v14"],
  play: ["M7 4l13 8-13 8V4z"],
  download: ["M12 4v11", "M7 10l5 5 5-5", "M4 20h16"],
  delete: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"],
  check: ["M4 12l5 5L20 6"],
  close: ["M5 5l14 14", "M19 5L5 19"],
  refresh: ["M20 12a8 8 0 1 1-2.3-5.7", "M20 4v5h-5"],
  room: ["M14 9a4 4 0 1 0-4 4", "M10 13l-6 6", "M6 17l2 2", "M14 9h7v4h-2"],
  history: ["M12 7v5l3 2", "M4 12a8 8 0 1 0 2.3-5.7", "M4 4v4h4"],
  upload: ["M12 20V9", "M7 14l5-5 5 5", "M4 4h16"],
  chevron: ["M9 6l6 6-6 6"],
};

type Props = { readonly name: GlyphName; readonly size?: number; readonly color: string };

export function Glyph({ name, size = 24, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      {PATHS[name].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={1.7} strokeLinecap="square" strokeLinejoin="miter" />
      ))}
    </Svg>
  );
}

/** Marca do app: quadrado plano com dois traços cruzados (golpe), na cor de destaque. */
export function AppMark({ size = 32, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={0} y={0} width={24} height={24} fill={color} />
      <Path d="M6 6l12 12M18 6L6 18" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="square" />
      <Circle cx={12} cy={12} r={2.2} fill="#FFFFFF" />
    </Svg>
  );
}

export const GLYPHS = Object.keys(PATHS) as GlyphName[];
