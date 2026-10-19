/**
 * Simulação determinística de uma partida. `stepWorld` avança exatamente um
 * frame (1/60 s) dado o input dos dois lados; mesmo estado + mesmos inputs ⇒
 * mesmo resultado em qualquer aparelho — requisito do rollback online.
 */

import { advanceAnim, contactPoint, currentFrame, overlap, resetAnim, worldBox } from "./anim";
import { getAnim } from "./character";
import {
  COUNTER_HITSTOP_BONUS,
  GROUND_Y,
  GUARD_CRUSH_HITSTOP,
  GUARD_MAX,
  GUARD_REGEN_DELAY,
  INTRO_FRAMES,
  JUST_DEFEND_HITSTOP_MAX,
  KO_FRAMES,
  KO_HITSTOP_FRAMES,
  KO_SLOWMO_FRAMES,
  POWER_PER_LEVEL,
  OVER_FRAMES,
  SCREEN_MARGIN,
  SCREEN_W,
  STAGE_LEFT,
  STAGE_RIGHT,
  START_X,
} from "./constants";
import {
  addPower,
  advanceFighterAnim,
  buildHitDef,
  changeAnim,
  animCharOf,
  changeState,
  emptyGetHit,
  faceOpponent,
  FighterCtx,
  holding,
  inputAgo,
  isIdleState,
  opponentOf,
  paramValue,
  runStateDef,
  updateCommands,
  width,
  type Roster,
  type StateRunner,
} from "./fighter";
import { INPUT_HISTORY, toRelative } from "./input";
import {
  attackBoost,
  guardCost,
  isJustDefend,
  isRolling,
  resolveThrows,
  SYS,
  systemInput,
  tickSystem,
} from "./snk";
import type {
  Box,
  CharacterData,
  Controller,
  ExplodState,
  FighterState,
  HitDefState,
  MatchConfig,
  ProjectileState,
  WorldState,
} from "./types";
import { Key } from "./types";

function createFighter(side: 0 | 1, ch: CharacterData): FighterState {
  const lifeMax = Math.max(1, Math.trunc(ch.consts["data.life"] ?? 1000));
  return {
    side,
    charId: ch.id,
    x: side === 0 ? -START_X : START_X,
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    life: lifeMax,
    lifeMax,
    power: 0,
    powerMax: Math.trunc(ch.consts["data.power"] ?? 3000),
    stateNo: 0,
    prevStateNo: 0,
    stateTime: 0,
    stateType: "S",
    moveType: "I",
    physics: "S",
    ctrl: false,
    anim: 0,
    animElem: 0,
    animElemTime: 0,
    animTick: 0,
    hitDef: null,
    hitDefActive: false,
    moveContact: 0,
    moveHit: 0,
    moveGuarded: 0,
    hitPause: 0,
    getHit: emptyGetHit(),
    fired: {},
    vars: new Array(60).fill(0),
    fvars: new Array(40).fill(0),
    sysvars: new Array(5).fill(0),
    sysfvars: new Array(5).fill(0),
    inputs: new Array(INPUT_HISTORY).fill(0),
    inputHead: 0,
    rawInput: 0,
    cmdActive: {},
    comboHits: 0,
    comboDamage: 0,
    notHitBy: 0,
    roundsWon: 0,
    attackMul: (ch.consts["data.attack"] ?? 100) / 100,
    defenceMul: (ch.consts["data.defence"] ?? 100) / 100,
    maxTime: 0,
    maxTotal: 0,
    guardMeter: GUARD_MAX,
    guardRegenDelay: 0,
    throwDir: 0,
    customOwner: -1,
    animOwner: -1,
    hasTarget: false,
    bindTime: 0,
    bindX: 0,
    bindY: 0,
    helper: null,
  };
}

export function createWorld(cfg: MatchConfig, roster: Roster): WorldState {
  const teams = cfg.teams ? cfg.teams.map((m) => m.filter(Boolean).slice(0, 3)) : null;
  if (teams && (teams[0].length === 0 || teams[1].length === 0)) throw new Error("equipe vazia");
  const [a, b] = teams ? [teams[0][0], teams[1][0]] : cfg.chars;
  for (const id of teams ? [...teams[0], ...teams[1]] : [a, b]) {
    if (!roster[id]) throw new Error(`personagem não carregado: ${id}`);
  }
  const w: WorldState = {
    frame: 0,
    rng: (cfg.seed >>> 0) || 0x9e3779b9,
    roundNo: 1,
    roundState: 0,
    roundStateTime: 0,
    timer: cfg.roundTime < 0 ? -1 : cfg.roundTime * 60,
    roundTicks: cfg.roundTime < 0 ? -1 : cfg.roundTime * 60,
    training: cfg.training === true,
    fighters: [createFighter(0, roster[a]), createFighter(1, roster[b])],
    projectiles: [],
    nextProjectileId: 1,
    roundsToWin: cfg.roundsToWin,
    roundWinner: -1,
    matchWinner: -1,
    cameraX: 0,
    superPause: 0,
    superPauseOwner: -1,
    events: [],
    stageId: cfg.stageId,
    teams: teams ? [{ members: teams[0], index: 0 }, { members: teams[1], index: 0 }] : null,
    explods: [],
    helpers: [],
    nextUid: 1,
  };
  return w;
}

// ------------------------------------------------------------ projéteis

