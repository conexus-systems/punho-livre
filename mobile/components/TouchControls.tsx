/**
 * Controles na tela (docs/CONTROLS.md).
 *
 * - Clássico: 4 botões SNK (A B C D + A+B e C+D) ou 6 do MUGEN (x y z / a b c).
 * - Simples: Soco, Chute, Especial e Super (bits virtuais, traduzidos em
 *   entradas normais por src/game/simpleMode.ts).
 *
 * Direcional na metade esquerda, flutuante (aparece onde o polegar toca) ou
 * fixo (no lugar do layout), com zona morta e 8 direções com histerese
 * (src/game/dpad.ts). Posição, tamanho e opacidade vêm do layout editável
 * (app/controls.tsx). Botões "assistidos" opcionais executam o comando inteiro.
 *
 * Multitoque via `nativeEvent.touches` num único overlay — funciona igual em
 * Android e iOS sem bibliotecas de gesto.
 */

import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Text, useWindowDimensions, View, type GestureResponderEvent } from "react-native";
import * as Haptics from "expo-haptics";

import { Btn } from "@/src/engine/input";
import { BUTTONS, DEFAULT_LAYOUTS, STICK_ID, type LayoutItem, type Scheme } from "@/src/game/controlLayout";
import { DEFAULT_PAD, DirectionalPad } from "@/src/game/dpad";
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
  /** Esquema: "snk" (A B C D + atalhos), "mugen" (x y z / a b c) ou "simple". */
  readonly layout?: Scheme;
  /** Posições e tamanhos (padrão do esquema se omitido). */
  readonly items?: LayoutItem[];
  readonly opacity?: number;
  readonly stickMode?: "floating" | "fixed";
  readonly deadZone?: number;
  /** Modo simples: o botão Super só aparece aceso com barra. */
  readonly superReady?: boolean;
};

/** Raio máximo do polegar em relação ao centro do direcional antes da base acompanhar. */
const STICK_TRAVEL = 60;

function knobOffset(dir: number, r: number) {
  return { dx: (dir & Btn.R ? 1 : dir & Btn.L ? -1 : 0) * r, dy: (dir & Btn.D ? 1 : dir & Btn.U ? -1 : 0) * r };
}

