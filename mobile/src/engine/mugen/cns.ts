/**
 * Parser de .cns (constantes + estados) e da parte de estados do .cmd.
 *
 *   [Statedef 200]
 *   type = S
 *   movetype = A
 *   physics = S
 *   anim = 200
 *   ctrl = 0
 *
 *   [State 200, golpe]
 *   type = HitDef
 *   trigger1 = AnimElem = 2
 *   attr = S, NA
 *   damage = 30
 */

import { parseExpr, type Expr } from "../expr";
import type { Controller, MoveType, Physics, StateDef, StateType } from "../types";
import { parseIni, splitTopLevel, type IniSection } from "./ini";

export const SUPPORTED_CONTROLLERS = new Set([
  "null",
  "changestate",
  "selfstate",
  "changeanim",
  "changeanim2",
  "velset",
  "veladd",
  "velmul",
  "posset",
  "posadd",
  "ctrlset",
  "hitdef",
  "statetypeset",
  "varset",
  "varadd",
  "varrangeset",
  "lifeadd",
  "lifeset",
  "poweradd",
  "powerset",
  "turn",
  "hitvelset",
  "projectile",
  "nothitby",
  "hitby",
  "superpause",
  "pause",
  "targetlifeadd",
  "defencemulset",
  "attackmulset",
  "hitfallvel",
  "hitfalldamage",
  "hitfallset",
  "fallenvshake",
  "playsnd",
  "stopsnd",
  "sprpriority",
  "assertspecial",
  "explod",
  "removeexplod",
  "modifyexplod",
  "envshake",
  "afterimage",
  "afterimagetime",
  "palfx",
  "allpalfx",
  "bgpalfx",
  "playerpush",
  "width",
  "posfreeze",
  "screenbound",
  "makedust",
  "gamemakeanim",
  "displaytoclipboard",
  "appendtoclipboard",
  "clearclipboard",
  "angledraw",
  "angleset",
  "angleadd",
  "anglemul",
  "trans",
  "offset",
  "envcolor",
  "victoryquote",
  "forcefeedback",
]);

/** Controladores que são só cosméticos/áudio: aceitos e ignorados sem aviso. */
export const COSMETIC_CONTROLLERS = new Set([
  "playsnd",
  "stopsnd",
  "sprpriority",
  "assertspecial",
  "explod",
  "removeexplod",
  "modifyexplod",
  "envshake",
  "afterimage",
  "afterimagetime",
  "palfx",
  "allpalfx",
  "bgpalfx",
  "playerpush",
  "width",
  "posfreeze",
  "screenbound",
  "makedust",
  "gamemakeanim",
  "displaytoclipboard",
  "appendtoclipboard",
  "clearclipboard",
  "angledraw",
  "angleset",
  "angleadd",
  "anglemul",
  "trans",
  "offset",
  "envcolor",
  "victoryquote",
  "forcefeedback",
  "fallenvshake",
]);

function safeExpr(src: string, problems: string[], where: string): Expr {
  try {
    return parseExpr(src);
  } catch (err) {
    problems.push(`${where}: ${(err as Error).message}`);
    return { k: "str", v: src.trim().toLowerCase() };
  }
}

export interface ParsedStates {
  states: Record<number, StateDef>;
  problems: string[];
  unsupported: string[];
}

function letter<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  const v = value.trim().charAt(0).toUpperCase() as T;
  return allowed.includes(v) ? v : undefined;
}

