/**
 * Converte comandos do .cmd em sequências de entrada (bits relativos por tick).
 * Usado pelos botões "assistidos" (especial/super num toque) e pela IA. Como o
 * resultado é só entrada, funciona igual no online.
 */

import { Btn, toAbsolute } from "@/src/engine/input";
import type { CharacterData, CommandDef } from "@/src/engine/types";

export type Macro = number[];

const TICKS_PER_STEP = 2;

export function macroFromCommand(cmd: CommandDef): Macro {
  const out: number[] = [];
  cmd.elements.forEach((el, i) => {
    const next = cmd.elements[i + 1];
    // carga (~30$B): segura a direção o tempo pedido antes de soltar
    const hold = el.release && el.releaseTime > 0 ? el.releaseTime + 2 : TICKS_PER_STEP;
    for (let t = 0; t < hold; t++) out.push(el.keys);
    if (el.release) out.push(0);
    else if (next && (next.keys & el.keys) !== 0 && !next.release) out.push(0);
  });
  out.push(0);
  return out;
}

/** Comandos de movimento (≥ 3 elementos, ex.: meia-lua) do personagem. */
export function motionCommands(ch: CharacterData): CommandDef[] {
  const seen = new Set<string>();
  return ch.commands.filter((c) => {
    if (c.elements.length < 3 || seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

export function findCommand(ch: CharacterData, name: string): CommandDef | undefined {
  return ch.commands.find((c) => c.name === name.toLowerCase());
}

/** Toca uma macro: devolve o input absoluto do tick atual. */
export class MacroPlayer {
  private queue: number[] = [];
  private facing: 1 | -1 = 1;

  play(macro: Macro, facing: 1 | -1): void {
    this.queue = [...macro];
    this.facing = facing;
  }

  get busy(): boolean {
    return this.queue.length > 0;
  }

  next(): number | null {
    const rel = this.queue.shift();
    return rel === undefined ? null : toAbsolute(rel, this.facing);
  }

  clear(): void {
    this.queue = [];
  }
}

export const PUNCHES = [Btn.x, Btn.y, Btn.z];
export const KICKS = [Btn.a, Btn.b, Btn.c];
