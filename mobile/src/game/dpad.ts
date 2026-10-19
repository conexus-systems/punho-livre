/**
 * Direcional virtual de 8 direções com zona morta e histerese.
 *
 * Sem histerese, um polegar parado perto da fronteira entre "frente" e
 * "baixo-frente" fica trocando de direção a cada pixel — a meia-lua sai
 * errada e a defesa baixa "escorrega" para em pé. Aqui:
 *
 * - zona morta com histerese radial: liga com `deadZone` e só desliga abaixo
 *   de `deadZone × releaseRatio`;
 * - histerese angular: a direção atual só muda quando o dedo passa
 *   `hysteresisDeg` graus além da fronteira do setor de 45°.
 *
 * Puro (sem React), usado pelo app (components/TouchControls.tsx) e pela
 * versão web (play/main.ts).
 */

import { Btn } from "@/src/engine/input";

export interface PadConfig {
  /** Distância mínima (dp/px) para sair do neutro. */
  deadZone: number;
  /** Graus além da fronteira do setor para trocar de direção. */
  hysteresisDeg: number;
  /** Fração da zona morta abaixo da qual volta ao neutro. */
  releaseRatio: number;
}

export const DEFAULT_PAD: PadConfig = { deadZone: 14, hysteresisDeg: 10, releaseRatio: 0.7 };

/** Octante → bits absolutos. 0 = direita, 2 = baixo, 4 = esquerda, 6 = cima (tela: y para baixo). */
export const OCTANT_BITS = [Btn.R, Btn.R | Btn.D, Btn.D, Btn.D | Btn.L, Btn.L, Btn.L | Btn.U, Btn.U, Btn.U | Btn.R] as const;

const SECTOR = Math.PI / 4;

function wrap(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export class DirectionalPad {
  private oct = -1;

  constructor(private cfg: PadConfig = DEFAULT_PAD) {}

  configure(cfg: Partial<PadConfig>): void {
    this.cfg = { ...this.cfg, ...cfg };
  }

  /** Octante atual (-1 = neutro). */
  get octant(): number {
    return this.oct;
  }

  /** Deslocamento do dedo em relação ao centro → bits de direção absolutos. */
  update(dx: number, dy: number): number {
    const r = Math.hypot(dx, dy);
    const threshold = this.oct < 0 ? this.cfg.deadZone : this.cfg.deadZone * this.cfg.releaseRatio;
    if (r < threshold) {
      this.oct = -1;
      return 0;
    }
    const a = Math.atan2(dy, dx);
    const candidate = Math.round(a / SECTOR) & 7;
    if (this.oct >= 0 && candidate !== this.oct) {
      const fromCurrent = Math.abs(wrap(a - this.oct * SECTOR));
      const keep = SECTOR / 2 + (this.cfg.hysteresisDeg * Math.PI) / 180;
      if (fromCurrent <= keep) return OCTANT_BITS[this.oct];
    }
    this.oct = candidate;
    return OCTANT_BITS[this.oct];
  }

  reset(): void {
    this.oct = -1;
  }
}
