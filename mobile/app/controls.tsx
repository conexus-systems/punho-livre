import { useMemo, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View, type GestureResponderEvent } from "react-native";
import { router } from "expo-router";

import { MetroButton, MetroSlider } from "@/components/metro";
import { BUTTONS, clampItem, DEFAULT_CONTROLS, DEFAULT_LAYOUTS, layoutFor, MAX_SIZE, MIN_SIZE, SCHEME_NAME, SCHEMES, schemeOf, STICK_ID, type LayoutItem, type Scheme } from "@/src/game/controlLayout";
import { setControls } from "@/src/settings";
import { app } from "@/src/store";
import { TYPE } from "@/src/ui/type";
import { space, TARGET, useTokens } from "@/src/ui/theme";

/** Passo das ações de acessibilidade (mover/redimensionar sem arrastar). */
const MOVE_STEP = 0.02;
const SIZE_STEP = 4;

function labelOf(scheme: Scheme, id: string): string {
  if (id === STICK_ID) return "Direcional";
  return BUTTONS[scheme].find((b) => b.id === id)?.label ?? id;
}

/**
 * Editor de layout dos controles da luta: arrastar e redimensionar cada botão
 * e o direcional fixo, opacidade, restaurar padrão. Rascunho local; só grava
 * nos ajustes ao tocar em Salvar.
 */
