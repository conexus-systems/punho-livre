import { Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Glyph, type GlyphName } from "@/src/ui/glyphs";
import { usePress } from "@/src/ui/motion";
import { isDestructive } from "@/src/ui/rules";
import { TYPE } from "@/src/ui/type";
import { space, TARGET, useTokens } from "@/src/ui/theme";

import { MetroProgress } from "./MetroProgress";

export type ButtonKind = "primary" | "secondary" | "danger" | "text";

type Props = {
  readonly label: string;
  readonly onPress: () => void;
  readonly kind?: ButtonKind;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly glyph?: GlyphName;
  /** Botão largo do W10M: caixa cinza plana, rótulo à esquerda, ícone à direita. */
  readonly wide?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

/** Botão W10M: retângulo plano. Rótulos destrutivos ("Remover", "Sair da conta"…) viram perigo. */
export function MetroButton({ label, onPress, kind, disabled, loading, glyph, wide, style }: Props) {
  const t = useTokens();
  const press = usePress();
  const k: ButtonKind = kind ?? (isDestructive(label) ? "danger" : "secondary");
  const bg = k === "primary" ? t.accent : k === "danger" ? t.danger : k === "secondary" ? t.surface : "transparent";
  const fg = k === "primary" || k === "danger" ? "#FFFFFF" : k === "text" ? t.accentText : t.text;
  const off = disabled || loading;

  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        accessibilityRole={k === "text" ? "link" : "button"}
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(off), busy: Boolean(loading) }}
        disabled={off}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => ({
          minHeight: k === "text" ? 40 : TARGET - 8,
          minWidth: k === "text" ? undefined : 96,
          paddingHorizontal: k === "text" ? 0 : space.md,
          backgroundColor: pressed && k !== "text" ? (k === "secondary" ? t.edge : bg) : bg,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: wide ? "space-between" : "center",
          gap: space.sm,
          borderWidth: k === "secondary" ? 2 : 0,
          borderColor: k === "secondary" ? t.surface : "transparent",
        })}
      >
        {loading ? (
          <MetroProgress color={fg} compact />
        ) : (
          <>
            {glyph && !wide ? <Glyph name={glyph} size={18} color={fg} /> : null}
            <Text style={[TYPE.BODY, { color: fg, fontWeight: k === "text" ? "400" : "600" }]} numberOfLines={1}>
              {label}
            </Text>
            {glyph && wide ? <Glyph name={glyph} size={18} color={fg} /> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Linha de botões lado a lado (diálogos, rodapés). */
export function MetroButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>{children}</View>;
}