function makeRunner(w: WorldState, roster: Roster): StateRunner {
  return {
    spawnProjectile(p: FighterState, c: Controller, ctx: FighterCtx) {
      const ch = roster[p.charId];
      const anim = paramValue(c, "projanim", ctx, 0, 0);
      if (!ch.anims[anim]) return;
      const offX = paramValue(c, "offset", ctx, 0, 0);
      const offY = paramValue(c, "offset", ctx, 1, 0);
      const pr: ProjectileState = {
        id: w.nextProjectileId++,
        projId: paramValue(c, "projid", ctx, 0, 0),
        owner: p.side,
        x: p.x + offX * p.facing,
        y: p.y + offY,
        vx: paramValue(c, "velocity", ctx, 0, 0),
        vy: paramValue(c, "velocity", ctx, 1, 0),
        ax: paramValue(c, "accel", ctx, 0, 0),
        ay: paramValue(c, "accel", ctx, 1, 0),
        facing: p.facing,
        anim,
        hitAnim: paramValue(c, "projhitanim", ctx, 0, -1),
        animElem: 0,
        animElemTime: 0,
        animTick: 0,
        removeTime: paramValue(c, "projremovetime", ctx, 0, -1),
        age: 0,
        hitDef: buildHitDef(c, ctx),
        phase: "flying",
        hitTicksLeft: 0,
      };
      resetAnim(pr, anim, ch.anims[anim]);
      w.projectiles.push(pr);
    },

    spawnHelper(p: FighterState, c: Controller, ctx: FighterCtx) {
      if (w.helpers.filter((h) => h.side === p.side).length >= MAX_HELPERS) return;
      const ch = roster[p.charId];
      const h = createFighter(p.side, ch);
      const root = w.fighters[p.side];
      h.helper = { id: paramValue(c, "id", ctx, 0, 0), uid: w.nextUid++ };
      const at = place(w, p, (c.raw["postype"] ?? "p1").trim().toLowerCase(), paramValue(c, "pos", ctx, 0, 0), paramValue(c, "pos", ctx, 1, 0));
      h.x = at.x;
      h.y = at.y;
      h.facing = (paramValue(c, "facing", ctx, 0, 1) >= 0 ? p.facing : -p.facing) as 1 | -1;
      h.life = root.life;
      h.lifeMax = root.lifeMax;
      h.ctrl = false;
      w.helpers.push(h);
      changeState(h, w, roster, paramValue(c, "stateno", ctx, 0, 0));
    },

    spawnExplod(p: FighterState, c: Controller, ctx: FighterCtx) {
      const raw = (c.raw["anim"] ?? "").trim();
      if (!raw || /^f/i.test(raw)) return; // animações comuns do fight.def: não temos
      if (w.explods.length >= MAX_EXPLODS) return;
      const ch = roster[p.charId];
      const anim = paramValue(c, "anim", ctx, 0, -1);
      if (!ch.anims[anim]) return;
      const postype = (c.raw["postype"] ?? "p1").trim().toLowerCase();
      const offX = paramValue(c, "pos", ctx, 0, 0);
      const offY = paramValue(c, "pos", ctx, 1, 0);
      const at = place(w, p, postype, offX, offY);
      const facing = (paramValue(c, "facing", ctx, 0, 1) >= 0 ? p.facing : -p.facing) as 1 | -1;
      const bindTo = postype === "p2" ? opponentOf(w, p).side : postype === "p1" ? p.side : -1;
      const trans = (c.raw["trans"] ?? "").trim().toLowerCase();
      const e: ExplodState = {
        uid: w.nextUid++,
        id: paramValue(c, "id", ctx, 0, -1),
        owner: p.side,
        charId: p.charId,
        anim,
        animElem: 0,
        animElemTime: 0,
        animTick: 0,
        x: at.x,
        y: at.y,
        vx: paramValue(c, "vel", ctx, 0, 0) * facing,
        vy: paramValue(c, "vel", ctx, 1, 0),
        ax: paramValue(c, "accel", ctx, 0, 0) * facing,
        ay: paramValue(c, "accel", ctx, 1, 0),
        facing,
        bindTo,
        bindTime: bindTo >= 0 ? paramValue(c, "bindtime", ctx, 0, 0) : 0,
        offX: offX * (postype === "p2" ? opponentOf(w, p).facing : p.facing),
        offY,
        removeTime: paramValue(c, "removetime", ctx, 0, -2),
        age: 0,
        onTop: paramValue(c, "ontop", ctx, 0, 0) !== 0 || paramValue(c, "sprpriority", ctx, 0, 0) > 0,
        scaleX: paramValue(c, "scale", ctx, 0, 1),
        scaleY: paramValue(c, "scale", ctx, 1, 1),
        removeOnGetHit: paramValue(c, "removeongethit", ctx, 0, 0) !== 0,
        additive: trans.startsWith("add"),
      };
      resetAnim(e, anim, ch.anims[anim]);
      w.explods.push(e);
    },
  };
}

const MAX_HELPERS = 24;
const MAX_EXPLODS = 64;

