/**
 * "Game feel" na engine: hitstop por nível do golpe (defesa, contra-ataque,
 * K.O., pausetime explícito) e leniência de entrada (buffer dos especiais
 * durante o hitstop e a recuperação; prioridade super > especial > normal).
 */
import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter, PACK_FORMAT, type CharacterPack } from "../character";
import { checksum, deepClone } from "../clone";
import {
  CommandTier,
  COUNTER_HITSTOP_BONUS,
  GUARD_HITSTOP_MIN,
  HITSTOP_BY_LEVEL,
  HitLevel,
  INPUT_BUFFER_FRAMES,
  KO_HITSTOP_FRAMES,
} from "../constants";
import { changeState, guardPause, hitLevelOf } from "../fighter";
import { Btn } from "../input";
import { commandTier, parseCmd } from "../mugen/cmd";
import type { CharacterData, GameEvent, WorldState } from "../types";
import { createWorld, stepWorld } from "../world";

const box = "Clsn2: 1\n Clsn2[0] = -10, -80, 10, 0\n";
const hit = "Clsn1: 1\n Clsn1[0] = 0, -70, 40, -40\n";
const AIR = `
[Begin Action 0]
${box}0, 0, 0, 0, -1

[Begin Action 200]
${box}${hit}0, 1, 0, 0, -1

[Begin Action 1000]
${box}0, 3, 0, 0, -1
`;

/** Golpe de teste: estado `no`, HitDef com os parâmetros extras dados. */
function attack(no: number, extra: string, movetype = "A"): string {
  return `
[Statedef ${no}]
type = S
movetype = ${movetype}
physics = S
anim = 200
ctrl = 0
velset = 0, 0

[State ${no}, golpe]
type = HitDef
trigger1 = Time = 0
damage = 10, 2
guardflag = MA
hitflag = MAF
ground.hittime = 12
guard.hittime = 10
${extra}

[State ${no}, fim]
type = ChangeState
trigger1 = Time >= 40
value = 0
ctrl = 1
`;
}

const CNS = `
[Data]
life = 1000
power = 3000

[Size]
ground.back = 15
ground.front = 16
height = 60

[Movement]
yaccel = .44
${attack(200, "attr = S, NA\nanimtype = Light")}
${attack(210, "attr = S, NA\nanimtype = Medium")}
${attack(220, "attr = S, NA\nanimtype = Hard")}
${attack(230, "attr = S, SA\nanimtype = Hard")}
${attack(240, "attr = S, HA\nanimtype = Hard")}
${attack(250, "attr = S, NA\nanimtype = Hard\npausetime = 3, 4")}
${attack(260, "attr = S, NA\nanimtype = Hard\npausetime = 0, 0")}
${attack(270, "attr = S, NA\nanimtype = Hard\npausetime = 12, 12\nguard.pausetime = 11, 11")}
${attack(280, "attr = S, NA\nanimtype = Light\npausetime = 14, 14")}

[Statedef 300]
type = S
movetype = A
physics = S
anim = 0
ctrl = 0

[Statedef 400]
type = S
movetype = I
physics = S
anim = 0
ctrl = 0

[State 400, volta]
type = ChangeState
trigger1 = Time >= 12
value = 0
ctrl = 1

[Statedef 1000]
type = S
movetype = A
physics = S
anim = 1000
ctrl = 0

[Statedef 3000]
type = S
movetype = A
physics = S
anim = 1000
ctrl = 0
`;

// a ordem do -1 aqui é a "errada" de propósito (normal antes do especial e do super)
const CMD = `
[Defaults]
command.time = 15
command.buffer.time = 1

[Command]
name = "x"
command = x
time = 1

[Command]
name = "qcf_x"
command = ~D, DF, F, x

[Command]
name = "hcf_x"
command = ~B, DB, D, DF, F, x

[Command]
name = "dd_x"
command = ~D, D, x

[Command]
name = "qcf2_x"
command = ~D, DF, F, D, DF, F, x
time = 30

[Command]
name = "FF"
command = F, F
time = 10

[Statedef -1]

[State -1, normal]
type = ChangeState
value = 200
triggerall = command = "x"
trigger1 = ctrl

[State -1, especial]
type = ChangeState
value = 1000
triggerall = command = "qcf_x"
trigger1 = ctrl
trigger2 = stateno = 280 && movecontact

[State -1, super]
type = ChangeState
value = 3000
triggerall = command = "qcf2_x"
triggerall = power >= 1000
trigger1 = ctrl
`;
const DEF = `[Info]\nname = "Teste"\n\n[Files]\ncns = teste.cns\nanim = teste.air\ncmd = teste.cmd\n`;
const pack: CharacterPack = {
  format: PACK_FORMAT,
  id: "teste",
  name: "Teste",
  author: "testes",
  version: "1",
  def: "teste.def",
  files: { "teste.def": DEF, "teste.cns": CNS, "teste.air": AIR, "teste.cmd": CMD },
  sprites: null,
};

const roster: Record<string, CharacterData> = { teste: loadCharacter(pack) };

