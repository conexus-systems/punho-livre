import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "../character";
import { checksum, deepClone } from "../clone";
import { GUARD_MAX, MAX_TICKS } from "../constants";
import { Btn } from "../input";
import { SYS } from "../snk";
import type { CharacterData, GameEvent, WorldState } from "../types";
import { createWorld, stepWorld } from "../world";

const roster: Record<string, CharacterData> = {};
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);

// botões no padrão SNK (ver snk.ts)
const A = Btn.x;
const B = Btn.a;
const C = Btn.z;
const D = Btn.c;

function fight(a = "kaze", b = "tita", seed = 3): WorldState {
  const w = createWorld({ chars: [a, b], stageId: "dojo", seed, roundsToWin: 2, roundTime: 99 }, roster);
  for (let i = 0; i < 400 && w.roundState !== 2; i++) stepWorld(w, [0, 0], roster);
  expect(w.roundState).toBe(2);
  return w;
}

/** Roda `frames` frames e devolve os eventos gerados. */
function run(w: WorldState, frames: number, input: (f: number, w: WorldState) => [number, number]): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < frames; i++) {
    stepWorld(w, input(i, w), roster);
    events.push(...w.events);
  }
  return events;
}

/** Coloca os dois colados no meio da tela. */
function close(w: WorldState): void {
  w.fighters[0].x = -16;
  w.fighters[1].x = 16;
}

const kinds = (ev: GameEvent[]) => ev.map((e) => e.kind);