/** Posição de um Explod/Helper pelo `postype` do MUGEN. */
function place(w: WorldState, p: FighterState, postype: string, x: number, y: number): { x: number; y: number } {
  const half = SCREEN_W / 2;
  switch (postype) {
    case "p2": {
      const o = opponentOf(w, p);
      return { x: o.x + x * o.facing, y: o.y + y };
    }
    case "front":
      return { x: (p.facing === 1 ? w.cameraX + half : w.cameraX - half) + x * p.facing, y: -GROUND_Y + y };
    case "back":
      return { x: (p.facing === 1 ? w.cameraX - half : w.cameraX + half) + x * p.facing, y: -GROUND_Y + y };
    case "left":
      return { x: w.cameraX - half + x, y: -GROUND_Y + y };
    case "right":
      return { x: w.cameraX + half + x, y: -GROUND_Y + y };
    default:
      return { x: p.x + x * p.facing, y: p.y + y };
  }
}

/** Explods: animação, movimento, presos ao lutador e remoção. */
function updateExplods(w: WorldState, roster: Roster): void {
  if (w.explods.length === 0) return;
  const keep: ExplodState[] = [];
  for (const e of w.explods) {
    const anim = getAnim(roster[e.charId], e.anim);
    e.age++;
    advanceAnim(e, anim);
    if (e.bindTime !== 0 && e.bindTo >= 0) {
      const f = w.fighters[e.bindTo];
      e.x = f.x + e.offX;
      e.y = f.y + e.offY;
      if (e.bindTime > 0) e.bindTime--;
    } else {
      e.x += e.vx;
      e.y += e.vy;
      e.vx += e.ax;
      e.vy += e.ay;
    }
    const done = e.removeTime === -2 ? !anim.infinite && e.age >= anim.totalTime : e.removeTime >= 0 && e.age >= e.removeTime;
    if (!done) keep.push(e);
  }
  w.explods = keep;
}

/** TargetBind / BindToParent: prende o lutador (ou helper) ao oponente (ou ao pai). */
function applyBinds(w: WorldState): void {
  for (const p of [...w.fighters, ...w.helpers]) {
    if (p.bindTime === 0) continue;
    const anchor = p.helper ? w.fighters[p.side] : opponentOf(w, p);
    p.x = anchor.x + p.bindX * anchor.facing;
    p.y = anchor.y + p.bindY;
    if (p.bindTime > 0) p.bindTime--;
  }
}

/** Helpers: rodam os próprios estados (sem os comandos -1), física e animação. */
function runHelpers(w: WorldState, roster: Roster, runner: StateRunner): void {
  if (w.helpers.length === 0) return;
  for (const h of [...w.helpers]) {
    if (h.hitPause > 0) {
      h.hitPause--;
      continue;
    }
    if (h.notHitBy > 0) h.notHitBy--;
    for (let guard = 0; guard < 16; guard++) {
      if (!runStateDef(h, h.stateNo, w, roster, runner) || (h.helper?.uid ?? 0) < 0) break;
    }
    if ((h.helper?.uid ?? 0) < 0) continue;
    physicsAndMove(h, w, roster);
    advanceFighterAnim(h, animCharOf(w, roster, h));
    tickCounters(h);
  }
  w.helpers = w.helpers.filter((h) => (h.helper?.uid ?? 0) >= 0);
}

function updateProjectiles(w: WorldState, roster: Roster): void {
  const keep: ProjectileState[] = [];
  for (const pr of w.projectiles) {
    const ch = roster[w.fighters[pr.owner].charId];
    pr.age++;
    if (pr.phase === "hit") {
      pr.hitTicksLeft--;
      if (pr.hitTicksLeft > 0) {
        advanceAnim(pr, getAnim(ch, pr.anim));
        keep.push(pr);
      }
      continue;
    }
    pr.x += pr.vx * pr.facing;
    pr.y += pr.vy;
    pr.vx += pr.ax;
    pr.vy += pr.ay;
    advanceAnim(pr, getAnim(ch, pr.anim));
    const expired = pr.removeTime >= 0 && pr.age >= pr.removeTime;
    const offscreen = Math.abs(pr.x - w.cameraX) > SCREEN_W / 2 + 80 || pr.y > 40 || pr.y < -300;
    if (!expired && !offscreen) keep.push(pr);
  }
  w.projectiles = keep;
}

function finishProjectile(pr: ProjectileState, roster: Roster, w: WorldState): void {
  const ch = roster[w.fighters[pr.owner].charId];
  pr.phase = "hit";
  pr.vx = 0;
  pr.vy = 0;
  if (pr.hitAnim >= 0 && ch.anims[pr.hitAnim]) {
    const anim = ch.anims[pr.hitAnim];
    resetAnim(pr, pr.hitAnim, anim);
    pr.hitTicksLeft = anim.infinite ? 20 : Math.max(1, anim.totalTime);
  } else {
    pr.hitTicksLeft = 0;
  }
}

const DEFAULT_PROJ_BOX: Box = { x1: -10, y1: -10, x2: 10, y2: 10 };

function projectileBoxes(pr: ProjectileState, roster: Roster, w: WorldState): Box[] {
  const ch = roster[w.fighters[pr.owner].charId];
  const f = currentFrame(pr, getAnim(ch, pr.anim));
  const boxes = f.clsn1.length > 0 ? f.clsn1 : f.clsn2.length > 0 ? f.clsn2 : [DEFAULT_PROJ_BOX];
  return boxes.map((b) => worldBox(b, pr.x, pr.y, pr.facing));
}

// ------------------------------------------------------------- golpes

