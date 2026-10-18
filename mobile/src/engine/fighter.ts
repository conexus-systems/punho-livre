/**
 * Lógica de um lutador: contexto de triggers, troca de estado/animação e
 * execução dos controladores de estado.
 */

import { advanceAnim, animTime, resetAnim } from "./anim";
import { getAnim } from "./character";
import { GROUND_Y, SCREEN_W, STAGE_LEFT, STAGE_RIGHT } from "./constants";
import { evalBool, evalNum, evaluate, toNum, type EvalContext, type Expr, type Value } from "./expr";
import { INPUT_HISTORY } from "./input";
import { matchCommand } from "./mugen/cmd";
import type {
  CharacterData,
  Controller,
  FighterState,
  HitDefState,
  MoveType,
  Physics,
  ProjectileState,
  StateType,
  WorldState,
} from "./types";
import { Key } from "./types";

export type Roster = Record<string, CharacterData>;

export function nextRandom(w: WorldState): number {
  let x = w.rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  w.rng = x >>> 0 || 1;
  return w.rng;
}

export function opponentOf(w: WorldState, p: FighterState): FighterState {
  return w.fighters[p.side === 0 ? 1 : 0];
}

export function inputAgo(p: FighterState, ago: number): number {
  if (ago >= INPUT_HISTORY) return 0;
  return p.inputs[(p.inputHead - ago + INPUT_HISTORY) % INPUT_HISTORY];
}

export function relInput(p: FighterState): number {
  return inputAgo(p, 0);
}

export function width(p: FighterState, ch: CharacterData): { front: number; back: number } {
  const air = p.stateType === "A";
  return {
    front: ch.consts[air ? "size.air.front" : "size.ground.front"] ?? 16,
    back: ch.consts[air ? "size.air.back" : "size.ground.back"] ?? 15,
  };
}

export function numProjectiles(w: WorldState, side: 0 | 1, projId?: number): number {
  let n = 0;
  for (const pr of w.projectiles) {
    if (pr.owner === side && pr.phase === "flying" && (projId === undefined || pr.projId === projId)) n++;
  }
  return n;
}

function opponentThreat(w: WorldState, p: FighterState, opp: FighterState, oppCh: CharacterData): boolean {
  const dist = Math.abs(opp.x - p.x);
  if (opp.moveType === "A" && dist <= (oppCh.consts["size.attack.dist"] ?? 160)) return true;
  const projDist = oppCh.consts["size.proj.attack.dist"] ?? 90;
  for (const pr of w.projectiles) {
    if (pr.owner === opp.side && pr.phase === "flying" && Math.abs(pr.x - p.x) <= projDist + 40) return true;
  }
  return false;
}

// ----------------------------------------------------------- contexto

const GETHITVAR: Record<string, keyof FighterState["getHit"]> = {
  damage: "damage",
  hittime: "hitTime",
  slidetime: "slideTime",
  ctrltime: "ctrlTime",
  xvel: "xvel",
  yvel: "yvel",
  yaccel: "yaccel",
  fall: "fall",
  "fall.xvel": "fallXVel",
  "fall.yvel": "fallYVel",
  "fall.recover": "fallRecover",
  animtype: "animType",
  groundtype: "groundType",
  airtype: "airType",
  guarded: "guarded",
  hitcount: "hitCount",
};

export class FighterCtx implements EvalContext {
  constructor(
    readonly p: FighterState,
    readonly w: WorldState,
    readonly roster: Roster,
  ) {}

  get ch(): CharacterData {
    return this.roster[this.p.charId];
  }

  get opp(): FighterState {
    return opponentOf(this.w, this.p);
  }

  get oppCh(): CharacterData {
    return this.roster[this.opp.charId];
  }

  command(name: string): boolean {
    return (this.p.cmdActive[name] ?? -1) >= this.w.frame;
  }

  animElem(n: number): boolean {
    return this.p.animElem === n - 1 && this.p.animElemTime === 0;
  }

