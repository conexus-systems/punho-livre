/* Shim de @shopify/react-native-skia para Node: Skia real via CanvasKit. */
import { readFileSync } from "node:fs";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const web = require("@shopify/react-native-skia/lib/commonjs/skia/web");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const types = require("@shopify/react-native-skia/lib/commonjs/skia/types");

export const state: { Skia: any; CK: any; typeface: any } = { Skia: null, CK: null, typeface: null };

export async function initSkia() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const init = require("canvaskit-wasm/bin/full/canvaskit.js");
  const CK = await init({
    locateFile: (f: string) => path.join(path.dirname(require.resolve("canvaskit-wasm/bin/full/canvaskit.js")), f),
  });
  (global as any).CanvasKit = CK;
  state.CK = CK;
  state.Skia = web.JsiSkApi(CK);
  const font = readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");
  state.typeface = state.Skia.Typeface.MakeFreeTypeFaceFromData(state.Skia.Data.fromBytes(new Uint8Array(font)));
}

export const Skia = new Proxy({}, { get: (_t, k) => state.Skia[k] });
export const TileMode = types.TileMode;
export const PaintStyle = types.PaintStyle;
export const BlendMode = types.BlendMode;
export const matchFont = (style: { fontSize?: number }) => state.Skia.Font(state.typeface, style.fontSize ?? 14);