function fighterBoxes(p: FighterState, ch: CharacterData, kind: 1 | 2): Box[] {
  const f = currentFrame(p, getAnim(ch, p.anim));
  const list = kind === 1 ? f.clsn1 : f.clsn2;
  return list.map((b) => worldBox(b, p.x, p.y, p.facing));
}

function firstContact(att: Box[], def: Box[]): { x: number; y: number } | null {
  for (const a of att) for (const d of def) if (overlap(a, d)) return contactPoint(a, d);
  return null;
}

function hitFlagAllows(hd: HitDefState, def: FighterState): boolean {
  const f = hd.hitFlag;
  if (f.includes("-") && def.moveType === "H") return false;
  if (f.includes("+") && def.moveType !== "H") return false;
  switch (def.stateType) {
    case "S":
      return f.includes("H") || f.includes("M");
    case "C":
      return f.includes("L") || f.includes("M");
    case "A":
      return f.includes("A") || (def.moveType === "H" && def.getHit.fall !== 0 && f.includes("F"));
    case "L":
      return f.includes("D");
  }
}

function canGuard(hd: HitDefState, def: FighterState): boolean {
  if (def.stateType === "L" || def.life <= 0) return false;
  const inGuard = def.stateNo >= 120 && def.stateNo <= 155;
  const wantsGuard = inGuard || (def.ctrl && def.moveType !== "H" && holding(def, Key.B));
  if (!wantsGuard) return false;
  const g = hd.guardFlag;
  switch (def.stateType) {
    case "S":
      return g.includes("H") || g.includes("M");
    case "C":
      return g.includes("L") || g.includes("M");
    case "A":
      return g.includes("A");
  }
}

