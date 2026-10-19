/**
 * Funções transcendentais determinísticas para a engine.
 *
 * `Math.sin/cos/tan/asin/acos/atan/exp/log/pow` (e o operador `**`) não têm
 * resultado fixado pela especificação do JavaScript: Hermes (Android/iOS) e
 * V8 (web) podem divergir no último bit, e no rollback online um bit de
 * diferença vira dessincronia alguns segundos depois.
 *
 * Aqui tudo é feito só com `+ - * /`, `Math.sqrt`, `Math.round/floor/trunc`
 * (operações IEEE 754 com arredondamento exato e definido) numa ordem fixa,
 * então o resultado é o mesmo bit a bit em qualquer motor. A precisão é de
 * ~1e-15 relativo, muito além do que um .cns precisa.
 *
 * O teste `detmath.test.ts` falha se o código da engine voltar a usar as
 * funções do `Math` (ou `**`).
 */

const PI = 3.141592653589793;
const HALF_PI = 1.5707963267948966;
const QUARTER_PI = 0.7853981633974483;
/** π/2 em três partes (Cody–Waite) para reduzir o argumento sem perder bits. */
const PIO2_1 = 1.5707963267341256;
const PIO2_2 = 6.077100506506192e-11;
const PIO2_3 = 2.0222662487959506e-21;
const LN2_HI = 0.6931471803691238;
const LN2_LO = 1.9082149292705877e-10;
const INV_LN2 = 1.4426950408889634;
const SQRT_HALF = 0.7071067811865476;
const TAN_PI_8 = 0.41421356237309503;

/** Seno de |r| ≤ π/4 (série de Taylor, termos suficientes para precisão dupla). */
function sinPoly(r: number): number {
  const z = r * r;
  return r + r * z * (-1 / 6 + z * (1 / 120 + z * (-1 / 5040 + z * (1 / 362880 + z * (-1 / 39916800 + z * (1 / 6227020800 + z * (-1 / 1307674368000)))))));
}

/** Cosseno de |r| ≤ π/4. */
function cosPoly(r: number): number {
  const z = r * r;
  return 1 + z * (-1 / 2 + z * (1 / 24 + z * (-1 / 720 + z * (1 / 40320 + z * (-1 / 3628800 + z * (1 / 479001600 + z * (-1 / 87178291200 + z * (1 / 20922789888000))))))));
}

/** Reduz x a r ∈ [-π/4, π/4] e quadrante q (x = q·π/2 + r). */
function reduce(x: number): [number, number] {
  const k = Math.round(x * (2 / PI));
  const r = x - k * PIO2_1 - k * PIO2_2 - k * PIO2_3;
  // quadrante como inteiro 0..3 (k pode ser enorme: usa o resto com sinal corrigido)
  const q = ((k % 4) + 4) % 4;
  return [r, q];
}

export function sin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (x === 0) return x;
  const [r, q] = reduce(x);
  switch (q) {
    case 0:
      return sinPoly(r);
    case 1:
      return cosPoly(r);
    case 2:
      return -sinPoly(r);
    default:
      return -cosPoly(r);
  }
}

export function cos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const [r, q] = reduce(x);
  switch (q) {
    case 0:
      return cosPoly(r);
    case 1:
      return -sinPoly(r);
    case 2:
      return -cosPoly(r);
    default:
      return sinPoly(r);
  }
}

export function tan(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (x === 0) return x;
  const [r, q] = reduce(x);
  const s = sinPoly(r);
  const c = cosPoly(r);
  return q % 2 === 0 ? s / c : -c / s;
}

/** atan de 0 ≤ t ≤ tan(π/8) ≈ 0,414: meia-angulação + série. */
function atanSmall(t: number): number {
  // atan(t) = 2·atan(t / (1 + √(1 + t²))) → |u| ≤ 0,199
  const u = t / (1 + Math.sqrt(1 + t * t));
  const z = u * u;
  return 2 * (u + u * z * sumShift(z));
}

/** Σ_{n≥1} (-1)^n z^(n-1) / (2n+1), em Horner (ordem fixa). */
function sumShift(z: number): number {
  let acc = 0;
  for (let n = 14; n >= 1; n--) acc = (n % 2 === 0 ? 1 : -1) / (2 * n + 1) + z * acc;
  return acc;
}

