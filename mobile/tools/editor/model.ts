/**
 * Modelo do editor de hitbox: um personagem com animações editáveis, vindo do elenco
 * embutido (caixas em unidades do MUGEN, sprites no atlas) ou de uma pasta do
 * importador (manifest.json: caixas em pixels relativos ao axis, um PNG por quadro).
 *
 * Tudo aqui é lógico (sem DOM) para dar para testar no jest.
 */

import { loadCharacter, PACK_FORMAT, type CharacterPack } from "@/src/engine/character";
import { characterFrameData, type CharacterFrameData } from "@/src/engine/framedata";
import { finalizeAnimation, parseAir, serializeAir } from "@/src/engine/mugen/air";
import type { Animation, Box, CharacterData } from "@/src/engine/types";

export interface EdFrame {
  group: number;
  index: number;
  /** Só na pasta do importador: arquivo PNG e eixo (px da imagem). */
  file?: string | null;
  axis?: [number, number];
  ox: number;
  oy: number;
  time: number;
  flipH: boolean;
  flipV: boolean;
  clsn1: Box[];
  clsn2: Box[];
}

export interface EdAnim {
  id: number;
  loop: boolean;
  loopStart: number;
  frames: EdFrame[];
}

export interface ManifestFrame {
  file: string | null;
  ticks: number;
  axis?: [number, number];
  flipH?: boolean;
  flipV?: boolean;
  offset?: [number, number];
  clsn1?: number[][];
  clsn2?: number[][];
}

export interface Manifest {
  id: string;
  name: string;
  pixelsPerUnit: number;
  anims: Record<string, { loop?: boolean; loopStart?: number; frames: ManifestFrame[] }>;
  cns: string;
  cmd: string;
  [extra: string]: unknown;
}

export interface EdChar {
  source: "builtin" | "manifest";
  id: string;
  name: string;
  /** Unidade das caixas e offsets: "un" (MUGEN) no embutido, "px" no manifest. */
  unit: "un" | "px";
  /** Pixels de imagem por unidade das caixas (scale do atlas no embutido; 1 no manifest). */
  imagePxPerUnit: number;
  /** Pixels por unidade do MUGEN (para converter o manifest em .air). */
  pixelsPerUnit: number;
  anims: Record<number, EdAnim>;
  /** Textos MUGEN (.def/.cns/.cmd/st) usados para medir a frame data. */
  files: Record<string, string>;
  def: string;
  /** Embutido: "grupo,índice" → [x, y, w, h, eixoX, eixoY, página]. */
  atlasFrames?: Record<string, number[]>;
  manifest?: Manifest;
}

const box = ([x1, y1, x2, y2]: number[]): Box => ({ x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) });
const cloneBoxes = (list: Box[]) => list.map((b) => ({ ...b }));

/** Personagem do elenco embutido (pack com .air e atlas). */
export function charFromPack(pack: CharacterPack): EdChar {
  const airName = Object.keys(pack.files).find((f) => /\.air$/i.test(f));
  if (!airName) throw new Error(`${pack.id}: pack sem .air`);
  const parsed = parseAir(pack.files[airName]);
  const anims: Record<number, EdAnim> = {};
  for (const [id, a] of Object.entries(parsed)) {
    anims[Number(id)] = {
      id: Number(id),
      loop: true,
      loopStart: a.loopStart,
      frames: a.frames.map((f) => ({ ...f, clsn1: cloneBoxes(f.clsn1), clsn2: cloneBoxes(f.clsn2) })),
    };
  }
  const scale = pack.sprites?.scale ?? 1;
  return {
    source: "builtin",
    id: pack.id,
    name: pack.name,
    unit: "un",
    imagePxPerUnit: scale,
    pixelsPerUnit: scale,
    anims,
    files: { ...pack.files },
    def: pack.def,
    atlasFrames: pack.sprites?.frames,
  };
}

/** Personagem de uma pasta do importador (manifest + textos .cns/.cmd). */
export function charFromManifest(m: Manifest, texts: Record<string, string>): EdChar {
  const anims: Record<number, EdAnim> = {};
  const sprites = new Map<string, [number, number]>();
  const count = new Map<number, number>();
  const ids = Object.keys(m.anims)
    .map(Number)
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
  for (const id of ids) {
    const a = m.anims[String(id)];
    anims[id] = {
      id,
      loop: a.loop !== false,
      loopStart: a.loopStart ?? 0,
      frames: a.frames.map((f) => {
        let gi: [number, number] = [-1, 0];
        if (f.file) {
          if (!sprites.has(f.file)) {
            const n = count.get(id) ?? 0;
            count.set(id, n + 1);
            sprites.set(f.file, [id, n]);
          }
          gi = sprites.get(f.file)!;
        }
        return {
          group: gi[0],
          index: gi[1],
          file: f.file,
          axis: f.axis ? [f.axis[0], f.axis[1]] : [0, 0],
          ox: f.offset?.[0] ?? 0,
          oy: f.offset?.[1] ?? 0,
          time: f.ticks,
          flipH: f.flipH === true,
          flipV: f.flipV === true,
          clsn1: (f.clsn1 ?? []).map(box),
          clsn2: (f.clsn2 ?? []).map(box),
        };
      }),
    };
  }
  const def = `${m.id}.def`;
  const files: Record<string, string> = { ...texts };
  files[def] = ["[Info]", `name = "${m.name}"`, "[Files]", `cmd = ${m.cmd}`, `cns = ${m.cns}`, `anim = ${m.id}.air`, ""].join("\n");
  return { source: "manifest", id: m.id, name: m.name, unit: "px", imagePxPerUnit: 1, pixelsPerUnit: m.pixelsPerUnit, anims, files, def, manifest: m };
}

