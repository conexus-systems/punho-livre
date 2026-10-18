/**
 * Controles na tela: direcional flutuante (metade esquerda) e os 6 botões do
 * MUGEN (x y z / a b c) à direita, mais botões "assistidos" que executam o
 * comando de especial/super inteiro num toque (opcional nas configurações).
 *
 * Multitoque via `nativeEvent.touches` num único overlay — funciona igual em
 * Android e iOS sem bibliotecas de gesto.
 */

import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Text, useWindowDimensions, View, type GestureResponderEvent } from "react-native";
import * as Haptics from "expo-haptics";

import { Btn } from "@/src/engine/input";
import { Glyph } from "@/src/ui/glyphs";
import { TYPE } from "@/src/ui/type";
import { useTokens } from "@/src/ui/theme";

export interface AssistButton {
  id: string;
  label: string;
  enabled: boolean;
}

type Props = {
  readonly inputRef: MutableRefObject<number>;
  readonly assists: AssistButton[];
  readonly onAssist: (id: string) => void;
  readonly haptics: boolean;
  readonly onPause: () => void;
};

// W10M: botões planos e quadrados; só o estado ativo usa a cor de destaque.
const BUTTONS = [
  { key: "x", bit: Btn.x, row: 0, col: 0 },
  { key: "y", bit: Btn.y, row: 0, col: 1 },
  { key: "z", bit: Btn.z, row: 0, col: 2 },
  { key: "a", bit: Btn.a, row: 1, col: 0 },
  { key: "b", bit: Btn.b, row: 1, col: 1 },
  { key: "c", bit: Btn.c, row: 1, col: 2 },
] as const;

const DEAD_ZONE = 14;

function dirFromDelta(dx: number, dy: number): number {
  if (Math.hypot(dx, dy) < DEAD_ZONE) return 0;
  const a = Math.atan2(dy, dx); // tela: y para baixo
  const oct = Math.round(a / (Math.PI / 4)) & 7; // 0 = direita, 2 = baixo, 4 = esquerda, 6 = cima
  return [Btn.R, Btn.R | Btn.D, Btn.D, Btn.D | Btn.L, Btn.L, Btn.L | Btn.U, Btn.U, Btn.U | Btn.R][oct];
}