function world(): WorldState {
  const w = createWorld({ chars: ["teste", "teste"], stageId: "dojo", seed: 1, roundsToWin: 2, roundTime: 99 }, roster);
  for (let i = 0; i < 400 && w.roundState !== 2; i++) stepWorld(w, [0, 0], roster);
  w.fighters[0].x = -16;
  w.fighters[1].x = 16;
  return w;
}

/** Dispara o golpe `state` do P1 e devolve o evento de contato e o hitstop dos dois. */
function strike(state: number, opts: { guard?: boolean; prepare?: (w: WorldState) => void } = {}) {
  const w = world();
  if (opts.guard) {
    // segura para trás antes: defesa comum, não Just Defend
    for (let i = 0; i < 12; i++) stepWorld(w, [0, Btn.R], roster);
    w.fighters[0].x = -16;
    w.fighters[1].x = 16;
  }
  opts.prepare?.(w);
  changeState(w.fighters[0], w, roster, state);
  for (let i = 0; i < 10; i++) {
    // P2 olha para a esquerda: trás = direita
    stepWorld(w, [0, opts.guard ? Btn.R : 0], roster);
    const ev = w.events.find((e) => e.kind === "hit" || e.kind === "guard");
    if (ev) return { w, ev, events: w.events, att: w.fighters[0].hitPause, def: w.fighters[1].hitPause };
  }
  throw new Error("o golpe não encostou");
}

describe("hitstop por nível do golpe", () => {
  it("nível do golpe vem do animtype e do attr", () => {
    expect(hitLevelOf(0, "NA")).toBe(HitLevel.LIGHT);
    expect(hitLevelOf(1, "NA")).toBe(HitLevel.MEDIUM);
    expect(hitLevelOf(2, "NA")).toBe(HitLevel.HEAVY);
    expect(hitLevelOf(4, "NA")).toBe(HitLevel.HEAVY); // up/diagup contam como forte
    expect(hitLevelOf(0, "SA")).toBe(HitLevel.SPECIAL);
    expect(hitLevelOf(1, "HP")).toBe(HitLevel.SUPER);
  });

  it("sem pausetime, cresce com o nível: fraco < médio < forte < especial < super", () => {
    const stops = [200, 210, 220, 230, 240].map((s) => strike(s));
    stops.forEach((r, lvl) => {
      expect(r.ev.kind).toBe("hit");
      expect(r.ev.level).toBe(lvl);
      expect(r.att).toBe(HITSTOP_BY_LEVEL[lvl][0]);
      expect(r.def).toBe(HITSTOP_BY_LEVEL[lvl][1]);
    });
    for (let i = 1; i < stops.length; i++) expect(stops[i].def).toBeGreaterThan(stops[i - 1].def);
  });

  it("pausetime explícito do HitDef é respeitado (inclusive 0)", () => {
    const r = strike(250);
    expect([r.att, r.def]).toEqual([3, 4]);
    const z = strike(260);
    expect([z.att, z.def]).toEqual([0, 0]);
  });

  it("defesa congela menos que acerto; guard.pausetime explícito vale", () => {
    const g = strike(220, { guard: true });
    expect(g.ev.kind).toBe("guard");
    const h = strike(220);
    expect(g.def).toBeLessThan(h.def);
    expect(g.att).toBeLessThan(h.att);
    expect(g.def).toBe(guardPause(HITSTOP_BY_LEVEL[HitLevel.HEAVY][1]));
    expect(g.def).toBeGreaterThanOrEqual(GUARD_HITSTOP_MIN);
    const e = strike(270, { guard: true });
    expect([e.att, e.def]).toEqual([11, 11]);
  });

  it("contra-ataque congela mais, nos dois lados", () => {
    const normal = strike(220);
    const counter = strike(220, { prepare: (w) => changeState(w.fighters[1], w, roster, 300) });
    expect(counter.events.some((e) => e.kind === "counter")).toBe(true);
    expect(counter.def).toBe(normal.def + COUNTER_HITSTOP_BONUS);
    expect(counter.att).toBe(normal.att + COUNTER_HITSTOP_BONUS);
  });

  it("o golpe do K.O. congela mais (fora do treino)", () => {
    const r = strike(200, { prepare: (w) => (w.fighters[1].life = 1) });
    expect(r.events.some((e) => e.kind === "ko")).toBe(true);
    expect(r.def).toBe(KO_HITSTOP_FRAMES);
    expect(r.att).toBe(KO_HITSTOP_FRAMES);
  });

  it("hitstop novo continua determinístico no clone/rollback", () => {
    const w = world();
    changeState(w.fighters[0], w, roster, 240);
    stepWorld(w, [0, 0], roster);
    const snap = deepClone(w);
    for (let i = 0; i < 40; i++) {
      stepWorld(w, [0, 0], roster);
      stepWorld(snap, [0, 0], roster);
    }
    expect(checksum(snap)).toBe(checksum(w));
  });
});

const motion = (dirs: number[], button: number): number[] => [...dirs, button | dirs[dirs.length - 1]];
// P1 olha para a direita: frente = R
const QCF = [Btn.D, Btn.D | Btn.R, Btn.R];

