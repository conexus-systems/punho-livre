import { Pressable, Text, View } from "react-native";

import { toggleState } from "@/src/ui/rules";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

type Props = {
  readonly label: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onChange: (v: boolean) => void;
  readonly disabled?: boolean;
};

/** Interruptor W10M: nome, descrição, trilho 44×20 com bolinha e "Ativado/Desativado" ao lado. */
export function MetroToggle({ label, description, value, onChange, disabled }: Props) {
  const t = useTokens();
  const fg = disabled ? t.disabled : t.text;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{ paddingVertical: space.sm, minHeight: 48 }}
    >
      <Text style={[TYPE.BODY, { color: fg }]}>{label}</Text>
      {description ? <Text style={[TYPE.CAPTION, { color: t.muted }]}>{description}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: space.xs, gap: space.sm }}>
        <View
          style={{
            width: 44,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: value ? t.accent : fg,
            backgroundColor: value ? t.accent : "transparent",
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: value ? "#FFFFFF" : fg, alignSelf: value ? "flex-end" : "flex-start" }} />
        </View>
        <Text style={[TYPE.BODY, { color: fg }]}>{toggleState(value)}</Text>
      </View>
    </Pressable>
  );
}