function parseStatedef(section: IniSection, no: number, problems: string[]): StateDef {
  // Padrões do MUGEN quando omitidos: type = S, movetype = I, physics = N. "U" = não muda.
  const def: StateDef = {
    no,
    type: "S",
    moveType: "I",
    physics: "N",
    hitDefPersist: false,
    moveHitPersist: false,
    controllers: [],
  };
  const where = `Statedef ${no}`;
  for (const l of section.lines) {
    if (l.key === null) continue;
    switch (l.key) {
      case "type":
        def.type = letter<StateType>(l.value, ["S", "C", "A", "L"]);
        break;
      case "movetype":
        def.moveType = letter<MoveType>(l.value, ["I", "A", "H"]);
        break;
      case "physics":
        def.physics = letter<Physics>(l.value, ["S", "C", "A", "N"]);
        break;
      case "anim":
        def.anim = safeExpr(l.value, problems, where);
        break;
      case "velset":
        def.velset = splitTopLevel(l.value).map((v) => safeExpr(v, problems, where));
        break;
      case "ctrl":
        def.ctrl = safeExpr(l.value, problems, where);
        break;
      case "poweradd":
        def.powerAdd = safeExpr(l.value, problems, where);
        break;
      case "facep2":
        def.faceP2 = safeExpr(l.value, problems, where);
        break;
      case "hitdefpersist":
        def.hitDefPersist = l.value.trim() !== "0";
        break;
      case "movehitpersist":
        def.moveHitPersist = l.value.trim() !== "0";
        break;
      default:
        break;
    }
  }
  return def;
}

function parseController(section: IniSection, index: number, problems: string[]): Controller | null {
  const label = section.name.replace(/^state\s+-?\d+\s*,?/i, "").trim();
  const where = `[${section.name}]`;
  const ctrl: Controller = {
    type: "",
    label,
    triggerAll: [],
    triggers: [],
    params: {},
    raw: {},
    persistent: 1,
    ignoreHitPause: false,
    index,
  };

  for (const l of section.lines) {
    if (l.key === null) continue;
    if (l.key === "type") {
      ctrl.type = l.value.trim().toLowerCase();
      continue;
    }
    if (l.key === "triggerall") {
      ctrl.triggerAll.push(safeExpr(l.value, problems, where));
      continue;
    }
    const trig = /^trigger(\d+)$/.exec(l.key);
    if (trig) {
      const n = Number.parseInt(trig[1], 10);
      while (ctrl.triggers.length < n) ctrl.triggers.push([]);
      ctrl.triggers[n - 1].push(safeExpr(l.value, problems, where));
      continue;
    }
    if (l.key === "persistent") {
      ctrl.persistent = Number.parseInt(l.value, 10) || 0;
      continue;
    }
    if (l.key === "ignorehitpause") {
      ctrl.ignoreHitPause = l.value.trim() !== "0";
      continue;
    }
    ctrl.raw[l.key] = l.value;
    ctrl.params[l.key] = splitTopLevel(l.value).map((v) => safeExpr(v, problems, `${where} ${l.key}`));
  }

  if (!ctrl.type) {
    problems.push(`${where}: sem "type"`);
    return null;
  }
  // trigger1 vazio com trigger2 preenchido é inválido no MUGEN; descartamos grupos vazios.
  ctrl.triggers = ctrl.triggers.filter((g) => g.length > 0);
  return ctrl;
}

/** Junta estados de vários arquivos; os posteriores sobrescrevem statedefs com o mesmo número. */
export function parseStates(texts: string[]): ParsedStates {
  const states: Record<number, StateDef> = {};
  const problems: string[] = [];
  const unsupported = new Set<string>();

  for (const text of texts) {
    let current: StateDef | null = null;
    for (const section of parseIni(text)) {
      const sd = /^statedef\s+(-?\d+)/.exec(section.lower);
      if (sd) {
        const no = Number.parseInt(sd[1], 10);
        current = parseStatedef(section, no, problems);
        states[no] = current;
        continue;
      }
      const st = /^state\s+(-?\d+)/.exec(section.lower);
      if (st) {
        const no = Number.parseInt(st[1], 10);
        let owner: StateDef | null = current && current.no === no ? current : (states[no] ?? null);
        if (!owner) {
          owner = { no, hitDefPersist: false, moveHitPersist: false, controllers: [] };
          states[no] = owner;
        }
        const c = parseController(section, owner.controllers.length, problems);
        if (c) {
          if (!SUPPORTED_CONTROLLERS.has(c.type)) unsupported.add(c.type);
          owner.controllers.push(c);
        }
        continue;
      }
    }
  }

  return { states, problems, unsupported: [...unsupported].sort() };
}

