/**
 * CPU do modo arcade/versus. Lê o estado do mundo e devolve input como um
 * jogador humano (não trapaceia lendo inputs do oponente). Não precisa ser
 * determinística: só roda em partidas locais.
 *
 * Usa o sistema SNK como um jogador faria: rola por cima de golpes, arremessa
 * colado, escapa de arremessos, usa guard cancel, blowback e liga o MAX.
 */

import { Btn } from "@/src/engine/input";
import { inBlockstun, SYS } from "@/src/engine/snk";
import type { CharacterData, FighterState, WorldState } from "@/src/engine/types";

import { findCommand, macroFromCommand, MacroPlayer, motionCommands } from "./macros";

const LEVELS = {
  1: { reaction: 22, guard: 0.25, aggression: 0.35, special: 0.15, system: 0.05, tech: 0.1 },
  2: { reaction: 12, guard: 0.55, aggression: 0.55, special: 0.3, system: 0.15, tech: 0.35 },
  3: { reaction: 6, guard: 0.85, aggression: 0.7, special: 0.45, system: 0.3, tech: 0.7 },
} as const;

// botões no padrão SNK
const A = Btn.x;
const B = Btn.a;
const C = Btn.z;
const D = Btn.c;

export class CpuController {
  private macro = new MacroPlayer();
  private hold = 0;
  private holdTicks = 0;
  private cooldown = 0;
  /** Já decidiu (escapar ou não) para o arremesso que começou neste frame. */
  private throwSeen = -1;
  private readonly cfg: (typeof LEVELS)[1 | 2 | 3];

  constructor(
    private readonly side: 0 | 1,
    /** Personagens da luta; nas equipes o lutador da CPU muda entre rounds. */
    private readonly roster: Record<string, CharacterData>,
    level: 1 | 2 | 3,
    private readonly rand: () => number = Math.random,
  ) {
    this.cfg = LEVELS[level];
  }

  next(w: WorldState): number {
    if (w.roundState !== 2) {
      this.macro.clear();
      this.holdTicks = 0;
      return 0;
    }
    const me = w.fighters[this.side];
    const reflex = this.reflex(w, me);
    if (reflex !== null) return reflex;
    const step = this.macro.next();
    if (step !== null) return step;
    if (this.holdTicks > 0) {
      this.holdTicks--;
      return this.hold;
    }
    if (this.cooldown-- > 0) return 0;
    this.cooldown = Math.max(1, Math.round(this.cfg.reaction * (0.6 + this.rand() * 0.8)));
    return this.decide(w, me);
  }

  /** Reações que não esperam o tempo de reação normal (como um jogador treinado). */
  private reflex(w: WorldState, me: FighterState): number | null {
    // escapar do arremesso
    if (me.stateNo === SYS.THROWN && me.stateTime < 6) {
      const start = w.frame - me.stateTime;
      if (this.throwSeen !== start) {
        this.throwSeen = start;
        if (this.rand() < this.cfg.tech) return this.holdFor(D, 3);
      }
      return null;
    }
    // guard cancel: só quando tem estoque e o oponente está colado
    if (inBlockstun(me) && me.power >= 1000 && me.stateTime === 0 && this.rand() < this.cfg.system * 0.5) {
      this.macro.clear();
      return this.holdFor(this.rand() < 0.5 ? C | D : A | B, 4);
    }
    return null;
  }

  private holdFor(bits: number, ticks: number): number {
    this.hold = bits;
    this.holdTicks = ticks;
    return bits;
  }

  private play(ch: CharacterData, name: string, me: { facing: 1 | -1 }): number {
    const cmd = findCommand(ch, name);
    if (!cmd) return 0;
    this.macro.play(macroFromCommand(cmd), me.facing);
    return this.macro.next() ?? 0;
  }

  private decide(w: WorldState, me: FighterState): number {
    const ch = this.roster[me.charId];
    const opp = w.fighters[this.side === 0 ? 1 : 0];
    if (!me.ctrl && me.moveType !== "A") return 0;
    const dist = Math.abs(opp.x - me.x);
    const toward = opp.x > me.x ? Btn.R : Btn.L;
    const away = toward === Btn.R ? Btn.L : Btn.R;
    const r = this.rand();
    const sys = this.cfg.system;
    const motions = motionCommands(ch);

    const incoming = w.projectiles.some((p) => p.owner !== this.side && p.phase === "flying" && Math.abs(p.x - me.x) < 120);
    if ((opp.moveType === "A" && dist < 110) || incoming) {
      // rolar por cima do golpe/projétil em vez de defender
      if (r < sys * 0.6 && opp.stateType !== "A") return this.holdFor(A | B, 3);
      if (r < this.cfg.guard) return this.holdFor(away | (opp.stateType === "C" ? Btn.D : 0), 14);
      if (incoming && r < this.cfg.guard + 0.2) return this.holdFor(Btn.U | toward, 10);
    }

    // anti-aéreo
    if (opp.stateType === "A" && dist < 90 && r < this.cfg.special) {
      const dp = motions.find((c) => c.name.startsWith("dp"));
      if (dp) return this.play(ch, dp.name, me);
      return this.holdFor(Btn.D | C, 2);
    }

    // MAX com estoque sobrando; no MAX, super turbinado
    if (me.maxTime === 0 && me.power >= 2000 && dist < 160 && r < sys * 0.4) return this.holdFor(A | B | C, 3);
    const superChance = me.maxTime > 0 ? this.cfg.special * 1.5 : this.cfg.special * 0.6;
    if (me.power >= 1000 && dist < 130 && r < superChance) {
      const sup = motions.find((c) => c.name.startsWith("super"));
      if (sup) return this.play(ch, sup.name, me);
    }

    // colado: arremesso
    if (dist < 44 && opp.stateType !== "A" && opp.moveType !== "H" && r < sys + 0.1) {
      return this.holdFor(toward | (this.rand() < 0.5 ? C : D), 2);
    }

    if (dist > 150) {
      if (r < this.cfg.special * 0.7) {
        const specials = motions.filter((c) => !c.name.startsWith("super"));
        const pick = specials[Math.floor(this.rand() * specials.length)];
        if (pick) return this.play(ch, pick.name, me);
      }
      if (r > 0.92) return this.holdFor(Btn.U | toward, 2); // pulo curto
      return r < 0.85 ? this.holdFor(toward, 16) : this.holdFor(Btn.U | toward, 10);
    }

    if (dist < 70 && r < this.cfg.aggression) {
      const choice = this.rand();
      if (choice < sys * 0.4) return this.holdFor(C | D, 3); // blowback
      if (choice < 0.15) return this.holdFor(Btn.D | D, 3);
      if (choice < 0.3) return this.holdFor(Btn.D | B, 3);
      if (choice < 0.45 && this.cfg.special > 0.2) {
        const specials = motions.filter((c) => !c.name.startsWith("super"));
        const pick = specials[Math.floor(this.rand() * specials.length)];
        if (pick) return this.play(ch, pick.name, me);
      }
      const buttons = [A, B, C, D, Btn.y, Btn.b];
      return this.holdFor(buttons[Math.floor(this.rand() * buttons.length)], 2);
    }

    if (r < 0.1) return this.holdFor(Btn.U | toward, 2); // pulo curto para entrar
    if (r < 0.18) return this.holdFor(Btn.U | toward, 10);
    if (r < 0.3) return this.holdFor(away, 10);
    return this.holdFor(toward, 10);
  }
}
