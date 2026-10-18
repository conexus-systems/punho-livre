/**
 * Personagens disponíveis: os nativos (embutidos no app) + os baixados do
 * catálogo do backend (packs `mugen-arena-pack/1`, verificados por sha256 e
 * guardados no armazenamento do app).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

import { loadCharacter, type CharacterPack } from "@/src/engine/character";
import type { CharacterData } from "@/src/engine/types";
import { fetchPackText, type CharacterSummary } from "@/src/services/api";
import { createStore } from "@/src/store";

import { BUILTIN, BUILTIN_ORDER } from "./builtin.generated";
import type { CharacterMeta } from "./types";

export interface RosterEntry {
  id: string;
  name: string;
  bio: string;
  builtin: boolean;
  /** sha256 do pack (online: os dois lados precisam do mesmo). */
  sha256: string;
  meta: CharacterMeta | null;
  style: CharacterData["style"];
}

const INSTALLED_KEY = "mugen-arena.installed";

interface Installed {
  slug: string;
  name: string;
  version: string;
  sha256: string;
  file: string;
}

export const rosterStore = createStore<{ installed: Installed[] }>({ installed: [] });

const loaded = new Map<string, CharacterData>();
const packs = new Map<string, CharacterPack>();

function charsDir(): Directory {
  const dir = new Directory(Paths.document, "characters");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export async function initRegistry(): Promise<void> {
  const raw = await AsyncStorage.getItem(INSTALLED_KEY);
  const installed = raw ? (JSON.parse(raw) as Installed[]) : [];
  rosterStore.set({ installed: installed.filter((i) => new File(i.file).exists) });
}

async function saveInstalled(list: Installed[]): Promise<void> {
  rosterStore.set({ installed: list });
  await AsyncStorage.setItem(INSTALLED_KEY, JSON.stringify(list));
}

/** sha256 estável dos nativos: calculado sobre o JSON do pack (sem os PNGs). */
const builtinSha = new Map<string, string>();
async function shaOf(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

export async function rosterEntries(): Promise<RosterEntry[]> {
  const out: RosterEntry[] = [];
  for (const id of BUILTIN_ORDER) {
    const b = BUILTIN[id];
    if (!builtinSha.has(id)) builtinSha.set(id, await shaOf(JSON.stringify(b.pack)));
    out.push({
      id,
      name: b.meta.name,
      bio: b.meta.bio,
      builtin: true,
      sha256: builtinSha.get(id) ?? "",
      meta: b.meta,
      style: getCharacter(id).style,
    });
  }
  for (const i of rosterStore.get().installed) {
    try {
      const ch = getCharacter(i.slug);
      out.push({ id: i.slug, name: i.name, bio: `por ${ch.author}`, builtin: false, sha256: i.sha256, meta: null, style: ch.style });
    } catch (err) {
      console.warn(`[roster] ${i.slug} inválido:`, (err as Error).message);
    }
  }
  return out;
}

export function getPack(id: string): CharacterPack {
  const b = BUILTIN[id];
  if (b) return b.pack;
  const cached = packs.get(id);
  if (cached) return cached;
  const entry = rosterStore.get().installed.find((i) => i.slug === id);
  if (!entry) throw new Error(`personagem não instalado: ${id}`);
  const pack = JSON.parse(new File(entry.file).textSync()) as CharacterPack;
  packs.set(id, pack);
  return pack;
}

export function getCharacter(id: string): CharacterData {
  const hit = loaded.get(id);
  if (hit) return hit;
  const ch = loadCharacter(getPack(id));
  loaded.set(id, ch);
  return ch;
}

export function isInstalled(slug: string, sha256?: string): boolean {
  if (BUILTIN[slug]) return true;
  return rosterStore.get().installed.some((i) => i.slug === slug && (!sha256 || i.sha256 === sha256));
}

/** Baixa, verifica (sha256 + parse na engine) e instala um personagem do catálogo. */
export async function install(c: CharacterSummary): Promise<void> {
  const text = await fetchPackText(c);
  const sha = await shaOf(text);
  if (sha !== c.sha256) throw new Error(`${c.name}: download corrompido (sha256 não confere)`);
  const pack = JSON.parse(text) as CharacterPack;
  loadCharacter(pack); // valida antes de instalar
  const file = new File(charsDir(), `${c.slug}-${sha.slice(0, 12)}.json`);
  file.write(text);
  const others = rosterStore.get().installed.filter((i) => i.slug !== c.slug);
  for (const old of rosterStore.get().installed.filter((i) => i.slug === c.slug)) {
    try {
      new File(old.file).delete();
    } catch {
      // já removido
    }
  }
  loaded.delete(c.slug);
  packs.delete(c.slug);
  await saveInstalled([...others, { slug: c.slug, name: c.name, version: c.version, sha256: sha, file: file.uri }]);
}

export async function uninstall(slug: string): Promise<void> {
  const list = rosterStore.get().installed;
  for (const i of list.filter((x) => x.slug === slug)) {
    try {
      new File(i.file).delete();
    } catch {
      // ignore
    }
  }
  loaded.delete(slug);
  packs.delete(slug);
  await saveInstalled(list.filter((i) => i.slug !== slug));
}

/** Roster da engine para uma partida. */
export function rosterFor(ids: string[]): Record<string, CharacterData> {
  const out: Record<string, CharacterData> = {};
  for (const id of ids) out[id] = getCharacter(id);
  return out;
}

export function builtinAtlasModules(id: string): number[] {
  return BUILTIN[id]?.atlasModules ?? [];
}
