import { Modal, Pressable, Text, useWindowDimensions, View } from "react-native";

import { Glyph, type GlyphName } from "@/src/ui/glyphs";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

export interface MenuItem {
  label: string;
  glyph?: GlyphName;
  destructive?: boolean;
  disabled?: boolean;
  checked?: boolean;
  separatorBefore?: boolean;
  onPress: () => void;
}

type Props = {
  readonly anchor: { x: number; y: number } | null;
  readonly items: MenuItem[];
  readonly onClose: () => void;
};

/** Menu de contexto W10M: painel plano com borda de 1 dp, itens de 48 dp, abre sob o toque. */
export function MetroMenu({ anchor, items, onClose }: Props) {
  const t = useTokens();
  const { width, height } = useWindowDimensions();
  if (!anchor) return null;
  const w = 240;
  const h = items.length * 48 + 2;
  const left = Math.max(8, Math.min(width - w - 8, anchor.x));
  const top = Math.max(8, Math.min(height - h - 8, anchor.y));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={["landscape", "portrait"]}>
      <Pressable accessibilityLabel="Fechar menu" onPress={onClose} style={{ flex: 1 }}>
        <View accessibilityViewIsModal accessibilityLabel="Menu" style={{ position: "absolute", left, top, width: w, backgroundColor: t.chrome, borderWidth: 1, borderColor: t.edge }}>
          {items.map((it) => (
            <View key={it.label}>
              {it.separatorBefore ? <View style={{ height: 1, backgroundColor: t.edge }} /> : null}
              <Pressable
                accessibilityRole="menuitem"
                accessibilityState={{ disabled: Boolean(it.disabled), checked: it.checked }}
                disabled={it.disabled}
                onPress={() => {
                  onClose();
                  it.onPress();
                }}
                style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: pressed ? t.edge : "transparent" })}
              >
                {it.glyph ? <Glyph name={it.glyph} size={18} color={it.destructive ? t.danger : it.checked ? t.accentText : t.text} /> : null}
                <Text style={[TYPE.BODY, { color: it.disabled ? t.disabled : it.destructive ? t.danger : it.checked ? t.accentText : t.text }]}>{it.label}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