function applyHit(
  w: WorldState,
  roster: Roster,
  att: FighterState,
  def: FighterState,
  hd: HitDefState,
  at: { x: number; y: number },
  fromProjectile: ProjectileState | null,
): void {
  const defCh = roster[def.charId];
  const wasHit = def.moveType === "H";
  // apanhar devolve aos próprios estados e solta qualquer TargetBind
  def.customOwner = -1;
  def.bindTime = 0;
  if (w.explods.length) w.explods = w.explods.filter((e) => !(e.owner === def.side && e.removeOnGetHit));
  if (fromProjectile) def.facing = fromProjectile.facing === 1 ? -1 : 1;
  else faceOpponent(def, att);

  const boost = attackBoost(att, hd);
  if (canGuard(hd, def)) {
    // Just Defend (Garou): sem dano, recupera um pouco e sai mais rápido da defesa
    const jd = isJustDefend(def);
    const dmg = jd ? 0 : Math.round((hd.guardDamage * att.attackMul * boost) / def.defenceMul);
    def.life -= dmg;
    if (def.life <= 0) def.life = hd.guardKill ? 0 : 1;
    if (jd) def.life = Math.min(def.lifeMax, def.life + 6);
    const air = def.stateType === "A";
    const hitTime = jd ? Math.max(3, Math.round(hd.guardHitTime / 2)) : hd.guardHitTime;
    def.getHit = {
      ...emptyGetHit(),
      damage: dmg,
      hitTime,
      slideTime: jd ? 0 : hd.guardSlideTime,
      ctrlTime: jd ? hitTime : hd.guardCtrlTime,
      xvel: jd ? 0 : air ? hd.airGuardVelX : hd.guardVelX,
      yvel: air ? hd.airGuardVelY : 0,
      yaccel: hd.yaccel,
      guarded: 1,
      hitTimeLeft: hitTime,
    };
    if (!fromProjectile) {
      att.moveGuarded = 1;
      att.moveContact = 1;
      att.hitPause = hd.guardPauseP1;
      att.hitDefActive = false;
    }
    def.hitPause = jd ? Math.min(hd.guardPauseP2, JUST_DEFEND_HITSTOP_MAX) : hd.guardPauseP2;
    // medidor de defesa: quem só defende acaba aberto (guard crush)
    const crush = !jd && !air && (def.guardMeter -= guardCost(hd)) <= 0;
    if (!jd) def.guardRegenDelay = GUARD_REGEN_DELAY;
    if (crush) {
      def.guardMeter = GUARD_MAX;
      changeState(def, w, roster, SYS.GUARD_CRUSH);
      def.hitPause = Math.max(def.hitPause, GUARD_CRUSH_HITSTOP);
    } else {
      changeState(def, w, roster, air ? 154 : def.stateType === "C" ? 152 : 150);
    }
    def.ctrl = false;
    addPower(att, hd.getPower / 2);
    addPower(def, jd ? 40 : hd.givePower / 2);
    w.events.push({ kind: "guard", x: at.x, y: at.y, side: att.side, level: hd.hitLevel, frame: w.frame });
    if (hd.guardSound) w.events.push({ kind: "sound", x: at.x, y: at.y, side: att.side, level: 0, frame: w.frame, snd: [hd.guardSound[0], hd.guardSound[1]], common: hd.guardSound[2], charId: att.charId });
    if (jd) w.events.push({ kind: "justdefend", x: def.x, y: def.y - 70, side: def.side, level: 0, frame: w.frame });
    if (crush) w.events.push({ kind: "guardcrush", x: def.x, y: def.y - 70, side: def.side, level: 2, frame: w.frame });
    if (def.life <= 0) w.events.push({ kind: "ko", x: def.x, y: def.y, side: def.side, level: 2, frame: w.frame });
    return;
  }

  // contra-ataque: acertar quem estava atacando dá mais dano e mais atordoamento
  const counter = !wasHit && def.moveType === "A";
  const combo = wasHit ? def.comboHits + 1 : 1;
  const scale = combo > 3 ? Math.max(0.4, 1 - 0.1 * (combo - 3)) : 1;
  const dmg = Math.max(hd.damage > 0 ? 1 : 0, Math.round(((hd.damage * att.attackMul * boost * (counter ? 1.25 : 1)) / def.defenceMul) * scale));
  def.life -= dmg;
  if (def.life <= 0) def.life = hd.kill ? 0 : 1;
  def.comboHits = combo;
  def.comboDamage = wasHit ? def.comboDamage + dmg : dmg;

  const airborne = def.stateType === "A" || def.stateType === "L";
  let xvel = airborne ? hd.airVelX : hd.groundVelX;
  let yvel = airborne ? hd.airVelY : hd.groundVelY;
  let fall = airborne ? hd.airFall : hd.fall;
  const groundType = airborne ? hd.airType : hd.groundType;
  if (!airborne && groundType === 3) fall = 1; // trip
  if (def.life <= 0) {
    fall = 1;
    if (yvel === 0) yvel = -5;
    if (xvel > -2.5) xvel = -2.5;
  }
  if (fall && yvel === 0) yvel = hd.fallYVel;
  if (def.stateType === "L") {
    fall = 1;
    if (yvel === 0) yvel = -3;
  }
  const hitTime = (airborne ? hd.airHitTime : hd.groundHitTime) + (counter ? 4 : 0);
  def.getHit = {
    damage: dmg,
    hitTime,
    slideTime: hd.groundSlideTime,
    ctrlTime: hitTime,
    xvel,
    yvel,
    yaccel: hd.yaccel,
    fall,
    fallXVel: hd.fallXVel,
    fallYVel: hd.fallYVel,
    fallRecover: hd.fallRecover,
    animType: airborne ? hd.airAnimType : hd.animType,
    groundType,
    airType: hd.airType,
    guarded: 0,
    hitCount: combo,
    hitTimeLeft: hitTime,
  };

  // hitstop: o do HitDef (ou o do nível do golpe), mais longo no contra-ataque e no K.O.
  const bonus = counter && hd.pauseP2 > 0 ? COUNTER_HITSTOP_BONUS : 0;
  const koStop = def.life <= 0 && !w.training ? KO_HITSTOP_FRAMES : 0;
  if (!fromProjectile) {
    att.moveHit = 1;
    att.moveContact = 1;
    att.hitPause = Math.max(hd.pauseP1 + (hd.pauseP1 > 0 ? bonus : 0), koStop);
    att.hitDefActive = false;
  }
  def.hitPause = Math.max(hd.pauseP2 + bonus, koStop);

  const stateNo = airborne ? 5020 : def.stateType === "C" ? 5010 : 5000;
  changeState(def, w, roster, stateNo);
  def.ctrl = false;
  def.moveType = "H";
  const animBase = airborne ? 5030 : def.stateType === "C" ? 5010 : 5000;
  changeAnim(def, defCh, airborne ? animBase : animBase + def.getHit.animType);

  addPower(att, hd.getPower);
  addPower(def, hd.givePower * 0.6);

  if (!fromProjectile) att.hasTarget = true;
  if (!fromProjectile && hd.p1StateNo >= 0) changeState(att, w, roster, hd.p1StateNo);
  // arremesso do MUGEN: o oponente passa a rodar um estado do atacante
  if (!fromProjectile && hd.p2StateNo >= 0 && def.life > 0) {
    def.customOwner = att.side;
    changeState(def, w, roster, hd.p2StateNo);
    if (hd.p2Facing !== 0) def.facing = (hd.p2Facing > 0 ? -att.facing : att.facing) as 1 | -1;
  }
  if (hd.hitSound) w.events.push({ kind: "sound", x: at.x, y: at.y, side: att.side, level: 0, frame: w.frame, snd: [hd.hitSound[0], hd.hitSound[1]], common: hd.hitSound[2], charId: att.charId });

  w.events.push({ kind: "hit", x: at.x, y: at.y, side: att.side, level: hd.hitLevel, frame: w.frame });
  if (counter) w.events.push({ kind: "counter", x: def.x, y: def.y - 70, side: att.side, level: 0, frame: w.frame });
  if (def.life <= 0) w.events.push({ kind: "ko", x: def.x, y: def.y, side: def.side, level: 2, frame: w.frame });
}

