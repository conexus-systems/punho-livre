/**
 * Expressões de trigger/parâmetro do MUGEN.
 *
 * Suporta: números, strings, operadores (|| ^^ && | ^ & = != < <= > >= + - * / % **
 * ! ~ e menos unário), intervalos (`x = [a, b]`, `x != (a, b]`), chamadas
 * (`ifelse(...)`, `var(3)`, `const(velocity.walk.fwd.x)`), triggers com eixo
 * (`vel x`, `p2bodydist x`) e redirecionamento (`p2, stateno`).
 *
 * As expressões são compiladas uma vez ao carregar o personagem; a avaliação é
 * pura e determinística dado o `EvalContext`.
 */

import { pow } from "./detmath";

export type Expr =
  | { k: "num"; v: number; float?: boolean }
  | { k: "str"; v: string }
  | { k: "id"; name: string; axis?: "x" | "y" }
  | { k: "call"; name: string; args: Expr[]; raw?: string }
  | { k: "un"; op: string; a: Expr }
  | { k: "bin"; op: string; a: Expr; b: Expr }
  | { k: "range"; op: "=" | "!="; a: Expr; lo: Expr; hi: Expr; loOpen: boolean; hiOpen: boolean }
  | { k: "redir"; target: string; arg?: Expr; e: Expr };

export type Value = number | string;

export interface EvalContext {
  /** Trigger sem argumentos (`time`, `vel x`...). `undefined` = identificador desconhecido. */
  ident(name: string, axis?: "x" | "y"): Value | undefined;
  /** Função com argumentos avaliados (`var(1)`) ou crus (`const(size.height)`). */
  call(name: string, args: Value[], raw?: string): Value;
  command(name: string): boolean;
  animElem(n: number): boolean;
  redirect(target: string, arg?: number): EvalContext | null;
}

// ------------------------------------------------------------------ tokens

type Tok =
  | { t: "num"; v: number; float: boolean }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "raw"; name: string; v: string }
  | { t: "op"; v: string };

const RAW_ARG_FUNCS = new Set(["const", "gethitvar", "hitdefattr", "stagevar", "name", "teammode"]);
const AXIS_TRIGGERS = new Set([
  "vel",
  "pos",
  "p2bodydist",
  "p2dist",
  "p1dist",
  "screenpos",
  "rootdist",
  "parentdist",
  "hitvel",
  "p1bodydist",
]);
const REDIRECTS = new Set(["p2", "enemy", "enemynear", "target", "partner", "root", "parent", "helper", "playerid"]);
const OPS = ["**", "||", "^^", "&&", "!=", "<=", ">=", ":=", "=", "<", ">", "+", "-", "*", "/", "%", "!", "~", "&", "|", "^", "(", ")", "[", "]", ","];

export class ExprError extends Error {}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      // notação científica não existe no MUGEN; "1.5e" seria identificador.
      const text = src.slice(i, j);
      out.push({ t: "num", v: Number.parseFloat(text), float: text.includes(".") });
      i = j;
      continue;
    }
    if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      if (end < 0) throw new ExprError(`string sem fechar: ${src}`);
      out.push({ t: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      const word = src.slice(i, j).toLowerCase();
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (RAW_ARG_FUNCS.has(word) && src[k] === "(") {
        let depth = 0;
        let m = k;
        for (; m < src.length; m++) {
          if (src[m] === "(") depth++;
          else if (src[m] === ")") {
            depth--;
            if (depth === 0) break;
          }
        }
        out.push({ t: "raw", name: word, v: src.slice(k + 1, m).trim().toLowerCase() });
        i = m + 1;
        continue;
      }
      out.push({ t: "id", v: word });
      i = j;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`caractere inesperado '${ch}' em: ${src}`);
    out.push({ t: "op", v: op === ":=" ? "=" : op });
    i += op.length;
  }
  return out;
}

// ------------------------------------------------------------------ parser

const BINARY_BP: Record<string, number> = {
  "||": 1,
  "^^": 2,
  "&&": 3,
  "|": 4,
  "^": 5,
  "&": 6,
  "=": 7,
  "!=": 7,
  "<": 8,
  "<=": 8,
  ">": 8,
  ">=": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
  "**": 11,
};
const UNARY_BP = 12;

class Parser {
  private pos = 0;
  constructor(
    private readonly toks: Tok[],
    private readonly src: string,
  ) {}

  parse(): Expr {
    const e = this.expr(0);
    if (this.pos < this.toks.length) throw new ExprError(`sobra na expressão: ${this.src}`);
    return e;
  }

  private peek(offset = 0): Tok | undefined {
    return this.toks[this.pos + offset];
  }

  private isOp(v: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t !== undefined && t.t === "op" && t.v === v;
  }

  private expect(v: string): void {
    if (!this.isOp(v)) throw new ExprError(`esperado '${v}' em: ${this.src}`);
    this.pos++;
  }

