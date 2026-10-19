import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { Glyph, type GlyphName } from "@/src/ui/glyphs";
import { duration, FLIP_MS, motionEnabled, usePress } from "@/src/ui/motion";
import { TILE_CELLS, type TileSize } from "@/src/ui/tiles";
import { TYPE } from "@/src/ui/type";
import { useTokens } from "@/src/ui/theme";

type Props = {
  readonly title: string;
  readonly size: TileSize;
  /** Lado de uma célula pequena em dp (o médio é 2× + margem). */
  readonly cell: number;
  readonly gap: number;
  readonly glyph?: GlyphName;
  readonly onPress: () => void;
  /** Cor própria do bloco; padrão = destaque. */
  readonly color?: string;
  /** Face "viva" que alterna com a frente (flip de 400 ms). */
  readonly back?: ReactNode;
  /** Intervalo do flip, em ms (padrão 6 s, defasado por bloco). */
  readonly flipEvery?: number;
  readonly badge?: string;
};

/** Live Tile W10M: bloco plano no destaque, ícone ao centro, nome embaixo à esquerda, flip vivo opcional. */
export function LiveTile({ title, size, cell, gap, glyph, onPress, color, back, flipEvery = 6000, badge }: Props) {
  const t = useTokens();
  const press = usePress();
  const cells = TILE_CELLS[size];
  const w = cells.columns * cell + (cells.columns - 1) * gap;
  const h = cells.rows * cell + (cells.rows - 1) * gap;
  const flip = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState<0 | 1>(0);

  useEffect(() => {
    if (!back) return;
    const id = setInterval(() => {
      const next = face === 0 ? 1 : 0;
      if (!motionEnabled()) {
        setFace(next);
        return;
      }
      Animated.timing(flip, { toValue: 0.5, duration: duration(FLIP_MS / 2), useNativeDriver: true }).start(() => {
        setFace(next);
        Animated.timing(flip, { toValue: 1, duration: duration(FLIP_MS / 2), useNativeDriver: true }).start(() => flip.setValue(0));
      });
    }, flipEvery);
    return () => clearInterval(id);
  }, [back, face, flip, flipEvery]);

  const rotateX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "90deg", "0deg"] });
  const bg = color ?? t.accentSoft;
  const small = size === "small";

  return (
    <Animated.View style={[{ width: w, height: h }, press.style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{ flex: 1 }}
      >
        <Animated.View style={{ flex: 1, backgroundColor: bg, overflow: "hidden", transform: [{ perspective: 600 }, { rotateX }] }}>
          {face === 1 && back ? (
            <View style={{ flex: 1 }}>{back}</View>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {glyph ? <Glyph name={glyph} size={small ? 24 : size === "medium" ? 40 : 44} color="#FFFFFF" /> : null}
            </View>
          )}
          {!small ? (
            <Text numberOfLines={1} style={[TYPE.CAPTION, { position: "absolute", left: 8, bottom: 6, right: 28, color: "#FFFFFF" }]}>
              {title}
            </Text>
          ) : null}
          {badge ? <Text style={[TYPE.BODY, { position: "absolute", right: 8, bottom: 4, color: "#FFFFFF", fontWeight: "600" }]}>{badge}</Text> : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
