import { contrast, ESSENTIALS, forBackground, forWhiteText, MORE, PALETTE, parseLoose } from "../accent";
import { bytes, count, number, percent, relative, signed } from "../formats";
import { checkDescription, dialogButtons, ellipsize, isDestructive, pivotDescription, pivotStep, slideDirection, toggleState, validate } from "../rules";
import { nextSize, pack } from "../tiles";

describe("cor de destaque (porte do Accent.kt)", () => {
  it.each(PALETTE)("%s em bloco passa de 4,5:1 com texto branco", (_n, c) => {
    expect(contrast(forWhiteText(c), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it.each(PALETTE)("%s como texto passa de 4,5:1 no preto e no branco", (_n, c) => {
    expect(contrast(forBackground(c, "#000000"), "#000000")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(forBackground(c, "#FFFFFF"), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it("essenciais + mais cores cobrem a paleta sem repetir", () => {
    expect(ESSENTIALS).toHaveLength(10);
    expect(new Set(MORE.map(([, c]) => c)).size).toBe(MORE.length);
  });
  it("aceita o que a pessoa digita", () => {
    expect(parseLoose("1ba1e2")).toBe("#1BA1E2");
    expect(parseLoose("#F80")).toBe("#FF8800");
    expect(parseLoose("azul")).toBeNull();
  });
});

describe("regras dos componentes (porte do MetroRules.kt)", () => {
  it("pivô dá a volta e desliza do lado certo", () => {
    expect(pivotStep(2, 3, 1)).toBe(0);
    expect(pivotStep(0, 3, -1)).toBe(2);
    expect(slideDirection(2, 0, 3)).toBe(1);
    expect(slideDirection(0, 2, 3)).toBe(-1);
    expect(slideDirection(1, 1, 3)).toBe(0);
    expect(pivotDescription("Ranking", 1, 3, true)).toBe("Ranking, aba 2 de 3, selecionada");
  });
  it("rótulos destrutivos e ordem dos botões", () => {
    expect(isDestructive("Remover do aparelho")).toBe(true);
    expect(isDestructive("Sair da conta")).toBe(true);
    expect(isDestructive("Baixar")).toBe(false);
    expect(dialogButtons("Sim", null, "Cancelar")).toEqual(["positive", "negative"]);
  });
  it("textos de estado, encurtar e validar", () => {
    expect(toggleState(true)).toBe("Ativado");
    expect(checkDescription("Escuro", false)).toBe("Escuro, não marcada");
    expect(ellipsize("Tempestade de Socos Elétricos", 20)).toBe("Tempestade de…");
    expect(validate("", "o nome", true)).toBe("Preencha o nome.");
    expect(validate("x".repeat(21), "o nome", true, 20)).toBe("Use até 20 caracteres.");
  });
});

describe("Live Tiles (porte do TilePacking.kt)", () => {
  it("empacota em ordem na primeira posição livre", () => {
    const { placed, rows } = pack(
      [
        { id: "a", size: "wide" as const },
        { id: "b", size: "medium" as const },
        { id: "c", size: "small" as const },
        { id: "d", size: "small" as const },
        { id: "e", size: "medium" as const },
      ],
      6,
    );
    const at = Object.fromEntries(placed.map((p) => [p.item.id, [p.col, p.row]]));
    expect(at).toEqual({ a: [0, 0], b: [4, 0], c: [0, 2], d: [1, 2], e: [2, 2] });
    expect(rows).toBe(4);
  });
  it("bloco maior que a grade é reduzido", () => {
    expect(pack([{ size: "wide" as const }], 2).placed[0].columns).toBe(2);
  });
  it("ciclo de tamanho do modo de edição", () => {
    expect(nextSize("large")).toBe("small");
    expect(nextSize("medium", ["medium", "wide"])).toBe("wide");
  });
});

describe("formatos pt-BR", () => {
  it("números, porcentagens, bytes e contagens", () => {
    expect(number(1234.5, 1)).toBe("1.234,5");
    expect(number(-1000)).toBe("-1.000");
    expect(percent(0.125, 1)).toBe("12,5%");
    expect(bytes(1_572_864)).toBe("1,5 MB");
    expect(count(1, "vitória", "vitórias")).toBe("1 vitória");
    expect(signed(16)).toBe("+16");
  });
  it("tempo relativo", () => {
    const now = Date.UTC(2026, 9, 18, 12, 0, 0);
    expect(relative(now - 30_000, now)).toBe("agora");
    expect(relative(now - 5 * 60_000, now)).toBe("há 5 min");
    expect(relative(now - 26 * 3600_000, now)).toBe("ontem");
  });
});
