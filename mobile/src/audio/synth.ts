/**
 * Sintetizador do jogo: efeitos sonoros e músicas gerados por código (nada de
 * áudio de terceiros). Tudo é PCM mono em Float32 a SAMPLE_RATE Hz, gerado a
 * partir de semente fixa: o mesmo som em qualquer aparelho, sem arquivos no app.
 */

export const SAMPLE_RATE = 22050;
const TAU = Math.PI * 2;

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const sec = (t: number) => Math.round(t * SAMPLE_RATE);

/** Envelope: ataque linear e queda exponencial. */
function env(i: number, n: number, attack = 0.005, curve = 4): number {
  const t = i / SAMPLE_RATE;
  if (t < attack) return t / attack;
  return Math.exp((-curve * (i - attack * SAMPLE_RATE)) / Math.max(1, n));
}

type Wave = "sine" | "square" | "saw" | "tri";
function osc(kind: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (kind) {
    case "sine":
      return Math.sin(p * TAU);
    case "square":
      return p < 0.5 ? 1 : -1;
    case "saw":
      return 2 * p - 1;
    case "tri":
      return 1 - 4 * Math.abs(p - 0.5);
  }
}

/** Filtro passa-baixa de um polo (no lugar). */
function lowpass(buf: Float32Array, cutoff: number): Float32Array {
  const a = 1 - Math.exp((-TAU * cutoff) / SAMPLE_RATE);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += a * (buf[i] - y);
    buf[i] = y;
  }
  return buf;
}

function highpass(buf: Float32Array, cutoff: number): Float32Array {
  const a = Math.exp((-TAU * cutoff) / SAMPLE_RATE);
  let x0 = 0;
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    y = a * (y + x - x0);
    x0 = x;
    buf[i] = y;
  }
  return buf;
}

function mix(into: Float32Array, src: Float32Array, at = 0, gain = 1): void {
  for (let i = 0; i < src.length && at + i < into.length; i++) into[at + i] += src[i] * gain;
}

function normalize(buf: Float32Array, peak = 0.9): Float32Array {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] / m) * peak;
  return buf;
}

/** Tom com varredura de frequência (de f0 para f1). */
function tone(kind: Wave, dur: number, f0: number, f1 = f0, curve = 4, attack = 0.004): Float32Array {
  const n = sec(dur);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 * Math.pow(f1 / f0, t);
    ph += f / SAMPLE_RATE;
    out[i] = osc(kind, ph) * env(i, n, attack, curve);
  }
  return out;
}

function noise(dur: number, seed: number, curve = 6, attack = 0.002): Float32Array {
  const n = sec(dur);
  const r = rng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (r() * 2 - 1) * env(i, n, attack, curve);
  return out;
}

function concatAt(len: number, parts: [Float32Array, number, number][]): Float32Array {
  const out = new Float32Array(sec(len));
  for (const [p, at, g] of parts) mix(out, p, sec(at), g);
  return out;
}

// ------------------------------------------------------------ efeitos

export type SfxName =
  | "hitLight"
  | "hitMedium"
  | "hitHard"
  | "guard"
  | "whoosh"
  | "jump"
  | "land"
  | "projectile"
  | "super"
  | "powerup"
  | "ko"
  | "gong"
  | "fight"
  | "counter"
  | "justdefend"
  | "guardcrush"
  | "grab"
  | "tech";

