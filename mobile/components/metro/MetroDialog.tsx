import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { dialogButtons, isDestructive } from "@/src/ui/rules";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

import { MetroButton } from "./MetroButton";

type Props = {
  readonly visible: boolean;
  readonly title: string;
  readonly message?: string;
  readonly children?: ReactNode;
  readonly positive?: string;
  readonly neutral?: string;
  readonly negative?: string;
  readonly onPositive?: () => void;
  readonly onNeutral?: () => void;
  readonly onNegative?: () => void;
  /** Toque fora / Voltar fecha (chama onNegative). */
  readonly cancelable?: boolean;
};

/**
 * Diálogo W10M: no telefone em pé ocupa a largura no topo (como no Lumia); em paisagem
 * ou tablet fica com 480 dp no centro. Fundo escurecido 60%. Botões lado a lado:
 * primário, secundário, fechar; primário vira vermelho se a ação for destrutiva.
 */
export function MetroDialog(p: Props) {
  const t = useTokens();
  const { width, height } = useWindowDimensions();
  const portraitPhone = width < height && width < 600;
  const order = dialogButtons(p.positive, p.neutral, p.negative);
  const close = () => {
    if (p.cancelable !== false) p.onNegative?.();
  };

  return (
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={close} supportedOrientations={["landscape", "portrait"]}>
      <Pressable accessibilityLabel="Fechar diálogo" onPress={close} style={{ flex: 1, backgroundColor: t.scrim, justifyContent: portraitPhone ? "flex-start" : "center", alignItems: "center" }}>
        <Pressable
          accessibilityViewIsModal
          onPress={() => undefined}
          style={{ width: portraitPhone ? "100%" : Math.min(480, width - 32), maxHeight: height - 32, backgroundColor: t.chrome, padding: space.lg, gap: space.md }}
        >
          <Text accessibilityRole="header" style={[TYPE.SUBTITLE, { color: t.text }]}>
            {p.title}
          </Text>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm }}>
            {p.message ? <Text style={[TYPE.BODY, { color: t.text }]}>{p.message}</Text> : null}
            {p.children}
          </ScrollView>
          {order.length > 0 ? (
            <View style={{ flexDirection: "row", gap: space.sm }}>
              {order.map((b) => {
                const label = b === "positive" ? p.positive! : b === "neutral" ? p.neutral! : p.negative!;
                const onPress = b === "positive" ? p.onPositive : b === "neutral" ? p.onNeutral : p.onNegative;
                const kind = b === "positive" ? (isDestructive(label) ? "danger" : "primary") : "secondary";
                return <MetroButton key={b} label={label} kind={kind} onPress={() => onPress?.()} style={{ flex: 1 }} />;
              })}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
