import { useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, ScrollView, Text, View } from "react-native";

import { useSlideIn } from "@/src/ui/motion";
import { pivotDescription, pivotStep, slideDirection } from "@/src/ui/rules";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

type Props = {
  readonly sections: string[];
  readonly index: number;
  readonly onChange: (index: number) => void;
  /** Conteúdo da seção ativa. Deslizar na horizontal troca de seção (com volta). */
  readonly children: ReactNode;
};

/**
 * Pivô W10M: seções grandes; a ativa em texto pleno com barra de 2 dp no destaque,
 * as outras esmaecidas. Toque, ou deslize horizontal na página; dá a volta.
 */
export function MetroPivot({ sections, index, onChange, children }: Props) {
  const t = useTokens();
  const [from, setFrom] = useState(index);
  const dir = slideDirection(from, index, sections.length);
  const slide = useSlideIn(index, dir);
  const current = useRef({ index, count: sections.length, onChange });
  current.current = { index, count: sections.length, onChange };

  const go = (to: number) => {
    setFrom(current.current.index);
    current.current.onChange(to);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) < 60) return;
          const c = current.current;
          go(pivotStep(c.index, c.count, g.dx < 0 ? 1 : -1));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }} style={{ flexGrow: 0 }}>
        {sections.map((s, i) => {
          const selected = i === index;
          return (
            <Pressable
              key={s}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={pivotDescription(s, i, sections.length, selected)}
              onPress={() => go(i)}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <Text style={[TYPE.TITLE, { color: selected ? t.text : t.disabled }]}>{s.toLowerCase()}</Text>
              <View style={{ height: 2, backgroundColor: selected ? t.accentText : "transparent", marginTop: 2 }} />
            </Pressable>
          );
        })}
      </ScrollView>
      <Animated.View style={[{ flex: 1, marginTop: space.sm }, slide]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
