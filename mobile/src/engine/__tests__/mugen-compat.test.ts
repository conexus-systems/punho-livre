import { BUILTIN } from "@/src/characters/builtin.generated";
import { loadCharacter, PACK_FORMAT, type CharacterPack } from "../character";
import { checksum, deepClone } from "../clone";
import { changeState } from "../fighter";
import type { CharacterData, GameEvent, WorldState } from "../types";
import { createWorld, stepWorld } from "../world";

// Personagem MUGEN mínimo, escrito à mão, com arremesso por p2stateno,
// estado personalizado com ChangeAnim2, Target*, Helper, Explod e PlaySnd.
const box = "Clsn2: 1\n Clsn2[0] = -10, -80, 10, 0\n";
const hit = "Clsn1: 1\n Clsn1[0] = 0, -70, 40, -40\n";
const AIR = `
[Begin Action 0]
${box}0, 0, 0, 0, -1

[Begin Action 810]
${box}${hit}0, 1, 0, 0, 30

[Begin Action 820]
${box}0, 2, 0, 0, -1

[Begin Action 1000]
${box}${hit}0, 3, 0, 0, -1

[Begin Action 7000]
0, 4, 0, 0, 5
0, 5, 0, 0, 5
`;
const CNS = `
[Data]
life = 1000
power = 3000
attack = 100
defence = 100

[Size]
ground.back = 15
ground.front = 16
height = 60

[Velocity]
walk.fwd = 2.4
walk.back = -2.2

[Movement]
yaccel = .44

[Statedef 800]
type = S
movetype = A
physics = S
anim = 810
ctrl = 0
velset = 0, 0

[State 800, agarra]
type = HitDef
trigger1 = Time = 0
attr = S, NT
hitflag = M-
damage = 0
p2stateno = 820
p2facing = 1

[State 800, prende]
type = TargetBind
trigger1 = NumTarget && Time < 10
pos = 30, -20

[State 800, dano]
type = TargetLifeAdd
trigger1 = NumTarget && Time = 10
value = -100

[State 800, solta]
type = TargetState
trigger1 = NumTarget && Time = 12
value = 821

[State 800, fim]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1

[Statedef 820]
type = A
movetype = H
physics = N
velset = 0, 0

[State 820, anim]
type = ChangeAnim2
trigger1 = Time = 0
value = 820

[Statedef 821]
type = A
movetype = H
physics = A

[State 821, voa]
type = VelSet
trigger1 = Time = 0
x = -3
y = -4

[State 821, chao]
type = SelfState
trigger1 = Vel Y > 0 && Pos Y >= 0
value = 5100

[Statedef 900]
type = S
movetype = I
physics = S
anim = 0
ctrl = 0

[State 900, ajudante]
type = Helper
trigger1 = Time = 0
stateno = 1000
id = 7
pos = 20, 0

[State 900, efeito]
type = Explod
trigger1 = Time = 0
anim = 7000
id = 3
pos = 0, -50
removetime = 30

[State 900, som]
type = PlaySnd
trigger1 = Time = 0
value = S1, 2

[State 900, fim]
type = ChangeState
trigger1 = Time >= 60
value = 0
ctrl = 1

[Statedef 1000]
type = S
movetype = A
physics = N
anim = 1000

[State 1000, vai]
type = VelSet
trigger1 = Time = 0
x = 3

[State 1000, golpe]
type = HitDef
trigger1 = Time = 0
attr = S, SP
damage = 50
guardflag = MA

[State 1000, some]
type = DestroySelf
trigger1 = MoveContact || Time >= 50
`;
const DEF = `[Info]\nname = "Teste"\n\n[Files]\ncns = teste.cns\nanim = teste.air\n`;
const pack: CharacterPack = { format: PACK_FORMAT, id: "teste", name: "Teste", author: "testes", version: "1", def: "teste.def", files: { "teste.def": DEF, "teste.cns": CNS, "teste.air": AIR }, sprites: null };

const roster: Record<string, CharacterData> = { teste: loadCharacter(pack), kaze: loadCharacter(BUILTIN.kaze.pack) };

function world(): WorldState {
  const w = createWorld({ chars: ["teste", "kaze"], stageId: "dojo", seed: 1, roundsToWin: 2, roundTime: 99 }, roster);
  for (let i = 0; i < 400 && w.roundState !== 2; i++) stepWorld(w, [0, 0], roster);
  w.fighters[0].x = -16;
  w.fighters[1].x = 16;
  return w;
}

function run(w: WorldState, n: number): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    stepWorld(w, [0, 0], roster);
    ev.push(...w.events);
  }
  return ev;
}

describe("compatibilidade MUGEN", () => {
  it("todos os controladores do personagem de teste são suportados", () => {
    expect(roster.teste.unsupported).toEqual([]);
  });

  it("arremesso com p2stateno: estado personalizado, ChangeAnim2, TargetBind, TargetLifeAdd e TargetState", () => {
    const w = world();
    const [a, b] = w.fighters;
    changeState(a, w, roster, 800);
    run(w, 2);
    expect(b.customOwner).toBe(0);
    expect(b.stateNo).toBe(820);
    expect(b.animOwner).toBe(0); // usando a animação 820 do atacante
    expect(b.anim).toBe(820);
    run(w, 4);
    // preso na frente do atacante
    expect(b.x).toBeCloseTo(a.x + 30 * a.facing, 0);
    expect(b.y).toBeCloseTo(-20, 0);
    run(w, 8);
    expect(b.life).toBe(b.lifeMax - 100);
    expect(b.stateNo).toBe(821);
    run(w, 80);
    // voltou aos próprios estados ao cair
    expect(b.customOwner).toBe(-1);
    expect(b.animOwner).toBe(-1);
    expect([52, 5100, 5110, 5120, 0]).toContain(b.stateNo);
  });

  it("Helper ataca sozinho, Explod aparece e some, PlaySnd emite som", () => {
    const w = world();
    w.fighters[1].x = 70;
    changeState(w.fighters[0], w, roster, 900);
    const ev = run(w, 2);
    expect(w.helpers).toHaveLength(1);
    expect(w.helpers[0].helper?.id).toBe(7);
    expect(w.explods).toHaveLength(1);
    expect(ev.find((e) => e.kind === "sound")).toMatchObject({ snd: [1, 2], common: false, charId: "teste" });
    const life = w.fighters[1].life;
    run(w, 40);
    expect(w.fighters[1].life).toBe(life - 50);
    expect(w.helpers).toHaveLength(0); // DestroySelf ao acertar
    expect(w.explods).toHaveLength(0); // removetime = 30
  });

  it("helpers e explods entram no clone do rollback", () => {
    const w = world();
    changeState(w.fighters[0], w, roster, 900);
    run(w, 3);
    const snap = deepClone(w);
    run(w, 20);
    run(snap, 20);
    expect(checksum(snap)).toBe(checksum(w));
  });
});