  redirect(target: string): EvalContext | null {
    if (target === "p2" || target === "enemy" || target === "enemynear" || target === "target") {
      return new FighterCtx(this.opp, this.w, this.roster);
    }
    return null;
  }

  ident(name: string, axis?: "x" | "y"): Value | undefined {
    const { p, w } = this;
    switch (name) {
      case "time":
      case "statetime":
        return p.stateTime;
      case "stateno":
        return p.stateNo;
      case "prevstateno":
        return p.prevStateNo;
      case "anim":
        return p.anim;
      case "animtime":
        return animTime(p, getAnim(this.ch, p.anim));
      case "animelem":
        return p.animElem + 1;
      case "ctrl":
        return p.ctrl ? 1 : 0;
      case "alive":
        return p.life > 0 ? 1 : 0;
      case "life":
        return p.life;
      case "lifemax":
        return p.lifeMax;
      case "power":
        return p.power;
      case "powermax":
        return p.powerMax;
      case "statetype":
        return p.stateType.toLowerCase();
      case "movetype":
        return p.moveType.toLowerCase();
      case "p2statetype":
        return this.opp.stateType.toLowerCase();
      case "p2movetype":
        return this.opp.moveType.toLowerCase();
      case "p2stateno":
        return this.opp.stateNo;
      case "p2life":
        return this.opp.life;
      case "facing":
        return p.facing;
      case "vel":
        return axis === "y" ? p.vy : p.vx;
      case "hitvel":
        return axis === "y" ? p.getHit.yvel : p.getHit.xvel;
      case "pos":
        return axis === "y" ? p.y : p.x - w.cameraX;
      case "screenpos":
        return axis === "y" ? p.y + GROUND_Y : p.x - w.cameraX + SCREEN_W / 2;
      case "p2dist":
        return axis === "y" ? this.opp.y - p.y : (this.opp.x - p.x) * p.facing;
      case "p2bodydist": {
        if (axis === "y") return this.opp.y - p.y;
        const dx = (this.opp.x - p.x) * p.facing;
        const mine = width(p, this.ch).front;
        const oppW = width(this.opp, this.oppCh);
        const theirs = this.opp.facing === p.facing ? oppW.back : oppW.front;
        return dx - mine - theirs;
      }
      case "frontedgedist":
      case "frontedgebodydist": {
        const edge = p.facing === 1 ? w.cameraX + SCREEN_W / 2 : w.cameraX - SCREEN_W / 2;
        const d = Math.abs(edge - p.x);
        return name === "frontedgebodydist" ? d - width(p, this.ch).front : d;
      }
      case "backedgedist":
      case "backedgebodydist": {
        const edge = p.facing === 1 ? w.cameraX - SCREEN_W / 2 : w.cameraX + SCREEN_W / 2;
        const d = Math.abs(edge - p.x);
        return name === "backedgebodydist" ? d - width(p, this.ch).back : d;
      }
      case "movecontact":
        return p.moveContact;
      case "movehit":
        return p.moveHit;
      case "moveguarded":
        return p.moveGuarded;
      case "movereversed":
        return 0;
      case "hitshakeover":
        return p.hitPause === 0 ? 1 : 0;
      case "hitover":
        return p.getHit.hitTimeLeft <= 0 ? 1 : 0;
      case "hitfall":
        return p.getHit.fall;
      case "canrecover":
        return p.getHit.fallRecover;
      case "hitpausetime":
        return p.hitPause;
      case "random":
        return nextRandom(w) % 1000;
      case "roundstate":
        return w.roundState;
      case "roundno":
        return w.roundNo;
      case "roundsexisted":
        return w.roundNo - 1;
      case "gametime":
        return w.frame;
      case "matchover":
        return w.matchWinner >= 0 ? 1 : 0;
      case "win":
        return w.roundWinner === p.side ? 1 : 0;
      case "lose":
        return w.roundWinner >= 0 && w.roundWinner !== p.side && w.roundWinner !== 2 ? 1 : 0;
      case "drawgame":
        return w.roundWinner === 2 ? 1 : 0;
      case "inguarddist":
        return opponentThreat(w, p, this.opp, this.oppCh) ? 1 : 0;
      case "numproj":
        return numProjectiles(w, p.side);
      case "numenemy":
        return 1;
      case "numtarget":
        return p.moveHit > 0 ? 1 : 0;
      case "numhelper":
      case "numexplod":
      case "numpartner":
      case "ishelper":
      case "projcontact":
      case "projhit":
      case "projguarded":
      case "ailevel":
        return 0;
      case "hitcount":
      case "uniqhitcount":
        return p.moveHit > 0 ? 1 : 0;
      case "id":
        return 56 + p.side;
      case "teamside":
        return p.side + 1;
      case "ishometeam":
        return p.side === 0 ? 1 : 0;
      case "palno":
        return 1;
      case "tickspersecond":
        return 60;
      case "e":
        return Math.E;
      case "pi":
        return Math.PI;
      case "name":
      case "p1name":
        return this.ch.name.toLowerCase();
      case "p2name":
        return this.oppCh.name.toLowerCase();
      case "authorname":
        return this.ch.author.toLowerCase();
      default:
        return undefined;
    }
  }

