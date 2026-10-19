import type { CharacterPack } from "@/src/engine/character";

export interface CharacterMeta {
  id: string;
  name: string;
  bio: string;
  specials: { name: string; cmd: string }[];
  super: { name: string; cmd: string };
  /** Super de 2 estoques. */
  super2?: { name: string; cmd: string };
  /** Frases de vitória (tela de resultado). */
  quotes?: string[];
}

export interface BuiltinCharacter {
  meta: CharacterMeta;
  pack: CharacterPack;
  /** Módulos de imagem (require) das páginas do atlas, na ordem. */
  atlasModules: number[];
}
