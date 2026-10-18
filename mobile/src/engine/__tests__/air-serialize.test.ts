import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { parseAir, serializeAir } from "../mugen/air";

describe("serializeAir", () => {
  it("volta ao mesmo resultado no parseAir (elenco inteiro)", () => {
    for (const id of BUILTIN_ORDER) {
      const pack = BUILTIN[id].pack;
      const anims = parseAir(pack.files[`${id}.air`]);
      expect(parseAir(serializeAir(anims, `${id}\nteste`))).toEqual(anims);
    }
  });

  it("escreve loopstart, flip e caixas de cada quadro", () => {
    const text = [
      "[Begin Action 7]",
      "Clsn2Default: 1",
      " Clsn2[0] = -10, -80, 10, 0",
      "7,0, 0,0, 3",
      "Clsn1: 1",
      " Clsn1[0] = 15, -60, 50.5, -50",
      "7,1, 2,-1, 4, H",
      "Loopstart",
      "7,2, 0,0, -1",
    ].join("\n");
    const anims = parseAir(text);
    const out = serializeAir(anims);
    expect(out).toContain("Loopstart");
    expect(out).toContain("7, 1, 2, -1, 4, H");
    expect(out).toContain(" Clsn1[0] = 15, -60, 50.5, -50");
    expect(parseAir(out)).toEqual(anims);
  });
});
