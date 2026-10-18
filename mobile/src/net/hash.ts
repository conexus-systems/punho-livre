/**
 * Hashes do online (docs/PROTOCOL.md → "Checksums e hash das entradas").
 *
 * - `stateHash`: FNV-1a 32 bits do WorldState com os números em bits exatos
 *   (o `checksum` da engine arredonda floats para 4 casas, o que esconde
 *   divergências pequenas até elas crescerem).
 * - `InputsHash`: FNV-1a 32 bits das entradas dos dois lados, quadro a quadro
 *   a partir do 1 (bits do lado 0 e do lado 1, cada um em 16 bits little
 *   endian). O servidor calcula o mesmo a partir do registro de entradas
 *   (web/app/services/matches/inputs_hash.rb) para conferir o replay.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

export function stateHash(v: unknown): number {
  let h = FNV_OFFSET;
  const byte = (b: number) => {
    h ^= b & 0xff;
    h = Math.imul(h, FNV_PRIME);
  };
  const word = (w: number) => {
    byte(w);
    byte(w >>> 8);
    byte(w >>> 16);
    byte(w >>> 24);
  };
  const str = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      byte(c);
      byte(c >>> 8);
    }
  };
  const walk = (x: unknown): void => {
    if (x === null || x === undefined) byte(0x6e);
    else if (typeof x === "number") {
      if (x === (x | 0)) {
        byte(0x69);
        word(x);
      } else {
        byte(0x66);
        f64[0] = x;
        word(u32[0]);
        word(u32[1]);
      }
    } else if (typeof x === "string") {
      byte(0x73);
      str(x);
      byte(0);
    } else if (typeof x === "boolean") byte(x ? 0x74 : 0x46);
    else if (Array.isArray(x)) {
      byte(0x5b);
      for (const i of x) walk(i);
      byte(0x5d);
    } else if (typeof x === "object") {
      byte(0x7b);
      for (const k of Object.keys(x as object).sort()) {
        if (k === "events") continue;
        str(k);
        byte(0x3a);
        walk((x as Record<string, unknown>)[k]);
      }
      byte(0x7d);
    }
  };
  walk(v);
  return h >>> 0;
}

/** Hash incremental das entradas confirmadas (quadros 1, 2, 3… em ordem). */
export class InputsHash {
  value = FNV_OFFSET;
  /** Último quadro já incluído. */
  frame = 0;

  push(frame: number, p1: number, p2: number): void {
    if (frame !== this.frame + 1) throw new Error(`InputsHash: quadro ${frame} fora de ordem (esperado ${this.frame + 1})`);
    let h = this.value;
    for (const b of [p1 & 0xff, (p1 >>> 8) & 0xff, p2 & 0xff, (p2 >>> 8) & 0xff]) {
      h ^= b;
      h = Math.imul(h, FNV_PRIME);
    }
    this.value = h >>> 0;
    this.frame = frame;
  }
}
