/**
 * Sistema de luta estilo SNK (The King of Fighters, Garou, Samurai Shodown),
 * por cima do MUGEN. Tudo aqui é determinístico e vive no WorldState, então
 * funciona igual no online com rollback.
 *
 * Botões: A = x (soco fraco), B = a (chute fraco), C = z (soco forte),
 * D = c (chute forte). Os médios (y, b) continuam existindo para o layout de
 * 6 botões do MUGEN.
 *
 * | Entrada                     | O quê                                         |
 * |-----------------------------|-----------------------------------------------|
 * | A+B                         | rolamento invencível (para trás segurando B)  |
 * | C+D (chão / ar)             | blowback: derruba                             |
 * | F ou B + C/D colado         | arremesso; C ou D a tempo escapa              |
 * | A+B+C (1 estoque)           | modo MAX: +20% de dano e super turbinado      |
 * | A+B na defesa (1 estoque)   | guard cancel com rolamento                    |
 * | C+D na defesa (1 estoque)   | guard cancel com blowback                     |
 * | B no último instante        | Just Defend: sem dano e recupera um pouco     |
 *
 * Também: contra-ataque (counter hit), medidor de defesa (guard crush) e super
 * turbinado (SDM) no MAX ou com a vida no vermelho.
 */

import {
  CHORD_WINDOW,
  GUARD_MAX,
  JUST_DEFEND_WINDOW,
  KO_HITSTOP_FRAMES,
  MAX_TICKS,
  POWER_PER_LEVEL,
  THROW_HIT_FRAME,
  THROW_HITSTOP,
  THROW_RANGE,
  THROW_TECH_WINDOW,
} from "./constants";
import {
  addPower,
  changeState,
  emptyGetHit,
  faceOpponent,
  holding,
  inputAgo,
  opponentOf,
  width,
  type Roster,
} from "./fighter";
import type { FighterState, HitDefState, WorldState } from "./types";
import { Key } from "./types";

/** Botões no padrão SNK, em bits relativos da engine. */
export const SnkButton = { A: Key.x, B: Key.a, C: Key.z, D: Key.c } as const;

/** Estados do sistema (definidos no common1, ver common1.ts). */
export const SYS = {
  ROLL_FWD: 6000,
  ROLL_BACK: 6001,
  BLOWBACK: 6010,
  AIR_BLOWBACK: 6015,
  GC_BLOWBACK: 6020,
  THROW: 6030,
  THROWN: 6040,
  THROW_TECH: 6050,
  GUARD_CRUSH: 6060,
  MAX_START: 6070,
} as const;

const { A, B, C, D } = SnkButton;

export function isRolling(p: FighterState): boolean {
  return p.stateNo === SYS.ROLL_FWD || p.stateNo === SYS.ROLL_BACK;
}

/** Defendendo um golpe (bloqueio no chão), onde valem os guard cancels. */
export function inBlockstun(p: FighterState): boolean {
  return p.stateNo >= 150 && p.stateNo <= 153;
}

/** O botão foi apertado exatamente `ago` frames atrás (borda de subida). */
export function newPress(p: FighterState, mask: number, ago: number): boolean {
  return (inputAgo(p, ago) & mask) !== 0 && (inputAgo(p, ago + 1) & mask) === 0;
}

function pressedWithin(p: FighterState, mask: number, window: number): boolean {
  for (let i = 0; i < window; i++) if (newPress(p, mask, i)) return true;
  return false;
}

/**
 * Botões apertados juntos: cada um foi apertado nos últimos `window` frames e
 * todos ainda estão seguros (o toque na tela e o teclado nunca chegam no mesmo
 * frame exato).
 */
export function chord(p: FighterState, masks: readonly number[], window = CHORD_WINDOW): boolean {
  const now = inputAgo(p, 0);
  for (const m of masks) if ((now & m) === 0 || !pressedWithin(p, m, window)) return false;
  return true;
}

/** Pode sair do que está fazendo para uma ação do sistema (com controle ou no começo de um normal). */
function cancellable(p: FighterState): boolean {
  if (p.ctrl) return true;
  // apertou A e B com um frame de diferença: o normal do A já começou
  if (p.moveType === "A" && p.stateNo >= 200 && p.stateNo < 700 && p.stateTime <= CHORD_WINDOW && p.moveContact === 0) return true;
  // A+B+C chegando um frame depois do A+B
  return isRolling(p) && p.stateTime <= 2;
}

