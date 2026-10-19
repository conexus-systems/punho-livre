import { useRef, useState } from "react";
import { PanResponder, Text, View, type LayoutChangeEvent } from "react-native";

import { sliderStep } from "@/src/ui/rules";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

type Props = {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly format?: (v: number) => string;
  readonly onChange: (v: number) => void;
};

/** Slider W10M: trilho de 2 dp, parte preenchida no destaque, polegar retangular 8×24. */
export function MetroSlider({ label, value, min, max, step = 1, format = String, onChange }: Props) {
  const t = useTokens();
  const [width, setWidth] = useState(0);
  const latest = useRef({ width, min, max, step, onChange });
  latest.current = { width, min, max, step, onChange };

  const fromX = (x: number) => {
    const l = latest.current;
    const ratio = l.width > 0 ? Math.max(0, Math.min(1, x / l.width)) : 0;
    const raw = l.min + ratio * (l.max - l.min);
    return Math.round(raw / l.step) * l.step;
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => latest.current.onChange(fromX(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => latest.current.onChange(fromX(e.nativeEvent.locationX)),
    }),
  ).current;

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const keyStep = Math.max(step, sliderStep(max - min));
  return (
    <View style={{ gap: space.xs, paddingVertical: space.sm }}>
      <Text style={[TYPE.BODY, { color: t.text }]}>
        {label}: <Text style={{ color: t.accentText }}>{format(value)}</Text>
      </Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: format(value) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => onChange(Math.max(min, Math.min(max, value + (e.nativeEvent.actionName === "increment" ? keyStep : -keyStep))))}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: 32, justifyContent: "center" }}
        {...pan.panHandlers}
      >
        <View style={{ height: 2, backgroundColor: t.muted }} />
        <View style={{ position: "absolute", left: 0, height: 2, width: width * ratio, backgroundColor: t.accentText }} />
        <View style={{ position: "absolute", left: Math.max(0, width * ratio - 4), width: 8, height: 24, backgroundColor: t.text }} />
      </View>
    </View>
  );
}
