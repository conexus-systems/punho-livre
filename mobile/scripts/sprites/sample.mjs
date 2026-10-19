#!/usr/bin/env node
// Gera uma pasta de exemplo para o importador (PNGs simples feitos com CanvasKit +
// manifest.json + .cns/.cmd mínimos). Serve de teste e de modelo para a produção.
//
//   node scripts/sprites/sample.mjs <pasta>
//   npm run import-sprites -- <pasta> --pack
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { initPainter } from "../roster/paint.mjs";
import { RECOMMENDED_ACTIONS, REQUIRED_ACTIONS } from "./actions.mjs";

export const SAMPLE_PPU = 2;
const W = 160;
const H = 240;
/** Ponto no chão entre os pés, em pixels da imagem. */
export const SAMPLE_AXIS = [80, 230];

/** Desenha um boneco: tronco, cabeça e, se `reach` > 0, um braço esticado (o golpe). */
function figure(CK, color, { lean = 0, reach = 0, crouch = false } = {}) {
  const surface = CK.MakeSurface(W, H);
  const c = surface.getCanvas();
  c.clear(CK.TRANSPARENT);
  const paint = new CK.Paint();
  paint.setAntiAlias(true);
  paint.setColor(CK.Color(...color, 1));
  const top = crouch ? 110 : 40;
  const [ax, ay] = SAMPLE_AXIS;
  c.drawRect(CK.LTRBRect(ax - 22 + lean, top + 30, ax + 22 + lean, ay), paint);
  c.drawCircle(ax + lean, top + 14, 16, paint);
  if (reach > 0) c.drawRect(CK.LTRBRect(ax + lean, top + 40, ax + lean + reach, top + 52), paint);
  paint.delete();
  const img = surface.makeImageSnapshot();
  const png = img.encodeToBytes();
  img.delete();
  surface.delete();
  return Buffer.from(png);
}

const CNS = `; Personagem de exemplo do importador de sprites
[Data]
life = 1000
power = 3000
attack = 100
defence = 100

[Size]
xscale = 1
yscale = 1
ground.back = 15
ground.front = 16
height = 60

[Velocity]
walk.fwd = 2.4
walk.back = -2.2
jump.neu = 0, -8.4
jump.back = -2.55
jump.fwd = 2.5

[Movement]
yaccel = .44
stand.friction = .85
crouch.friction = .82

[Statedef 200]
type = S
movetype = A
physics = S
anim = 200
ctrl = 0
velset = 0, 0

[State 200, golpe]
type = HitDef
trigger1 = AnimElem = 2
attr = S, NA
animtype = Light
damage = 30, 4
guardflag = MA
hitflag = MAF
pausetime = 8, 8
ground.type = High
ground.slidetime = 8
ground.hittime = 12
ground.velocity = -5
air.velocity = -3, -4

[State 200, fim]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1
`;

const CMD = `; Comandos do personagem de exemplo
[Command]
name = "x"
command = x
time = 1

[Statedef -1]

[State -1, Soco]
type = ChangeState
value = 200
triggerall = command = "x"
triggerall = statetype = S
trigger1 = ctrl
`;

/** Escreve a pasta de exemplo. `omit` tira ações do manifest (para testar erros). */
export async function writeSampleFolder(dir, { omit = [], recommended = true } = {}) {
  const CK = await initPainter();
  mkdirSync(dir, { recursive: true });
  const art = {
    "idle_000.png": figure(CK, [70, 110, 200]),
    "idle_001.png": figure(CK, [70, 110, 200], { lean: 2 }),
    "crouch_000.png": figure(CK, [70, 110, 200], { crouch: true }),
    "jab_000.png": figure(CK, [200, 120, 60], { lean: 4 }),
    "jab_001.png": figure(CK, [220, 90, 50], { lean: 6, reach: 50 }),
    "hit_000.png": figure(CK, [180, 60, 60], { lean: -8 }),
  };
  for (const [f, png] of Object.entries(art)) writeFileSync(path.join(dir, f), png);

  // caixas em pixels relativos ao axis (y negativo para cima), como no .air
  const body = [[-24, -190, 24, 0]];
  const crouchBody = [[-24, -120, 24, 0]];
  const frame = (file, ticks, extra = {}) => ({ file, ticks, axis: SAMPLE_AXIS, flipH: false, clsn2: body, ...extra });
  const anims = {};
  const ids = [...REQUIRED_ACTIONS, ...(recommended ? RECOMMENDED_ACTIONS : [])].map(([n]) => n);
  for (const n of ids) {
    const crouch = [10, 11, 12, 131, 151, 5010, 5011, 5012].includes(n);
    const hit = n >= 5000 && n < 5200;
    const file = crouch ? "crouch_000.png" : hit ? "hit_000.png" : "idle_000.png";
    anims[n] = { loop: true, loopStart: 0, frames: [frame(file, n === 0 ? 8 : 4, crouch ? { clsn2: crouchBody } : {})] };
  }
  anims[0].frames.push(frame("idle_001.png", 8));
  anims[200] = {
    loop: false,
    loopStart: 0,
    frames: [
      frame("jab_000.png", 3),
      frame("jab_001.png", 4, { clsn1: [[20, -160, 106, -136]], clsn2: [...body, [20, -158, 60, -138]] }),
      frame("jab_000.png", 6),
    ],
  };
  for (const n of omit) delete anims[n];

  const manifest = {
    id: "exemplo",
    name: "Exemplo",
    author: "BAMBA",
    pixelsPerUnit: SAMPLE_PPU,
    style: { body: "#4670C8", energy: "#60A5FA" },
    meta: { bio: "Boneco de teste do importador de sprites." },
    anims,
    cns: "exemplo.cns",
    cmd: "exemplo.cmd",
  };
  writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(path.join(dir, "exemplo.cns"), CNS);
  writeFileSync(path.join(dir, "exemplo.cmd"), CMD);
  return manifest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("uso: node scripts/sprites/sample.mjs <pasta>");
    process.exit(1);
  }
  await writeSampleFolder(path.resolve(dir));
  console.log(`pasta de exemplo em ${dir}`);
}