const SFX: Record<SfxName, () => Float32Array> = {
  hitLight: () => normalize(concatAt(0.14, [[tone("sine", 0.12, 180, 70, 6), 0, 0.9], [highpass(noise(0.06, 11, 8), 1200), 0, 0.5]]), 0.7),
  hitMedium: () => normalize(concatAt(0.2, [[tone("sine", 0.18, 150, 55, 5), 0, 1], [lowpass(noise(0.12, 12, 7), 3000), 0, 0.6], [tone("square", 0.03, 900, 400, 6), 0, 0.15]]), 0.85),
  hitHard: () => normalize(concatAt(0.34, [[tone("sine", 0.32, 120, 38, 4), 0, 1], [lowpass(noise(0.25, 13, 5), 2200), 0, 0.8], [highpass(noise(0.05, 14, 10), 2500), 0, 0.5]]), 0.95),
  guard: () => normalize(concatAt(0.18, [[tone("square", 0.12, 1250, 1100, 7), 0, 0.3], [tone("tri", 0.16, 2400, 2300, 5), 0, 0.4], [highpass(noise(0.05, 21, 9), 3000), 0, 0.4]]), 0.6),
  whoosh: () => {
    const n = noise(0.16, 31, 3, 0.04);
    return normalize(lowpass(highpass(n, 400), 1800), 0.35);
  },
  jump: () => normalize(tone("sine", 0.09, 220, 420, 4), 0.25),
  land: () => normalize(concatAt(0.1, [[tone("sine", 0.08, 110, 60, 6), 0, 1], [lowpass(noise(0.06, 41, 8), 900), 0, 0.5]]), 0.4),
  projectile: () => {
    const n = sec(0.4);
    const out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      ph += (260 + 500 * t + 40 * Math.sin(t * 60)) / SAMPLE_RATE;
      out[i] = osc("saw", ph) * env(i, n, 0.01, 3);
    }
    return normalize(lowpass(out, 2600), 0.5);
  },
  super: () => {
    const base = concatAt(0.9, [[highpass(noise(0.8, 51, 1.5, 0.3), 600), 0, 0.5]]);
    for (const [f, d] of [[220, 0], [277, 0.05], [330, 0.1], [440, 0.15]]) mix(base, tone("saw", 0.7, f, f * 1.01, 2, 0.05), sec(d), 0.25);
    return normalize(lowpass(base, 3500), 0.8);
  },
  powerup: () => {
    const out = new Float32Array(sec(0.8));
    [262, 330, 392, 523, 659, 784].forEach((f, i) => mix(out, tone("square", 0.25, f, f, 5), sec(i * 0.07), 0.3));
    mix(out, highpass(noise(0.7, 61, 2, 0.2), 1500), 0, 0.25);
    return normalize(lowpass(out, 4000), 0.75);
  },
  ko: () => {
    const out = concatAt(1.4, [[tone("sine", 1.2, 90, 30, 2.5), 0, 1], [lowpass(noise(1.3, 71, 3), 1400), 0, 0.9], [tone("saw", 0.4, 160, 60, 3), 0, 0.3]]);
    return normalize(out, 0.95);
  },
  gong: () => {
    const out = new Float32Array(sec(1.8));
    for (const [f, g] of [[98, 1], [147, 0.6], [196.7, 0.5], [262.3, 0.35], [349, 0.2], [523, 0.12]]) mix(out, tone("sine", 1.8, f, f * 0.995, 2.2, 0.003), 0, g);
    mix(out, lowpass(noise(0.08, 81, 6), 2000), 0, 0.4);
    return normalize(out, 0.8);
  },
  fight: () => {
    const out = concatAt(0.8, [[tone("sine", 0.3, 130, 50, 4), 0, 1], [lowpass(noise(0.2, 91, 5), 2500), 0, 0.6]]);
    for (const f of [196, 247, 294, 392]) mix(out, lowpass(tone("saw", 0.6, f, f, 2.5, 0.01), 2800), sec(0.02), 0.22);
    return normalize(out, 0.9);
  },
  counter: () => normalize(concatAt(0.3, [[tone("square", 0.12, 1320, 1320, 5), 0, 0.5], [tone("square", 0.15, 1760, 1760, 5), 0.08, 0.5]]), 0.45),
  justdefend: () => normalize(concatAt(0.45, [[tone("sine", 0.4, 1568, 1568, 3), 0, 0.6], [tone("sine", 0.35, 2093, 2093, 3), 0.06, 0.5], [tone("tri", 0.3, 3136, 3136, 4), 0.06, 0.2]]), 0.55),
  guardcrush: () => {
    const out = new Float32Array(sec(0.6));
    for (let k = 0; k < 7; k++) mix(out, highpass(noise(0.12, 100 + k, 7), 2000 + k * 300), sec(k * 0.045), 0.6);
    mix(out, tone("sine", 0.4, 140, 50, 4), 0, 0.8);
    return normalize(out, 0.85);
  },
  grab: () => normalize(concatAt(0.25, [[lowpass(noise(0.2, 111, 4, 0.03), 700), 0, 1], [tone("sine", 0.12, 160, 90, 5), 0.05, 0.6]]), 0.5),
  tech: () => normalize(concatAt(0.2, [[tone("square", 0.05, 700, 500, 8), 0, 0.5], [tone("square", 0.05, 900, 600, 8), 0.07, 0.5]]), 0.45),
};