  call(name: string, args: Value[], raw?: string): Value {
    const n = (i: number) => toNum(args[i] ?? 0);
    const { p } = this;
    switch (name) {
      case "abs":
        return Math.abs(n(0));
      case "ceil":
        return Math.ceil(n(0));
      case "floor":
        return Math.floor(n(0));
      case "min":
        return Math.min(n(0), n(1));
      case "max":
        return Math.max(n(0), n(1));
      case "sqrt":
        return Math.sqrt(Math.max(0, n(0)));
      case "sin":
        return Math.sin(n(0));
      case "cos":
        return Math.cos(n(0));
      case "tan":
        return Math.tan(n(0));
      case "asin":
        return Math.asin(n(0));
      case "acos":
        return Math.acos(n(0));
      case "atan":
        return Math.atan(n(0));
      case "exp":
        return Math.exp(n(0));
      case "ln":
        return n(0) > 0 ? Math.log(n(0)) : 0;
      case "log":
        return n(0) > 0 && n(1) > 0 ? Math.log(n(1)) / Math.log(n(0)) : 0;
      case "ifelse":
      case "cond":
        return toNum(args[0] ?? 0) !== 0 ? (args[1] ?? 0) : (args[2] ?? 0);
      case "var":
        return p.vars[n(0)] ?? 0;
      case "fvar":
        return p.fvars[n(0)] ?? 0;
      case "sysvar":
        return p.sysvars[n(0)] ?? 0;
      case "sysfvar":
        return p.sysfvars[n(0)] ?? 0;
      case "const":
        return this.ch.consts[raw ?? ""] ?? 0;
      case "gethitvar": {
        const key = GETHITVAR[raw ?? ""];
        if (raw === "hitshaketime") return p.hitPause;
        return key ? p.getHit[key] : 0;
      }
      case "animexist":
      case "selfanimexist":
        return this.ch.anims[n(0)] ? 1 : 0;
      case "animelemtime": {
        const anim = getAnim(this.ch, p.anim);
        const start = anim.starts[n(0) - 1];
        return start === undefined ? 0 : p.animTick - start;
      }
      case "animelemno": {
        const anim = getAnim(this.ch, p.anim);
        const t = p.animTick + n(0);
        let idx = 0;
        for (let i = 0; i < anim.starts.length; i++) if (anim.starts[i] <= t) idx = i;
        return idx + 1;
      }
      case "numprojid":
        return numProjectiles(this.w, p.side, n(0));
      default:
        return 0;
    }
  }
}

// ------------------------------------------------- estado e animação

export function changeAnim(p: FighterState, ch: CharacterData, id: number, elem = 1): void {
  const anim = getAnim(ch, id);
  resetAnim(p, id, anim, elem - 1);
}

