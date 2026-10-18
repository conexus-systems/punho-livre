/** Carrega as páginas de atlas dos personagens como SkImage. */

import { Image } from "react-native";
import { Skia, type SkImage } from "@shopify/react-native-skia";

import { builtinAtlasModules, getPack } from "@/src/characters/registry";

const cache = new Map<string, Promise<SkImage[]>>();

async function imageFrom(src: string, moduleId?: number): Promise<SkImage | null> {
  try {
    let data;
    if (moduleId !== undefined) {
      const uri = Image.resolveAssetSource(moduleId)?.uri;
      if (!uri) return null;
      data = await Skia.Data.fromURI(uri);
    } else if (src.startsWith("data:")) {
      data = Skia.Data.fromBase64(src.slice(src.indexOf(",") + 1));
    } else {
      data = await Skia.Data.fromURI(src);
    }
    return Skia.Image.MakeImageFromEncoded(data);
  } catch (err) {
    console.warn("[atlas] falha ao carregar página:", (err as Error).message);
    return null;
  }
}

export function loadAtlas(charId: string): Promise<SkImage[]> {
  const hit = cache.get(charId);
  if (hit) return hit;
  const job = (async () => {
    const pack = getPack(charId);
    if (!pack.sprites) return [];
    const pages = Array.isArray(pack.sprites.atlas) ? pack.sprites.atlas : [pack.sprites.atlas];
    const modules = builtinAtlasModules(charId);
    const images = await Promise.all(
      pages.map((src, i) => (src.startsWith("builtin:") ? imageFrom(src, modules[i]) : imageFrom(src))),
    );
    return images.filter((i): i is SkImage => i !== null);
  })();
  cache.set(charId, job);
  return job;
}

export async function loadAtlases(ids: string[]): Promise<Record<string, SkImage[]>> {
  const out: Record<string, SkImage[]> = {};
  await Promise.all(
    ids.map(async (id) => {
      out[id] = await loadAtlas(id);
    }),
  );
  return out;
}