function play(w: WorldState, inputs: number[]): GameEvent[] {
  const ev: GameEvent[] = [];
  for (const i of inputs) {
    stepWorld(w, [i, 0], roster);
    ev.push(...w.events);
  }
  return ev;
}

describe("leniência de entrada", () => {
  it("classifica os comandos: super > especial > normal", () => {
    const cmds = Object.fromEntries(parseCmd(CMD).map((c) => [c.name, c]));
    expect(commandTier(cmds.x)).toBe(CommandTier.NORMAL);
    expect(commandTier(cmds.ff)).toBe(CommandTier.NORMAL);
    expect(commandTier(cmds.qcf_x)).toBe(CommandTier.SPECIAL);
    expect(commandTier(cmds.hcf_x)).toBe(CommandTier.SPECIAL);
    expect(commandTier(cmds.dd_x)).toBe(CommandTier.SPECIAL);
    expect(commandTier(cmds.qcf2_x)).toBe(CommandTier.SUPER);
    expect(commandTier({ ...cmds.qcf_x, name: "super_p" })).toBe(CommandTier.SUPER);
    expect(cmds.qcf2_x.tier).toBe(CommandTier.SUPER);
  });

  it("estado -1 reordenado: super, depois especial, depois normal", () => {
    const labels = roster.teste.states[-1].controllers.map((c) => c.label);
    expect(labels).toEqual(["super", "especial", "normal"]);
  });

  it("meia-lua dupla + soco com barra sai o super (mesmo casando o especial e o soco)", () => {
    const w = world();
    w.fighters[0].power = 1000;
    play(w, motion([...QCF, ...QCF], Btn.x));
    play(w, [0]);
    expect(w.fighters[0].stateNo).toBe(3000);
  });

  it("sem barra, a mesma entrada vira o especial (não o soco)", () => {
    const w = world();
    w.fighters[0].power = 0;
    play(w, motion([...QCF, ...QCF], Btn.x));
    play(w, [0]);
    expect(w.fighters[0].stateNo).toBe(1000);
  });

  it("meia-lua + soco tem prioridade sobre o soco", () => {
    const w = world();
    play(w, motion(QCF, Btn.x));
    play(w, [0]);
    expect(w.fighters[0].stateNo).toBe(1000);
  });

  it(`especial completo na recuperação sai se o controle voltar dentro do buffer (${INPUT_BUFFER_FRAMES} quadros)`, () => {
    // estado 400 devolve o controle com Time >= 12; o -1 o vê no quadro 13 depois do início
    const FIRST_FREE = 13;
    const result = (gap: number) => {
      const w = world();
      changeState(w.fighters[0], w, roster, 400);
      const seq = motion(QCF, Btn.x);
      // o soco cai `gap` quadros antes do primeiro quadro livre
      const pad = FIRST_FREE - gap - (seq.length - 1);
      play(w, [...new Array(pad).fill(0), ...seq]);
      for (let i = 0; i < gap + 3; i++) play(w, [0]);
      return w.fighters[0].stateNo;
    };
    expect(result(1)).toBe(1000);
    // o quadro do aperto conta: vale até INPUT_BUFFER_FRAMES - 1 quadros depois
    expect(result(INPUT_BUFFER_FRAMES - 1)).toBe(1000);
    expect(result(INPUT_BUFFER_FRAMES)).toBe(0);
    expect(result(INPUT_BUFFER_FRAMES + 3)).toBe(0);
  });

  it("especial feito durante o hitstop cancela o golpe quando o congelamento acaba", () => {
    const w = world();
    changeState(w.fighters[0], w, roster, 280); // pausetime 14, cancela em 1000 no contato
    let guard = 0;
    while (!w.events.some((e) => e.kind === "hit") && guard++ < 10) play(w, [0]);
    expect(w.fighters[0].hitPause).toBe(14);
    // meia-lua + soco logo no começo do congelamento (10 quadros antes de ele acabar)
    play(w, motion(QCF, Btn.x));
    const states: number[] = [];
    for (let i = 0; i < 14; i++) {
      play(w, [0]);
      states.push(w.fighters[0].stateNo);
    }
    // saiu no primeiro quadro livre, mais de INPUT_BUFFER_FRAMES depois do soco:
    // só vale porque o buffer não envelhece durante o congelamento
    const at = states.indexOf(1000);
    expect(at).toBeGreaterThanOrEqual(INPUT_BUFFER_FRAMES);
    expect(states.slice(0, at).every((s) => s === 280)).toBe(true);
  });
});

describe("elenco nativo com as regras novas", () => {
  it("todo personagem tem super e especial classificados", () => {
    for (const id of BUILTIN_ORDER) {
      const ch = loadCharacter(BUILTIN[id].pack);
      const tiers = new Set(ch.commands.map((c) => c.tier ?? 0));
      expect(tiers.has(CommandTier.SPECIAL)).toBe(true);
      expect(tiers.has(CommandTier.SUPER)).toBe(true);
    }
  });
});