export function faceOpponent(p: FighterState, opp: FighterState): void {
  if (opp.x > p.x) p.facing = 1;
  else if (opp.x < p.x) p.facing = -1;
}

export function changeState(p: FighterState, w: WorldState, roster: Roster, no: number): void {
  const ch = roster[p.charId];
  const target = ch.states[no] ? no : 0;
  const sd = ch.states[target];
  p.prevStateNo = p.stateNo;
  p.stateNo = target;
  p.stateTime = 0;
  for (const k of Object.keys(p.fired)) if (!k.startsWith("-")) delete p.fired[k];
  if (!sd) return;

  if (sd.type) p.stateType = sd.type;
  if (sd.moveType) p.moveType = sd.moveType;
  if (sd.physics) p.physics = sd.physics;
  if (!sd.hitDefPersist) p.hitDefActive = false;
  if (!sd.moveHitPersist) {
    p.moveContact = 0;
    p.moveHit = 0;
    p.moveGuarded = 0;
  }

  const ctx = new FighterCtx(p, w, roster);
  if (sd.ctrl) p.ctrl = evalBool(sd.ctrl, ctx);
  if (sd.velset) {
    if (sd.velset[0]) p.vx = evalNum(sd.velset[0], ctx);
    if (sd.velset[1]) p.vy = evalNum(sd.velset[1], ctx);
  }
  if (sd.powerAdd) addPower(p, evalNum(sd.powerAdd, ctx));
  if (sd.faceP2 && evalBool(sd.faceP2, ctx)) faceOpponent(p, opponentOf(w, p));
  if (sd.anim) changeAnim(p, ch, evalNum(sd.anim, ctx));
}

export function addPower(p: FighterState, v: number): void {
  p.power = Math.max(0, Math.min(p.powerMax, p.power + v));
}

// ------------------------------------------------------- comandos

export function updateCommands(p: FighterState, ch: CharacterData, frame: number): void {
  const h = (ago: number) => inputAgo(p, ago);
  for (const cmd of ch.commands) {
    if (matchCommand(cmd, h)) p.cmdActive[cmd.name] = frame + cmd.bufferTime - 1;
  }
}

// --------------------------------------------------------- HitDef

const ANIM_TYPES: Record<string, number> = { light: 0, medium: 1, med: 1, hard: 2, heavy: 2, back: 3, up: 4, diagup: 5 };
const GROUND_TYPES: Record<string, number> = { none: 0, high: 1, low: 2, trip: 3 };

function rawWord(c: Controller, key: string): string | undefined {
  const v = c.raw[key];
  return v === undefined ? undefined : v.trim().toLowerCase();
}

