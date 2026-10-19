/**
 * Carrega um personagem a partir de um "pack" (arquivos de texto do MUGEN em JSON).
 * Ver docs/PROTOCOL.md (formato `mugen-arena-pack/1`).
 */

import { COMMON1_CNS } from "./common1";
import { parseAir, finalizeAnimation } from "./mugen/air";
import { parseCmd, parseCommandElement, prioritizeCommandStates } from "./mugen/cmd";
import { COSMETIC_CONTROLLERS, parseConstants, parseStates, withJumpAliases } from "./mugen/cns";
import { findSection, parseIni, sectionMap, unquote } from "./mugen/ini";
import type { Animation, CharacterData, CharacterStyle, CommandDef, SpriteSheet } from "./types";

export const PACK_FORMAT = "mugen-arena-pack/1";

export interface CharacterPack {
  format: string;
  id: string;
  name: string;
  author: string;
  version: string;
  def: string;
  files: Record<string, string>;
  sprites: SpriteSheet | null;
  /** Sons do .snd convertidos ("grupo,índice" → data URI WAV), opcional. */
  sounds?: Record<string, string> | null;
}

export class PackError extends Error {}

const DEFAULT_STYLE: CharacterStyle = {
  body: "#3B82F6",
  accent: "#1E3A8A",
  skin: "#F2C29B",
  trim: "#F8FAFC",
  energy: "#60A5FA",
};

/** Animações que o common1 espera terminar (AnimTime = 0); se faltarem, criamos versões curtas. */
const TRANSITION_ANIMS = new Set([5, 6, 10, 12, 40, 47, 52, 120, 121, 122, 140, 141, 142, 190, 5120]);

/** Ordem de substituição quando o personagem não tem uma animação. */
export function fallbackAnimChain(n: number): number[] {
  if (n >= 5000 && n < 5010) return [5000, 0];
  if (n >= 5010 && n < 5020) return [5010, 5000, 11, 0];
  if (n >= 5020 && n < 5100) return [5030, 5000, 0];
  if (n >= 5100 && n < 5200) return [5110, 5100, 5030, 0];
  if (n >= 120 && n <= 155) {
    const crouch = n === 121 || n === 131 || n === 141 || n === 151 || n === 152 || n === 153;
    return crouch ? [131, 11, 0] : [130, 0];
  }
  if (n === 10 || n === 11 || n === 12 || n === 6) return [11, 0];
  if (n >= 40 && n < 50) return [41, 0];
  if (n === 100) return [20, 0];
  if (n === 105) return [43, 41, 0];
  if (n === 21) return [20, 0];
  // sistema SNK (common1 6000+): personagens importados usam o que tiverem de parecido
  if (n === 6000 || n === 6001) return [6000, 11, 10, 0];
  if (n === 6010) return [240, 250, 210, 200, 0];
  if (n === 6015) return [640, 630, 610, 600, 41, 0];
  if (n === 6030) return [800, 810, 210, 200, 0];
  if (n === 6040) return [5002, 5001, 5000, 0];
  if (n === 6050) return [150, 130, 0];
  if (n === 6060) return [5002, 5001, 5000, 0];
  if (n === 6070) return [3000, 181, 180, 0];
  return [0];
}

function synthesize(anims: Record<number, Animation>, n: number): Animation | null {
  for (const alt of fallbackAnimChain(n)) {
    const base = anims[alt];
    if (!base) continue;
    if (TRANSITION_ANIMS.has(n)) {
      return finalizeAnimation(n, [{ ...base.frames[0], time: 3 }], 0);
    }
    return { ...base, id: n };
  }
  return null;
}

function normalizePath(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1].toLowerCase().trim();
}

/** Comandos que todo personagem do MUGEN precisa ter; criados se o .cmd não definir. */
const REQUIRED_COMMANDS: Array<[string, string]> = [
  ["holdfwd", "/$F"],
  ["holdback", "/$B"],
  ["holdup", "/$U"],
  ["holddown", "/$D"],
];

function parseStyle(sections: ReturnType<typeof parseIni>): CharacterStyle {
  const map = sectionMap(findSection(sections, "arena"));
  const color = (key: keyof CharacterStyle) => {
    const v = unquote(map[key] ?? "");
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : DEFAULT_STYLE[key];
  };
  return { body: color("body"), accent: color("accent"), skin: color("skin"), trim: color("trim"), energy: color("energy") };
}