function bodyDist(p: FighterState, opp: FighterState, roster: Roster): number {
  const dx = (opp.x - p.x) * p.facing;
  const mine = width(p, roster[p.charId]).front;
  const ow = width(opp, roster[opp.charId]);
  return dx - mine - (opp.facing === p.facing ? ow.back : ow.front);
}

function canBeThrown(opp: FighterState): boolean {
  if (opp.stateType === "A" || opp.stateType === "L" || opp.y < 0) return false;
  if (opp.moveType === "H" || opp.notHitBy > 0 || opp.life <= 0) return false;
  return opp.stateNo !== SYS.THROWN && opp.stateNo !== SYS.THROW_TECH && opp.stateNo !== SYS.MAX_START;
}

function enter(p: FighterState, w: WorldState, roster: Roster, stateNo: number): void {
  changeState(p, w, roster, stateNo);
  p.ctrl = false;
}

function event(w: WorldState, p: FighterState, kind: WorldState["events"][number]["kind"], level = 0): void {
  w.events.push({ kind, x: p.x, y: p.y - 60, side: p.side, level, frame: w.frame });
}

/**
 * Entradas do sistema. Roda antes dos estados -1 do personagem (como o
 * movimento interno do MUGEN); devolve true se trocou de estado.
 */
export function systemInput(p: FighterState, w: WorldState, roster: Roster): boolean {
  if (w.roundState !== 2 || p.life <= 0) return false;
  const opp = opponentOf(w, p);

  // guard cancels: gastam 1 estoque e só valem defendendo no chão
  if (inBlockstun(p) && p.power >= POWER_PER_LEVEL) {
    // janela maior: o aperto pode ter vindo durante o congelamento do impacto
    const cd = chord(p, [C, D], 16);
    if (cd || chord(p, [A, B], 16)) {
      p.power -= POWER_PER_LEVEL;
      p.getHit.hitTimeLeft = 0;
      enter(p, w, roster, cd ? SYS.GC_BLOWBACK : holding(p, Key.B) ? SYS.ROLL_BACK : SYS.ROLL_FWD);
      event(w, p, "guardcancel");
      return true;
    }
    return false;
  }

  const grounded = (p.stateType === "S" || p.stateType === "C") && p.y >= 0;
  if (grounded && cancellable(p)) {
    if (p.maxTime === 0 && p.power >= POWER_PER_LEVEL && chord(p, [A, B, C])) {
      p.power -= POWER_PER_LEVEL;
      p.maxTime = MAX_TICKS;
      p.maxTotal = MAX_TICKS;
      enter(p, w, roster, SYS.MAX_START);
      if (w.superPause <= 0) {
        w.superPause = 24;
        w.superPauseOwner = p.side;
      }
      event(w, p, "max");
      return true;
    }
    if (!isRolling(p)) {
      if (chord(p, [A, B])) {
        enter(p, w, roster, holding(p, Key.B) ? SYS.ROLL_BACK : SYS.ROLL_FWD);
        return true;
      }
      if (chord(p, [C, D])) {
        enter(p, w, roster, SYS.BLOWBACK);
        return true;
      }
    }
  }

  // arremesso: para frente ou para trás + C ou D, colado no oponente
  if (
    grounded &&
    p.ctrl &&
    (newPress(p, C, 0) || newPress(p, D, 0)) &&
    (holding(p, Key.F) || holding(p, Key.B)) &&
    !holding(p, Key.D) &&
    canBeThrown(opp) &&
    Math.abs(opp.y - p.y) < 4 &&
    bodyDist(p, opp, roster) <= THROW_RANGE &&
    !specialCommandActive(p, w, roster)
  ) {
    p.throwDir = holding(p, Key.B) ? -1 : 1;
    enter(p, w, roster, SYS.THROW);
    p.hitDefActive = false;
    faceOpponent(p, opp);
    faceOpponent(opp, p);
    enter(opp, w, roster, SYS.THROWN);
    opp.vx = 0;
    opp.vy = 0;
    opp.hitDefActive = false;
    event(w, p, "throw");
    return true;
  }

  // blowback no ar
  if (p.stateType === "A" && (p.ctrl || (p.moveType === "A" && p.stateNo >= 600 && p.stateNo < 700 && p.stateTime <= CHORD_WINDOW)) && chord(p, [C, D])) {
    enter(p, w, roster, SYS.AIR_BLOWBACK);
    return true;
  }
  return false;
}

