import AsyncStorage from "@react-native-async-storage/async-storage";

import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import { checksum } from "@/src/engine/clone";
import { Btn, toRelative } from "@/src/engine/input";
import { matchCommand } from "@/src/engine/mugen/cmd";
import type { CharacterData, GameEvent, WorldState } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";
import { DEFAULT_CONTROLS, DEFAULT_LAYOUTS, layoutFor, MIN_SIZE, sanitizeControls, sanitizeLayout } from "@/src/game/controlLayout";
import { DirectionalPad, OCTANT_BITS } from "@/src/game/dpad";
import { HapticGate, hitFeel } from "@/src/game/feedback";
import { GamepadReader } from "@/src/game/gamepad";
import { findCommand } from "@/src/game/macros";
import { probeChangeState, reachable, SIMPLE_MASK, SimpleBtn, SimpleController, simpleContextOf, simpleKit, SLOTS, type SimpleContext, type SpecialSlot } from "@/src/game/simpleMode";
import { loadSettings, setControls } from "@/src/settings";
import { app } from "@/src/store";

const roster: Record<string, CharacterData> = {};
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);

const kitOf = (id: string) => simpleKit(roster[id], BUILTIN[id].meta);

function fight(a: string, b = "tita"): WorldState {
  const w = createWorld({ chars: [a, b], stageId: "dojo", seed: 7, roundsToWin: 2, roundTime: 99 }, roster);
  for (let i = 0; i < 400 && w.roundState !== 2; i++) stepWorld(w, [0, 0], roster);
  expect(w.roundState).toBe(2);
  return w;
}

function ctxOf(w: WorldState, side = 0): SimpleContext {
  const me = w.fighters[side];
  return simpleContextOf(me);
}

/** Roda a luta com o modo simples no P1; `raw(f)` são os bits crus do toque no frame f. */
function runSimple(w: WorldState, ctl: SimpleController, frames: number, raw: (f: number) => number) {
  const states: number[] = [];
  const outputs: number[] = [];
  const events: GameEvent[] = [];
  for (let f = 0; f < frames; f++) {
    const out = ctl.step(raw(f), ctxOf(w));
    outputs.push(out);
    stepWorld(w, [out, 0], roster);
    states.push(w.fighters[0].stateNo);
    events.push(...w.events);
  }
  return { states, outputs, events };
}

/** Absoluto da direção "frente/trás/baixo" para quem olha para `facing`. */
function dirBits(slot: SpecialSlot, facing: 1 | -1): number {
  if (slot === "down") return Btn.D;
  if (slot === "forward") return facing === 1 ? Btn.R : Btn.L;
  if (slot === "back") return facing === 1 ? Btn.L : Btn.R;
  return 0;
}

/** Aperta Especial (com a direção da vaga) por 3 frames e solta tudo. */
const tapSpecial = (slot: SpecialSlot, facing: 1 | -1) => (f: number) => (f < 3 ? dirBits(slot, facing) | SimpleBtn.special : 0);

const CHARS = ["kaze", "tita", "brasa"] as const;

