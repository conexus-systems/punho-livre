/**
 * CPU do modo arcade/versus. Lê o estado do mundo e devolve input como um
 * jogador humano (não trapaceia lendo inputs do oponente). Não precisa ser
 * determinística: só roda em partidas locais.
 */

import { Btn } from "@/src/engine/input";
import type { CharacterData, WorldState } from "@/src/engine/types";

import { findCommand, macroFromCommand, MacroPlayer, motionCommands } from "./macros";

const LEVELS = {
  1: { reaction: 22, guard: 0.25, aggression: 0.35, special: 0.15 },
  2: { reaction: 12, guard: 0.55, aggression: 0.55, special: 0.3 },
  3: { reaction: 6, guard: 0.85, aggression: 0.7, special: 0.45 },
} as const;

export class CpuController {
  private macro = new MacroPlayer();
  private hold = 0;
  private holdTicks = 0;
  private cooldown = 0;
  private readonly cfg: (typeof LEVELS)[1 | 2 | 3];

  constructor(
    private readonly side: 0 | 1,
    private readonly ch: CharacterData,
    level: 1 | 2 | 3,
    private readonly rand: () => number = Math.random,
  ) {
    this.cfg = LEVELS[level];
  }

  next(w: WorldState): number {
    if (w.roundState !== 2) {
      this.macro.clear();
      return 0;
    }
    const step = this.macro.next();
    if (step !== null) return step;
    if (this.holdTicks > 0) {
      this.holdTicks--;
      return this.hold;
    }
    if (this.cooldown-- > 0) return 0;
    this.cooldown = Math.max(1, Math.round(this.cfg.reaction * (0.6 + this.rand() * 0.8)));
    return this.decide(w);
  }

  private holdFor(bits: number, ticks: number): number {
    this.hold = bits;
    this.holdTicks = ticks;
    return bits;
  }

  private play(name: string, me: { facing: 1 | -1 }): number {
    const cmd = findCommand(this.ch, name);
    if (!cmd) return 0;
    this.macro.play(macroFromCommand(cmd), me.facing);
    return this.macro.next() ?? 0;
  }

  private decide(w: WorldState): number {
    const me = w.fighters[this.side];
    const opp = w.fighters[this.side === 0 ? 1 : 0];
    if (!me.ctrl && me.moveType !== "A") return 0;
    const dist = Math.abs(opp.x - me.x);
    const toward = opp.x > me.x ? Btn.R : Btn.L;
    const away = toward === Btn.R ? Btn.L : Btn.R;
    const r = this.rand();

    const incoming = w.projectiles.some((p) => p.owner !== this.side && p.phase === "flying" && Math.abs(p.x - me.x) < 120);
    if ((opp.moveType === "A" && dist < 110) || incoming) {
      if (r < this.cfg.guard) return this.holdFor(away | (opp.stateType === "C" ? Btn.D : 0), 14);
      if (incoming && r < this.cfg.guard + 0.2) return this.holdFor(Btn.U | toward, 4);
    }

    // anti-aéreo
    if (opp.stateType === "A" && dist < 90 && r < this.cfg.special) {
      const dp = motionCommands(this.ch).find((c) => c.name.startsWith("dp"));
      if (dp) return this.play(dp.name, me);
      return this.holdFor(Btn.D | Btn.z, 2);
    }

    if (me.power >= 1000 && dist < 130 && r < this.cfg.special * 0.6) {
      const sup = motionCommands(this.ch).find((c) => c.name.startsWith("super"));
      if (sup) return this.play(sup.name, me);
    }

    if (dist > 150) {
      if (r < this.cfg.special * 0.7) {
        const specials = motionCommands(this.ch).filter((c) => !c.name.startsWith("super"));
        const pick = specials[Math.floor(this.rand() * specials.length)];
        if (pick) return this.play(pick.name, me);
      }
      return r < 0.85 ? this.holdFor(toward, 16) : this.holdFor(Btn.U | toward, 3);
    }

    if (dist < 70 && r < this.cfg.aggression) {
      const choice = this.rand();
      if (choice < 0.15) return this.holdFor(Btn.D | Btn.c, 3);
      if (choice < 0.3) return this.holdFor(Btn.D | Btn.a, 3);
      if (choice < 0.45 && this.cfg.special > 0.2) {
        const specials = motionCommands(this.ch).filter((c) => !c.name.startsWith("super"));
        const pick = specials[Math.floor(this.rand() * specials.length)];
        if (pick) return this.play(pick.name, me);
      }
      const buttons = [Btn.x, Btn.y, Btn.z, Btn.a, Btn.b, Btn.c];
      return this.holdFor(buttons[Math.floor(this.rand() * buttons.length)], 2);
    }

    if (r < 0.15) return this.holdFor(Btn.U | toward, 3);
    if (r < 0.3) return this.holdFor(away, 10);
    return this.holdFor(toward, 10);
  }
}
