import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import { motionEnabled } from "@/src/ui/motion";
import { useTokens } from "@/src/ui/theme";

type Props = {
  /** 0–1 para barra determinada; omitido = 5 pontos correndo. */
  readonly value?: number;
  readonly color?: string;
  readonly compact?: boolean;
};

/** Progresso W10M: indeterminado com 5 pontos correndo; determinado em barra de 4 dp. */
export function MetroProgress({ value, color, compact }: Props) {
  const t = useTokens();
  const c = color ?? t.accentText;
  const run = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (value !== undefined || !motionEnabled()) return;
    const loop = Animated.loop(Animated.timing(run, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [run, value]);

  if (value !== undefined) {
    const v = Math.max(0, Math.min(1, value));
    return (
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }} style={{ height: 4, backgroundColor: t.surface }}>
        <View style={{ height: 4, width: `${v * 100}%`, backgroundColor: c }} />
      </View>
    );
  }

  const width = compact ? 60 : 160;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Carregando" style={{ width, height: compact ? 8 : 12, overflow: "hidden" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const x = run.interpolate({
          inputRange: [0, 0.35 + i * 0.03, 0.65 - i * 0.03, 1],
          outputRange: [-10 - i * 8, width * 0.45 - i * 8, width * 0.55 - i * 8, width + 10],
        });
        return (
          <Animated.View
            key={i}
            style={{ position: "absolute", top: compact ? 2 : 4, width: 4, height: 4, backgroundColor: c, transform: [{ translateX: motionEnabled() ? x : width / 2 - i * 8 }] }}
          />
        );
      })}
    </View>
  );
}