// ------------------------------------------------------------- exportar

/** Animações do personagem como a engine as vê (caixas e offsets em unidades do MUGEN). */
export function engineAnims(c: EdChar): Record<number, Animation> {
  const k = c.unit === "px" ? 1 / c.pixelsPerUnit : 1;
  const conv = (v: number) => (k === 1 ? v : Math.round(v * k));
  const convBox = (b: Box): Box => ({ x1: conv(b.x1), y1: conv(b.y1), x2: conv(b.x2), y2: conv(b.y2) });
  const out: Record<number, Animation> = {};
  for (const a of Object.values(c.anims)) {
    const frames = a.frames.map((f) => ({
      group: f.group,
      index: f.index,
      ox: conv(f.ox),
      oy: conv(f.oy),
      time: f.time,
      flipH: f.flipH,
      flipV: f.flipV,
      clsn1: f.clsn1.map(convBox),
      clsn2: f.clsn2.map(convBox),
    }));
    out[a.id] = finalizeAnimation(a.id, frames, a.loop ? a.loopStart : 0);
  }
  return out;
}

export function exportAir(c: EdChar): string {
  return serializeAir(engineAnims(c), `${c.name} — animações (formato MUGEN .air)\nEditado no editor de hitbox (mobile/tools/editor).`);
}

/** manifest.json atualizado (só para personagem vindo de pasta). Mantém os campos extras. */
export function exportManifest(c: EdChar): Manifest {
  if (!c.manifest) throw new Error("personagem embutido não tem manifest; exporte o .air");
  const anims: Manifest["anims"] = {};
  const pair = (b: Box) => [b.x1, b.y1, b.x2, b.y2];
  for (const a of Object.values(c.anims).sort((x, y) => x.id - y.id)) {
    anims[String(a.id)] = {
      loop: a.loop,
      loopStart: a.loopStart,
      frames: a.frames.map((f) => ({
        file: f.file ?? null,
        ticks: f.time,
        ...(f.file ? { axis: f.axis ?? [0, 0] } : {}),
        flipH: f.flipH,
        ...(f.flipV ? { flipV: true } : {}),
        ...(f.ox || f.oy ? { offset: [f.ox, f.oy] as [number, number] } : {}),
        clsn1: f.clsn1.map(pair),
        clsn2: f.clsn2.map(pair),
      })),
    };
  }
  return { ...c.manifest, anims };
}

/** Pack para a engine medir a frame data (sem sprites: a simulação só usa as caixas). */
export function packOf(c: EdChar): CharacterPack {
  const files = { ...c.files };
  const airName = Object.keys(files).find((f) => /\.air$/i.test(f)) ?? `${c.id}.air`;
  files[airName] = exportAir(c);
  return { format: PACK_FORMAT, id: c.id, name: c.name, author: "editor", version: "0", def: c.def, files, sprites: null };
}

/** Frame data com as caixas/tempos atuais (o próprio personagem é o boneco). */
export function measure(c: EdChar): { ch: CharacterData; data: CharacterFrameData } {
  const pack = packOf(c);
  const ch = loadCharacter(pack);
  return { ch, data: characterFrameData({ [c.id]: ch }, pack) };
}

// ------------------------------------------------------------- caixas

export type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Aplica um arrasto (em unidades das caixas) a partir da caixa original. */
export function dragBox(orig: Box, handle: Handle, dx: number, dy: number): Box {
  const b = { ...orig };
  if (handle === "move") {
    b.x1 += dx;
    b.x2 += dx;
    b.y1 += dy;
    b.y2 += dy;
    return b;
  }
  if (handle.includes("w")) b.x1 += dx;
  if (handle.includes("e")) b.x2 += dx;
  if (handle.includes("n")) b.y1 += dy;
  if (handle.includes("s")) b.y2 += dy;
  return box([b.x1, b.y1, b.x2, b.y2]);
}

/** Duração da animação em ticks (quadros com -1 contam como 1 no preview). */
export function animTicks(a: EdAnim): number {
  return a.frames.reduce((n, f) => n + (f.time < 0 ? 0 : f.time), 0);
}

/** Nome das ações do common1 (para a lista do editor). */
export const ACTION_NAMES: Record<number, string> = {
  0: "parado",
  5: "virar",
  6: "virar agachado",
  10: "em pé → agachado",
  11: "agachado",
  12: "agachado → em pé",
  20: "andar para frente",
  21: "andar para trás",
  40: "preparar pulo",
  41: "pulo neutro",
  42: "pulo para frente",
  43: "pulo para trás",
  47: "pouso",
  100: "corrida",
  105: "recuo",
  120: "começar defesa",
  130: "defesa em pé",
  131: "defesa agachado",
  132: "defesa no ar",
  150: "defendendo em pé",
  151: "defendendo agachado",
  152: "defendendo no ar",
  170: "derrota",
  180: "vitória",
  181: "vitória (pose)",
  190: "intro",
  5000: "apanhar leve",
  5001: "apanhar médio",
  5002: "apanhar forte",
  5010: "apanhar agachado",
  5030: "apanhar no ar",
  5050: "caindo",
  5100: "quique",
  5110: "deitado",
  5120: "levantar",
  6000: "rolamento",
  6010: "blowback",
  6030: "arremesso",
  6060: "guard crush",
  6070: "MAX",
};
