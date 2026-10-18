import { evaluate, parseExpr, type EvalContext, type Value } from "../expr";

function ctx(vals: Record<string, Value> = {}, commands: string[] = []): EvalContext {
  return {
    ident: (name, axis) => vals[axis ? `${name} ${axis}` : name],
    call: (name, args, raw) => {
      if (name === "ifelse") return Number(args[0]) !== 0 ? args[1] : args[2];
      if (name === "var") return vals[`var${args[0]}`] ?? 0;
      if (name === "const") return vals[`const:${raw}`] ?? 0;
      if (name === "abs") return Math.abs(Number(args[0]));
      return 0;
    },
    command: (n) => commands.includes(n),
    animElem: (n) => vals["animelem"] === n,
    redirect: () => ctx({ stateno: 5000 }),
  };
}

const ev = (src: string, c = ctx()) => evaluate(parseExpr(src), c);

describe("expressões MUGEN", () => {
  it("aritmética com precedência e divisão inteira", () => {
    expect(ev("1 + 2 * 3")).toBe(7);
    expect(ev("7 / 2")).toBe(3);
    expect(ev("7.0 / 2")).toBe(3.5);
    expect(ev("2 ** 3 ** 2")).toBe(512);
    expect(ev("-(3) + 1")).toBe(-2);
    expect(ev("10 % 4")).toBe(2);
  });

  it("lógica e comparação", () => {
    expect(ev("1 && 0 || 1")).toBe(1);
    expect(ev("!0")).toBe(1);
    expect(ev("3 >= 3 && 2 < 1")).toBe(0);
    expect(ev("1 ^^ 1")).toBe(0);
  });

  it("intervalos", () => {
    const c = ctx({ time: 5 });
    expect(ev("time = [5, 10]", c)).toBe(1);
    expect(ev("time = (5, 10]", c)).toBe(0);
    expect(ev("time != [1, 4]", c)).toBe(1);
  });

  it("triggers com eixo, strings e comandos", () => {
    const c = ctx({ "vel y": -3, statetype: "a" }, ["qcf_x"]);
    expect(ev("Vel Y < 0", c)).toBe(1);
    expect(ev("StateType = A", c)).toBe(1);
    expect(ev("statetype != S", c)).toBe(1);
    expect(ev('command = "QCF_x"', c)).toBe(1);
    expect(ev('command != "holdfwd"', c)).toBe(1);
  });

  it("funções, const e redirecionamento", () => {
    const c = ctx({ "const:velocity.walk.fwd.x": 2.4, var3: 7 });
    expect(ev("const(velocity.walk.fwd.x)", c)).toBe(2.4);
    expect(ev("ifelse(var(3) = 7, 10, 20)", c)).toBe(10);
    expect(ev("abs(-4)", c)).toBe(4);
    expect(ev("p2, stateno = 5000", c)).toBe(1);
  });
});
