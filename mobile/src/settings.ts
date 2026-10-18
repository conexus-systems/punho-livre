/** Ajustes do jogo persistidos (assistido, vibração, dificuldade, atraso online, botões, som, reduzir movimento). */

import AsyncStorage from "@react-native-async-storage/async-storage";

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
        reduceMotion: typeof s.reduceMotion === "boolean" ? s.reduceMotion : cur.reduceMotion,
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