const CONST_SECTIONS = new Set(["data", "size", "velocity", "movement"]);

/** [Data]/[Size]/[Velocity]/[Movement] → "velocity.walk.fwd.x" etc. */
export function parseConstants(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const section of parseIni(text)) {
    if (!CONST_SECTIONS.has(section.lower)) continue;
    for (const l of section.lines) {
      if (l.key === null) continue;
      const base = `${section.lower}.${l.key}`;
      const parts = splitTopLevel(l.value).map((v) => Number.parseFloat(v));
      if (parts.length === 0 || !Number.isFinite(parts[0])) continue;
      out[base] = parts[0];
      out[`${base}.x`] = parts[0];
      if (parts.length > 1 && Number.isFinite(parts[1])) out[`${base}.y`] = parts[1];
    }
  }
  return out;
}

/** Valores padrão do MUGEN 1.0 para localcoord 320x240. */
export const DEFAULT_CONSTANTS: Record<string, number> = {
  "data.life": 1000,
  "data.power": 3000,
  "data.attack": 100,
  "data.defence": 100,
  "data.fall.defence_up": 50,
  "data.liedown.time": 60,
  "size.xscale": 1,
  "size.yscale": 1,
  "size.ground.back": 15,
  "size.ground.front": 16,
  "size.air.back": 12,
  "size.air.front": 12,
  "size.height": 60,
  "size.attack.dist": 160,
  "size.proj.attack.dist": 90,
  "size.head.pos.x": -5,
  "size.head.pos.y": -90,
  "size.mid.pos.x": -5,
  "size.mid.pos.y": -60,
  "velocity.walk.fwd.x": 2.4,
  "velocity.walk.back.x": -2.2,
  "velocity.run.fwd.x": 4.6,
  "velocity.run.fwd.y": 0,
  "velocity.run.back.x": -4.5,
  "velocity.run.back.y": -3.8,
  "velocity.jump.neu.x": 0,
  "velocity.jump.neu.y": -8.4,
  "velocity.jump.back.x": -2.55,
  "velocity.jump.fwd.x": 2.5,
  "velocity.runjump.back.x": -2.55,
  "velocity.runjump.back.y": -8.1,
  "velocity.runjump.fwd.x": 4,
  "velocity.runjump.fwd.y": -8.1,
  "velocity.airjump.neu.x": 0,
  "velocity.airjump.neu.y": -8.1,
  "velocity.airjump.back.x": -2.55,
  "velocity.airjump.fwd.x": 2.5,
  "movement.airjump.num": 1,
  "movement.airjump.height": 35,
  "movement.yaccel": 0.44,
  "movement.stand.friction": 0.85,
  "movement.crouch.friction": 0.82,
  "movement.stand.friction.threshold": 2,
  "movement.crouch.friction.threshold": 0.05,
  "movement.down.bounce.offset.x": 0,
  "movement.down.bounce.offset.y": 20,
  "movement.down.bounce.yaccel": 0.4,
  "movement.down.bounce.groundlevel": 12,
  "movement.down.friction.threshold": 0.05,
};

export function withJumpAliases(consts: Record<string, number>): Record<string, number> {
  const out = { ...DEFAULT_CONSTANTS, ...consts };
  // o MUGEN expõe a velocidade vertical do pulo como velocity.jump.y
  out["velocity.jump.y"] = out["velocity.jump.neu.y"];
  out["velocity.runjump.y"] = out["velocity.runjump.fwd.y"];
  out["velocity.airjump.y"] = out["velocity.airjump.neu.y"];
  return out;
}