export function buildHitDef(c: Controller, ctx: FighterCtx): HitDefState {
  const num = (key: string, i = 0, d = 0): number => {
    const list = c.params[key];
    return list && list[i] ? evalNum(list[i], ctx, d) : d;
  };
  const has = (key: string, i = 0) => Boolean(c.params[key]?.[i]);

  const attr = (c.raw["attr"] ?? "S, NA").split(",").map((s) => s.trim().toUpperCase());
  const animType = ANIM_TYPES[rawWord(c, "animtype") ?? "light"] ?? 0;
  const groundType = GROUND_TYPES[rawWord(c, "ground.type") ?? "high"] ?? 1;
  const damage = num("damage", 0, 0);
  const pauseP1 = num("pausetime", 0, 0);
  const pauseP2 = num("pausetime", 1, 0);
  const groundVelX = num("ground.velocity", 0, 0);
  const groundVelY = num("ground.velocity", 1, 0);
  const airVelX = num("air.velocity", 0, 0);
  const airVelY = num("air.velocity", 1, 0);
  const groundSlide = num("ground.slidetime", 0, 0);
  const groundHit = num("ground.hittime", 0, 0);
  const guardSlide = has("guard.slidetime") ? num("guard.slidetime") : groundSlide;
  const fall = num("fall", 0, 0);
  const getPower = has("getpower") ? num("getpower") : damage;

  return {
    attrState: attr[0] ?? "S",
    attrKind: attr[1] ?? "NA",
    damage,
    guardDamage: num("damage", 1, 0),
    animType,
    airAnimType: ANIM_TYPES[rawWord(c, "air.animtype") ?? ""] ?? animType,
    guardFlag: (c.raw["guardflag"] ?? "").toUpperCase(),
    hitFlag: (c.raw["hitflag"] ?? "MAF").toUpperCase(),
    pauseP1,
    pauseP2,
    guardPauseP1: has("guard.pausetime") ? num("guard.pausetime", 0) : pauseP1,
    guardPauseP2: has("guard.pausetime", 1) ? num("guard.pausetime", 1) : pauseP2,
    groundType,
    airType: GROUND_TYPES[rawWord(c, "air.type") ?? ""] ?? groundType,
    groundSlideTime: groundSlide,
    groundHitTime: groundHit,
    guardSlideTime: guardSlide,
    guardHitTime: has("guard.hittime") ? num("guard.hittime") : groundHit,
    guardCtrlTime: has("guard.ctrltime") ? num("guard.ctrltime") : guardSlide,
    groundVelX,
    groundVelY,
    guardVelX: has("guard.velocity") ? num("guard.velocity") : groundVelX,
    airVelX,
    airVelY,
    airGuardVelX: has("airguard.velocity") ? num("airguard.velocity", 0) : airVelX * 1.5,
    airGuardVelY: has("airguard.velocity", 1) ? num("airguard.velocity", 1) : airVelY * 0.5,
    airHitTime: has("air.hittime") ? num("air.hittime") : 20,
    airFall: has("air.fall") ? num("air.fall") : fall,
    fall,
    fallXVel: has("fall.xvelocity") ? num("fall.xvelocity") : Number.NaN,
    fallYVel: has("fall.yvelocity") ? num("fall.yvelocity") : -4.5,
    fallRecover: has("fall.recover") ? num("fall.recover") : 1,
    yaccel: has("yaccel") ? num("yaccel") : 0.35,
    getPower,
    givePower: has("givepower") ? num("givepower") : getPower,
    p1StateNo: has("p1stateno") ? num("p1stateno") : -1,
    kill: has("kill") ? num("kill") !== 0 : true,
    guardKill: has("guard.kill") ? num("guard.kill") !== 0 : true,
    sparkLevel: Math.min(2, animType),
  };
}

// ------------------------------------------------------ controladores

export interface StateRunner {
  spawnProjectile(p: FighterState, c: Controller, ctx: FighterCtx): void;
}

function setVarFromKey(p: FighterState, key: string, value: number, add: boolean): boolean {
  const m = /^(sys)?(f)?var\((\d+)\)$/.exec(key);
  if (!m) return false;
  const list = m[1] ? (m[2] ? p.sysfvars : p.sysvars) : m[2] ? p.fvars : p.vars;
  const idx = Number.parseInt(m[3], 10);
  if (idx < 0 || idx >= list.length) return true;
  const v = add ? list[idx] + value : value;
  list[idx] = m[2] ? v : Math.trunc(v);
  return true;
}

function varController(p: FighterState, c: Controller, ctx: FighterCtx, add: boolean): void {
  for (const key of Object.keys(c.params)) {
    const expr = c.params[key][0];
    if (!expr) continue;
    if (setVarFromKey(p, key, evalNum(expr, ctx), add)) continue;
  }
  const value = c.params["value"]?.[0];
  if (c.params["v"]?.[0] && value) {
    const i = evalNum(c.params["v"][0], ctx);
    if (i >= 0 && i < p.vars.length) p.vars[i] = Math.trunc((add ? p.vars[i] : 0) + evalNum(value, ctx));
  }
  if (c.params["fv"]?.[0] && value) {
    const i = evalNum(c.params["fv"][0], ctx);
    if (i >= 0 && i < p.fvars.length) p.fvars[i] = (add ? p.fvars[i] : 0) + evalNum(value, ctx);
  }
}

