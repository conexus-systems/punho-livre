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

  const scenes: { name: string; a: string; b: string; stage: string; script: (f: number) => [number, number]; frames: number }[] = [
    { name: "intro", a: "kaze", b: "tita", stage: "dojo", frames: 30, script: () => [0, 0] },
    { name: "soco", a: "kaze", b: "tita", stage: "dojo", frames: 400 + 45, script: (f) => (f < 400 ? [0, 0] : f < 440 ? [Btn.R, 0] : [Btn.y, 0]) },
    { name: "projetil", a: "sombra", b: "volt", stage: "metro", frames: 400 + 30, script: (f) => {
      const seq = [Btn.D, Btn.D | Btn.R, Btn.R, Btn.x];
      return f >= 400 && f < 404 ? [seq[f - 400], 0] : [0, 0];
    } },
    { name: "chute-alto", a: "brasa", b: "yuki", stage: "pelourinho", frames: 400 + 40, script: (f) => (f < 400 ? [0, 0] : f < 425 ? [Btn.R, Btn.L] : [Btn.c, 0]) },
  ];

  for (const sc of scenes) {
    const w = createWorld({ chars: [sc.a, sc.b], stageId: sc.stage, seed: 3, roundsToWin: 2, roundTime: 99 }, roster);
    const r = new FightRenderer();
    for (let f = 0; f < sc.frames; f++) {
      stepWorld(w, sc.script(f), roster);
      r.addEvents(w.events, w, roster);
    }
    const surface = state.CK.MakeSurface(W, H);
    const canvas = state.Skia.Canvas ? null : null;
    void canvas;
    const rec = state.Skia.PictureRecorder();
    const c = rec.beginRecording(state.Skia.XYWHRect(0, 0, W, H));
    r.draw(c, { world: w, roster, atlases, names: [roster[sc.a].displayName, roster[sc.b].displayName], width: W, height: H, debugBoxes: sc.name === "soco" });
    const pic = rec.finishRecordingAsPicture();
    const skCanvas = surface.getCanvas();
    skCanvas.drawPicture(pic.ref);
    surface.flush();
    const img = surface.makeImageSnapshot();
    const png = img.encodeToBytes();
    writeFileSync(`${OUT}/${sc.name}.png`, Buffer.from(png));
  }
}, 60_000);