function detectHits(w: WorldState, roster: Roster): void {
  const [p0, p1] = w.fighters;
  type Pending = { att: FighterState; def: FighterState; hd: HitDefState; at: { x: number; y: number } };
  const pending: Pending[] = [];

  // lutadores e helpers atacam o lutador do outro lado
  const attackers: [FighterState, FighterState][] = [
    [p0, p1],
    [p1, p0],
  ];
  for (const h of w.helpers) attackers.push([h, opponentOf(w, h)]);
  for (const [att, def] of attackers) {
    if (!att.hitDefActive || !att.hitDef || def.notHitBy > 0) continue;
    if (!hitFlagAllows(att.hitDef, def)) continue;
    const at = firstContact(fighterBoxes(att, animCharOf(w, roster, att), 1), fighterBoxes(def, animCharOf(w, roster, def), 2));
    if (at) pending.push({ att, def, hd: att.hitDef, at });
  }
  // aplicar depois de checar os dois lados: golpes simultâneos trocam (trade)
  for (const h of pending) applyHit(w, roster, h.att, h.def, h.hd, h.at, null);

  // projétil × projétil se anulam
  const flying = w.projectiles.filter((p) => p.phase === "flying");
  for (let i = 0; i < flying.length; i++) {
    for (let j = i + 1; j < flying.length; j++) {
      const a = flying[i];
      const b = flying[j];
      if (a.owner === b.owner || a.phase !== "flying" || b.phase !== "flying") continue;
      const at = firstContact(projectileBoxes(a, roster, w), projectileBoxes(b, roster, w));
      if (at) {
        finishProjectile(a, roster, w);
        finishProjectile(b, roster, w);
        w.events.push({ kind: "guard", x: at.x, y: at.y, side: a.owner, level: 1, frame: w.frame });
      }
    }
  }

  for (const pr of w.projectiles) {
    if (pr.phase !== "flying") continue;
    const att = w.fighters[pr.owner];
    const def = opponentOf(w, att);
    if (def.notHitBy > 0 || !hitFlagAllows(pr.hitDef, def)) continue;
    const at = firstContact(projectileBoxes(pr, roster, w), fighterBoxes(def, animCharOf(w, roster, def), 2));
    if (!at) continue;
    applyHit(w, roster, att, def, pr.hitDef, at, pr);
    finishProjectile(pr, roster, w);
  }
}

// -------------------------------------------------------------- física

function applyFriction(p: FighterState, ch: CharacterData): void {
  if (p.y < 0) return;
  if (p.physics === "S") p.vx *= ch.consts["movement.stand.friction"] ?? 0.85;
  else if (p.physics === "C") p.vx *= ch.consts["movement.crouch.friction"] ?? 0.82;
}

function internalMovement(p: FighterState, w: WorldState, roster: Roster): void {
  if (w.roundState !== 2) return;
  const ch = roster[p.charId];
  const opp = opponentOf(w, p);
  const ctx = new FighterCtx(p, w, roster);

  // defesa automática ao segurar para trás durante um ataque
  const inGuard = p.stateNo >= 120 && p.stateNo <= 155;
  if (p.ctrl && !inGuard && p.moveType !== "H" && p.stateType !== "L" && holding(p, Key.B) && ctx.ident("inguarddist") === 1) {
    if (p.stateType === "S" && holding(p, Key.D)) p.stateType = "C";
    changeState(p, w, roster, 120);
    return;
  }

  if (!p.ctrl) return;
  if (p.stateType === "S" && (p.stateNo === 0 || p.stateNo === 20)) {
    if (holding(p, Key.U)) {
      changeState(p, w, roster, 40);
      return;
    }
    if (holding(p, Key.D)) {
      changeState(p, w, roster, 10);
      return;
    }
    const fwd = holding(p, Key.F);
    const back = holding(p, Key.B);
    if (fwd !== back) {
      if (p.stateNo !== 20) changeState(p, w, roster, 20);
    } else if (p.stateNo === 20) {
      changeState(p, w, roster, 0);
    }
  } else if (p.stateNo === 11 && !holding(p, Key.D)) {
    changeState(p, w, roster, 12);
  }

  if (p.stateNo === 20) {
    const fwd = holding(p, Key.F);
    p.vx = fwd ? (ch.consts["velocity.walk.fwd.x"] ?? 2.4) : (ch.consts["velocity.walk.back.x"] ?? -2.2);
    const want = fwd ? 20 : ch.anims[21] ? 21 : 20;
    if (p.anim !== want) changeAnim(p, ch, want);
  }
  void opp;
}

function runFighter(p: FighterState, w: WorldState, roster: Roster, runner: StateRunner): void {
  const ch = roster[p.charId];
  applyFriction(p, ch);

  // -3/-2/-1 sempre rodam; depois os movimentos internos; depois o estado atual.
  // sistema SNK (rolamento, blowback, arremesso, MAX, guard cancel) antes dos comandos do personagem
  let changed = systemInput(p, w, roster);
  if (!changed) for (const special of [-3, -2, -1]) {
    if (ch.states[special] && runStateDef(p, special, w, roster, runner)) changed = true;
  }
  if (!changed) internalMovement(p, w, roster);

  for (let guard = 0; guard < 16; guard++) {
    if (!runStateDef(p, p.stateNo, w, roster, runner)) break;
  }
}

function physicsAndMove(p: FighterState, w: WorldState, roster: Roster): void {
  const ch = roster[p.charId];
  if (p.physics === "A") p.vy += ch.consts["movement.yaccel"] ?? 0.44;
  p.x += p.vx * p.facing;
  p.y += p.vy;

  if (p.physics === "A" && p.y >= 0 && p.vy > 0) {
    p.y = 0;
    p.vy = 0;
    changeState(p, w, roster, 52);
  } else if ((p.physics === "S" || p.physics === "C") && p.y > 0) {
    p.y = 0;
  }
}

function tickCounters(p: FighterState): void {
  p.stateTime++;
  if (p.moveContact > 0) p.moveContact++;
  if (p.moveHit > 0) p.moveHit++;
  if (p.moveGuarded > 0) p.moveGuarded++;
  if (p.moveType === "H") p.getHit.hitTimeLeft--;
  else p.comboHits = 0;
}

