// node --test scripts/__tests__
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadTs } from "../lib/ts-bundle.mjs";
import { REQUIRED_ACTIONS } from "../sprites/actions.mjs";
import { ImportError, importSprites } from "../sprites/import.mjs";
import { SAMPLE_AXIS, writeSampleFolder } from "../sprites/sample.mjs";

const tmp = (name) => mkdtempSync(path.join(tmpdir(), `sprites-${name}-`));

async function failure(dir, opts) {
  try {
    await importSprites(dir, opts);
  } catch (err) {
    assert.ok(err instanceof ImportError, `esperava ImportError, veio ${err}`);
    return err.errors.join("\n");
  }
  assert.fail("a importação deveria falhar");
}

test("importa a pasta de exemplo: atlas WebP, sprites.json, AIR em unidades e pack que a engine carrega", async () => {
  const dir = tmp("ok");
  await writeSampleFolder(dir);
  const r = await importSprites(dir, { pack: true });
  for (const f of ["exemplo.def", "exemplo.air", "exemplo.cns", "exemplo.cmd", "sprites0.webp", "sprites.json", "meta.json", "exemplo.pack.json"]) {
    assert.ok(existsSync(path.join(r.out, f)), `${f} não foi gerado`);
  }
  const webp = readFileSync(path.join(r.out, "sprites0.webp"));
  assert.equal(webp.subarray(0, 4).toString("latin1"), "RIFF");
  assert.equal(webp.subarray(8, 12).toString("latin1"), "WEBP");

  // 6 PNGs distintos → 6 sprites; grupo = ação onde aparece primeiro
  const sheet = JSON.parse(readFileSync(path.join(r.out, "sprites.json"), "utf8"));
  assert.equal(sheet.scale, 2);
  assert.deepEqual(Object.keys(sheet.frames).sort(), ["0,0", "0,1", "10,0", "200,0", "200,1", "5000,0"]);
  // transparência recortada: o boneco tem 44 px de largura (não 160) e o eixo acompanha o recorte
  const [, , w, h, ax, ay] = sheet.frames["0,0"];
  assert.equal(w, 44);
  assert.equal(h, 192);
  assert.equal(ax, SAMPLE_AXIS[0] - 58);
  assert.equal(ay, 192);

  // caixas: pixels relativos ao axis ÷ pixelsPerUnit
  const engine = await loadTs("scripts/sprites/engine.ts");
  const anims = engine.parseAir(readFileSync(path.join(r.out, "exemplo.air"), "utf8"));
  assert.deepEqual(anims[200].frames[1].clsn1, [{ x1: 10, y1: -80, x2: 53, y2: -68 }]);
  assert.deepEqual(anims[200].frames.map((f) => f.time), [3, 4, 6]);
  assert.deepEqual([anims[200].frames[1].group, anims[200].frames[1].index], [200, 1]);
  for (const [n] of REQUIRED_ACTIONS) assert.ok(anims[n], `ação ${n} ausente no AIR`);

  const pack = JSON.parse(readFileSync(path.join(r.out, "exemplo.pack.json"), "utf8"));
  assert.equal(pack.format, "mugen-arena-pack/1");
  assert.match(pack.sprites.atlas[0], /^data:image\/webp;base64,/);
  const ch = engine.loadCharacter(pack);
  assert.equal(ch.name, "Exemplo");
  assert.equal(ch.style.body, "#4670C8");
  assert.ok(ch.states[200]);
  assert.deepEqual(ch.unsupported, []);
  rmSync(dir, { recursive: true, force: true });
});

test("a saída é determinística", async () => {
  const dir = tmp("det");
  await writeSampleFolder(dir);
  const a = await importSprites(dir, { out: path.join(dir, "a") });
  const b = await importSprites(dir, { out: path.join(dir, "b") });
  for (const f of ["exemplo.air", "sprites.json", "sprites0.webp", "exemplo.def"]) {
    assert.ok(readFileSync(path.join(a.out, f)).equals(readFileSync(path.join(b.out, f))), `${f} mudou entre duas importações`);
  }
  rmSync(dir, { recursive: true, force: true });
});

test("erros claros: quadro faltando, axis fora da imagem, ação obrigatória ausente", async () => {
  const dir = tmp("err");
  await writeSampleFolder(dir, { omit: [0, 5120] });
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  manifest.anims[200].frames[1].file = "jab_999.png";
  manifest.anims[20].frames[0].axis = [500, 230];
  manifest.anims[11].frames[0].ticks = 0;
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));

  const msg = await failure(dir);
  assert.match(msg, /ação 200, quadro 1: arquivo "jab_999.png" não existe/);
  assert.match(msg, /ação 20, quadro 0: axis \[500, 230\] fora da imagem "idle_000.png" \(160x240\)/);
  assert.match(msg, /ação 11, quadro 0: "ticks" precisa ser inteiro/);
  assert.match(msg, /ações obrigatórias do common1 ausentes: 0 \(parado \(loop\)\), 5120 \(levantar\)/);
  rmSync(dir, { recursive: true, force: true });
});

test("ação usada pelo .cns precisa existir; --allow-missing só rebaixa as obrigatórias", async () => {
  const dir = tmp("ref");
  await writeSampleFolder(dir, { omit: [200, 5120] });
  const msg = await failure(dir, { allowMissing: true });
  assert.match(msg, /a ação 200 é usada em exemplo\.cns, estado 200, mas não está no manifest/);
  assert.doesNotMatch(msg, /obrigatórias/);

  await writeSampleFolder(dir, { omit: [5120] });
  const r = await importSprites(dir, { allowMissing: true });
  assert.ok(r.warnings.some((w) => w.includes("5120")));
  rmSync(dir, { recursive: true, force: true });
});
