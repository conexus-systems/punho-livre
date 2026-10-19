import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import type { CharacterData, GameEvent, WorldState } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";

import { CpuController } from "../ai";
import { CAM_ZOOM_MAX, FightCamera, noise, type Viewport } from "../camera";
import { Effects, MAX_IMPACTS, MAX_PARTICLES } from "../effects";

const roster: Record<string, CharacterData> = {};
for (const id of BUILTIN_ORDER.slice(0, 6)) roster[id] = loadCharacter(BUILTIN[id].pack);
const ids = Object.keys(roster);

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Luta CPU × CPU gravada: estados (cópia rasa do que a câmera usa) e eventos por quadro. */
function record(seed: number, frames: number): { worlds: WorldState[]; events: GameEvent[][] } {
  const w = createWorld({ chars: [ids[seed % ids.length], ids[(seed + 1) % ids.length]], stageId: "dojo", seed, roundsToWin: 9, roundTime: 99 }, roster);
  const r = rng(seed);
  const cpu = [new CpuController(0, roster, 3, r), new CpuController(1, roster, 3, r)];
  const worlds: WorldState[] = [];
  const events: GameEvent[][] = [];
  for (let i = 0; i < frames; i++) {
    stepWorld(w, [cpu[0].next(w), cpu[1].next(w)], roster);
    worlds.push(JSON.parse(JSON.stringify(w)));
    events.push(w.events.slice());
  }
  return { worlds, events };
}

const PHONE: Viewport = { width: 844, height: 390, k: 390 / 250, groundPx: 390 * 0.8, hudPx: 390 * 0.2 };
const TABLET: Viewport = { width: 1024, height: 768, k: 768 / 250, groundPx: 768 * 0.8, hudPx: 768 * 0.2 };

const fight = record(5, 1400);

