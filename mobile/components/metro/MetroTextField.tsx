import { useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { Glyph } from "@/src/ui/glyphs";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

type Props = Omit<TextInputProps, "style" | "onChangeText" | "value"> & {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (v: string) => void;
  readonly help?: string;
  readonly error?: string | null;
  readonly clearable?: boolean;
};

/**
 * Campo W10M: rótulo acima, caixa quadrada com borda de 2 dp; em foco fica branca com
 * texto preto e borda no destaque; ajuda ou erro logo abaixo (erro anunciado).
 */
export function MetroTextField({ label, value, onChangeText, help, error, clearable, editable = true, ...rest }: Props) {
  const t = useTokens();
  const [focus, setFocus] = useState(false);
  const border = error ? t.danger : focus ? t.accent : t.muted;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[TYPE.BODY, { color: editable ? t.text : t.disabled }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: border, backgroundColor: focus ? "#FFFFFF" : "transparent", minHeight: 40 }}>
        <TextInput
          {...rest}
          editable={editable}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={focus ? "#666666" : t.muted}
          style={[TYPE.BODY, { flex: 1, color: focus ? "#000000" : t.text, paddingHorizontal: space.sm, paddingVertical: 6 }]}
        />
        {clearable && value && focus ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Limpar" onPress={() => onChangeText("")} style={{ padding: space.sm }}>
            <Glyph name="close" size={16} color="#000000" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.CAPTION, { color: t.danger }]}>
          {error}
        </Text>
      ) : help ? (
        <Text style={[TYPE.CAPTION, { color: t.muted }]}>{help}</Text>
      ) : null}
    </View>
  );
}
