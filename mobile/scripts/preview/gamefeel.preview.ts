/**
 * Cenas de "game feel" (impacto, defesa, contra-ataque, guard crush, super,
 * K.O.) para comparar antes/depois. Cada cena roda até o evento pedido e
 * desenha `after` quadros depois dele. Saída em $PREVIEW_OUT/gamefeel-*.png.
 * Só usa addEvents/draw do renderer, então roda em versões antigas também.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

jest.mock("react-native", () => ({ Platform: { select: (o: any) => o.default, OS: "android" } }));

import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import { Btn, toAbsolute } from "@/src/engine/input";
import type { CharacterData, WorldState } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";
import { findCommand, macroFromCommand } from "@/src/game/macros";

import { initSkia, state } from "./skia-node";

const OUT = process.env.PREVIEW_OUT ?? "/tmp/mugen-preview";
const A = Btn.x, C = Btn.z;

test("cenas de game feel", async () => {
  await initSkia();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FightRenderer } = require("@/src/game/renderer");
  const roster: Record<string, CharacterData> = {};
  for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);
  const img = (file: string) => state.Skia.Image.MakeImageFromEncoded(state.Skia.Data.fromBytes(new Uint8Array(readFileSync(file))));
  const atlases: Record<string, any[]> = {};
  for (const id of BUILTIN_ORDER) atlases[id] = BUILTIN[id].pack.sprites!.atlas.map((_: string, i: number) => img(`${__dirname}/../../characters/${id}/sprites${i}.webp`));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { STAGE_ART } = require("@/src/game/stages.generated");
  const stageImages: Record<string, Record<string, any>> = {};
  for (const id of Object.keys(STAGE_ART)) {
    stageImages[id] = {};
    for (const l of STAGE_ART[id].layers) {
      const file = ["jpg", "png"].map((ext) => `${__dirname}/../../assets/stages/${id}-${l.name}.${ext}`).find((f) => existsSync(f));
      if (file) stageImages[id][l.name] = img(file);
    }
  }
  mkdirSync(OUT, { recursive: true });
  const W = 844, H = 390;

  const superMacro = (id: string) => macroFromCommand(findCommand(roster[id], BUILTIN[id].meta.super.cmd)!).map((r) => toAbsolute(r, 1));

  type Scene = {
    name: string;
    a: string;
    b: string;
    stage: string;
    /** Ajuste logo antes do primeiro input (lutadores já com controle). */
    setup?: (w: WorldState) => void;
    /** Entradas [P1, P2] a partir do quadro 0 da cena. */
    script: (f: number) => [number, number];
    /** Antes de cada quadro, até o evento (ex.: manter a distância). */
    each?: (w: WorldState) => void;
    /** Evento que dispara a captura e quantos quadros depois desenhar. */
    on: string;
    after: number;
  };
  const near = (w: WorldState) => {
    w.fighters[0].x = -18;
    w.fighters[1].x = 18;
  };
  const scenes: Scene[] = [
    { name: "forte", a: "lua", b: "volt", stage: "pelourinho", setup: near, script: (f) => [f === 0 ? C : 0, 0], on: "hit", after: 2 },
    { name: "fraco", a: "kaze", b: "tita", stage: "dojo", setup: near, script: (f) => [f === 0 ? A : 0, 0], on: "hit", after: 2 },
    // P2 segura para trás bem antes (defesa comum, não Just Defend)
    { name: "defesa", a: "lua", b: "volt", stage: "dojo", setup: near, each: (w) => (w.fighters[0].x = w.fighters[1].x - 32), script: (f) => [f === 0 ? C : 0, Btn.R], on: "guard", after: 2 },
    {
      name: "guardcrush", a: "lua", b: "brasa", stage: "metro",
      setup: (w) => { near(w); w.fighters[1].guardMeter = 1; },
      each: (w) => (w.fighters[0].x = w.fighters[1].x - 32),
      script: (f) => [f === 0 ? C : 0, Btn.R], on: "guardcrush", after: 4,
    },
    // P2 começa um golpe forte, P1 acerta um fraco no meio dele: contra-ataque
    { name: "counter", a: "kaze", b: "tita", stage: "dojo", setup: near, script: (f) => [f === 2 ? A : 0, f === 0 ? C : 0], on: "counter", after: 3 },
    {
      name: "super", a: "kenshi", b: "lua", stage: "dojo",
      setup: (w) => { near(w); w.fighters[0].power = 1000; },
      script: (f) => { const m = superMacro("kenshi"); return [m[f] ?? 0, 0]; }, on: "super", after: 6,
    },
    {
      name: "ko", a: "lua", b: "volt", stage: "pelourinho",
      setup: (w) => { near(w); w.fighters[1].life = 1; },
      script: (f) => [f === 0 ? C : 0, 0], on: "ko", after: 6,
    },
  ];

  const report: string[] = [];
  for (const sc of scenes) {
    const w = createWorld({ chars: [sc.a, sc.b], stageId: sc.stage, seed: 3, roundsToWin: 2, roundTime: 99 }, roster);
    const r = new FightRenderer();
    let f = 0;
    for (; f < 400 && w.roundState !== 2; f++) {
      stepWorld(w, [0, 0], roster);
      r.addEvents(w.events, w, roster);
    }
    for (let i = 0; i < 45; i++) {
      stepWorld(w, [0, i > 10 ? Btn.R : 0], roster);
      r.addEvents(w.events, w, roster);
    }
    sc.setup?.(w);
    let left = -1;
    const seen: string[] = [];
    for (let i = 0; i < 200; i++) {
      if (left < 0) sc.each?.(w);
      stepWorld(w, sc.script(i), roster);
      r.addEvents(w.events, w, roster);
      for (const e of w.events) if (e.kind !== "sound") seen.push(`${i}:${e.kind}`);
      if (left < 0 && w.events.some((e) => e.kind === sc.on)) left = sc.after;
      else if (left > 0) left--;
      if (left === 0) break;
    }
    report.push(`${sc.name}: ${left === 0 ? "ok" : `evento ${sc.on} não aconteceu`} (P1 hitpause ${w.fighters[0].hitPause}, P2 hitpause ${w.fighters[1].hitPause}) ${left === 0 ? "" : seen.join(" ") + ` st ${w.fighters[0].stateNo}/${w.fighters[1].stateNo} x ${w.fighters[0].x.toFixed(0)}/${w.fighters[1].x.toFixed(0)} rs ${w.roundState}`}`);
    const surface = state.CK.MakeSurface(W, H);
    const rec = state.Skia.PictureRecorder();
    const c = rec.beginRecording(state.Skia.XYWHRect(0, 0, W, H));
    r.draw(c, { world: w, roster, atlases, stageImages: stageImages[sc.stage], width: W, height: H });
    const pic = rec.finishRecordingAsPicture();
    surface.getCanvas().drawPicture(pic.ref);
    surface.flush();
    writeFileSync(`${OUT}/gamefeel-${sc.name}.png`, Buffer.from(surface.makeImageSnapshot().encodeToBytes()));
  }
  // eslint-disable-next-line no-console
  console.log(report.join("\n"));
}, 120_000);