export function atan(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === 0) return x;
  const neg = x < 0;
  let t = neg ? -x : x;
  let base = 0;
  let flip = false;
  if (t > 1) {
    t = 1 / t;
    flip = true;
  }
  if (t > TAN_PI_8) {
    // atan(t) = π/4 + atan((t - 1) / (t + 1)); o argumento fica em [-0,414, 0]
    const v = (t - 1) / (t + 1);
    base = QUARTER_PI;
    t = v;
  }
  let a = t < 0 ? base - atanSmall(-t) : base + atanSmall(t);
  if (flip) a = HALF_PI - a;
  return neg ? -a : a;
}

export function asin(x: number): number {
  if (Number.isNaN(x) || x > 1 || x < -1) return NaN;
  if (x === 1) return HALF_PI;
  if (x === -1) return -HALF_PI;
  if (x === 0) return x;
  return atan(x / Math.sqrt((1 - x) * (1 + x)));
}

export function acos(x: number): number {
  if (Number.isNaN(x) || x > 1 || x < -1) return NaN;
  if (x === -1) return PI;
  // acos(x) = 2·atan(√((1 - x) / (1 + x))): estável perto de ±1
  return 2 * atan(Math.sqrt((1 - x) / (1 + x)));
}

/** 2^k exato (k inteiro), por quadrados sucessivos de potências de 2. */
function pow2(k: number): number {
  let result = 1;
  let base = k < 0 ? 0.5 : 2;
  let n = k < 0 ? -k : k;
  while (n > 0) {
    if (n % 2 === 1) result *= base;
    base *= base;
    n = Math.floor(n / 2);
  }
  return result;
}

export function exp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019412) return 0;
  if (x === 0) return 1;
  const k = Math.round(x * INV_LN2);
  const r = x - k * LN2_HI - k * LN2_LO; // |r| ≤ ln2/2
  // Taylor até r^20/20! em Horner
  let p = 1;
  for (let n = 20; n >= 1; n--) p = 1 + (r / n) * p;
  // escala em dois passos para não estourar/zerar no meio (2^k fora do intervalo normal)
  const k1 = Math.trunc(k / 2);
  return p * pow2(k1) * pow2(k - k1);
}

const view = new DataView(new ArrayBuffer(8));

/** x = m · 2^e com m ∈ [1, 2) (x > 0 finito). */
function frexp(x: number): [number, number] {
  let e = 0;
  // subnormais: normaliza antes de ler o expoente
  if (x < 2.2250738585072014e-308) {
    x *= 18014398509481984; // 2^54
    e = -54;
  }
  view.setFloat64(0, x);
  const hi = view.getUint32(0);
  const biased = (hi >>> 20) & 0x7ff;
  view.setUint32(0, (hi & 0x800fffff) | (1023 << 20));
  return [view.getFloat64(0), e + biased - 1023];
}

/** Logaritmo natural. */
export function ln(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  let [m, e] = frexp(x);
  if (m > 2 * SQRT_HALF) {
    m /= 2;
    e += 1;
  }
  // ln(m) = 2·atanh(s), s = (m - 1)/(m + 1), |s| ≤ 0,1716
  const s = (m - 1) / (m + 1);
  const z = s * s;
  let acc = 0;
  for (let n = 14; n >= 0; n--) acc = 1 / (2 * n + 1) + z * acc;
  const lnm = 2 * s * acc;
  return e * LN2_HI + (e * LN2_LO + lnm);
}

/** Potência com a semântica do `Math.pow` nos casos usados por expressões MUGEN. */
export function pow(a: number, b: number): number {
  if (Number.isNaN(b)) return NaN;
  if (b === 0) return 1;
  if (Number.isNaN(a)) return NaN;
  if (Number.isInteger(b) && Math.abs(b) <= 1024) {
    // expoente inteiro: multiplicações em ordem fixa (exato quando cabe)
    let result = 1;
    let base = a;
    let n = Math.abs(b);
    while (n > 0) {
      if (n % 2 === 1) result *= base;
      base *= base;
      n = Math.floor(n / 2);
    }
    return b < 0 ? 1 / result : result;
  }
  if (a === 0) return b > 0 ? 0 : Infinity;
  if (a < 0) {
    // expoente não inteiro de base negativa: NaN; inteiro grande: sinal pela paridade
    if (!Number.isInteger(b)) return NaN;
    const mag = exp(b * ln(-a));
    return b % 2 === 0 ? mag : -mag;
  }
  if (a === Infinity) return b > 0 ? Infinity : 0;
  if (b === Infinity) return a > 1 ? Infinity : a === 1 ? NaN : 0;
  if (b === -Infinity) return a > 1 ? 0 : a === 1 ? NaN : Infinity;
  return exp(b * ln(a));
}
