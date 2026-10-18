// Ponto de entrada empacotado por scripts/framedata/generate.mjs.
import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import { characterFrameData, frameDataMarkdown, type CharacterFrameData } from "@/src/engine/framedata";
import type { CharacterData } from "@/src/engine/types";

export function builtinFrameData(ids: string[] = BUILTIN_ORDER, dummy = BUILTIN_ORDER[0]): { data: CharacterFrameData[]; markdown: Record<string, string> } {
  const roster: Record<string, CharacterData> = {};
  for (const id of new Set([...ids, dummy])) {
    if (!BUILTIN[id]) throw new Error(`personagem desconhecido: ${id}`);
    roster[id] = loadCharacter(BUILTIN[id].pack);
  }
  const data = ids.map((id) => characterFrameData(roster, BUILTIN[id].pack, dummy));
  const markdown: Record<string, string> = {};
  for (const fd of data) markdown[fd.id] = frameDataMarkdown(fd, roster[dummy].displayName);
  return { data, markdown };
}

export { BUILTIN_ORDER };
