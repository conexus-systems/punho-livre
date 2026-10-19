import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "../character";
import { checksum, deepClone } from "../clone";
import { Btn } from "../input";
import { parseStates } from "../mugen/cns";
import type { CharacterData, WorldState } from "../types";
import { createWorld, stepWorld } from "../world";

const roster: Record<string, CharacterData> = {};
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);

function fight(a: string, b: string, seed = 7): WorldState {
  return createWorld({ chars: [a, b], stageId: "dojo", seed, roundsToWin: 2, roundTime: 99 }, roster);
}

function run(w: WorldState, frames: number, input: (f: number, w: WorldState) => [number, number]) {
  for (let i = 0; i < frames; i++) stepWorld(w, input(i, w), roster);
}

/** Avança até a luta começar (roundState 2). */
function toFight(w: WorldState) {
  run(w, 400, () => [0, 0]);
  expect(w.roundState).toBe(2);
}

describe("elenco nativo", () => {
  it.each(BUILTIN_ORDER)("%s carrega sem controladores não suportados nem erros de parse", (id) => {
    const ch = roster[id];
    expect(ch.unsupported).toEqual([]);
    const files = BUILTIN[id].pack.files;
    const parsed = parseStates(Object.entries(files).filter(([n]) => /\.(cns|cmd)$/.test(n)).map(([, t]) => t));
    expect(parsed.problems).toEqual([]);
    expect(Object.keys(ch.anims).length).toBeGreaterThan(60);
    for (const sp of BUILTIN[id].meta.specials) expect(ch.commands.some((c) => c.name === sp.cmd)).toBe(true);
  });
});

describe("simulação", () => {
  it("intro → luta e ninguém se move sem input", () => {
    const w = fight("kaze", "brasa");
    toFight(w);
    expect(w.fighters[0].x).toBeCloseTo(-70, 0);
    expect(w.fighters[0].ctrl).toBe(true);
    expect(w.fighters[0].stateNo).toBe(0);
  });

  it("andar para frente aproxima e o soco acerta", () => {
    const w = fight("kaze", "tita");
    toFight(w);
    run(w, 40, () => [Btn.R, 0]);
    expect(w.fighters[0].x).toBeGreaterThan(-60);
    const lifeBefore = w.fighters[1].life;
    run(w, 2, () => [Btn.x, 0]);
    run(w, 30, () => [0, 0]);
    expect(w.fighters[1].life).toBeLessThan(lifeBefore);
  });

  it("segurar para trás defende", () => {
    const w = fight("kaze", "volt");
    toFight(w);
    run(w, 40, () => [Btn.R, 0]);
    // P2 (virado para a esquerda) segura baixo-trás = baixo+direita bem antes do golpe
    // (agachado não anda; apertar no último instante seria Just Defend, sem raspão)
    const back = Btn.D | Btn.R;
    run(w, 20, () => [0, back]);
    const lifeBefore = w.fighters[1].life;
    run(w, 2, () => [Btn.x, back]);
    const states: number[] = [];
    run(w, 30, (_f, world) => {
      states.push(world.fighters[1].stateNo);
      return [0, back];
    });
    // só o dano de raspão (chip) do jab e passou pelos estados de defesa
    expect(w.fighters[1].life).toBe(lifeBefore - 3);
    expect(states.some((s) => s >= 150 && s <= 153)).toBe(true);
  });

  it("meia-lua + soco solta projétil (Kaze Ha)", () => {
    const w = fight("kaze", "sombra");
    toFight(w);
    const seq = [Btn.D, Btn.D | Btn.R, Btn.R, Btn.x];
    run(w, seq.length, (f) => [seq[f], 0]);
    run(w, 20, () => [0, 0]);
    expect(w.fighters[0].stateNo === 1000 || w.projectiles.length > 0).toBe(true);
    run(w, 60, () => [0, 0]);
    expect(w.fighters[1].life).toBeLessThan(w.fighters[1].lifeMax);
  });

  it("pulo sobe e volta ao chão", () => {
    const w = fight("yuki", "kaze");
    toFight(w);
    run(w, 1, () => [Btn.U, 0]);
    run(w, 10, () => [0, 0]);
    expect(w.fighters[0].y).toBeLessThan(-10);
    run(w, 80, () => [0, 0]);
    expect(w.fighters[0].y).toBe(0);
    expect(w.fighters[0].stateNo).toBe(0);
  });

  it("é determinístico e o clone do estado reproduz o futuro (rollback)", () => {
    let rnd = 12345;
    const rand = () => {
      rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
      return rnd;
    };
    const inputs: [number, number][] = Array.from({ length: 2400 }, () => [rand() & 2047, rand() & 2047]);
    const a = fight("brasa", "tita", 99);
    const b = fight("brasa", "tita", 99);
    run(a, 1200, (f) => inputs[f]);
    run(b, 1200, (f) => inputs[f]);
    expect(checksum(a)).toBe(checksum(b));
    const snap = deepClone(a);
    run(a, 1200, (f) => inputs[1200 + f]);
    run(snap, 1200, (f) => inputs[1200 + f]);
    expect(checksum(a)).toBe(checksum(snap));
  });

  it.each(BUILTIN_ORDER)("%s aguenta 3000 frames de botões aleatórios contra todos", (id) => {
    let rnd = id.length * 977;
    const rand = () => {
      rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
      return rnd >> 8;
    };
    for (const opp of BUILTIN_ORDER) {
      const w = fight(id, opp, rnd);
      run(w, 3000, () => [rand() & 2047, rand() & 2047]);
      for (const p of w.fighters) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(p.life).toBeGreaterThanOrEqual(0);
        expect(roster[p.charId].states[p.stateNo]).toBeDefined();
      }
    }
  });
});