describe("sistema SNK", () => {
  it("A+B rola invencível e atravessa o oponente", () => {
    const w = fight();
    close(w);
    const startX = w.fighters[0].x;
    let invincible = false;
    run(w, 1, () => [A | B, 0]);
    expect(w.fighters[0].stateNo).toBe(SYS.ROLL_FWD);
    run(w, 30, (f, world) => {
      if (f === 4) invincible = world.fighters[0].notHitBy > 0;
      return [0, 0];
    });
    expect(invincible).toBe(true);
    expect(w.fighters[0].x).toBeGreaterThan(w.fighters[1].x);
    expect(w.fighters[0].x - startX).toBeGreaterThan(40);
    expect(w.fighters[0].ctrl).toBe(true);
  });

  it("A e B com 1 frame de diferença ainda viram rolamento (cancela o soco)", () => {
    const w = fight();
    run(w, 1, () => [A, 0]);
    expect(w.fighters[0].stateNo).toBe(200);
    run(w, 1, () => [A | B, 0]);
    expect(w.fighters[0].stateNo).toBe(SYS.ROLL_FWD);
  });

  it("C+D é um blowback que derruba", () => {
    const w = fight();
    close(w);
    const life = w.fighters[1].life;
    const states: number[] = [];
    run(w, 60, (f, world) => {
      states.push(world.fighters[1].stateNo);
      return [f === 0 ? C | D : 0, 0];
    });
    expect(w.fighters[1].life).toBeLessThan(life);
    expect(states).toContain(5100);
  });

  it("frente + C colado arremessa; trás + C joga para o outro lado", () => {
    for (const [dir, crosses] of [
      [Btn.R, false],
      [Btn.L, true],
    ] as const) {
      const w = fight();
      close(w);
      const life = w.fighters[1].life;
      const ev = run(w, 1, () => [dir | C, 0]);
      expect(kinds(ev)).toContain("throw");
      expect(w.fighters[0].stateNo).toBe(SYS.THROW);
      expect(w.fighters[1].stateNo).toBe(SYS.THROWN);
      const states: number[] = [];
      run(w, 80, (_f, world) => {
        states.push(world.fighters[1].stateNo);
        return [0, 0];
      });
      expect(w.fighters[1].life).toBeLessThan(life - 90);
      expect(states).toContain(5100);
      expect(w.fighters[1].x < w.fighters[0].x).toBe(crosses);
    }
  });

  it("C ou D a tempo escapa do arremesso", () => {
    const w = fight();
    close(w);
    const life = w.fighters[1].life;
    run(w, 1, () => [Btn.R | C, 0]);
    const ev = run(w, 3, (f) => [0, f === 2 ? D : 0]);
    expect(kinds(ev)).toContain("tech");
    expect(w.fighters[0].stateNo).toBe(SYS.THROW_TECH);
    expect(w.fighters[1].stateNo).toBe(SYS.THROW_TECH);
    run(w, 30, () => [0, 0]);
    expect(w.fighters[1].life).toBe(life);
  });

  it("meia-lua + C colado sai o especial, não o arremesso", () => {
    const w = fight();
    close(w);
    const seq = [Btn.D, Btn.D | Btn.R, Btn.R, Btn.R | C];
    run(w, seq.length, (f) => [seq[f], 0]);
    expect(w.fighters[0].stateNo).toBe(1000);
  });

  it("Just Defend: defender no último instante não toma raspão e recupera vida", () => {
    const w = fight("kaze", "volt");
    close(w);
    w.fighters[1].life = 500;
    const ev = run(w, 20, (f) => [f === 0 ? C : 0, f >= 3 ? Btn.R : 0]);
    expect(kinds(ev)).toContain("justdefend");
    expect(w.fighters[1].life).toBeGreaterThan(500);
  });

  it("A+B+C com 1 estoque liga o MAX: mais dano e a barra não enche", () => {
    const base = fight();
    close(base);
    const normal = (() => {
      const w = deepClone(base);
      const life = w.fighters[1].life;
      run(w, 20, (f) => [f === 0 ? A : 0, 0]);
      return life - w.fighters[1].life;
    })();

    const w = deepClone(base);
    w.fighters[0].power = 1500;
    const ev = run(w, 1, () => [A | B | C, 0]);
    expect(kinds(ev)).toContain("max");
    expect(w.fighters[0].maxTime).toBeGreaterThan(MAX_TICKS - 3);
    expect(w.fighters[0].power).toBe(500);
    run(w, 60, () => [0, 0]);
    close(w);
    const life = w.fighters[1].life;
    run(w, 20, (f) => [f === 0 ? A : 0, 0]);
    expect(life - w.fighters[1].life).toBeGreaterThan(normal);
    expect(w.fighters[0].power).toBe(500);
    run(w, MAX_TICKS, () => [0, 0]);
    expect(w.fighters[0].maxTime).toBe(0);
  });

  it("contra-ataque: acertar quem está atacando dá mais dano", () => {
    const base = fight("kaze", "kaze");
    close(base);
    const hit = (p2: number) => {
      const w = deepClone(base);
      const life = w.fighters[1].life;
      const ev = run(w, 20, (f) => [f === 2 ? A : 0, f === 0 ? p2 : 0]);
      return { dmg: life - w.fighters[1].life, ev };
    };
    // o forte do P2 demora a sair; o jab do P1 pega no meio
    const counter = hit(C);
    expect(kinds(counter.ev)).toContain("counter");
    const plain = (() => {
      const w = deepClone(base);
      const life = w.fighters[1].life;
      run(w, 20, (f) => [f === 2 ? A : 0, 0]);
      return life - w.fighters[1].life;
    })();
    expect(counter.dmg).toBeGreaterThan(plain);
  });

  it("defender demais quebra a guarda (guard crush)", () => {
    const w = fight();
    close(w);
    run(w, 30, () => [0, Btn.R]);
    let crushed = false;
    for (let i = 0; i < 20 && !crushed; i++) {
      w.fighters[0].x = w.fighters[1].x - 32;
      const ev = run(w, 40, (f) => [f === 0 ? C : 0, Btn.R]);
      crushed = kinds(ev).includes("guardcrush");
    }
    expect(crushed).toBe(true);
    expect(w.fighters[1].guardMeter).toBeGreaterThan(GUARD_MAX / 2);
  });

  it("guard cancel: A+B defendendo gasta 1 estoque e rola", () => {
    const w = fight();
    close(w);
    w.fighters[1].power = 1000;
    const back = Btn.D | Btn.R;
    run(w, 30, () => [0, back]);
    let rolled = false;
    run(w, 40, (f, world) => {
      if (world.fighters[1].stateNo === SYS.ROLL_FWD) rolled = true;
      const blocking = world.fighters[1].stateNo >= 150 && world.fighters[1].stateNo <= 153;
      return [f === 0 ? A : 0, blocking ? A | B : back];
    });
    expect(rolled).toBe(true);
    expect(w.fighters[1].power).toBeLessThan(100);
  });

  it("tocar para cima dá um pulo curto (hop)", () => {
    const peak = (hold: number) => {
      const w = fight();
      let top = 0;
      run(w, 70, (f, world) => {
        top = Math.min(top, world.fighters[0].y);
        return [f < hold ? Btn.U : 0, 0];
      });
      return -top;
    };
    const hop = peak(2);
    const full = peak(20);
    expect(hop).toBeGreaterThan(20);
    expect(hop).toBeLessThan(full * 0.75);
  });

  it("K.O. em câmera lenta e determinístico", () => {
    const w = fight();
    close(w);
    w.fighters[1].life = 1;
    run(w, 20, (f) => [f === 0 ? C : 0, 0]);
    expect(w.roundState).toBe(3);
    const x0 = w.fighters[1].x;
    const t0 = w.roundStateTime;
    run(w, 3, () => [0, 0]);
    // em 3 frames o lutador só anda em 1
    expect(w.roundStateTime).toBe(t0 + 3);
    expect(Math.abs(w.fighters[1].x - x0)).toBeLessThan(8);
  });
});

