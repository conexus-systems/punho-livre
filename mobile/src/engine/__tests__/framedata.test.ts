import { BUILTIN } from "@/src/characters/builtin.generated";
import { loadCharacter } from "../character";
import { characterFrameData, frameDataMarkdown, listMoves, measureMove } from "../framedata";
import type { CharacterData } from "../types";

const roster: Record<string, CharacterData> = {};
for (const id of ["kaze", "kenshi"]) roster[id] = loadCharacter(BUILTIN[id].pack);

function move(id: string, state: number) {
  const m = listMoves(BUILTIN[id].pack, roster[id]).find((x) => x.state === state);
  expect(m).toBeDefined();
  return measureMove(roster, id, m!, "kaze");
}

describe("frame data", () => {
  it("lista normais, especiais e supers a partir do [Statedef -1]", () => {
    const moves = listMoves(BUILTIN.kaze.pack, roster.kaze);
    expect(moves.map((m) => m.state)).toEqual([200, 210, 220, 230, 240, 250, 400, 410, 430, 440, 600, 610, 630, 640, 1000, 1100, 1200, 1300, 3000, 3100]);
    const byState = Object.fromEntries(moves.map((m) => [m.state, m]));
    expect(byState[1000]).toMatchObject({ name: "Kaze Ha", kind: "especial", stance: "S", commands: ["qcf_p"] });
    expect(byState[430]).toMatchObject({ kind: "normal", stance: "C", name: "agachado a/b" });
    expect(byState[630].stance).toBe("A");
    // Senpu sobe (estado tipo A), mas começa no chão
    expect(byState[1200].stance).toBe("S");
    expect(byState[3100]).toMatchObject({ kind: "super", powerRequired: 2000 });
  });

  it("jab do Kaze: 3 de startup, 3 ativos, +5 no acerto, 0 na defesa", () => {
    // anim 200: 2 + 4 (Clsn1) + 5 ticks; o HitDef arma no AnimElem = 2, um tick depois do Clsn1 aparecer
    expect(move("kaze", 200)).toMatchObject({
      startup: 3,
      active: 3,
      recovery: 6,
      total: 11,
      onHit: 5,
      onBlock: 0,
      damage: 22,
      chip: 3,
      hits: 1,
      level: "médio",
      knockdown: false,
      meterCost: 0,
    });
  });

  it("rasteira é baixa e derruba; golpe aéreo é alto", () => {
    expect(move("kaze", 440)).toMatchObject({ level: "baixo", knockdown: true, startup: 6, active: 3 });
    expect(move("kaze", 640)).toMatchObject({ level: "alto", onHit: null, recovery: null });
  });

  it("especial com invencibilidade, projétil e custo de barra do super", () => {
    expect(move("kaze", 1100).invincible).toBe("1-7");
    expect(move("kaze", 1000)).toMatchObject({ projectile: true, startup: 9, active: null });
    expect(move("kaze", 3000)).toMatchObject({ meterCost: 1000, meterRequired: 1000 });
    expect(move("kaze", 3100)).toMatchObject({ meterCost: 2000, meterRequired: 2000 });
  });

  it("golpe que não encosta no boneco em pé fica sem vantagem", () => {
    // o gancho do Kenshi passa por cima da cabeça de um oponente em pé
    expect(move("kenshi", 220)).toMatchObject({ onHit: null, onBlock: null, distance: null, startup: 7 });
  });

  it("é determinística: duas gerações dão o mesmo resultado", () => {
    const a = characterFrameData(roster, BUILTIN.kenshi.pack, "kaze");
    const b = characterFrameData(roster, BUILTIN.kenshi.pack, "kaze");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(frameDataMarkdown(a, "Kaze")).toBe(frameDataMarkdown(b, "Kaze"));
    expect(a.moves).toHaveLength(20);
  });
});