describe("modo simples: kit derivado do personagem", () => {
  it("especiais distribuídos por direção (meia-lua → frente, meia-lua para trás → trás, baixo-baixo → baixo, shoryuken → neutro)", () => {
    expect(Object.fromEntries(SLOTS.map((s) => [s, kitOf("kaze").specials[s]?.cmd]))).toEqual({ neutral: "dp_p", forward: "qcf_p", back: "qcb_k", down: "dd_p" });
    expect(Object.fromEntries(SLOTS.map((s) => [s, kitOf("brasa").specials[s]?.cmd]))).toEqual({ neutral: "dp_k", forward: "qcf_k", back: "qcb_k", down: "dd_k" });
    expect(Object.fromEntries(SLOTS.map((s) => [s, kitOf("sombra").specials[s]?.cmd]))).toEqual({ neutral: "qcf_k", forward: "qcf_p", back: "qcb_p", down: "dd_k" });
  });

  it("meia-volta (agarrão) vem antes da meia-lua no .cmd e entra no kit", () => {
    // Titã: B, DB, D, DF, F + soco também completa a meia-lua (qcf_p); o gerador lista a meia-volta antes
    expect(reachable(roster.tita, "hcf_p")).toBe(true);
    expect(reachable(roster.tita, "qcf_p")).toBe(true);
    const kit = kitOf("tita");
    expect(SLOTS.map((s) => kit.specials[s]?.cmd)).toContain("hcf_p");
    const ctl = new SimpleController(roster.tita, kit);
    for (let f = 0; f < 3; f++) ctl.step(Btn.L | SimpleBtn.special, { facing: 1, power: 0, ctrl: true, stateNo: 0, moveContact: 0, hitPause: 0, air: false });
    // Especial + trás (olhando para a direita) solta o agarrão
    expect(kit.specials.back?.cmd).toBe("hcf_p");
    expect(ctl.lastFired).toBe("hcf_p");
  });

  it("especiais aéreos (statetype = A) ficam no kit do ar", () => {
    const yuki = kitOf("yuki");
    expect(yuki.specials.forward?.cmd).toBe("qcf_p");
    expect(yuki.airSpecials.neutral?.name).toBe("Avalanche");
    expect(yuki.airSpecials.forward?.name).toBe("Chuva de Kunai");
  });

  it("todo nativo tem pelo menos 3 especiais (chão + ar), super e um auto-combo que termina em especial", () => {
    for (const id of BUILTIN_ORDER) {
      const kit = kitOf(id);
      const moves = new Set([...SLOTS.map((s) => kit.specials[s]?.name), ...SLOTS.map((s) => kit.airSpecials[s]?.name)].filter(Boolean));
      expect({ id, n: moves.size >= 3 }).toEqual({ id, n: true });
      expect(kit.super).not.toBeNull();
      expect(kit.combo.length).toBeGreaterThanOrEqual(2);
      expect(kit.combo[0]).toMatchObject({ kind: "button", key: "x" });
      expect(kit.combo[kit.combo.length - 1].kind).toBe("command");
    }
  });

  it("o auto-combo segue as ligações do .cmd e o alcance dos golpes (Kaze: soco fraco → chute médio → Kaze Ha)", () => {
    // x → y também é ligação válida, mas o y não alcança depois do empurrão do primeiro acerto
    expect(probeChangeState(roster.kaze, { stateNo: 200, ctrl: false, moveContact: 1, commands: new Set(["y"]) })).toBe(210);
    expect(kitOf("kaze").combo.map((c) => (c.kind === "button" ? c.key : c.cmd))).toEqual(["x", "b", "qcf_p"]);
  });
});

describe("modo simples: gera os comandos certos", () => {
  for (const id of CHARS) {
    for (const facing of [1, -1] as const) {
      it(`${id}, olhando para ${facing === 1 ? "a direita" : "a esquerda"}: Especial + direção reconhece o comando e entra no estado do especial`, () => {
        const kit = kitOf(id);
        for (const slot of SLOTS) {
          const move = kit.specials[slot];
          if (!move) continue;
          // 1) a sequência de entradas, vista pela engine (relativa), casa com o comando do .cmd
          const ctl = new SimpleController(roster[id], kit);
          const ctx: SimpleContext = { facing, power: 0, ctrl: true, stateNo: 0, moveContact: 0, hitPause: 0, air: false };
          const rel: number[] = [];
          for (let f = 0; f < 40; f++) {
            const out = ctl.step(tapSpecial(slot, facing)(f), ctx);
            expect(out & SIMPLE_MASK).toBe(0);
            rel.push(toRelative(out, facing));
          }
          const cmd = findCommand(roster[id], move.cmd)!;
          const matched = rel.some((_, now) => matchCommand(cmd, (ago) => rel[now - ago] ?? 0));
          expect({ id, slot, matched }).toEqual({ id, slot, matched: true });

          // 2) na luta de verdade o lutador entra no estado do especial
          const w = fight(id);
          if (facing === -1) {
            w.fighters[0].x = 120;
            w.fighters[1].x = -120;
            for (let i = 0; i < 4; i++) stepWorld(w, [0, 0], roster);
            expect(w.fighters[0].facing).toBe(-1);
          }
          const want = probeChangeState(roster[id], { stateNo: 0, ctrl: true, moveContact: 0, commands: new Set([move.cmd]) });
          const { states } = runSimple(w, new SimpleController(roster[id], kit), 40, tapSpecial(slot, facing));
          expect({ id, slot, entered: states.includes(want!) }).toEqual({ id, slot, entered: true });
        }
      });
    }
  }

  it("Super só sai com barra; baixo + Super com 2 estoques solta o super 2", () => {
    for (const id of CHARS) {
      const kit = kitOf(id);
      const superState = probeChangeState(roster[id], { stateNo: 0, ctrl: true, moveContact: 0, commands: new Set([kit.super!.cmd]), power: 3000 });
      // sem barra: nada
      let w = fight(id);
      w.fighters[0].power = 0;
      expect(runSimple(w, new SimpleController(roster[id], kit), 50, (f) => (f < 3 ? SimpleBtn.super : 0)).states).not.toContain(superState);
      // com 1 estoque: super
      w = fight(id);
      w.fighters[0].power = 1000;
      expect(runSimple(w, new SimpleController(roster[id], kit), 50, (f) => (f < 3 ? SimpleBtn.super : 0)).states).toContain(superState);
      // com 2 estoques + baixo: super 2
      if (kit.super2) {
        const super2State = probeChangeState(roster[id], { stateNo: 0, ctrl: true, moveContact: 0, commands: new Set([kit.super2.cmd]), power: 3000 });
        w = fight(id);
        w.fighters[0].power = 2000;
        expect(runSimple(w, new SimpleController(roster[id], kit), 60, (f) => (f < 3 ? Btn.D | SimpleBtn.super : 0)).states).toContain(super2State);
      }
    }
  });

  it("toques repetidos no Soco fazem o auto-combo inteiro, colado no oponente, cancelando um golpe no outro", () => {
    for (const id of CHARS) {
      const kit = kitOf(id);
      const w = fight(id);
      w.fighters[0].x = -16;
      w.fighters[1].x = 16;
      // um toque a cada 6 frames (dedo apressado): os adiantados esperam o golpe encostar
      const { states, events } = runSimple(w, new SimpleController(roster[id], kit), 120, (f) => (f % 6 < 2 && f < 40 ? SimpleBtn.punch : 0));
      const order = kit.combo.map((c) => states.indexOf(c.state));
      expect({ id, inOrder: order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])) }).toEqual({ id, inOrder: true });
      // cancel de verdade: do primeiro golpe ao especial o lutador não volta ao neutro (estado 0)
      expect({ id, cancelled: !states.slice(order[0], order[order.length - 1]).includes(0) }).toEqual({ id, cancelled: true });
      expect({ id, hits: events.filter((e) => e.kind === "hit" && e.side === 0).length }).toEqual({ id, hits: kit.combo.length });
    }
  });

  it("Chute é o D (chute forte) e segue a direção segurada", () => {
    const ctl = new SimpleController(roster.kaze, kitOf("kaze"));
    const ctx: SimpleContext = { facing: 1, power: 0, ctrl: true, stateNo: 0, moveContact: 0, hitPause: 0, air: false };
    expect(ctl.step(SimpleBtn.kick | Btn.R, ctx)).toBe(Btn.c | Btn.R);
    expect(ctl.step(Btn.D, ctx)).toBe(Btn.D);
  });

  it("é determinístico: mesma sequência de toques ⇒ mesmo mundo (checksum)", () => {
    const script = (f: number) => [SimpleBtn.punch, 0, Btn.R | SimpleBtn.special, 0, Btn.D, SimpleBtn.kick | Btn.L, 0][(f >> 3) % 7];
    const run = () => {
      const w = fight("kaze");
      runSimple(w, new SimpleController(roster.kaze, kitOf("kaze")), 400, script);
      return checksum(w);
    };
    expect(run()).toBe(run());
  });
});