export function TouchControls({ inputRef, assists, onAssist, haptics, onPause }: Props) {
  const { width, height } = useWindowDimensions();
  const t = useTokens();
  const btnR = Math.min(34, height * 0.085);
  const gap = btnR * 0.35;
  const layout = useMemo(() => {
    const right = width - btnR - 24;
    const bottom = height - btnR - 18;
    return BUTTONS.map((b) => ({
      ...b,
      cx: right - (2 - b.col) * (btnR * 2 + gap) + b.row * btnR * 0.5,
      cy: bottom - (1 - b.row) * (btnR * 2 + gap * 0.6),
    }));
  }, [width, height, btnR, gap]);
  const assistLayout = useMemo(
    () =>
      assists.map((a, i) => ({
        ...a,
        x: width - 24 - (assists.length - i) * (btnR * 1.9 + 6),
        y: height - (btnR * 2 + gap) * 2 - btnR * 1.5 - 18,
        w: btnR * 1.9,
        h: btnR * 1.1,
      })),
    [assists, width, height, btnR, gap],
  );

  const origins = useRef(new Map<string, { x: number; y: number }>());
  const assistTouches = useRef(new Set<string>());
  const [stick, setStick] = useState<{ x: number; y: number; dir: number } | null>(null);
  const [pressed, setPressed] = useState(0);

  const update = useCallback(
    (e: GestureResponderEvent) => {
      const touches = e.nativeEvent.touches;
      let dir = 0;
      let buttons = 0;
      let stickState: { x: number; y: number; dir: number } | null = null;
      const alive = new Set<string>();
      for (const t of touches) {
        const id = String(t.identifier);
        alive.add(id);
        const x = t.pageX;
        const y = t.pageY;
        if (x < width * 0.42) {
          let o = origins.current.get(id);
          if (!o) {
            o = { x, y };
            origins.current.set(id, o);
          }
          dir = dirFromDelta(x - o.x, y - o.y);
          // a base acompanha o dedo se ele for longe demais (direcional "flutuante")
          const d = Math.hypot(x - o.x, y - o.y);
          if (d > 60) {
            o.x = x - ((x - o.x) / d) * 60;
            o.y = y - ((y - o.y) / d) * 60;
          }
          stickState = { x: o.x, y: o.y, dir };
          continue;
        }
        const assist = assistLayout.find((a) => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
        if (assist) {
          if (!assistTouches.current.has(id) && assist.enabled) {
            assistTouches.current.add(id);
            onAssist(assist.id);
            if (haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          continue;
        }
        for (const b of layout) {
          if (Math.hypot(x - b.cx, y - b.cy) <= btnR * 1.15) buttons |= b.bit;
        }
      }
      for (const id of [...origins.current.keys()]) if (!alive.has(id)) origins.current.delete(id);
      for (const id of [...assistTouches.current]) if (!alive.has(id)) assistTouches.current.delete(id);
      inputRef.current = dir | buttons;
      if (buttons !== pressed) {
        if (haptics && (buttons & ~pressed) !== 0) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPressed(buttons);
      }
      setStick((prev) => (prev?.dir === stickState?.dir && prev?.x === stickState?.x ? prev : stickState));
    },
    [width, layout, assistLayout, btnR, inputRef, onAssist, haptics, pressed],
  );

  const release = useCallback(
    (e: GestureResponderEvent) => {
      update(e);
    },
    [update],
  );

  const knob = stick ? { dx: (stick.dir & Btn.R ? 1 : stick.dir & Btn.L ? -1 : 0) * 26, dy: (stick.dir & Btn.D ? 1 : stick.dir & Btn.U ? -1 : 0) * 26 } : null;

  return (
    <View
      style={{ position: "absolute", left: 0, top: 0, width, height }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={update}
      onResponderMove={update}
      onResponderRelease={release}
      onResponderTerminate={() => {
        inputRef.current = 0;
        origins.current.clear();
        setStick(null);
        setPressed(0);
      }}
      onTouchStart={update}
      onTouchMove={update}
      onTouchEnd={release}
      onTouchCancel={release}
    >
      {/* direcional */}
      {stick ? (
        <View pointerEvents="none" style={{ position: "absolute", left: stick.x - 50, top: stick.y - 50, width: 100, height: 100, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", backgroundColor: "rgba(0,0,0,0.3)" }}>
          <View style={{ position: "absolute", left: 50 - 20 + (knob?.dx ?? 0), top: 50 - 20 + (knob?.dy ?? 0), width: 40, height: 40, backgroundColor: stick.dir ? t.accent : "rgba(255,255,255,0.6)" }} />
        </View>
      ) : (
        <View pointerEvents="none" style={{ position: "absolute", left: 40, top: height - 150, width: 100, height: 100, borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" }}>
          <Text style={[TYPE.CAPTION, { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 40 }]}>mover</Text>
        </View>
      )}

      {/* botões */}
      {layout.map((b) => {
        const on = (pressed & b.bit) !== 0;
        return (
          <View
            key={b.key}
            pointerEvents="none"
            accessibilityLabel={`Botão ${b.key}`}
            style={{
              position: "absolute",
              left: b.cx - btnR,
              top: b.cy - btnR,
              width: btnR * 2,
              height: btnR * 2,
              backgroundColor: on ? t.accent : "rgba(0,0,0,0.4)",
              borderWidth: 2,
              borderColor: on ? t.accent : "rgba(255,255,255,0.7)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "300", fontSize: btnR * 0.8 }}>{b.key}</Text>
          </View>
        );
      })}

      {/* especiais assistidos */}
      {assistLayout.map((a) => (
        <View
          key={a.id}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: a.x,
            top: a.y,
            width: a.w,
            height: a.h,
            backgroundColor: a.enabled ? t.accentSoft : "rgba(0,0,0,0.35)",
            borderWidth: a.enabled ? 0 : 1,
            borderColor: "rgba(255,255,255,0.25)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text numberOfLines={1} style={[TYPE.CAPTION, { color: a.enabled ? "#FFFFFF" : "rgba(255,255,255,0.4)" }]}>
            {a.label}
          </Text>
        </View>
      ))}

      {/* pausa */}
      <View
        style={{ position: "absolute", left: width / 2 - 24, top: height - 56, width: 48, height: 48, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={onPause}
        accessibilityRole="button"
        accessibilityLabel="Pausar"
      >
        <Glyph name="pause" color="#FFFFFF" />
      </View>
    </View>
  );
}