describe("câmera da luta", () => {
  it("a luta gravada tem golpes (senão os testes abaixo não dizem nada)", () => {
    const kinds = fight.events.flat().map((e) => e.kind);
    expect(kinds.filter((k) => k === "hit").length).toBeGreaterThan(5);
  });

  it("é determinística: o mesmo histórico dá a mesma câmera (e não usa Math.random)", () => {
    const spy = jest.spyOn(Math, "random");
    const a = new FightCamera();
    const b = new FightCamera();
    for (let i = 0; i < fight.worlds.length; i++) {
      a.update(fight.worlds[i], fight.events[i]);
      b.update(fight.worlds[i], fight.events[i]);
      expect(b.snapshot()).toEqual(a.snapshot());
      expect(b.view(PHONE)).toEqual(a.view(PHONE));
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("os dois lutadores ficam sempre dentro da tela", () => {
    for (const vp of [PHONE, TABLET]) {
      const cam = new FightCamera();
      for (let i = 0; i < fight.worlds.length; i++) {
        const w = fight.worlds[i];
        cam.update(w, fight.events[i]);
        const v = cam.view(vp);
        expect(v.zoom).toBeGreaterThanOrEqual(1);
        expect(v.zoom).toBeLessThanOrEqual(CAM_ZOOM_MAX + 0.1);
        for (const f of w.fighters) {
          const base = (f.x - v.x) * vp.k + vp.width / 2;
          const screen = v.pivotX + (base - v.pivotX) * v.zoom + v.shakeX;
          expect(screen).toBeGreaterThan(0);
          expect(screen).toBeLessThan(vp.width);
        }
      }
    }
  });

  it("golpe forte dá tremor e punch de zoom; golpe fraco só tremor; tudo decai", () => {
    const w = fight.worlds[200];
    const hit = (level: number): GameEvent => ({ kind: "hit", x: 0, y: -60, side: 0, level, frame: w.frame });
    const light = new FightCamera();
    light.update(w, []);
    light.update(w, [hit(0)]);
    expect(light.trauma).toBeGreaterThan(0);
    expect(light.punch).toBe(0);

    const heavy = new FightCamera();
    heavy.update(w, []);
    heavy.update(w, [hit(2)]);
    expect(heavy.trauma).toBeGreaterThan(light.trauma);
    expect(heavy.punch).toBeGreaterThan(0);
    const sup = new FightCamera();
    sup.update(w, []);
    sup.update(w, [hit(4)]);
    expect(sup.punch).toBeGreaterThan(heavy.punch);
    for (let i = 0; i < 60; i++) heavy.update(w, []);
    expect(heavy.trauma).toBe(0);
    expect(heavy.punch).toBe(0);
  });

  it("contra-ataque e K.O. reagem mais que o golpe sozinho", () => {
    const w = fight.worlds[200];
    const base: GameEvent = { kind: "hit", x: 0, y: -60, side: 0, level: 1, frame: w.frame };
    const plain = new FightCamera();
    plain.update(w, []);
    plain.update(w, [base]);
    const counter = new FightCamera();
    counter.update(w, []);
    counter.update(w, [base, { ...base, kind: "counter" }]);
    const ko = new FightCamera();
    ko.update(w, []);
    ko.update(w, [base, { ...base, kind: "ko" }]);
    expect(counter.trauma).toBeGreaterThan(plain.trauma);
    expect(counter.punch).toBeGreaterThan(plain.punch);
    expect(ko.trauma).toBeGreaterThan(counter.trauma);
  });

  it("reduzir movimento: sem tremor, sem punch, zoom 1", () => {
    const cam = new FightCamera();
    cam.reduceMotion = true;
    for (let i = 0; i < fight.worlds.length; i++) {
      cam.update(fight.worlds[i], fight.events[i]);
      const v = cam.view(PHONE);
      expect(v.shakeX).toBe(0);
      expect(v.shakeY).toBe(0);
      expect(v.zoom).toBe(1);
    }
  });

  it("segue o alvo da engine com suavização", () => {
    const w = JSON.parse(JSON.stringify(fight.worlds[300])) as WorldState;
    const cam = new FightCamera();
    w.cameraX = 0;
    cam.update(w, []);
    w.cameraX = 60;
    cam.update(w, []);
    expect(cam.x).toBeGreaterThan(0);
    expect(cam.x).toBeLessThan(60);
    for (let i = 0; i < 60; i++) cam.update(w, []);
    expect(cam.x).toBeCloseTo(60, 1);
  });

  it("noise é estável e fica em [0, 1)", () => {
    for (let f = 0; f < 500; f++) {
      const v = noise(f, 3);
      expect(v).toBe(noise(f, 3));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("efeitos de impacto", () => {
  it("partículas e impactos têm teto fixo", () => {
    const fx = new Effects();
    for (let f = 0; f < 200; f++) {
      fx.beginFrame(f);
      fx.tick();
      for (let i = 0; i < 5; i++) fx.impact(i % 2 ? "counter" : "hit", 0, -60, 4, "#FFFFFF", 1);
      fx.impact("crush", 0, -40, 2, "#EF4444", 1);
      fx.dust(0, 10);
      expect(fx.liveParticles).toBeLessThanOrEqual(MAX_PARTICLES);
    }
    expect(MAX_IMPACTS).toBeLessThanOrEqual(16);
  });

  it("os mesmos eventos geram os mesmos efeitos (PRNG semeado pelo quadro)", () => {
    const run = () => {
      const fx = new Effects();
      const counts: number[] = [];
      for (let f = 0; f < 120; f++) {
        fx.beginFrame(f);
        fx.tick();
        if (f % 7 === 0) fx.impact("hit", 0, -60, f % 5, "#FFFFFF", 1);
        if (f % 11 === 0) fx.impact("guard", 0, -60, 1, "#FFFFFF", -1);
        if (f % 13 === 0) fx.dust(0, 4, 1);
        counts.push(fx.liveParticles);
      }
      return counts;
    };
    const spy = jest.spyOn(Math, "random");
    expect(run()).toEqual(run());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
