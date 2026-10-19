/** Áudio do app: um diretor único sobre o tocador da plataforma. */

import { app } from "@/src/store";

import { AudioDirector } from "./director";
import { NativeAudio } from "./native";

const backend = new NativeAudio();
export const audio = new AudioDirector(backend, { music: true, sfx: true });

/** Prepara os efeitos e acompanha os ajustes de música/efeitos. */
export async function initAudio(): Promise<void> {
  const apply = () => {
    const s = app.get().settings;
    audio.setPrefs({ music: s.music, sfx: s.sfx });
  };
  apply();
  app.subscribe(apply);
  await backend.init().catch(() => undefined);
}