const sfxCache = new Map<SfxName, Float32Array>();

export function sfx(name: SfxName): Float32Array {
  let b = sfxCache.get(name);
  if (!b) {
    b = SFX[name]();
    sfxCache.set(name, b);
  }
  return b;
}

export const SFX_NAMES = Object.keys(SFX) as SfxName[];

// ------------------------------------------------------------ música

interface Style {
  bpm: number;
  /** Nota MIDI da tônica. */
  root: number;
  /** Graus da escala em semitons. */
  scale: number[];
  /** Progressão de acordes (graus da escala, 0-based), um por compasso. */
  prog: number[];
  lead: Wave;
  bass: Wave;
  pad: Wave | null;
  /** Bateria: padrões de 16 passos (1 = toca). */
  kick: string;
  snare: string;
  hat: string;
  /** Percussão extra (tambor grave/agogô) com timbre próprio. */
  perc?: { pattern: string; freq: number; kind: "drum" | "bell" };
  leadDensity: number;
  swing?: number;
  seed: number;
  brightness: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const IN_SCALE = [0, 1, 5, 7, 8]; // escala japonesa "in"
const PENTA_MIN = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];

/** Uma trilha por cenário, no clima dele. */
const STYLES: Record<string, Style> = {
  dojo: { bpm: 118, root: 50, scale: IN_SCALE, prog: [0, 0, 3, 4, 0, 0, 3, 1], lead: "tri", bass: "sine", pad: "sine", kick: "1000001010000000", snare: "0000000010000000", hat: "0010001000100010", perc: { pattern: "1000100010001010", freq: 70, kind: "drum" }, leadDensity: 0.45, seed: 1, brightness: 2200 },
  pelourinho: { bpm: 126, root: 48, scale: MIXO, prog: [0, 0, 3, 4, 0, 5, 3, 4], lead: "tri", bass: "sine", pad: null, kick: "1000001010000010", snare: "0000100000001000", hat: "1011101110111011", perc: { pattern: "1001001010010010", freq: 1600, kind: "bell" }, leadDensity: 0.55, swing: 0.12, seed: 2, brightness: 3000 },
  metro: { bpm: 112, root: 45, scale: MINOR, prog: [0, 5, 2, 6, 0, 5, 3, 4], lead: "saw", bass: "saw", pad: "saw", kick: "1000100010001000", snare: "0000100000001000", hat: "0010001000100010", leadDensity: 0.5, seed: 3, brightness: 2600 },
  praia: { bpm: 104, root: 53, scale: MAJOR, prog: [0, 5, 1, 4, 0, 5, 1, 4], lead: "sine", bass: "tri", pad: "tri", kick: "1000001000100000", snare: "0000100000001000", hat: "1010101010101010", perc: { pattern: "0010010000100100", freq: 2200, kind: "bell" }, leadDensity: 0.4, swing: 0.15, seed: 4, brightness: 2400 },
  templo: { bpm: 98, root: 46, scale: PENTA_MIN, prog: [0, 0, 2, 3, 0, 0, 4, 3], lead: "sine", bass: "sine", pad: "tri", kick: "1000000010100000", snare: "0000000000001000", hat: "0000100000001000", perc: { pattern: "1010001010100010", freq: 90, kind: "drum" }, leadDensity: 0.35, seed: 5, brightness: 1800 },
  telhado: { bpm: 168, root: 47, scale: MINOR, prog: [0, 0, 5, 5, 3, 3, 4, 4], lead: "square", bass: "saw", pad: null, kick: "1000000000100000", snare: "0000100000001000", hat: "1111111111111111", leadDensity: 0.6, seed: 6, brightness: 3200 },
  neve: { bpm: 88, root: 52, scale: DORIAN, prog: [0, 3, 0, 4, 0, 3, 5, 4], lead: "tri", bass: "sine", pad: "sine", kick: "1000000010000000", snare: "0000000000001000", hat: "0010000000100000", leadDensity: 0.3, seed: 7, brightness: 1600 },
  ringue: { bpm: 140, root: 40, scale: MINOR, prog: [0, 0, 5, 6, 0, 0, 3, 4], lead: "square", bass: "square", pad: "square", kick: "1000101010001000", snare: "0000100000001000", hat: "1010101010101010", leadDensity: 0.5, seed: 8, brightness: 2400 },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function note(kind: Wave, freq: number, dur: number, curve: number, attack = 0.01): Float32Array {
  const n = sec(dur);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    ph += freq / SAMPLE_RATE;
    out[i] = osc(kind, ph) * env(i, n, attack, curve);
  }
  return out;
}