export default function ControlsEditor() {
  const t = useTokens();
  const { width, height } = useWindowDimensions();
  const settings = app.use((s) => s.settings);
  const [scheme, setScheme] = useState<Scheme>(schemeOf(settings.controls, settings.buttons));
  const [drafts, setDrafts] = useState<Record<Scheme, LayoutItem[]>>(() => ({
    snk: layoutFor("snk", settings.controls.layouts),
    mugen: layoutFor("mugen", settings.controls.layouts),
    simple: layoutFor("simple", settings.controls.layouts),
  }));
  const [opacity, setOpacity] = useState(settings.controls.opacity);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState(true);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const items = drafts[scheme];
  const panelW = Math.min(620, width * 0.7);
  const sel = items.find((i) => i.id === selected) ?? null;
  const labels = useMemo(() => new Map(items.map((i) => [i.id, labelOf(scheme, i.id)])), [items, scheme]);

  const patch = (id: string, change: (it: LayoutItem) => LayoutItem) =>
    setDrafts((d) => ({ ...d, [scheme]: d[scheme].map((it) => (it.id === id ? clampItem(change(it)) : it)) }));

  // uma camada só pega o toque e acha o botão embaixo (como na luta): arrastar não perde o dedo quando o botão anda
  const grant = (e: GestureResponderEvent) => {
    const { pageX: x, pageY: y } = e.nativeEvent;
    const hit = [...items].reverse().find((it) => Math.abs(x - it.x * width) <= it.size / 2 && Math.abs(y - it.y * height) <= it.size / 2);
    if (!hit) {
      drag.current = null;
      return;
    }
    setSelected(hit.id);
    drag.current = { id: hit.id, dx: x - hit.x * width, dy: y - hit.y * height };
  };
  const move = (e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d) return;
    const x = (e.nativeEvent.pageX - d.dx) / width;
    const y = (e.nativeEvent.pageY - d.dy) / height;
    patch(d.id, (it) => ({ ...it, x, y }));
  };

  const save = () => {
    setControls({ layouts: { ...settings.controls.layouts, ...drafts }, opacity });
    router.back();
  };
  const restore = () => {
    setDrafts((d) => ({ ...d, [scheme]: DEFAULT_LAYOUTS[scheme].map((i) => ({ ...i })) }));
    setOpacity(DEFAULT_CONTROLS.opacity);
    setSelected(null);
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: "#000000" }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={() => (drag.current = null)}
      onResponderTerminate={() => (drag.current = null)}
    >
      {/* metade do direcional */}
      <View pointerEvents="none" style={{ position: "absolute", left: width * 0.42, top: 0, bottom: 0, width: 1, backgroundColor: t.edge }} />
      <Text pointerEvents="none" style={[TYPE.CAPTION, { position: "absolute", left: space.md, bottom: space.sm, color: t.muted }]}>
        área do direcional
      </Text>

      {items.map((it) => {
        const size = it.size;
        const isSel = it.id === selected;
        const label = labels.get(it.id) ?? it.id;
        return (
          <View
            key={it.id}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`${label}, ${size} dp`}
            accessibilityHint="Arraste para mover. Ações: aumentar, diminuir e mover."
            accessibilityState={{ selected: isSel }}
            accessibilityActions={[
              { name: "increment", label: "Aumentar" },
              { name: "decrement", label: "Diminuir" },
              { name: "left", label: "Mover para a esquerda" },
              { name: "right", label: "Mover para a direita" },
              { name: "up", label: "Mover para cima" },
              { name: "down", label: "Mover para baixo" },
            ]}
            onAccessibilityAction={(e) => {
              setSelected(it.id);
              const a = e.nativeEvent.actionName;
              patch(it.id, (p) => ({
                ...p,
                size: p.size + (a === "increment" ? SIZE_STEP : a === "decrement" ? -SIZE_STEP : 0),
                x: p.x + (a === "right" ? MOVE_STEP : a === "left" ? -MOVE_STEP : 0),
                y: p.y + (a === "down" ? MOVE_STEP : a === "up" ? -MOVE_STEP : 0),
              }));
            }}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: it.x * width - size / 2,
              top: it.y * height - size / 2,
              width: size,
              height: size,
              backgroundColor: isSel ? t.accent : "rgba(0,0,0,0.4)",
              borderWidth: 2,
              borderColor: isSel ? t.text : "rgba(255,255,255,0.7)",
              alignItems: "center",
              justifyContent: "center",
              opacity,
            }}
          >
            <Text numberOfLines={1} style={[TYPE.CAPTION, { color: "#FFFFFF" }]}>
              {label}
            </Text>
          </View>
        );
      })}

      {panel ? (
        <View
          style={{ position: "absolute", top: space.sm, left: (width - panelW) / 2, width: panelW, backgroundColor: t.chrome, paddingHorizontal: space.md, paddingVertical: space.sm }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" }}>
            <Text accessibilityRole="header" style={[TYPE.SUBTITLE, { color: t.text }]}>
              Editar layout
            </Text>
            <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: space.md, flexWrap: "wrap" }}>
              {SCHEMES.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: s === scheme }}
                  accessibilityLabel={SCHEME_NAME[s]}
                  onPress={() => {
                    setScheme(s);
                    setSelected(null);
                  }}
                  style={{ minHeight: TARGET, justifyContent: "center" }}
                >
                  <Text style={[TYPE.BODY, { color: s === scheme ? t.accentText : t.muted }]}>{SCHEME_NAME[s].toLowerCase()}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: space.lg }}>
            <View style={{ flex: 1, justifyContent: "center" }}>
              {sel ? (
                <MetroSlider
                  label={`Tamanho · ${labels.get(sel.id)}`}
                  value={sel.size}
                  min={MIN_SIZE}
                  max={MAX_SIZE}
                  step={2}
                  format={(v) => `${v} dp`}
                  onChange={(v) => patch(sel.id, (it) => ({ ...it, size: v }))}
                />
              ) : (
                <Text style={[TYPE.CAPTION, { color: t.muted }]}>Toque num botão para escolher; arraste para mover.</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <MetroSlider label="Opacidade" value={Math.round(opacity * 100)} min={20} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => setOpacity(v / 100)} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <MetroButton kind="primary" label="Salvar" onPress={save} />
            <MetroButton label="Restaurar padrão" onPress={restore} />
            <MetroButton kind="text" label="Cancelar" onPress={() => router.back()} />
            <MetroButton kind="text" label="Ocultar painel" onPress={() => setPanel(false)} />
          </View>
        </View>
      ) : (
        <View style={{ position: "absolute", top: space.sm, left: width / 2 - 80, width: 160 }}>
          <MetroButton label="Mostrar painel" onPress={() => setPanel(true)} />
        </View>
      )}
    </View>
  );
}
