import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

type Props = {
  /** Nome do app em maiúsculas acima do título (kicker). */
  readonly kicker?: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Até 2 ações (ex.: MetroButton variante "text"). */
  readonly actions?: ReactNode;
};

/** Cabeçalho W10M: rótulo em maiúsculas + título grande e leve à esquerda. */
export function MetroHeader({ kicker = "MUGEN ARENA", title, subtitle, actions }: Props) {
  const t = useTokens();
  return (
    <View style={{ paddingTop: space.sm, paddingBottom: space.sm, flexDirection: "row", alignItems: "flex-end" }}>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.KICKER, { color: t.text }]}>{kicker}</Text>
        <Text accessibilityRole="header" numberOfLines={2} style={[TYPE.HEADER, { color: t.text, marginTop: 2 }]}>
          {title}
        </Text>
        {subtitle ? <Text style={[TYPE.CAPTION, { color: t.muted, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={{ flexDirection: "row", gap: space.sm }}>{actions}</View> : null}
    </View>
  );
}