/**
 * Compõe e sintetiza a música de um cenário: 16 compassos em laço (A A' B A),
 * bateria, baixo, acordes e melodia sobre a escala, com semente fixa.
 */
export function music(stageId: string): Float32Array {
  const st = STYLES[stageId] ?? STYLES.dojo;
  const r = rng(1000 + st.seed);
  const step = 60 / st.bpm / 4; // semicolcheia
  const bars = 16;
  const total = bars * 16 * step;
  const out = new Float32Array(sec(total));
  const deg = (d: number, octave = 0) => {
    const n = st.scale.length;
    const o = Math.floor(d / n);
    return st.root + st.scale[((d % n) + n) % n] + 12 * (o + octave);
  };
  // células de bateria
  const kick = tone("sine", 0.18, 120, 45, 5);
  const snare = concatAt(0.18, [[lowpass(noise(0.16, 7, 6), 4000), 0, 0.8], [tone("tri", 0.08, 220, 180, 6), 0, 0.4]]);
  const hat = highpass(noise(0.04, 9, 12), 6000);
  const perc = st.perc ? (st.perc.kind === "drum" ? tone("sine", 0.3, st.perc.freq * 1.6, st.perc.freq, 4) : tone("square", 0.08, st.perc.freq, st.perc.freq, 8)) : null;
  // motivo melódico de 2 compassos, variado nas repetições
  const motif: (number | null)[] = Array.from({ length: 32 }, (_, i) => (r() < st.leadDensity || i % 8 === 0 ? Math.floor(r() * 8) : null));

  for (let bar = 0; bar < bars; bar++) {
    const section = bar < 4 ? 0 : bar < 8 ? 1 : bar < 12 ? 2 : 0;
    const chord = st.prog[bar % st.prog.length] + (section === 2 ? 2 : 0);
    const barStart = bar * 16 * step;
    for (let s = 0; s < 16; s++) {
      const swing = st.swing && s % 2 === 1 ? st.swing * step : 0;
      const t = barStart + s * step + swing;
      const at = sec(t);
      if (st.kick[s] === "1") mix(out, kick, at, 0.55);
      if (st.snare[s] === "1") mix(out, snare, at, 0.35);
      if (st.hat[s] === "1") mix(out, hat, at, s % 4 === 0 ? 0.12 : 0.08);
      if (perc && st.perc!.pattern[s] === "1") mix(out, perc, at, st.perc!.kind === "drum" ? 0.4 : 0.12);
      // baixo: tônica do acorde nas batidas, quinta no contratempo
      if (s % 4 === 0 || (s % 4 === 3 && r() < 0.3)) {
        const n = deg(chord, -1) + (s % 8 === 4 ? 7 : 0);
        mix(out, lowpass(note(st.bass, midi(n), step * 3, 3), 900), at, 0.35);
      }
      // melodia
      const m = motif[(bar % 2) * 16 + s];
      // na seção A' a melodia fica mais rala (só nos tempos pares)
      if (m !== null && (section !== 1 || s % 2 === 0)) {
        const d = chord + m + (section === 2 ? 2 : 0);
        const len = step * (1 + Math.floor(r() * 3));
        mix(out, note(st.lead, midi(deg(d, 1)), len, 3, 0.008), at, 0.16);
      }
    }
    // acordes longos (pad)
    if (st.pad) {
      for (const k of [0, 2, 4]) mix(out, lowpass(note(st.pad, midi(deg(chord + k)), 16 * step, 1.2, 0.08), 1400), sec(barStart), 0.07);
    }
  }
  lowpass(out, st.brightness);
  highpass(out, 40);
  // fecha o laço sem estalo: leve fade nas pontas
  const fade = sec(0.02);
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return normalize(out, 0.7);
}

// ------------------------------------------------------------ WAV

/** PCM Float32 → WAV 16 bits mono. */
export function toWav(pcm: Float32Array, rate = SAMPLE_RATE): Uint8Array {
  const out = new Uint8Array(44 + pcm.length * 2);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i);
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  return out;
}
