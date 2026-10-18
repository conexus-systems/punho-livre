import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import * as dm from "../detmath";

const ENGINE_DIR = path.join(__dirname, "..");

/** Funções do Math sem resultado fixado pela especificação (podem divergir entre Hermes e V8). */
const FORBIDDEN_MATH = [
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "exp", "expm1", "log", "log1p", "log2", "log10", "pow", "cbrt", "hypot", "random",
];

function engineFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "__tests__") continue;
    if (statSync(full).isDirectory()) out.push(...engineFiles(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Remove comentários e literais de string/template (sobra só código). */
function codeOnly(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      i++;
      while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
      i++;
      out += '""';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const bits = (x: number) => {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  return v.getBigUint64(0).toString(16).padStart(16, "0");
};

describe("matemática determinística da engine", () => {
  it("o código da engine não usa funções transcendentais do Math, Math.random, relógio nem **", () => {
    const offenders: string[] = [];
    const math = new RegExp(`\\bMath\\.(${FORBIDDEN_MATH.join("|")})\\b`);
    for (const file of engineFiles(ENGINE_DIR)) {
      if (path.basename(file) === "detmath.ts") continue;
      const lines = codeOnly(readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, n) => {
        if (math.test(line) || /\*\*/.test(line) || /\bDate\b|\bperformance\.now\b/.test(line)) {
          offenders.push(`${path.relative(ENGINE_DIR, file)}:${n + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("detmath.ts só usa operações IEEE exatas", () => {
    const src = codeOnly(readFileSync(path.join(ENGINE_DIR, "detmath.ts"), "utf8"));
    const used = new Set([...src.matchAll(/\bMath\.(\w+)/g)].map((m) => m[1]));
    expect([...used].filter((f) => !["sqrt", "round", "floor", "trunc", "abs"].includes(f))).toEqual([]);
    expect(src).not.toMatch(/\*\*/);
  });

  it("a varredura pega usos proibidos", () => {
    expect(codeOnly('const a = Math.sin(x); // Math.cos(y)\nconst s = "Math.exp";')).toMatch(/Math\.sin/);
    expect(codeOnly('const s = "Math.exp"; /* Math.pow */')).not.toMatch(/Math\.(exp|pow)/);
  });

  const grid: number[] = [];
  for (let i = -2000; i <= 2000; i++) grid.push(i * 0.0173);
  grid.push(0, -0, 1e-9, -1e-9, 1e-300, 123456.789, -98765.4321);

  it.each([
    ["sin", dm.sin, Math.sin],
    ["cos", dm.cos, Math.cos],
    ["tan", dm.tan, Math.tan],
    ["atan", dm.atan, Math.atan],
  ] as const)("%s bate com o Math na precisão dupla", (_n, mine, ref) => {
    for (const x of grid) {
      const a = mine(x);
      const b = ref(x);
      expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-13 * Math.max(1, Math.abs(b)));
    }
  });

  it("asin/acos/exp/ln/pow batem com o Math", () => {
    for (let i = -1000; i <= 1000; i++) {
      const x = i / 1000;
      expect(Math.abs(dm.asin(x) - Math.asin(x))).toBeLessThan(1e-13);
      expect(Math.abs(dm.acos(x) - Math.acos(x))).toBeLessThan(1e-13);
    }
    for (let i = -700; i <= 700; i += 0.37) {
      expect(Math.abs(dm.exp(i) / Math.exp(i) - 1)).toBeLessThan(1e-13);
    }
    for (const x of [1e-310, 1e-200, 0.001, 0.5, 0.7071, 1, 1.5, 2, Math.E, 10, 12345.678, 1e100, 1e308]) {
      expect(Math.abs(dm.ln(x) - Math.log(x))).toBeLessThanOrEqual(1e-13 * Math.max(1, Math.abs(Math.log(x))));
    }
    for (const [a, b] of [[2, 10], [2, -3], [1.5, 2.5], [10, 0.5], [-2, 3], [-2, 0.5], [0, 0], [0, -1], [7, 1 / 3]]) {
      const r = dm.pow(a, b);
      const e = Math.pow(a, b);
      if (Number.isNaN(e)) expect(r).toBeNaN();
      else if (!Number.isFinite(e)) expect(r).toBe(e);
      else expect(Math.abs(r - e)).toBeLessThanOrEqual(1e-13 * Math.max(1, Math.abs(e)));
    }
    expect(dm.sin(NaN)).toBeNaN();
    expect(dm.asin(2)).toBeNaN();
    expect(dm.ln(-1)).toBeNaN();
    expect(dm.ln(0)).toBe(-Infinity);
    expect(dm.exp(1000)).toBe(Infinity);
    expect(dm.exp(-1000)).toBe(0);
  });

  // Valores congelados bit a bit: se outro motor JS (Hermes) rodar esta suíte e algum mudar, é
  // porque uma operação básica não é IEEE lá — e o online dessincronizaria.
  it("resultados fixos bit a bit", () => {
    const out = [
      dm.sin(1),
      dm.cos(1),
      dm.tan(0.5),
      dm.asin(0.3),
      dm.acos(0.3),
      dm.atan(2.5),
      dm.exp(1.234),
      dm.ln(3.7),
      dm.pow(1.7, 2.3),
      dm.sin(1000.5),
    ].map(bits);
    expect(out).toEqual(GOLDEN);
  });
});

const GOLDEN = [
  "3feaed548f090cee",
  "3fe14a280fb5068c",
  "3fe17b4f5bf3474a",
  "3fd380159e14f700",
  "3ff441f5ecbeef58",
  "3ff30b6d796a4da8",
  "400b7ac2cc5e67ba",
  "3ff4eeee650ae550",
  "400b1c0c46dcb4ea",
  "3fefd948c50a7a0d",
];
