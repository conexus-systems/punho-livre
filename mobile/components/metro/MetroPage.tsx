import type { ReactNode } from "react";
import { Animated, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useEnterPage } from "@/src/ui/motion";
import { space, useTokens } from "@/src/ui/theme";

type Props = {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  /** Margens laterais da página (24 dp). */
  readonly padded?: boolean;
  readonly footer?: ReactNode;
};

/** Página W10M: fundo do tema, entra subindo e aparecendo. */
export function MetroPage({ children, style, padded = true, footer }: Props) {
  const t = useTokens();
  const enter = useEnterPage();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom", "left", "right"]}>
      <Animated.View style={[{ flex: 1, paddingHorizontal: padded ? space.lg : 0 }, enter, style]}>{children}</Animated.View>
      {footer ? <View>{footer}</View> : null}
    </SafeAreaView>
  );
}
