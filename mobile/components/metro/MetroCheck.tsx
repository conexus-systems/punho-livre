import { Pressable, Text, View } from "react-native";

import { checkDescription } from "@/src/ui/rules";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

type Props = {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  /** "radio": anel no destaque com ponto (opção única). */
  readonly kind?: "check" | "radio";
  readonly description?: string;
};

/** Caixa de seleção quadrada (preenchida no destaque com ✓) ou botão de opção. */
export function MetroCheck({ label, checked, onChange, kind = "check", description }: Props) {
  const t = useTokens();
  const radio = kind === "radio";
  return (
    <Pressable
      accessibilityRole={radio ? "radio" : "checkbox"}
      accessibilityLabel={checkDescription(label, checked)}
      accessibilityState={{ checked }}
      onPress={() => onChange(radio ? true : !checked)}
      style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48 }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: radio ? 10 : 0,
          borderWidth: 2,
          borderColor: checked ? (radio ? t.accentText : t.accent) : t.text,
          backgroundColor: checked && !radio ? t.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && radio ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.text }} /> : null}
        {checked && !radio ? <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", lineHeight: 15 }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.BODY, { color: t.text }]}>{label}</Text>
        {description ? <Text style={[TYPE.CAPTION, { color: t.muted }]}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}
