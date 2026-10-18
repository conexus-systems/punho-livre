import { mkdirSync, writeFileSync } from "node:fs";

jest.mock("react-native", () => ({ Platform: { select: (o: any) => o.default, OS: "android" } }));

import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import { Btn } from "@/src/engine/input";
import type { CharacterData } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";

import { initSkia, state } from "./skia-node";

const OUT = process.env.PREVIEW_OUT ?? "/tmp/mugen-preview";

test("renderiza cenas de luta", async () => {
  await initSkia();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FightRenderer } = require("@/src/game/renderer");
  const roster: Record<string, CharacterData> = {};
  for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);
  const atlases: Record<string, any[]> = {};
  for (const id of BUILTIN_ORDER) {
    atlases[id] = [0].map((i) => {
      const bytes = require("node:fs").readFileSync(`${__dirname}/../../characters/${id}/sprites${i}.png`);
      return state.Skia.Image.MakeImageFromEncoded(state.Skia.Data.fromBytes(new Uint8Array(bytes)));
    });
  }
  mkdirSync(OUT, { recursive: true });
  const W = 844, H = 390;

  type Scene = {
    name: string;
    a: string;
    b: string;
    stage: string;
    script: (f: number) => [number, number];
    frames: number;
    teams?: [string[], string[]];
    /** Ajuste no início da luta (frame 400), ex.: dar estoques. */
    setup?: (w: any) => void;
  };
  // botões no padrão SNK: A = x, B = a, C = z, D = c
  const A = Btn.x, B = Btn.a, C = Btn.z, D = Btn.c;
  const scenes: Scene[] = [
    { name: "intro", a: "kaze", b: "tita", stage: "dojo", frames: 30, script: () => [0, 0] },
    { name: "soco", a: "kaze", b: "tita", stage: "dojo", frames: 400 + 45, script: (f) => (f < 400 ? [0, 0] : f < 440 ? [Btn.R, 0] : [Btn.y, 0]) },
    { name: "projetil", a: "sombra", b: "volt", stage: "metro", frames: 400 + 30, script: (f) => {
      const seq = [Btn.D, Btn.D | Btn.R, Btn.R, Btn.x];
      return f >= 400 && f < 404 ? [seq[f - 400], 0] : [0, 0];
    } },
    { name: "chute-alto", a: "brasa", b: "yuki", stage: "pelourinho", frames: 400 + 40, script: (f) => (f < 400 ? [0, 0] : f < 425 ? [Btn.R, Btn.L] : [Btn.c, 0]) },
    // sistema SNK
    {
      name: "max", a: "kenshi", b: "lua", stage: "dojo", frames: 400 + 52,
      teams: [["kenshi", "kaze", "tita"], ["lua", "volt", "yuki"]],
      setup: (w) => { w.fighters[0].power = 2600; w.fighters[1].power = 1200; w.fighters[1].life = 210; },
      script: (f) => (f === 400 ? [A | B | C, 0] : f > 430 && f < 436 ? [Btn.R, 0] : [0, 0]),
    },
    {
      name: "blowback", a: "lua", b: "kenshi", stage: "metro", frames: 400 + 32,
      setup: (w) => { w.fighters[0].x = -20; w.fighters[1].x = 20; },
      script: (f) => (f === 400 ? [C | D, 0] : [0, 0]),
    },
    {
      name: "arremesso", a: "tita", b: "brasa", stage: "pelourinho", frames: 400 + 22,
      setup: (w) => { w.fighters[0].x = -20; w.fighters[1].x = 20; },
      script: (f) => (f === 400 ? [Btn.L | C, 0] : [0, 0]),
    },
    {
      name: "just-defend", a: "kaze", b: "volt", stage: "dojo", frames: 400 + 22,
      setup: (w) => { w.fighters[0].x = -16; w.fighters[1].x = 16; },
      script: (f) => (f === 400 ? [C, 0] : f >= 403 ? [0, Btn.R] : [0, 0]),
    },
  ];

  for (const sc of scenes) {
    const w = createWorld({ chars: [sc.a, sc.b], teams: sc.teams, stageId: sc.stage, seed: 3, roundsToWin: 2, roundTime: 99 }, roster);
    const r = new FightRenderer();
    for (let f = 0; f < sc.frames; f++) {
      if (f === 400) sc.setup?.(w);
      stepWorld(w, sc.script(f), roster);
      r.addEvents(w.events, w, roster);
    }
    const surface = state.CK.MakeSurface(W, H);
    const canvas = state.Skia.Canvas ? null : null;
    void canvas;
    const rec = state.Skia.PictureRecorder();
    const c = rec.beginRecording(state.Skia.XYWHRect(0, 0, W, H));
    r.draw(c, { world: w, roster, atlases, width: W, height: H, debugBoxes: sc.name === "soco" });
    const pic = rec.finishRecordingAsPicture();
    const skCanvas = surface.getCanvas();
    skCanvas.drawPicture(pic.ref);
    surface.flush();
    const img = surface.makeImageSnapshot();
    const png = img.encodeToBytes();
    writeFileSync(`${OUT}/${sc.name}.png`, Buffer.from(png));
  }
}, 60_000);
