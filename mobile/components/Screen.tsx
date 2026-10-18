import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { spacing } from "@/constants/theme";
import { useColors } from "@/hooks/useColors";

type Props = {
  readonly children: ReactNode;
  readonly edges?: readonly Edge[];
  readonly padded?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  edges = ["top", "bottom"],
  padded = true,
  style,
}: Props) {
  const c = useColors();
  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: c.bg }, style]}
      edges={[...edges]}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: padded ? spacing.screen : 0,
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