export function TouchControls({
  inputRef,
  assists,
  onAssist,
  haptics,
  onPause,
  layout: scheme = "snk",
  items,
  opacity = 0.8,
  stickMode = "floating",
  deadZone = DEFAULT_PAD.deadZone,
  superReady = true,
}: Props) {
  const { width, height } = useWindowDimensions();
  const t = useTokens();
  const placed = useMemo(() => {
    const pos = new Map((items ?? DEFAULT_LAYOUTS[scheme]).map((i) => [i.id, i]));
    const defaults = new Map(DEFAULT_LAYOUTS[scheme].map((i) => [i.id, i]));
    return BUTTONS[scheme].map((b) => {
      const it = pos.get(b.id) ?? defaults.get(b.id)!;
      return { ...b, cx: it.x * width, cy: it.y * height, half: it.size / 2 };
    });
  }, [items, scheme, width, height]);
  const stickItem = useMemo(
    () => (items ?? DEFAULT_LAYOUTS[scheme]).find((i) => i.id === STICK_ID) ?? DEFAULT_LAYOUTS[scheme][0],
    [items, scheme],
  );
  const fixedCenter = { x: stickItem.x * width, y: stickItem.y * height };
  const btnTop = placed.reduce((m, b) => Math.min(m, b.cy - b.half), height);
  const assistLayout = useMemo(() => {
    const w = 64;
    const h = 48;
    return assists.map((a, i) => ({ ...a, x: width - 16 - (assists.length - i) * (w + 6), y: Math.max(56, btnTop - h - 12), w, h }));
  }, [assists, width, btnTop]);

  const origins = useRef(new Map<string, { x: number; y: number; pad: DirectionalPad }>());
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
      for (const tc of touches) {
        const id = String(tc.identifier);
        alive.add(id);
        const x = tc.pageX;
        const y = tc.pageY;
        let o = origins.current.get(id);
        if (o || x < width * 0.42) {
          if (!o) {
            const pad = new DirectionalPad({ ...DEFAULT_PAD, deadZone });
            o = stickMode === "fixed" ? { ...fixedCenter, pad } : { x, y, pad };
            origins.current.set(id, o);
          }
          dir = o.pad.update(x - o.x, y - o.y);
          // flutuante: a base acompanha o dedo se ele for longe demais
          const d = Math.hypot(x - o.x, y - o.y);
          if (stickMode === "floating" && d > STICK_TRAVEL) {
            o.x = x - ((x - o.x) / d) * STICK_TRAVEL;
            o.y = y - ((y - o.y) / d) * STICK_TRAVEL;
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
        // folga de 15% em volta do botão: o polegar raramente acerta o centro
        for (const b of placed) {
          const slop = b.half * 1.15;
          if (Math.abs(x - b.cx) <= slop && Math.abs(y - b.cy) <= slop) buttons |= b.bit;
        }
      }
      for (const id of [...origins.current.keys()]) if (!alive.has(id)) origins.current.delete(id);
      for (const id of [...assistTouches.current]) if (!alive.has(id)) assistTouches.current.delete(id);
      inputRef.current = dir | buttons;
      if (buttons !== pressed) {
        if (haptics && (buttons & ~pressed) !== 0) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPressed(buttons);
      }
      setStick((prev) => (prev?.dir === stickState?.dir && prev?.x === stickState?.x && prev?.y === stickState?.y ? prev : stickState));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, placed, assistLayout, inputRef, onAssist, haptics, pressed, stickMode, deadZone, fixedCenter.x, fixedCenter.y],
  );

  const reset = useCallback(() => {
    inputRef.current = 0;
    origins.current.clear();
    setStick(null);
    setPressed(0);
  }, [inputRef]);

  const knob = stick ? knobOffset(stick.dir, 26) : null;
  const base = stick ?? (stickMode === "fixed" ? { ...fixedCenter, dir: 0 } : null);
  const stickSize = stickItem.size;

  return (
    <View
      style={{ position: "absolute", left: 0, top: 0, width, height }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={update}
      onResponderMove={update}
      onResponderRelease={update}
      onResponderTerminate={reset}
      onTouchStart={update}
      onTouchMove={update}
      onTouchEnd={update}
      onTouchCancel={update}
    >
      {/* direcional */}
      {base ? (
        <View
          pointerEvents="none"
          accessibilityLabel="Direcional"
          style={{
            position: "absolute",
            left: base.x - stickSize / 2,
            top: base.y - stickSize / 2,
            width: stickSize,
            height: stickSize,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.5)",
            backgroundColor: "rgba(0,0,0,0.3)",
            opacity,
          }}
        >
          <View
            style={{
              position: "absolute",
              left: stickSize / 2 - 20 + (knob?.dx ?? 0),
              top: stickSize / 2 - 20 + (knob?.dy ?? 0),
              width: 40,
              height: 40,
              backgroundColor: stick?.dir ? t.accent : "rgba(255,255,255,0.6)",
            }}
          />
        </View>
      ) : (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: fixedCenter.x - 50, top: fixedCenter.y - 50, width: 100, height: 100, borderWidth: 2, borderColor: "rgba(255,255,255,0.25)", opacity }}
        >
          <Text style={[TYPE.CAPTION, { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 40 }]}>mover</Text>
        </View>
      )}

      {/* botões */}
      {placed.map((b) => {
        const on = (pressed & b.bit) === b.bit;
        const dim = b.id === "super" && !superReady;
        const size = b.half * 2;
        const words = b.label.length > 3;
        return (
          <View
            key={b.id}
            pointerEvents="none"
            accessibilityLabel={b.a11y}
            accessibilityState={{ disabled: dim }}
            style={{
              position: "absolute",
              left: b.cx - b.half,
              top: b.cy - b.half,
              width: size,
              height: size,
              backgroundColor: on ? t.accent : "rgba(0,0,0,0.4)",
              borderWidth: b.small ? 1 : 2,
              borderColor: on ? t.accent : dim ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
              alignItems: "center",
              justifyContent: "center",
              opacity: dim ? opacity * 0.5 : opacity,
            }}
          >
            <Text numberOfLines={1} style={{ color: "#FFFFFF", fontWeight: "300", fontSize: words ? Math.max(12, size * 0.2) : b.small ? size * 0.27 : size * 0.4 }}>
              {b.label}
            </Text>
          </View>
        );
      })}

      {/* especiais assistidos */}
      {assistLayout.map((a) => (
        <View
          key={a.id}
          pointerEvents="none"
          accessibilityLabel={a.label}
          accessibilityState={{ disabled: !a.enabled }}
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
            opacity,
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
