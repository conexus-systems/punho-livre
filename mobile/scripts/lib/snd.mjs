// Leitor do .snd do MUGEN (sons dos personagens): uma lista ligada de
// subarquivos WAV, cada um com grupo e índice.
//
//   0  "ElecbyteSnd\0"   12 bytes
//   12 versão             4 bytes
//   16 quantidade de sons 4 bytes (int32 LE)
//   20 offset do 1º subcabeçalho
//   subcabeçalho: próximo offset, tamanho, grupo, índice (4 × int32) + WAV

export function readSnd(buf) {
  if (buf.length < 24 || buf.toString("latin1", 0, 11) !== "ElecbyteSnd") throw new Error("não é um .snd do MUGEN");
  const count = buf.readInt32LE(16);
  let off = buf.readInt32LE(20);
  const sounds = [];
  const seen = new Set();
  for (let n = 0; n < count && off > 0 && off + 16 <= buf.length; n++) {
    if (seen.has(off)) break; // lista ligada com ciclo: arquivo corrompido
    seen.add(off);
    const next = buf.readUInt32LE(off);
    const len = buf.readUInt32LE(off + 4);
    const group = buf.readInt32LE(off + 8);
    const index = buf.readInt32LE(off + 12);
    const start = off + 16;
    const data = buf.subarray(start, Math.min(buf.length, start + len));
    if (data.length >= 12 && data.toString("latin1", 0, 4) === "RIFF") sounds.push({ group, index, data });
    off = next;
  }
  return sounds;
}

/** Sons referenciados nos textos do personagem (PlaySnd, hitsound, guardsound), sem os comuns "F". */
export function usedSounds(texts) {
  const used = new Set();
  const re = /^\s*(?:value|hitsound|guardsound)\s*=\s*(S?)\s*(\d+)\s*,\s*(\d+)/gim;
  for (const t of texts) for (const m of t.matchAll(re)) used.add(`${Number(m[2])},${Number(m[3])}`);
  return used;
}