/** Um comando de especial (meia-lua + botão etc.) acabou de sair: ele tem prioridade sobre o arremesso. */
function specialCommandActive(p: FighterState, w: WorldState, roster: Roster): boolean {
  for (const cmd of roster[p.charId].commands) {
    const n = cmd.elements.length;
    if (n < 2 || cmd.elements[n - 1].buttons === 0) continue;
    if ((p.cmdActive[cmd.name] ?? -1) >= w.frame) return true;
  }
  return false;
}

/** Liga os dois lados do arremesso: escape (C ou D a tempo) ou dano e derrubada. */
export function resolveThrows(w: WorldState, roster: Roster): void {
  for (const p of w.fighters) {
    if (p.throwDir === 0) continue;
    const opp = opponentOf(w, p);
    if (p.stateNo !== SYS.THROW || opp.stateNo !== SYS.THROWN) {
      p.throwDir = 0;
      continue;
    }
    if (opp.stateTime <= THROW_TECH_WINDOW && (newPress(opp, C, 0) || newPress(opp, D, 0))) {
      p.throwDir = 0;
      changeState(p, w, roster, SYS.THROW_TECH);
      changeState(opp, w, roster, SYS.THROW_TECH);
      p.ctrl = false;
      opp.ctrl = false;
      w.events.push({ kind: "tech", x: (p.x + opp.x) / 2, y: p.y - 60, side: opp.side, level: 1, frame: w.frame });
      continue;
    }
    if (p.stateTime < THROW_HIT_FRAME) continue;

    if (p.throwDir === -1) opp.x = p.x - p.facing * 24;
    faceOpponent(opp, p);
    p.throwDir = 0;
    const dmg = Math.max(1, Math.round((110 * p.attackMul * attackBoost(p, null)) / opp.defenceMul));
    opp.life = Math.max(0, opp.life - dmg);
    opp.getHit = { ...emptyGetHit(), damage: dmg, hitTime: 12, ctrlTime: 12, xvel: -4, yvel: -6.5, fall: 1, fallRecover: 0, animType: 2, hitCount: 1, hitTimeLeft: 12 };
    opp.comboHits = 1;
    opp.comboDamage = dmg;
    changeState(opp, w, roster, 5030);
    opp.moveType = "H";
    opp.ctrl = false;
    p.hitPause = THROW_HITSTOP;
    opp.hitPause = THROW_HITSTOP;
    addPower(p, 60);
    if (opp.life <= 0 && !w.training) {
      p.hitPause = KO_HITSTOP_FRAMES;
      opp.hitPause = KO_HITSTOP_FRAMES;
    }
    w.events.push({ kind: "hit", x: (p.x + opp.x) / 2, y: opp.y - 50, side: p.side, level: 2, frame: w.frame });
    if (opp.life <= 0) w.events.push({ kind: "ko", x: opp.x, y: opp.y, side: opp.side, level: 2, frame: w.frame });
  }
}

/** Defendeu apertando para trás no último instante (Garou). */
export function isJustDefend(def: FighterState): boolean {
  if (!holding(def, Key.B)) return false;
  for (let i = 0; i < JUST_DEFEND_WINDOW; i++) if (newPress(def, Key.B, i)) return true;
  return false;
}

/** Quanto um golpe defendido gasta do medidor de defesa. */
export function guardCost(hd: HitDefState): number {
  return Math.max(6, Math.min(36, Math.round(hd.damage * 0.22) + 4));
}

/** Multiplicador de dano do atacante: MAX (+20%) e super turbinado (+50%). */
export function attackBoost(att: FighterState, hd: HitDefState | null): number {
  const hyper = hd !== null && hd.attrKind.startsWith("H");
  if (hyper && (att.maxTime > 0 || att.life * 4 <= att.lifeMax)) return 1.5;
  return att.maxTime > 0 ? 1.2 : 1;
}

/** Relógios do sistema, uma vez por frame de luta. */
export function tickSystem(p: FighterState, w: WorldState): void {
  if (p.maxTime > 0) p.maxTime--;
  if (p.guardRegenDelay > 0) p.guardRegenDelay--;
  else if (p.guardMeter < GUARD_MAX && (w.frame & 1) === 0 && !(p.stateNo >= 120 && p.stateNo <= 155)) p.guardMeter++;
}