export function loadCharacter(pack: CharacterPack): CharacterData {
  if (pack.format !== PACK_FORMAT) throw new PackError(`formato desconhecido: ${pack.format}`);
  const files: Record<string, string> = {};
  for (const [name, text] of Object.entries(pack.files)) files[normalizePath(name)] = text;

  const read = (name: string | undefined): string | null => {
    if (!name) return null;
    return files[normalizePath(unquote(name))] ?? null;
  };

  const defText = read(pack.def);
  if (defText === null) throw new PackError(`arquivo .def ausente: ${pack.def}`);
  const defSections = parseIni(defText);
  const info = sectionMap(findSection(defSections, "info"));
  const fileMap = sectionMap(findSection(defSections, "files"));

  const cnsText = read(fileMap["cns"]);
  const airText = read(fileMap["anim"]);
  const cmdText = read(fileMap["cmd"]);
  if (cnsText === null) throw new PackError("arquivo cns ausente");
  if (airText === null) throw new PackError("arquivo anim (.air) ausente");

  const stTexts: string[] = [];
  for (const key of ["st", ...Array.from({ length: 10 }, (_, i) => `st${i}`)]) {
    const t = read(fileMap[key]);
    if (t !== null) stTexts.push(t);
  }

  // common1 primeiro: os arquivos do personagem sobrescrevem statedefs repetidos.
  // O stcommon do personagem é ignorado — a engine usa o próprio common1.
  const parsed = parseStates([COMMON1_CNS, cnsText, ...stTexts, ...(cmdText ? [cmdText] : [])]);

  const anims = parseAir(airText);
  if (!anims[0]) throw new PackError("o personagem precisa da animação 0 (parado)");
  const needed = [5, 6, 10, 11, 12, 20, 21, 40, 41, 42, 43, 47, 100, 105, 120, 121, 122, 130, 131, 132, 140, 141, 142, 150, 151, 152, 170, 180, 190, 5000, 5001, 5002, 5010, 5011, 5012, 5030, 5050, 5100, 5110, 5120];
  for (const n of needed) {
    if (!anims[n]) {
      const s = synthesize(anims, n);
      if (s) anims[n] = s;
    }
  }

  const commands: CommandDef[] = cmdText ? parseCmd(cmdText) : [];
  for (const [name, src] of REQUIRED_COMMANDS) {
    if (!commands.some((c) => c.name === name)) {
      const el = parseCommandElement(src);
      if (el) commands.push({ name, elements: [el], time: 1, bufferTime: 1 });
    }
  }

  // super > especial > normal quando várias entradas casam no mesmo quadro
  const root = parsed.states[-1];
  if (root) root.controllers = prioritizeCommandStates(root.controllers, commands);

  return {
    id: pack.id,
    name: unquote(info["name"] ?? pack.name),
    displayName: unquote(info["displayname"] ?? info["name"] ?? pack.name),
    author: unquote(info["author"] ?? pack.author),
    version: pack.version,
    consts: withJumpAliases(parseConstants(cnsText)),
    anims,
    states: parsed.states,
    commands,
    style: parseStyle(defSections),
    sprites: pack.sprites,
    unsupported: parsed.unsupported.filter((t) => !COSMETIC_CONTROLLERS.has(t)),
    sounds: pack.sounds ?? null,
  };
}

/**
 * Substitutas já montadas. Ficam fora de `ch.anims` de propósito: o renderizador
 * pede animações que a simulação não pediu, e `AnimExist` não pode mudar por
 * causa disso (os dois lados do online precisam ver o mesmo).
 */
const substitutes = new WeakMap<CharacterData, Map<number, Animation>>();

export function getAnim(ch: CharacterData, n: number): Animation {
  const a = ch.anims[n];
  if (a) return a;
  let cache = substitutes.get(ch);
  if (!cache) substitutes.set(ch, (cache = new Map()));
  let s = cache.get(n);
  if (!s) {
    s = synthesize(ch.anims, n) ?? ch.anims[0];
    cache.set(n, s);
  }
  return s;
}
