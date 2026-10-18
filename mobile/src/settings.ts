/** Ajustes do jogo persistidos (assistido, vibração, dificuldade, atraso online, botões, som, controles). */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { sanitizeControls } from "@/src/game/controlLayout";
import { app, type AppState } from "@/src/store";

const KEY = "mugen-arena.settings";

export async function loadSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as Partial<AppState["settings"]>;
    const cur = app.get().settings;
    app.set({
      settings: {
        assist: typeof s.assist === "boolean" ? s.assist : cur.assist,
        vibration: typeof s.vibration === "boolean" ? s.vibration : cur.vibration,
        difficulty: s.difficulty === 1 || s.difficulty === 2 || s.difficulty === 3 ? s.difficulty : cur.difficulty,
        inputDelay: typeof s.inputDelay === "number" && s.inputDelay >= 1 && s.inputDelay <= 4 ? s.inputDelay : cur.inputDelay,
        buttons: s.buttons === "snk" || s.buttons === "mugen" ? s.buttons : cur.buttons,
        music: typeof s.music === "boolean" ? s.music : cur.music,
        sfx: typeof s.sfx === "boolean" ? s.sfx : cur.sfx,
        // quem já jogava antes do modo simples continua no clássico; instalação nova começa no simples
        controls: s.controls === undefined ? { ...cur.controls, mode: "classic" } : sanitizeControls(s.controls),
      },
    });
  } catch {
    // ajustes corrompidos: ficam os padrões
  }
}

export function setSetting<K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]): void {
  app.set((s) => ({ settings: { ...s.settings, [key]: value } }));
  void AsyncStorage.setItem(KEY, JSON.stringify(app.get().settings)).catch(() => undefined);
}

/** Muda parte dos ajustes de controle (modo, direcional, layout…) e salva. */
export function setControls(patch: Partial<AppState["settings"]["controls"]>): void {
  setSetting("controls", sanitizeControls({ ...app.get().settings.controls, ...patch }));
}
