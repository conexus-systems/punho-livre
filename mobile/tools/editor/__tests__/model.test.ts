import { BUILTIN } from "@/src/characters/builtin.generated";
import { parseAir } from "@/src/engine/mugen/air";

import { charFromManifest, charFromPack, dragBox, engineAnims, exportAir, exportManifest, measure, type Manifest } from "../model";

describe("modelo do editor", () => {
  it("embutido: exportar o .air sem mexer devolve as mesmas animações", () => {
    const pack = BUILTIN.kaze.pack;
    const c = charFromPack(pack);
    expect(parseAir(exportAir(c))).toEqual(parseAir(pack.files["kaze.air"]));
  });

  it("embutido: caixa e ticks editados chegam ao .air e à frame data", () => {
    const c = charFromPack(BUILTIN.kaze.pack);
    const f = c.anims[200].frames[1];
    const x2 = f.clsn1[0].x2;
    f.clsn1[0] = dragBox(f.clsn1[0], "e", 5, 0);
    f.time = 6;
    const anims = parseAir(exportAir(c));
    expect(anims[200].frames[1].clsn1[0].x2).toBe(x2 + 5);
    expect(anims[200].frames[1].time).toBe(6);
    const jab = measure(c).data.moves.find((m) => m.state === 200)!;
    expect(jab.active).toBe(5);
  });

  it("manifest: caixas em pixels viram unidades no .air e voltam iguais no manifest", () => {
    const m: Manifest = {
      id: "teste",
      name: "Teste",
      pixelsPerUnit: 2,
      cns: "t.cns",
      cmd: "t.cmd",
      author: "x",
      anims: {
        "0": { loop: true, loopStart: 0, frames: [{ file: "a.png", ticks: 5, axis: [64, 120], flipH: false, clsn2: [[-20, -180, 20, 0]] }] },
        "200": { loop: false, loopStart: 0, frames: [{ file: "b.png", ticks: 4, axis: [64, 120], clsn1: [[21, -101, 80, -80]], clsn2: [] }, { file: "a.png", ticks: 6, axis: [64, 120] }] },
      },
    };
    const c = charFromManifest(m, { "t.cns": "", "t.cmd": "" });
    const anims = engineAnims(c);
    expect(anims[200].frames[0].clsn1[0]).toEqual({ x1: 11, y1: -50, x2: 40, y2: -40 }); // Math.round, como o importador
    expect([anims[200].frames[1].group, anims[200].frames[1].index]).toEqual([0, 0]);
    const out = exportManifest(c);
    expect(out.author).toBe("x");
    expect(out.anims["200"].frames[0]).toMatchObject({ file: "b.png", ticks: 4, axis: [64, 120], clsn1: [[21, -101, 80, -80]] });
    expect(out.anims["0"].frames[0].clsn2).toEqual([[-20, -180, 20, 0]]);
  });

  it("dragBox normaliza caixa invertida", () => {
    expect(dragBox({ x1: 0, y1: -10, x2: 10, y2: 0 }, "e", -20, 0)).toEqual({ x1: -10, y1: -10, x2: 0, y2: 0 });
  });
});
