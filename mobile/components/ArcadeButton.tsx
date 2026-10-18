import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, minTouch, radii, spacing } from "@/constants/theme";

type Props = {
  readonly label: string;
  readonly sublabel?: string;
  readonly onPress: () => void;
  readonly variant?: "primary" | "secondary" | "danger" | "online";
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly compact?: boolean;
};

const BG = { primary: colors.primary, secondary: colors.surfaceHigh, danger: colors.accent, online: colors.online } as const;
const FG = { primary: colors.onPrimary, secondary: colors.ink, danger: "#FFFFFF", online: "#04263A" } as const;

export function ArcadeButton({ label, sublabel, onPress, variant = "secondary", disabled, style, compact }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: minTouch,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          paddingVertical: compact ? spacing.xs : spacing.sm,
          borderRadius: radii.sm,
          backgroundColor: BG[variant],
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          justifyContent: "center",
          borderWidth: 2,
          borderColor: variant === "secondary" ? colors.border : "transparent",
        },
        style,
      ]}
    >
      <View>
        <Text style={{ color: FG[variant], fontWeight: "800", fontSize: compact ? 14 : 17, letterSpacing: 0.5 }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ color: FG[variant], opacity: 0.75, fontSize: 12, marginTop: 2 }}>{sublabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