describe("direcional com histerese", () => {
  it("zona morta: liga em 14 e só solta abaixo de 70% dela", () => {
    const pad = new DirectionalPad();
    expect(pad.update(10, 0)).toBe(0);
    expect(pad.update(15, 0)).toBe(Btn.R);
    expect(pad.update(11, 0)).toBe(Btn.R); // abaixo da zona morta, mas acima de 9,8
    expect(pad.update(9, 0)).toBe(0);
  });

  it("8 direções nos centros dos setores", () => {
    const pad = new DirectionalPad();
    for (let oct = 0; oct < 8; oct++) {
      pad.reset();
      const a = (oct * Math.PI) / 4;
      expect(pad.update(Math.cos(a) * 40, Math.sin(a) * 40)).toBe(OCTANT_BITS[oct]);
    }
  });

  it("diagonal não escorrega: passar um pouco da fronteira de 22,5° mantém baixo-frente", () => {
    const pad = new DirectionalPad();
    const at = (deg: number) => pad.update(Math.cos((deg * Math.PI) / 180) * 40, Math.sin((deg * Math.PI) / 180) * 40);
    expect(at(45)).toBe(Btn.R | Btn.D);
    // fronteira com "direita" em 22,5°: com 10° de histerese, segura até 12,5°
    expect(at(20)).toBe(Btn.R | Btn.D);
    expect(at(14)).toBe(Btn.R | Btn.D);
    expect(at(10)).toBe(Btn.R);
    // e na volta a "direita" também segura além da fronteira
    expect(at(25)).toBe(Btn.R);
    expect(at(31)).toBe(Btn.R);
    expect(at(34)).toBe(Btn.R | Btn.D);
  });

  it("sem histerese (comparação): o mesmo movimento troca de direção na fronteira", () => {
    const pad = new DirectionalPad({ deadZone: 14, hysteresisDeg: 0, releaseRatio: 1 });
    const at = (deg: number) => pad.update(Math.cos((deg * Math.PI) / 180) * 40, Math.sin((deg * Math.PI) / 180) * 40);
    expect(at(45)).toBe(Btn.R | Btn.D);
    expect(at(20)).toBe(Btn.R);
  });
});