/** Executa um controlador. Retorna true se trocou de estado. */
function execController(
  p: FighterState,
  c: Controller,
  ctx: FighterCtx,
  w: WorldState,
  roster: Roster,
  runner: StateRunner,
): boolean {
  const ch = roster[p.charId];
  const param = (key: string, i = 0): Expr | undefined => c.params[key]?.[i];
  const num = (key: string, i = 0, d = 0) => evalNum(param(key, i), ctx, d);

  switch (c.type) {
    case "changestate":
    case "selfstate": {
      const value = param("value");
      if (!value) return false;
      const to = evalNum(value, ctx);
      const ctrl = param("ctrl");
      const anim = param("anim");
      const ctrlValue = ctrl ? evalBool(ctrl, ctx) : null;
      const animValue = anim ? evalNum(anim, ctx) : null;
      changeState(p, w, roster, to);
      if (ctrlValue !== null) p.ctrl = ctrlValue;
      if (animValue !== null) changeAnim(p, ch, animValue);
      return true;
    }
    case "changeanim":
    case "changeanim2": {
      const value = param("value");
      if (value) changeAnim(p, ch, evalNum(value, ctx), param("elem") ? num("elem") : 1);
      return false;
    }
    case "velset":
      if (param("x")) p.vx = num("x");
      if (param("y")) p.vy = num("y");
      return false;
    case "veladd":
      if (param("x")) p.vx += num("x");
      if (param("y")) p.vy += num("y");
      return false;
    case "velmul":
      if (param("x")) p.vx *= num("x", 0, 1);
      if (param("y")) p.vy *= num("y", 0, 1);
      return false;
    case "posset":
      if (param("x")) p.x = w.cameraX + num("x");
      if (param("y")) p.y = num("y");
      return false;
    case "posadd":
      if (param("x")) p.x += num("x") * p.facing;
      if (param("y")) p.y += num("y");
      return false;
    case "ctrlset":
      p.ctrl = num("value") !== 0;
      return false;
    case "hitdef":
      p.hitDef = buildHitDef(c, ctx);
      p.hitDefActive = true;
      return false;
    case "statetypeset": {
      const st = rawWord(c, "statetype")?.charAt(0).toUpperCase();
      const mt = rawWord(c, "movetype")?.charAt(0).toUpperCase();
      const ph = rawWord(c, "physics")?.charAt(0).toUpperCase();
      if (st && "SCAL".includes(st)) p.stateType = st as StateType;
      if (mt && "IAH".includes(mt)) p.moveType = mt as MoveType;
      if (ph && "SCAN".includes(ph)) p.physics = ph as Physics;
      return false;
    }
    case "varset":
      varController(p, c, ctx, false);
      return false;
    case "varadd":
      varController(p, c, ctx, true);
      return false;
    case "varrangeset": {
      const first = num("first", 0, 0);
      const last = num("last", 0, 59);
      if (param("value")) {
        const v = Math.trunc(num("value"));
        for (let i = Math.max(0, first); i <= Math.min(p.vars.length - 1, last); i++) p.vars[i] = v;
      }
      if (param("fvalue")) {
        const v = num("fvalue");
        for (let i = Math.max(0, first); i <= Math.min(p.fvars.length - 1, last); i++) p.fvars[i] = v;
      }
      return false;
    }
    case "lifeadd": {
      const kill = param("kill") ? num("kill") !== 0 : true;
      p.life = Math.min(p.lifeMax, p.life + Math.trunc(num("value")));
      if (p.life <= 0) p.life = kill ? 0 : 1;
      return false;
    }
    case "lifeset":
      p.life = Math.max(0, Math.min(p.lifeMax, Math.trunc(num("value"))));
      return false;
    case "poweradd":
      addPower(p, num("value"));
      return false;
    case "powerset":
      p.power = Math.max(0, Math.min(p.powerMax, num("value")));
      return false;
    case "turn":
      p.facing = p.facing === 1 ? -1 : 1;
      return false;
    case "hitvelset":
      if (param("x") && num("x") !== 0) p.vx = p.getHit.xvel;
      if (param("y") && num("y") !== 0) p.vy = p.getHit.yvel;
      return false;
    case "hitfallvel":
      if (p.getHit.fall) {
        if (!Number.isNaN(p.getHit.fallXVel)) p.vx = p.getHit.fallXVel;
        p.vy = p.getHit.fallYVel;
      }
      return false;
    case "hitfallset":
      if (param("value") && num("value") >= 0) p.getHit.fall = num("value");
      if (param("xvel")) p.getHit.fallXVel = num("xvel");
      if (param("yvel")) p.getHit.fallYVel = num("yvel");
      return false;
    case "projectile":
      runner.spawnProjectile(p, c, ctx);
      return false;
    case "nothitby":
      p.notHitBy = Math.max(p.notHitBy, param("time") ? num("time") : 1);
      return false;
    case "superpause":
    case "pause": {
      const time = param("time") ? num("time") : 30;
      if (w.superPause <= 0) {
        w.superPause = time;
        w.superPauseOwner = p.side;
        if (c.type === "superpause") {
          addPower(p, param("poweradd") ? num("poweradd") : 0);
          w.events.push({ kind: "super", x: p.x, y: p.y - 60, side: p.side, level: 2, frame: w.frame });
        }
      }
      return false;
    }
    case "targetlifeadd": {
      if (p.moveHit > 0) {
        const t = opponentOf(w, p);
        t.life = Math.max(0, Math.min(t.lifeMax, t.life + Math.trunc(num("value"))));
      }
      return false;
    }
    case "defencemulset":
      p.defenceMul = num("value", 0, 1) || 1;
      return false;
    case "attackmulset":
      p.attackMul = num("value", 0, 1);
      return false;
    default:
      // null, cosméticos e não suportados
      return false;
  }
}