// ---------------------------------------------------------- posições

function separate(w: WorldState, roster: Roster): void {
  const [a, b] = w.fighters;
  if (a.stateType === "L" || b.stateType === "L") return;
  if (isRolling(a) || isRolling(b)) return; // o rolamento atravessa o oponente
  const ha = roster[a.charId].consts["size.height"] ?? 60;
  const hb = roster[b.charId].consts["size.height"] ?? 60;
  if (a.y < b.y - hb || b.y < a.y - ha) return; // um passou por cima do outro

  const left = a.x <= b.x ? a : b;
  const right = left === a ? b : a;
  const wl = width(left, roster[left.charId]);
  const wr = width(right, roster[right.charId]);
  const leftEdge = left.facing === 1 ? wl.front : wl.back;
  const rightEdge = right.facing === -1 ? wr.front : wr.back;
  const gap = right.x - left.x - (leftEdge + rightEdge);
  if (gap >= 0) return;
  const push = -gap / 2;
  left.x -= push;
  right.x += push;
}

function clampPositions(w: WorldState): void {
  const [a, b] = w.fighters;
  const mid = (a.x + b.x) / 2;
  const half = SCREEN_W / 2;
  w.cameraX = Math.max(STAGE_LEFT + half, Math.min(STAGE_RIGHT - half, mid));
  const lo = w.cameraX - half + SCREEN_MARGIN;
  const hi = w.cameraX + half - SCREEN_MARGIN;
  for (const p of w.fighters) {
    p.x = Math.max(Math.max(STAGE_LEFT + SCREEN_MARGIN, lo), Math.min(Math.min(STAGE_RIGHT - SCREEN_MARGIN, hi), p.x));
  }
  // se os dois estiverem colados na mesma parede, empurra o de dentro
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  if (r.x - l.x < 8 && !isRolling(a) && !isRolling(b)) r.x = Math.min(hi, l.x + 8);
}

function autoTurn(w: WorldState, roster: Roster): void {
  for (const p of w.fighters) {
    const opp = opponentOf(w, p);
    if (!p.ctrl || p.moveType !== "I" || p.stateType === "A" || p.stateType === "L") continue;
    if (!(isIdleState(p) || (p.stateNo >= 120 && p.stateNo <= 140))) continue;
    const shouldFace = opp.x > p.x ? 1 : opp.x < p.x ? -1 : p.facing;
    if (shouldFace !== p.facing) {
      p.facing = shouldFace;
      const ch = roster[p.charId];
      const turnAnim = p.stateType === "C" ? 6 : 5;
      if (ch.anims[turnAnim] && (p.stateNo === 0 || p.stateNo === 11)) changeAnim(p, ch, turnAnim);
    }
  }
}

// -------------------------------------------------------------- rounds

function resetRound(w: WorldState, roster: Roster, keepLife: readonly [boolean, boolean] = [false, false]): void {
  w.roundState = 1;
  w.roundStateTime = 0;
  w.roundWinner = -1;
  w.projectiles = [];
  w.explods = [];
  w.helpers = [];
  w.superPause = 0;
  w.cameraX = 0;
  w.timer = w.roundTicks;
  for (const p of w.fighters) {
    const ch = roster[p.charId];
    const keep: Partial<FighterState> = { roundsWon: p.roundsWon, power: p.power };
    if (keepLife[p.side]) keep.life = p.life;
    Object.assign(p, createFighter(p.side, ch), keep);
    changeState(p, w, roster, ch.states[190] && ch.anims[190] ? 190 : 0);
    p.ctrl = false;
    if (p.stateNo === 0) changeAnim(p, ch, 0);
  }
  w.events.push({ kind: "round", x: 0, y: -100, side: 0, level: w.roundNo, frame: w.frame });
}

function settled(p: FighterState): boolean {
  if (p.life <= 0) return p.stateNo === 5110 || p.stateType === "L";
  return p.moveType !== "H" && p.stateType !== "A";
}