  expr(minBp: number): Expr {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (!t || t.t !== "op") break;
      const bp = BINARY_BP[t.v];
      if (bp === undefined || bp <= minBp) break;
      this.pos++;
      if ((t.v === "=" || t.v === "!=") && this.looksLikeRange()) {
        left = this.range(left, t.v);
        continue;
      }
      // ** é associativo à direita
      const right = this.expr(t.v === "**" ? bp - 1 : bp);
      left = { k: "bin", op: t.v, a: left, b: right };
    }
    return left;
  }

  private looksLikeRange(): boolean {
    const t = this.peek();
    if (!t || t.t !== "op" || (t.v !== "[" && t.v !== "(")) return false;
    let depth = 0;
    for (let i = this.pos; i < this.toks.length; i++) {
      const tok = this.toks[i];
      if (tok.t !== "op") continue;
      if (tok.v === "(" || tok.v === "[") depth++;
      else if (tok.v === ")" || tok.v === "]") {
        depth--;
        if (depth === 0) return false;
      } else if (tok.v === "," && depth === 1) return true;
    }
    return false;
  }

  private range(a: Expr, op: string): Expr {
    const open = this.toks[this.pos++] as { v: string };
    const lo = this.expr(0);
    this.expect(",");
    const hi = this.expr(0);
    const close = this.peek();
    if (!close || close.t !== "op" || (close.v !== "]" && close.v !== ")")) {
      throw new ExprError(`intervalo sem fechar em: ${this.src}`);
    }
    this.pos++;
    return { k: "range", op: op as "=" | "!=", a, lo, hi, loOpen: open.v === "(", hiOpen: close.v === ")" };
  }

  private unary(): Expr {
    const t = this.peek();
    if (t && t.t === "op" && (t.v === "!" || t.v === "-" || t.v === "~" || t.v === "+")) {
      this.pos++;
      const a = this.expr(UNARY_BP - 1);
      if (t.v === "+") return a;
      if (t.v === "-" && a.k === "num") return { k: "num", v: -a.v, float: a.float };
      return { k: "un", op: t.v, a };
    }
    return this.primary();
  }

  private primary(): Expr {
    const t = this.peek();
    if (!t) throw new ExprError(`expressão incompleta: ${this.src}`);
    this.pos++;
    switch (t.t) {
      case "num":
        return { k: "num", v: t.v, float: t.float };
      case "str":
        return { k: "str", v: t.v };
      case "raw":
        return { k: "call", name: t.name, args: [], raw: t.v };
      case "op":
        if (t.v === "(") {
          const e = this.expr(0);
          this.expect(")");
          return e;
        }
        throw new ExprError(`operador inesperado '${t.v}' em: ${this.src}`);
      case "id":
        return this.identifier(t.v);
    }
  }

  private identifier(name: string): Expr {
    // redirecionamento: "p2, stateno" ou "enemynear(1), life"
    if (REDIRECTS.has(name)) {
      let arg: Expr | undefined;
      if (this.isOp("(")) {
        const save = this.pos;
        this.pos++;
        const inner = this.expr(0);
        if (this.isOp(")") && this.isOp(",", 1)) {
          this.pos++;
          arg = inner;
        } else {
          this.pos = save;
        }
      }
      if (this.isOp(",")) {
        this.pos++;
        const e = this.expr(UNARY_BP - 1);
        return { k: "redir", target: name, arg, e };
      }
    }
    if (this.isOp("(")) {
      this.pos++;
      const args: Expr[] = [];
      if (!this.isOp(")")) {
        for (;;) {
          args.push(this.expr(0));
          if (this.isOp(",")) {
            this.pos++;
            continue;
          }
          break;
        }
      }
      this.expect(")");
      return { k: "call", name, args };
    }
    if (AXIS_TRIGGERS.has(name)) {
      const nxt = this.peek();
      if (nxt && nxt.t === "id" && (nxt.v === "x" || nxt.v === "y")) {
        this.pos++;
        return { k: "id", name, axis: nxt.v };
      }
    }
    return { k: "id", name };
  }
}

const cache = new Map<string, Expr>();

export function parseExpr(src: string): Expr {
  const key = src.trim();
  const hit = cache.get(key);
  if (hit) return hit;
  const e = new Parser(tokenize(key), key).parse();
  cache.set(key, e);
  return e;
}

// --------------------------------------------------------------- avaliação

export function toNum(v: Value): number {
  if (typeof v === "number") return v;
  return 0;
}

function truthy(v: Value): boolean {
  return typeof v === "number" ? v !== 0 : v.length > 0;
}

