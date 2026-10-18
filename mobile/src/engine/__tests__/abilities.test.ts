import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { findCommand, macroFromCommand } from "@/src/game/macros";
import { loadCharacter } from "../character";
import { Btn, toAbsolute } from "../input";
import type { CharacterData, WorldState } from "../types";
import { createWorld, stepWorld } from "../world";

const roster: Record<string, CharacterData> = {};
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);

function fight(a: string, b: string): WorldState {
  const w = createWorld({ chars: [a, b], stageId: "dojo", seed: 5, roundsToWin: 2, roundTime: 99 }, roster);
  for (let i = 0; i < 400 && w.roundState !== 2; i++) stepWorld(w, [0, 0], roster);
  w.fighters[0].x = -16;
  w.fighters[1].x = 16;
  return w;
}

/** Executa o comando do P1 pela macro (como o botão de atalho) e devolve os estados visitados. */
function perform(w: WorldState, cmdName: string, p2: (f: number) => number = () => 0, extra = 40): number[] {
  const ch = roster[w.fighters[0].charId];
  const cmd = findCommand(ch, cmdName);
  expect(cmd).toBeDefined();
  const seq = macroFromCommand(cmd!).map((rel) => toAbsolute(rel, w.fighters[0].facing));
  const states: number[] = [];
  for (let f = 0; f < seq.length + extra; f++) {
    stepWorld(w, [seq[f] ?? 0, p2(f)], roster);
    states.push(w.fighters[0].stateNo);
  }
  return states;
}

describe("elenco ampliado", () => {
  it("20 personagens, 4 especiais e 2 supers cada", () => {
    expect(BUILTIN_ORDER).toHaveLength(20);
    for (const id of BUILTIN_ORDER) {
      expect(BUILTIN[id].meta.specials).toHaveLength(4);
      expect(BUILTIN[id].meta.super2).toBeDefined();
      expect(roster[id].unsupported).toEqual([]);
    }
  });

  it("agarrão de comando passa pela defesa", () => {
    const w = fight("bento", "kaze");
    const life = w.fighters[1].life;
    // o P2 segura baixo-trás o tempo todo
    perform(w, "hcf_p", () => Btn.D | Btn.R, 60);
    expect(w.fighters[1].life).toBeLessThan(life - 100);
  });

  it("golpe de carga sai pela macro (segurar trás e soltar para frente)", () => {
    const w = fight("mei", "tita");
    w.fighters[0].x = -120;
    w.fighters[1].x = 120;
    const states = perform(w, "chg_bf_p");
    expect(states).toContain(1000);
  });

  it("contra-golpe revida quando o oponente ataca", () => {
    const w = fight("akemi", "volt");
    const life = w.fighters[1].life;
    const states = perform(w, "dd_p", (f) => (f === 6 ? Btn.z : 0), 40);
    expect(states).toContain(1001);
    expect(w.fighters[1].life).toBeLessThan(life);
  });

  it("super de 2 estoques gasta 2000 de power", () => {
    const w = fight("ze", "yuki");
    w.fighters[0].power = 2500;
    const states = perform(w, "super2_p", () => 0, 80);
    expect(states).toContain(3100);
    expect(w.fighters[0].power).toBeLessThan(1000);
    expect(w.fighters[1].life).toBeLessThan(w.fighters[1].lifeMax);
  });

  it("projétil aéreo e pisão no chão", () => {
    const w = fight("iara", "kai");
    // pulo e, no ar, meia-lua + soco
    for (let f = 0; f < 8; f++) stepWorld(w, [Btn.U, 0], roster);
    const states = perform(w, "qcf_p", () => 0, 30);
    expect(states.some((s) => s === 1100)).toBe(true);

    const w2 = fight("hercules", "kai");
    w2.fighters[0].x = -60;
    w2.fighters[1].x = 60;
    const s2 = perform(w2, "qcb_k", () => 0, 60);
    expect(s2).toContain(1201);
  });
});
