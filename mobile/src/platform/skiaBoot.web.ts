/** Web (visualização/QA): carrega o CanvasKit (wasm servido na raiz) antes do primeiro desenho. */
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export async function bootSkia(): Promise<void> {
  await LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" });
}