function triggersPass(c: Controller, ctx: FighterCtx): boolean {
  for (const t of c.triggerAll) if (!evalBool(t, ctx)) return false;
  if (c.triggers.length === 0) return false;
  for (const group of c.triggers) {
    let ok = true;
    for (const t of group) {
      if (!evalBool(t, ctx)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** Roda os controladores de um statedef. Retorna true se houve ChangeState. */
export function runStateDef(
  p: FighterState,
  stateNo: number,
  w: WorldState,
  roster: Roster,
  runner: StateRunner,
): boolean {
  const ch = roster[p.charId];
  const sd = ch.states[stateNo];
  if (!sd) return false;
  const ctx = new FighterCtx(p, w, roster);
  for (const c of sd.controllers) {
    if (!triggersPass(c, ctx)) continue;
    const key = `${stateNo}:${c.index}`;
    const fired = p.fired[key];
    if (fired !== undefined) {
      if (c.persistent === 0) continue;
      if (fired > 0) {
        p.fired[key] = fired - 1;
        continue;
      }
    }
    p.fired[key] = c.persistent === 0 ? 1 : Math.max(0, c.persistent - 1);
    if (execController(p, c, ctx, w, roster, runner)) return true;
  }
  return false;
}

/** Valor de um parâmetro qualquer, avaliado no contexto do lutador. */
export function paramValue(c: Controller, key: string, ctx: FighterCtx, i = 0, d = 0): number {
  const e = c.params[key]?.[i];
  return e ? toNum(evaluate(e, ctx)) : d;
}

export function advanceFighterAnim(p: FighterState, ch: CharacterData): void {
  advanceAnim(p, getAnim(ch, p.anim));
}

export function clampToStage(x: number): number {
  return Math.max(STAGE_LEFT, Math.min(STAGE_RIGHT, x));
}

export function isIdleState(p: FighterState): boolean {
  return p.stateNo === 0 || p.stateNo === 20 || p.stateNo === 11;
}

export function holding(p: FighterState, key: number): boolean {
  return (relInput(p) & key) !== 0;
}

export { Key };
export type { ProjectileState };
