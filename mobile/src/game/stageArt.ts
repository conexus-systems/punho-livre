/** Carrega as camadas pintadas de um cenário (assets/stages) como SkImage. */

import { imageFrom } from "./atlas";
import { STAGE_ART } from "./stages.generated";
import type { StageImages } from "./stages";

const cache = new Map<string, Promise<StageImages>>();

export function loadStageArt(stageId: string): Promise<StageImages> {
  const hit = cache.get(stageId);
  if (hit) return hit;
  const art = STAGE_ART[stageId];
  const job = (async () => {
    const out: StageImages = {};
    if (!art) return out;
    await Promise.all(
      art.layers.map(async (l) => {
        out[l.name] = (await imageFrom(l.name, l.module)) ?? undefined;
      }),
    );
    return out;
  })();
  cache.set(stageId, job);
  return job;
}
