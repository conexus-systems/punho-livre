/** No app rodando no navegador (react-native-web), o áudio é o WebAudio. */
import { WebAudio } from "./web";

export class NativeAudio extends WebAudio {
  async init(): Promise<void> {
    if (typeof window === "undefined") return;
    const unlock = () => this.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }
}