function updateRound(w: WorldState, roster: Roster): void {
  w.roundStateTime++;
  const [a, b] = w.fighters;

  switch (w.roundState) {
    case 0:
      resetRound(w, roster);
      return;
    case 1:
      if (w.roundStateTime >= INTRO_FRAMES) {
        w.roundState = 2;
        w.roundStateTime = 0;
        for (const p of w.fighters) {
          if (p.stateNo === 190) changeState(p, w, roster, 0);
          p.ctrl = true;
        }
        w.events.push({ kind: "fight", x: 0, y: -100, side: 0, level: 0, frame: w.frame });
      }
      return;
    case 2: {
      if (w.training) {
        for (const p of w.fighters) {
          if (p.life <= 0) p.life = 1;
          if (p.moveType !== "H" && p.stateTime > 60) p.life = p.lifeMax;
          p.power = p.powerMax;
        }
        return;
      }
      if (w.timer > 0) w.timer--;
      const ko = a.life <= 0 || b.life <= 0;
      if (ko || w.timer === 0) {
        if (a.life <= 0 && b.life <= 0) w.roundWinner = 2;
        else if (a.life <= 0) w.roundWinner = 1;
        else if (b.life <= 0) w.roundWinner = 0;
        else {
          const ra = a.life / a.lifeMax;
          const rb = b.life / b.lifeMax;
          w.roundWinner = ra === rb ? 2 : ra > rb ? 0 : 1;
        }
        w.roundState = 3;
        w.roundStateTime = 0;
        for (const p of w.fighters) p.ctrl = false;
      }
      return;
    }
    case 3:
      if (w.roundStateTime >= KO_FRAMES && (w.roundStateTime >= KO_FRAMES * 2 || (settled(a) && settled(b)))) {
        for (const p of w.fighters) {
          const won = w.roundWinner === p.side;
          if (won || w.roundWinner === 2) p.roundsWon++;
          if (won && p.life > 0) changeState(p, w, roster, 180);
          else if (p.life > 0 && w.roundWinner !== 2) changeState(p, w, roster, 170);
        }
        w.roundState = 4;
        w.roundStateTime = 0;
      }
      return;
    case 4:
      if (w.matchWinner < 0 && w.roundStateTime >= OVER_FRAMES && w.teams) {
        nextTeamRound(w, roster);
      } else if (w.matchWinner < 0 && w.roundStateTime >= OVER_FRAMES) {
        const aWon = a.roundsWon >= w.roundsToWin;
        const bWon = b.roundsWon >= w.roundsToWin;
        if (aWon || bWon || w.roundNo >= 9) {
          w.matchWinner = aWon && bWon ? 2 : aWon ? 0 : bWon ? 1 : a.roundsWon === b.roundsWon ? 2 : a.roundsWon > b.roundsWon ? 0 : 1;
        } else {
          w.roundNo++;
          resetRound(w, roster);
        }
      }
      return;
  }
}

/**
 * Equipes (KOF): quem perdeu dá lugar ao próximo, que entra com +1 estoque;
 * quem venceu continua com a vida que tinha e recupera 30% do que perdeu.
 */
function nextTeamRound(w: WorldState, roster: Roster): void {
  const teams = w.teams;
  if (!teams) return;
  const lost: [boolean, boolean] = [w.roundWinner === 1 || w.roundWinner === 2, w.roundWinner === 0 || w.roundWinner === 2];
  for (const side of [0, 1] as const) if (lost[side]) teams[side].index++;
  const out = teams.map((t) => t.index >= t.members.length);
  if (out[0] || out[1]) {
    w.matchWinner = out[0] && out[1] ? 2 : out[0] ? 1 : 0;
    return;
  }
  w.roundNo++;
  for (const side of [0, 1] as const) {
    const prev = w.fighters[side];
    if (lost[side]) {
      const next = createFighter(side, roster[teams[side].members[teams[side].index]]);
      next.power = Math.min(next.powerMax, prev.power + POWER_PER_LEVEL);
      next.roundsWon = prev.roundsWon;
      w.fighters[side] = next;
    } else {
      prev.life = Math.min(prev.lifeMax, prev.life + Math.round((prev.lifeMax - prev.life) * 0.3));
    }
  }
  resetRound(w, roster, [!lost[0], !lost[1]]);
}

// ---------------------------------------------------------------- step

export function stepWorld(w: WorldState, inputs: readonly [number, number], roster: Roster): void {
  w.frame++;
  w.events = [];
  updateRound(w, roster);

  // entradas
  for (const p of w.fighters) {
    const raw = w.roundState === 2 ? inputs[p.side] : 0;
    p.rawInput = raw;
    p.inputHead = (p.inputHead + 1) % INPUT_HISTORY;
    p.inputs[p.inputHead] = toRelative(raw, p.facing);
    // congelado neste quadro (superpause ou hitstop): o buffer dos especiais não envelhece
    updateCommands(p, roster[p.charId], w.frame, w.superPause > 0 || p.hitPause > 0);
  }

  // pausa de super: o mundo inteiro congela, inclusive quem soltou (pausemovetime = 0 do MUGEN);
  // antes a animação dele andava sozinha e os golpes do começo do super se perdiam
  if (w.superPause > 0) {
    w.superPause--;
    return;
  }

  // câmera lenta do K.O.: os lutadores andam 1 frame a cada 3
  if (w.roundState === 3 && w.roundStateTime < KO_SLOWMO_FRAMES && w.roundStateTime % 3 !== 0 && !w.training) {
    if (w.fighters[0].life <= 0 || w.fighters[1].life <= 0) return;
  }

  const runner = makeRunner(w, roster);
  for (const p of w.fighters) {
    if (p.hitPause > 0) continue;
    // NotHitBy conta a partir do frame em que é ligado (time = 1 vale para este frame)
    if (p.notHitBy > 0) p.notHitBy--;
    runFighter(p, w, roster, runner);
  }
  resolveThrows(w, roster);
  if (w.roundState === 2) for (const p of w.fighters) tickSystem(p, w);

  for (const p of w.fighters) {
    if (p.hitPause > 0) {
      p.hitPause--;
      continue;
    }
    physicsAndMove(p, w, roster);
    advanceFighterAnim(p, animCharOf(w, roster, p));
    tickCounters(p);
  }

  runHelpers(w, roster, runner);
  applyBinds(w);
  updateExplods(w, roster);
  updateProjectiles(w, roster);
  separate(w, roster);
  clampPositions(w);
  autoTurn(w, roster);
  if (w.roundState >= 2) detectHits(w, roster);
}

/** Histórico de entradas usado pela IA e pelo HUD de treino. */
export function lastInputs(p: FighterState, n: number): number[] {
  return Array.from({ length: n }, (_, i) => inputAgo(p, i));
}
