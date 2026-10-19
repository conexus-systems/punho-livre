/**
 * Movimento W10M (porte de `ui/Motion.kt`): curto (≤ 400 ms), desacelerado,
 * horizontal ou para cima. Desliga com "Animações" desligado nos Ajustes ou com
 * "Remover animações"/"Reduzir movimento" do sistema; aí tudo aparece no estado final.
 */

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

import { themeStore } from "./theme";

export const QUICK_MS = 100;
export const FAST_MS = 167;
export const PAGE_MS = 250;
export const FLIP_MS = 400;
export const STAGGER_MS = 20;
export const STAGGER_MAX = 8;
export const TRAVEL_DP = 40;
export const PRESS_SCALE = 0.97;

/** Curva "entrada" do W10M: começo rápido, pouso longo e suave. */
export const decelerate = Easing.bezier(0.1, 0.9, 0.2, 1);

let systemReduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    systemReduceMotion = v;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => {
  systemReduceMotion = v;
});

export function motionEnabled(): boolean {
  return themeStore.get().animations && !systemReduceMotion;
}

export function duration(base: number): number {
  return Math.round((base * 100) / themeStore.get().speed);
}

export function staggerDelay(index: number): number {
  return duration(STAGGER_MS * Math.max(0, Math.min(STAGGER_MAX, index)));
}

/** Entrada de página: sobe TRAVEL_DP e aparece. Devolve o estilo animado. */
export function useEnterPage(delay = 0) {
  const progress = useRef(new Animated.Value(motionEnabled() ? 0 : 1)).current;
  useEffect(() => {
    if (!motionEnabled()) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: duration(PAGE_MS),
      delay,
      easing: decelerate,
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);
  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [TRAVEL_DP, 0] }) }],
  };
}

/** Deslize do pivô: a seção nova entra do lado de onde veio (+1 da direita, -1 da esquerda). */
export function useSlideIn(key: string | number, direction: number) {
  const x = useRef(new Animated.Value(0)).current;
  const [last, setLast] = useState(key);
  if (last !== key) {
    setLast(key);
    if (motionEnabled() && direction !== 0) x.setValue(direction * TRAVEL_DP * 2);
  }
  useEffect(() => {
    Animated.timing(x, { toValue: 0, duration: duration(FAST_MS), easing: decelerate, useNativeDriver: true }).start();
  }, [key, x]);
  return { transform: [{ translateX: x }] };
}

/** "Empurrão" de 3% no toque (o tilt do W10M lido como pressão). */
export function usePress() {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => {
    if (!motionEnabled()) return;
    Animated.timing(scale, { toValue: v, duration: duration(QUICK_MS), useNativeDriver: true }).start();
  };
  return {
    style: { transform: [{ scale }] },
    onPressIn: () => to(PRESS_SCALE),
    onPressOut: () => to(1),
  };
}
