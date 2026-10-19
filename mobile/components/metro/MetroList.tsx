import type { ReactNode } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";

import { Glyph, type GlyphName } from "@/src/ui/glyphs";
import { TYPE } from "@/src/ui/type";
import { ROW_HEIGHT, space, useTokens } from "@/src/ui/theme";

type RowProps = {
  readonly title: string;
  readonly secondary?: string;
  readonly right?: string | ReactNode;
  readonly glyph?: GlyphName;
  readonly leading?: ReactNode;
  readonly selected?: boolean;
  readonly onPress?: () => void;
  /** Menu de contexto no toque longo (também como ação do leitor de tela). */
  readonly onLongPress?: (e: GestureResponderEvent) => void;
  readonly danger?: boolean;
};

/** Linha W10M: sobre a própria página, sem cartão; seleção com barra de 4 dp no destaque. */
export function MetroRow({ title, secondary, right, glyph, leading, selected, onPress, onLongPress, danger }: RowProps) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityActions={onLongPress ? [{ name: "longpress", label: "Mais opções" }] : undefined}
      onAccessibilityAction={onLongPress ? (e) => e.nativeEvent.actionName === "longpress" && onLongPress(e as unknown as GestureResponderEvent) : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        minHeight: ROW_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.sm,
        backgroundColor: pressed ? t.edge : "transparent",
      })}
    >
      <View style={{ width: 4, alignSelf: "stretch", backgroundColor: selected ? t.accentText : "transparent" }} />
      {leading}
      {glyph ? <Glyph name={glyph} color={danger ? t.danger : selected ? t.accentText : t.text} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.BODY, { color: danger ? t.danger : t.text }]} numberOfLines={1}>
          {title}
        </Text>
        {secondary ? (
          <Text style={[TYPE.CAPTION, { color: t.muted }]} numberOfLines={2}>
            {secondary}
          </Text>
        ) : null}
      </View>
      {typeof right === "string" ? <Text style={[TYPE.CAPTION, { color: t.muted }]}>{right}</Text> : right}
    </Pressable>
  );
}

/** Cabeçalho de grupo de lista (texto no destaque). */
export function MetroGroup({ title }: { title: string }) {
  const t = useTokens();
  return <Text style={[TYPE.GROUP, { color: t.accentText, marginTop: space.md, marginBottom: space.xs }]}>{title}</Text>;
}

export function MetroDivider() {
  const t = useTokens();
  return <View style={{ height: 1, backgroundColor: t.edge }} />;
}

/** Estado vazio/erro: o que falta + uma ação real (nunca só "erro"). */
export function MetroEmpty({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  const t = useTokens();
  return (
    <View style={{ paddingVertical: space.lg, gap: space.sm }}>
      <Text style={[TYPE.SUBTITLE, { color: t.text }]}>{title}</Text>
      {detail ? <Text style={[TYPE.BODY, { color: t.muted }]}>{detail}</Text> : null}
      {action}
    </View>
  );
}