describe("equipes (KOF 3 contra 3)", () => {
  function teamFight(): WorldState {
    const w = createWorld(
      { chars: ["kaze", "kaze"], teams: [["kaze", "brasa", "tita"], ["yuki", "volt", "sombra"]], stageId: "dojo", seed: 9, roundsToWin: 2, roundTime: 99 },
      roster,
    );
    return w;
  }

  /** Avança até o próximo round começar ou a partida acabar. */
  function untilNext(w: WorldState): void {
    for (let i = 0; i < 2000 && w.roundState !== 2 && w.matchWinner < 0; i++) stepWorld(w, [0, 0], roster);
  }

  /** O P1 derruba o oponente atual com um blowback. */
  function knockOut(w: WorldState): void {
    untilNext(w);
    close(w);
    w.fighters[1].life = 1;
    run(w, 20, (f) => [f === 0 ? C | D : 0, 0]);
    expect(w.roundState).toBe(3);
    for (let i = 0; i < 2000 && w.roundState >= 3 && w.matchWinner < 0; i++) stepWorld(w, [0, 0], roster);
  }

  it("quem perde dá lugar ao próximo; quem vence continua com a vida", () => {
    const w = teamFight();
    untilNext(w);
    expect(w.fighters[1].charId).toBe("yuki");
    w.fighters[0].life = 400;
    knockOut(w);
    expect(w.teams?.[1].index).toBe(1);
    expect(w.fighters[1].charId).toBe("volt");
    expect(w.fighters[0].charId).toBe("kaze");
    // ficou com a vida e recuperou 30% do que tinha perdido
    expect(w.fighters[0].life).toBe(400 + Math.round(600 * 0.3));
    // quem entra ganha um estoque
    expect(w.fighters[1].power).toBeGreaterThanOrEqual(1000);
    knockOut(w);
    expect(w.fighters[1].charId).toBe("sombra");
    knockOut(w);
    expect(w.matchWinner).toBe(0);
  });

  it("é determinístico com clone no meio (rollback)", () => {
    const w = teamFight();
    let s = 12345;
    const rnd = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) % 4096;
    };
    const inputs: [number, number][] = Array.from({ length: 3000 }, () => [rnd() & 2047, rnd() & 2047]);
    let snap: WorldState | null = null;
    inputs.forEach((inp, i) => {
      if (i === 1500) snap = deepClone(w);
      stepWorld(w, inp, roster);
    });
    const again = snap as unknown as WorldState;
    for (let i = 1500; i < inputs.length; i++) stepWorld(again, inputs[i], roster);
    expect(checksum(again)).toBe(checksum(w));
  });
});
