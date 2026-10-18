/**
 * Bits de entrada. O formato absoluto (U/D/L/R) é o que trafega na rede
 * (docs/PROTOCOL.md); a engine converte para relativo (B/F) conforme o lado
 * para onde o lutador está virado.
 */

import { Key } from "./types";

export const Btn = {
  U: 1,
  D: 2,
  L: 4,
  R: 8,
  a: 16,
  b: 32,
  c: 64,
  x: 128,
  y: 256,
  z: 512,
  s: 1024,
} as const;

export const INPUT_HISTORY = 64;

export function toRelative(raw: number, facing: 1 | -1): number {
  let out = raw & ~(Btn.L | Btn.R);
  const left = (raw & Btn.L) !== 0;
  const right = (raw & Btn.R) !== 0;
  if (facing === 1) {
    if (left) out |= Key.B;
    if (right) out |= Key.F;
  } else {
    if (left) out |= Key.F;
    if (right) out |= Key.B;
  }
  return out;
}

/** Converte uma sequência de bits relativos de volta para absoluto (usado pela IA). */
export function toAbsolute(rel: number, facing: 1 | -1): number {
  let out = rel & ~(Key.B | Key.F);
  const back = (rel & Key.B) !== 0;
  const fwd = (rel & Key.F) !== 0;
  if (facing === 1) {
    if (back) out |= Btn.L;
    if (fwd) out |= Btn.R;
  } else {
    if (back) out |= Btn.R;
    if (fwd) out |= Btn.L;
  }
  return out;
}
