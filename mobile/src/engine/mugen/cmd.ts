/**
 * Parser de comandos .cmd do MUGEN e reconhecimento de comandos no histórico
 * de entradas.
 *
 *   [Command]
 *   name = "QCF_x"
 *   command = ~D, DF, F, x
 *   time = 15
 *
 * Símbolos suportados: `~` (soltar, com tempo opcional `~30`), `/` (segurar),
 * `$` (qualquer direção que contenha), `>` (estrito — aceito, tratado como normal)
 * e `+` (simultâneo).
 */

import { Key, type CommandDef, type CommandElement } from "../types";
import { parseIni, sectionMap, splitTopLevel, unquote } from "./ini";

const DIRS: Record<string, number> = {
  U: Key.U,
  D: Key.D,
  B: Key.B,
  F: Key.F,
  UB: Key.U | Key.B,
  UF: Key.U | Key.F,
  DB: Key.D | Key.B,
  DF: Key.D | Key.F,
};
const BUTTONS: Record<string, number> = {
  a: Key.a,
  b: Key.b,
  c: Key.c,
  x: Key.x,
  y: Key.y,
  z: Key.z,
  s: Key.s,
};

export function parseCommandElement(src: string): CommandElement | null {
  let s = src.trim();
  let hold = false;
  let release = false;
  let releaseTime = 0;
  let anyDir = false;
  let strict = false;

  for (;;) {
    if (s.startsWith("/")) {
      hold = true;
      s = s.slice(1).trim();
    } else if (s.startsWith("~")) {
      release = true;
      s = s.slice(1);
      const m = /^\d+/.exec(s);
      if (m) {
        releaseTime = Number.parseInt(m[0], 10);
        s = s.slice(m[0].length);
      }
      s = s.trim();
    } else if (s.startsWith("$")) {
      anyDir = true;
      s = s.slice(1).trim();
    } else if (s.startsWith(">")) {
      strict = true;
      s = s.slice(1).trim();
    } else break;
  }

  let dir = 0;
  let buttons = 0;
  for (const partRaw of s.split("+")) {
    const part = partRaw.trim();
    if (part === "") continue;
    // Botões são minúsculos (a b c x y z s) e direções maiúsculas (U D F B...):
    // "b" é o botão b, "B" é trás.
    if (part in BUTTONS) buttons |= BUTTONS[part];
    else if (part.toUpperCase() in DIRS) dir |= DIRS[part.toUpperCase()];
    else return null;
  }
  if (dir === 0 && buttons === 0) return null;
  return { keys: dir | buttons, dir, buttons, hold, release, releaseTime, anyDir, strict };
}

export function parseCmd(text: string): CommandDef[] {
  const sections = parseIni(text);
  const defaults = sectionMap(sections.find((s) => s.lower === "defaults"));
  const defTime = Number.parseInt(defaults["command.time"] ?? "15", 10) || 15;
  const defBuffer = Number.parseInt(defaults["command.buffer.time"] ?? "1", 10) || 1;

  const out: CommandDef[] = [];
  for (const section of sections) {
    if (section.lower !== "command") continue;
    const map = sectionMap(section);
    const name = unquote(map["name"] ?? "").toLowerCase();
    const cmd = map["command"];
    if (!name || !cmd) continue;
    const elements = splitTopLevel(cmd).map(parseCommandElement);
    if (elements.some((e) => e === null)) continue;
    out.push({
      name,
      elements: elements as CommandElement[],
      time: Number.parseInt(map["time"] ?? "", 10) || defTime,
      bufferTime: Math.max(1, Number.parseInt(map["buffer.time"] ?? "", 10) || defBuffer),
    });
  }
  return out;
}

// ------------------------------------------------------- reconhecimento

/** Entrada `ago` frames atrás (0 = agora). */
type History = (ago: number) => number;

function dirOf(bits: number): number {
  let d = bits & (Key.U | Key.D | Key.B | Key.F);
  // direções opostas se anulam
  if ((d & (Key.U | Key.D)) === (Key.U | Key.D)) d &= ~(Key.U | Key.D);
  if ((d & (Key.B | Key.F)) === (Key.B | Key.F)) d &= ~(Key.B | Key.F);
  return d;
}

function dirHeld(el: CommandElement, bits: number): boolean {
  const d = dirOf(bits);
  return el.anyDir ? (d & el.dir) === el.dir : d === el.dir;
}

function held(el: CommandElement, bits: number): boolean {
  if (el.dir !== 0 && !dirHeld(el, bits)) return false;
  return (bits & el.buttons) === el.buttons;
}

/** O elemento "acontece" exatamente no frame `t` (frames atrás). */
function occursAt(el: CommandElement, h: History, t: number): boolean {
  const now = h(t);
  const before = h(t + 1);
  if (el.hold) return held(el, now);
  if (el.release) {
    if (!(held(el, before) && !held(el, now))) return false;
    if (el.releaseTime > 0) {
      for (let k = 1; k <= el.releaseTime; k++) if (!held(el, h(t + k))) return false;
    }
    return true;
  }
  if (!held(el, now)) return false;
  // pressionado agora e não antes (pelo menos uma parte nova)
  if (el.buttons !== 0) {
    const newly = el.buttons & now & ~before;
    if (newly === 0 && !(el.dir !== 0 && !dirHeld(el, before))) return false;
    return true;
  }
  return !dirHeld(el, before);
}

export function matchCommand(cmd: CommandDef, h: History): boolean {
  const els = cmd.elements;
  const last = els[els.length - 1];
  if (!occursAt(last, h, 0)) return false;
  let t = 0;
  for (let i = els.length - 2; i >= 0; i--) {
    let found = -1;
    // "/F, x" (segurar) e "~D, DF" (soltar D ao ir para DF) podem coincidir
    // com o frame do elemento seguinte.
    for (let s = els[i].hold || els[i].release ? t : t + 1; s <= cmd.time; s++) {
      if (occursAt(els[i], h, s)) {
        found = s;
        break;
      }
    }
    if (found < 0) return false;
    // ">" no elemento seguinte: nada pode ter sido apertado entre os dois
    if (els[i + 1].strict) {
      for (let s = t + 1; s < found; s++) if (h(s) !== 0) return false;
    }
    t = found;
  }
  return t <= cmd.time;
}
