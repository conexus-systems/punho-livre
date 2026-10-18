/**
 * Controle físico na versão web (Gamepad API, mapeamento "standard" do W3C).
 * Puro: recebe o estado lido de `navigator.getGamepads()` e devolve bits.
 *
 * | Botão standard            | Clássico        | Simples   |
 * |---------------------------|-----------------|-----------|
 * | 2 (X / Quadrado, esquerda)| A (soco fraco)  | Soco      |
 * | 0 (A / Xis, baixo)        | B (chute fraco) | Chute     |
 * | 3 (Y / Triângulo, cima)   | C (soco forte)  | Especial  |
 * | 1 (B / Bola, direita)     | D (chute forte) | Super     |
 * | 4 (LB / L1)               | A+B (rolamento) | A+B       |
 * | 5 (RB / R1)               | C+D (blowback)  | C+D       |
 * | 6 (LT / L2)               | A+B+C (MAX)     | A+B+C     |
 * | 12–15 (direcional) e analógico esquerdo | direções | direções |
 * | 9 (Start)                 | pausa           | pausa     |
 * | 8 (Back / Select)         | troca simples/clássico |    |
 *
 * A disposição física segue a do Neo Geo (A B C D da esquerda para a direita
 * na fileira de cima/baixo), por isso X → A e B (direita) → D.
 */

import { Btn } from "@/src/engine/input";

import { DirectionalPad } from "./dpad";
import { SimpleBtn } from "./simpleMode";

export interface PadSnapshot {
  /** `pressed` de cada botão, na ordem do mapeamento standard. */
  buttons: readonly boolean[];
  /** Eixos -1..1 (0/1 = analógico esquerdo). */
  axes: readonly number[];
}

export const PAD_START = 9;
export const PAD_SELECT = 8;

const CLASSIC: Record<number, number> = {
  2: Btn.x,
  0: Btn.a,
  3: Btn.z,
  1: Btn.c,
  4: Btn.x | Btn.a,
  5: Btn.z | Btn.c,
  6: Btn.x | Btn.a | Btn.z,
};

const SIMPLE: Record<number, number> = {
  ...CLASSIC,
  2: SimpleBtn.punch,
  0: SimpleBtn.kick,
  3: SimpleBtn.special,
  1: SimpleBtn.super,
};

/** Converte o analógico com a mesma zona morta + histerese do direcional touch (escala 0–100). */
export class GamepadReader {
  private stick = new DirectionalPad({ deadZone: 35, hysteresisDeg: 10, releaseRatio: 0.7 });
  private prev: readonly boolean[] = [];

  bits(pad: PadSnapshot, mode: "classic" | "simple"): number {
    const map = mode === "simple" ? SIMPLE : CLASSIC;
    let out = 0;
    pad.buttons.forEach((on, i) => {
      if (on) out |= map[i] ?? 0;
    });
    if (pad.buttons[12]) out |= Btn.U;
    if (pad.buttons[13]) out |= Btn.D;
    if (pad.buttons[14]) out |= Btn.L;
    if (pad.buttons[15]) out |= Btn.R;
    // o direcional digital tem prioridade; o analógico só vale com ele solto
    if ((out & (Btn.U | Btn.D | Btn.L | Btn.R)) === 0) out |= this.stick.update((pad.axes[0] ?? 0) * 100, (pad.axes[1] ?? 0) * 100);
    else this.stick.reset();
    return out;
  }

  /** Botão apertado agora e não na leitura anterior (Start, Select). Chame uma vez por leitura. */
  pressed(pad: PadSnapshot): Set<number> {
    const out = new Set<number>();
    pad.buttons.forEach((on, i) => {
      if (on && !this.prev[i]) out.add(i);
    });
    this.prev = [...pad.buttons];
    return out;
  }
}