function eq(a: Value, b: Value): boolean {
  if (typeof a === "string" || typeof b === "string") {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  return a === b;
}

const FLOAT_IDS = new Set(["vel", "pos", "p2dist", "p2bodydist", "screenpos", "hitvel", "e", "pi", "p1dist", "rootdist", "parentdist"]);
const FLOAT_CALLS = new Set(["fvar", "sysfvar", "const", "sin", "cos", "tan", "asin", "acos", "atan", "exp", "ln", "log", "sqrt", "gethitvar"]);
const COMPARISON = new Set(["=", "!=", "<", "<=", ">", ">=", "&&", "||", "^^"]);

/** Tipagem estática do MUGEN: int / int trunca; qualquer float envolvido divide normalmente. */
function isFloatExpr(e: Expr): boolean {
  switch (e.k) {
    case "num":
      return e.float === true;
    case "id":
      return FLOAT_IDS.has(e.name);
    case "call":
      if (FLOAT_CALLS.has(e.name)) return true;
      if (e.name === "ifelse" || e.name === "cond") return e.args.slice(1).some(isFloatExpr);
      if (e.name === "abs" || e.name === "min" || e.name === "max") return e.args.some(isFloatExpr);
      return false;
    case "un":
      return e.op === "-" && isFloatExpr(e.a);
    case "bin":
      if (COMPARISON.has(e.op)) return false;
      return isFloatExpr(e.a) || isFloatExpr(e.b);
    case "redir":
      return isFloatExpr(e.e);
    default:
      return false;
  }
}

export function evaluate(e: Expr, ctx: EvalContext): Value {
  switch (e.k) {
    case "num":
      return e.v;
    case "str":
      return e.v;
    case "id": {
      const v = ctx.ident(e.name, e.axis);
      // identificador desconhecido vira literal: "statetype = S" → "s"
      return v === undefined ? e.name : v;
    }
    case "call":
      return ctx.call(
        e.name,
        e.args.map((a) => evaluate(a, ctx)),
        e.raw,
      );
    case "redir": {
      const arg = e.arg ? toNum(evaluate(e.arg, ctx)) : undefined;
      const other = ctx.redirect(e.target, arg);
      return other ? evaluate(e.e, other) : 0;
    }
    case "un": {
      const a = evaluate(e.a, ctx);
      if (e.op === "!") return truthy(a) ? 0 : 1;
      if (e.op === "-") return -toNum(a);
      return ~toNum(a);
    }
    case "range": {
      const v = toNum(evaluate(e.a, ctx));
      const lo = toNum(evaluate(e.lo, ctx));
      const hi = toNum(evaluate(e.hi, ctx));
      const inside = (e.loOpen ? v > lo : v >= lo) && (e.hiOpen ? v < hi : v <= hi);
      return (e.op === "=" ? inside : !inside) ? 1 : 0;
    }
    case "bin":
      return binary(e, ctx);
  }
}

function binary(e: Extract<Expr, { k: "bin" }>, ctx: EvalContext): Value {
  const { op } = e;

  if (op === "=" || op === "!=") {
    if (e.a.k === "id" && e.a.name === "command") {
      const r = ctx.command(String(evaluate(e.b, ctx)).toLowerCase());
      return (op === "=" ? r : !r) ? 1 : 0;
    }
    if (e.a.k === "id" && e.a.name === "animelem") {
      const r = ctx.animElem(toNum(evaluate(e.b, ctx)));
      return (op === "=" ? r : !r) ? 1 : 0;
    }
    const r = eq(evaluate(e.a, ctx), evaluate(e.b, ctx));
    return (op === "=" ? r : !r) ? 1 : 0;
  }

  if (op === "&&") return truthy(evaluate(e.a, ctx)) && truthy(evaluate(e.b, ctx)) ? 1 : 0;
  if (op === "||") return truthy(evaluate(e.a, ctx)) || truthy(evaluate(e.b, ctx)) ? 1 : 0;
  if (op === "^^") return truthy(evaluate(e.a, ctx)) !== truthy(evaluate(e.b, ctx)) ? 1 : 0;

  const a = toNum(evaluate(e.a, ctx));
  const b = toNum(evaluate(e.b, ctx));
  switch (op) {
    case "<":
      return a < b ? 1 : 0;
    case "<=":
      return a <= b ? 1 : 0;
    case ">":
      return a > b ? 1 : 0;
    case ">=":
      return a >= b ? 1 : 0;
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) return 0;
      return !isFloatExpr(e.a) && !isFloatExpr(e.b) && Number.isInteger(a) && Number.isInteger(b)
        ? Math.trunc(a / b)
        : a / b;
    case "%":
      if (b === 0) return 0;
      return Math.trunc(a) % Math.trunc(b);
    case "**":
      return pow(a, b);
    case "&":
      return a & b;
    case "|":
      return a | b;
    case "^":
      return a ^ b;
    default:
      throw new ExprError(`operador desconhecido ${op}`);
  }
}

export function evalNum(e: Expr | undefined, ctx: EvalContext, fallback = 0): number {
  if (!e) return fallback;
  return toNum(evaluate(e, ctx));
}

export function evalBool(e: Expr, ctx: EvalContext): boolean {
  return truthy(evaluate(e, ctx));
}