describe("layout e ajustes de controle", () => {
  it("sanitiza: ids estranhos saem, faltantes voltam ao padrão, números presos (≥ 48 dp)", () => {
    const l = sanitizeLayout("snk", [{ id: "A", x: 2, y: -1, size: 10 }, { id: "zzz", x: 0.5, y: 0.5, size: 60 }, { id: "B", x: "a" }, null]);
    expect(l.map((i) => i.id)).toEqual(DEFAULT_LAYOUTS.snk.map((i) => i.id));
    const a = l.find((i) => i.id === "A")!;
    expect(a.x).toBeLessThan(1);
    expect(a.y).toBeGreaterThan(0);
    expect(a.size).toBe(MIN_SIZE);
    expect(l.find((i) => i.id === "B")).toEqual(DEFAULT_LAYOUTS.snk.find((i) => i.id === "B"));
    expect(sanitizeControls("lixo")).toEqual(DEFAULT_CONTROLS);
    for (const s of ["snk", "mugen", "simple"] as const) for (const it of DEFAULT_LAYOUTS[s]) expect(it.size).toBeGreaterThanOrEqual(MIN_SIZE);
  });

  it("persiste o layout editado, o modo e o direcional (salva e recarrega do AsyncStorage)", async () => {
    await AsyncStorage.clear();
    const moved = DEFAULT_LAYOUTS.simple.map((i) => (i.id === "punch" ? { ...i, x: 0.6, y: 0.5, size: 90 } : i));
    setControls({ mode: "simple", stick: "fixed", deadZone: 20, opacity: 0.55, layouts: { simple: moved } });
    await new Promise((r) => setTimeout(r, 0));
    // simula reabrir o app: volta aos padrões e carrega do armazenamento
    app.set((s) => ({ settings: { ...s.settings, controls: DEFAULT_CONTROLS } }));
    await loadSettings();
    const c = app.get().settings.controls;
    expect(c).toMatchObject({ mode: "simple", stick: "fixed", deadZone: 20, opacity: 0.55 });
    expect(layoutFor("simple", c.layouts).find((i) => i.id === "punch")).toEqual({ id: "punch", x: 0.6, y: 0.5, size: 90 });
    // esquema não editado continua no padrão
    expect(layoutFor("snk", c.layouts)).toEqual(DEFAULT_LAYOUTS.snk);
  });

  it("quem já tinha ajustes salvos antes do modo simples continua no clássico", async () => {
    await AsyncStorage.setItem("mugen-arena.settings", JSON.stringify({ assist: true, vibration: false, buttons: "snk" }));
    app.set((s) => ({ settings: { ...s.settings, controls: DEFAULT_CONTROLS } }));
    await loadSettings();
    expect(app.get().settings.controls.mode).toBe("classic");
    expect(app.get().settings.vibration).toBe(false);
  });
});

describe("vibração e controle físico", () => {
  const ev = (kind: GameEvent["kind"], side: 0 | 1): GameEvent => ({ kind, side, x: 0, y: 0, level: 1, frame: 0 });

  it("acertar, apanhar e defender viram vibrações diferentes; apanhar ganha do resto", () => {
    expect(hitFeel([ev("hit", 0)], 0)).toBe("hit");
    expect(hitFeel([ev("hit", 1)], 0)).toBe("hurt");
    expect(hitFeel([ev("guard", 1)], 0)).toBe("guard");
    expect(hitFeel([ev("guard", 0), ev("hit", 1), ev("hit", 0)], 0)).toBe("hurt");
    expect(hitFeel([ev("round", 0)], 0)).toBeNull();
    const gate = new HapticGate(70);
    expect([gate.allow(0), gate.allow(30), gate.allow(80)]).toEqual([true, false, true]);
  });

  it("gamepad padrão: face buttons no layout Neo Geo, ombros como atalhos, analógico com zona morta", () => {
    const g = new GamepadReader();
    const buttons = (...on: number[]) => Array.from({ length: 17 }, (_, i) => on.includes(i));
    expect(g.bits({ buttons: buttons(2), axes: [0, 0] }, "classic")).toBe(Btn.x);
    expect(g.bits({ buttons: buttons(1, 14), axes: [0, 0] }, "classic")).toBe(Btn.c | Btn.L);
    expect(g.bits({ buttons: buttons(4), axes: [0, 0] }, "classic")).toBe(Btn.x | Btn.a);
    expect(g.bits({ buttons: buttons(3), axes: [0, 0] }, "simple")).toBe(SimpleBtn.special);
    expect(g.bits({ buttons: buttons(), axes: [0.2, 0.1] }, "classic")).toBe(0);
    expect(g.bits({ buttons: buttons(), axes: [0.7, 0.7] }, "classic")).toBe(Btn.R | Btn.D);
    expect([...g.pressed({ buttons: buttons(9), axes: [] })]).toEqual([9]);
    expect([...g.pressed({ buttons: buttons(9), axes: [] })]).toEqual([]);
  });
});
