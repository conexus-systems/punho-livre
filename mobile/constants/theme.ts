/** Tokens visuais do MUGEN Arena (arcade escuro). Mantém o formato do template CONEXUS. */
export const colors = {
  bg: "#0B0B12",
  surface: "#16161F",
  surfaceHigh: "#22222E",
  ink: "#F8FAFC",
  inkSecondary: "#A1A1AA",
  primary: "#FACC15",
  onPrimary: "#111111",
  accent: "#EF4444",
  error: "#F87171",
  border: "#2E2E3A",
  success: "#22C55E",
  online: "#38BDF8",
} as const;

export const colorsDark = colors;

export const fonts = {
  regular: "System",
  medium: "System",
  semibold: "System",
  bold: "System",
} as const;

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const spacing = {
  screen: 20,
  card: 18,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const minTouch = 44;
