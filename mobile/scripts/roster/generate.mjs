#!/usr/bin/env node
// Gera o elenco nativo em formato MUGEN (.def/.air/.cmd/.cns) + atlas de sprites.
//
//   node scripts/roster/generate.mjs            # todos
//   node scripts/roster/generate.mjs kaze yuki  # só alguns
//
// Saída: mobile/characters/<id>/ — arquivos versionados no repositório. Depois
// rode `npm run characters` para atualizar src/characters/builtin.generated.ts.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ROSTER } from "./characters.mjs";
import { POSES } from "./poses.mjs";
import { encodeWebP, initPainter, paintFighter, paintProjectile } from "./paint.mjs";
import { packAtlas } from "./raster.mjs";
import { boxes, proportions, solve } from "./rig.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../characters");
const SCALE = 2.6; // pixels por unidade do MUGEN
const H_ = true; // marca frame ativo (Clsn1)

// --------------------------------------------------------- animações

const F = (frames, loopStart = 0) => ({ frames, loopStart });

function commonAnims() {
  const walk = ["walk1", "walk2", "walk3", "walk4", "walk5", "walk6"].map((p) => [p, 5]);
  return {
    // respiração com quadros intermediários (pose "a~b" = meio caminho)
    0: F([["stand1", 5], ["stand1~stand2", 5], ["stand2", 5], ["stand2~stand3", 5], ["stand3", 5], ["stand3~stand2", 5], ["stand2", 5], ["stand2~stand1", 5]]),
    5: F([["turn", 3]]),
    6: F([["crouch1", 3]]),
    10: F([["crouchDown", 3]]),
    11: F([["crouch1", 14], ["crouch2", 14]]),
    12: F([["crouchDown", 3]]),
    20: F(walk),
    21: F([...walk].reverse()),
    40: F([["jumpStart", 3]]),
    41: F([["jumpUp", -1]]),
    42: F([["jumpFwd", -1]]),
    43: F([["jumpBack", -1]]),
    44: F([["jumpDown", -1]]),
    45: F([["jumpDown", -1]]),
    46: F([["jumpDown", -1]]),
    47: F([["land", 3]]),
    100: F([["run1", 4], ["run2", 4], ["run3", 4], ["run2", 4]]),
    105: F([["hopBack", -1]]),
    120: F([["guard", 2]]),
    121: F([["guardCrouch", 2]]),
    122: F([["guardAir", 2]]),
    130: F([["guard", -1]]),
    131: F([["guardCrouch", -1]]),
    132: F([["guardAir", -1]]),
    140: F([["guard", 2]]),
    141: F([["guardCrouch", 2]]),
    142: F([["guardAir", 2]]),
    150: F([["guardHit", -1]]),
    151: F([["guardCrouchHit", -1]]),
    152: F([["guardAir", -1]]),
    170: F([["lose", -1]]),
    180: F([["win1", 6]]),
    181: F([["win1", 12], ["win2", -1]]),
    190: F([["intro1", 35], ["intro2", 35], ["stand1", 10]]),
    5000: F([["hitLight", -1]]),
    5001: F([["hitMedium", -1]]),
    5002: F([["hitHard", -1]]),
    5010: F([["hitCrouch", -1]]),
    5011: F([["hitCrouch", -1]]),
    5012: F([["hitCrouch", -1]]),
    5030: F([["hitAir", -1]]),
    5050: F([["fall", -1]]),
    5100: F([["bounce", -1]]),
    5110: F([["lie", -1]]),
    5120: F([["getUp1", 8], ["getUp2", 8], ["stand1", 4]]),
    // sistema SNK (estados 6000+ do common1 da engine)
    6000: F([["crouchDown", 2], ["roll1", 4], ["roll2", 4], ["roll3", 4], ["roll4", 4], ["roll1", 3], ["crouchDown", 3]]),
    6001: F([["crouchDown", 2], ["roll4", 4], ["roll3", 4], ["roll2", 4], ["roll1", 4], ["roll4", 3], ["crouchDown", 3]]),
    6010: F([["blowWind", 9], ["blow", 6, H_], ["blow", 8], ["roundWind", 8]]),
    6015: F([["jumpUp", 4], ["airBlow", 10, H_], ["airBlow", -1]]),
    6030: F([["grab", 12], ["toss", 14], ["stand3", 10]]),
    6040: F([["hitHard", -1]]),
    6050: F([["guardHit", 10], ["stand3", 8]]),
    6060: F([["dizzy1", 10], ["dizzy2", 10]]),
    6070: F([["maxPose", 12], ["superPose", 18]]),
  };
}

// --------------------------------------------------------- golpes normais

const NORMALS = [
  { no: 200, cmds: ["x"], st: "S", frames: [["jabWind", 2], ["jab", 4, H_], ["jabWind", 5]], dmg: [22, 3], at: "Light", gvel: -4.5, hittime: 12, pause: [7, 7], chainFrom: [] },
  { no: 210, cmds: ["y"], st: "S", frames: [["straightWind", 4], ["straight", 5, H_], ["straightWind", 8]], dmg: [45, 6], at: "Medium", gvel: -6, hittime: 15, pause: [10, 10], chainFrom: [200, 230, 400] },
  { no: 220, cmds: ["z"], st: "S", frames: [["hookWind", 6], ["hook", 5, H_], ["hookFollow", 12]], dmg: [72, 9], at: "Hard", gvel: -5, hittime: 18, pause: [12, 12], avel: [-3, -7], chainFrom: [200, 210, 230, 400] },
  { no: 230, cmds: ["a"], st: "S", frames: [["shortKickWind", 3], ["shortKick", 4, H_], ["shortKickWind", 6]], dmg: [28, 4], at: "Light", gvel: -5, hittime: 12, pause: [8, 8], chainFrom: [200] },
  { no: 240, cmds: ["b"], st: "S", frames: [["midKickWind", 5], ["midKick", 5, H_], ["midKickWind", 9]], dmg: [50, 7], at: "Medium", gvel: -6.5, hittime: 16, pause: [10, 10], chainFrom: [200, 230, 430] },
  { no: 250, cmds: ["c"], st: "S", frames: [["roundWind", 7], ["roundhouse", 6, H_], ["roundWind", 14]], dmg: [82, 10], at: "Hard", gvel: -7.5, hittime: 20, pause: [13, 13], avel: [-4, -6], chainFrom: [210, 240] },
  { no: 400, cmds: ["x", "y"], st: "C", frames: [["crouch1", 2], ["crouchJab", 4, H_], ["crouch1", 5]], dmg: [20, 3], at: "Light", gvel: -4, hittime: 11, pause: [7, 7], chainFrom: [400, 430] },
  { no: 410, cmds: ["z"], st: "C", frames: [["crouchUpperWind", 5], ["crouchUpper", 6, H_], ["crouchUpper", 10], ["crouch1", 6]], dmg: [68, 8], at: "Hard", gvel: -4, hittime: 18, pause: [12, 12], avel: [-2.5, -7.5], chainFrom: [400, 430] },
  { no: 430, cmds: ["a", "b"], st: "C", frames: [["crouch1", 3], ["crouchKick", 5, H_], ["crouch1", 6]], dmg: [30, 4], at: "Light", gvel: -5, hittime: 12, pause: [8, 8], guard: "L", chainFrom: [400] },
  { no: 440, cmds: ["c"], st: "C", frames: [["crouch1", 5], ["sweep1", 4, H_], ["sweep2", 6], ["crouch1", 12]], dmg: [60, 8], at: "Hard", gvel: -2, hittime: 20, pause: [10, 10], guard: "L", trip: true, chainFrom: [400, 430] },
  { no: 600, cmds: ["x", "y"], st: "A", frames: [["jumpUp", 2], ["airPunch", 8, H_], ["airPunch", -1]], dmg: [40, 5], at: "Medium", gvel: -4, hittime: 14, pause: [8, 8], guard: "HA" },
  { no: 610, cmds: ["z"], st: "A", frames: [["jumpUp", 3], ["airHammer", 6, H_], ["airHammer", -1]], dmg: [66, 8], at: "Hard", gvel: -5, hittime: 18, pause: [11, 11], guard: "HA" },
  { no: 630, cmds: ["a", "b"], st: "A", frames: [["jumpUp", 2], ["airKick", 10, H_], ["airKick", -1]], dmg: [45, 5], at: "Medium", gvel: -5, hittime: 15, pause: [9, 9], guard: "HA" },
  { no: 640, cmds: ["c"], st: "A", frames: [["jumpUp", 4], ["flyingKick", 8, H_], ["flyingKick", -1]], dmg: [72, 8], at: "Hard", gvel: -6, hittime: 18, pause: [12, 12], guard: "HA" },
];

// --------------------------------------------------------- texto CNS

function hitDef(stateNo, label, trigger, o) {
  const lines = [
    `[State ${stateNo}, ${label}]`,
    "type = HitDef",
    ...[].concat(trigger).map((t, i) => `trigger${i + 1} = ${t}`),
    `attr = ${o.attr ?? "S, NA"}`,
    `animtype = ${o.at ?? "Light"}`,
    `damage = ${o.dmg[0]}, ${o.dmg[1] ?? 0}`,
    // sem guardflag = imbloqueável (agarrões)
    ...(o.guard === "" ? [] : [`guardflag = ${o.guard ?? "MA"}`]),
    `hitflag = ${o.hitflag ?? "MAF"}`,
    `pausetime = ${o.pause?.[0] ?? 8}, ${o.pause?.[1] ?? 8}`,
    `ground.type = ${o.trip ? "Trip" : o.gtype ?? "High"}`,
    `ground.slidetime = ${o.slide ?? Math.round((o.hittime ?? 12) * 0.6)}`,
    `ground.hittime = ${o.hittime ?? 12}`,
    `ground.velocity = ${o.gvel ?? -5}${o.gvely ? `, ${o.gvely}` : ""}`,
    `air.velocity = ${(o.avel ?? [-3, -4]).join(", ")}`,
    `air.fall = ${o.airfall ?? 1}`,
    `fall = ${o.fall ?? (o.trip ? 1 : 0)}`,
  ];
  if (o.p1stateno !== undefined) lines.push(`p1stateno = ${o.p1stateno}`);
  if (o.extra) lines.push(...o.extra);
  return lines.join("\n");
}

function statedef(no, o) {
  const lines = [`[Statedef ${no}]`, `type = ${o.type ?? "S"}`, `movetype = ${o.movetype ?? "A"}`, `physics = ${o.physics ?? "S"}`];
  if (o.anim !== undefined) lines.push(`anim = ${o.anim}`);
  if (o.ctrl !== undefined) lines.push(`ctrl = ${o.ctrl}`);
  if (o.velset) lines.push(`velset = ${o.velset.join(", ")}`);
  if (o.poweradd) lines.push(`poweradd = ${o.poweradd}`);
  return lines.join("\n");
}

function ctrl(stateNo, label, type, triggers, params = {}) {
  const lines = [`[State ${stateNo}, ${label}]`, `type = ${type}`];
  triggers.forEach((t, i) => {
    for (const part of [].concat(t)) lines.push(`trigger${i + 1} = ${part}`);
  });
  for (const [k, v] of Object.entries(params)) lines.push(`${k} = ${v}`);
  return lines.join("\n");
}

const firstHitElem = (frames) => frames.findIndex((f) => f[2] === H_) + 1;

function normalStates(n) {
  const out = [];
  const air = n.st === "A";
  out.push(statedef(n.no, { type: n.st, physics: air ? "A" : n.st, anim: n.no, ctrl: 0, velset: air ? undefined : [0, 0], poweradd: Math.round(n.dmg[0] / 3) }));
  out.push(hitDef(n.no, "golpe", `AnimElem = ${firstHitElem(n.frames)}`, { ...n, attr: `${n.st}, NA` }));
  if (!air) {
    out.push(ctrl(n.no, "fim", "ChangeState", ["AnimTime = 0"], { value: n.st === "C" ? 11 : 0, ctrl: 1 }));
  }
  return out.join("\n\n");
}

// ------------------------------------------------------ especiais

// Cada template devolve { anims, states: string, triggerExtra?, projectiles: [{anim, kind}] }
const SPECIALS = {
  projectile(sp, base, ch) {
    const flight = base + 50;
    const burst = base + 60;
    const low = sp.low === true;
    const anims = {
      [base]: F([["palmWind", 8], ["palmThrust", 4], ["palmThrust", 18], ["stand3", 4]]),
      [flight]: F([[`proj:${sp.proj}:0`, 3], [`proj:${sp.proj}:1`, 3]]),
      [burst]: F([0, 1, 2, 3].map((i) => [`proj:burst:${i}`, 3])),
    };
    const offY = sp.proj === "wave" ? 0 : -Math.round(ch.H * 0.55);
    const states = [
      statedef(base, { anim: base, ctrl: 0, velset: [0, 0], poweradd: 40 }),
      [
        `[State ${base}, projetil]`,
        "type = Projectile",
        "trigger1 = AnimElem = 2",
        `projid = ${base}`,
        `projanim = ${flight}`,
        `projhitanim = ${burst}`,
        `projremovetime = ${sp.removetime ?? -1}`,
        `velocity = ${sp.speed}, 0`,
        `offset = ${Math.round(ch.H * 0.45)}, ${offY}`,
        "attr = S, SP",
        `damage = ${sp.damage}, ${Math.round(sp.damage / 6)}`,
        "animtype = Hard",
        `guardflag = ${low ? "L" : "MA"}`,
        "hitflag = MAF",
        "pausetime = 0, 14",
        "ground.type = High",
        "ground.slidetime = 12",
        "ground.hittime = 18",
        "ground.velocity = -6",
        "air.velocity = -4, -5",
        "air.fall = 1",
      ].join("\n"),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states, triggerAll: [`NumProjID(${base}) = 0`] };
  },

  rising(sp, base) {
    const poses = sp.kick
      ? [["risingWind", 3], ["flyingKick", 4, H_], ["airKick", 10, H_], ["jumpDown", -1]]
      : [["risingWind", 3], ["rising1", 4, H_], ["rising2", 12, H_], ["jumpDown", -1]];
    const anims = { [base]: F(poses) };
    const states = [
      statedef(base, { anim: base, ctrl: 0, velset: [0, 0], poweradd: 50 }),
      ctrl(base, "invencivel", "NotHitBy", ["Time = 0"], { value: "SCA", time: 7 }),
      ctrl(base, "sobe", "VelSet", ["AnimElem = 2"], { x: 2.2, y: -9.5 }),
      ctrl(base, "ar", "StateTypeSet", ["AnimElem = 2"], { statetype: "A", physics: "A" }),
      hitDef(base, "golpe", "AnimElem = 2", {
        attr: "S, SA",
        at: "Hard",
        dmg: [sp.damage, Math.round(sp.damage / 8)],
        pause: [10, 12],
        gvel: -3,
        gvely: -8,
        avel: [-3, -8],
        fall: 1,
        hittime: 20,
      }),
    ].join("\n\n");
    return { anims, states };
  },

  spin(sp, base) {
    const hits = sp.hits ?? 3;
    const frames = [["jumpStart", 3]];
    for (let i = 0; i < hits; i++) frames.push(["spinA", 5, H_], ["spinB", 5, H_]);
    frames.push(["jumpDown", 3]);
    const anims = { [base]: F(frames) };
    const states = [
      statedef(base, { type: "A", physics: "N", anim: base, ctrl: 0, poweradd: 45 }),
      ctrl(base, "sobe", "VelSet", ["Time = 0"], { x: 0, y: -3 }),
      ctrl(base, "avanca", "VelSet", ["Time = 6"], { x: 3.2, y: 0 }),
      hitDef(
        base,
        "golpe",
        Array.from({ length: hits * 2 }, (_, i) => `AnimElem = ${i + 2}`),
        { attr: "A, SA", at: "Medium", dmg: [sp.damage, 4], pause: [6, 8], gvel: -3, hittime: 14, avel: [-2, -4], airfall: 0 },
      ),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 50, ctrl: 0 }),
    ].join("\n\n");
    return { anims, states };
  },

  dash(sp, base) {
    const pose = sp.pose ?? "dashPunch";
    const anims = { [base]: F([[sp.low ? "crouch1" : "jabWind", 5], [pose, 14, H_], [sp.low ? "crouch1" : "stand3", 10]]) };
    const states = [
      statedef(base, { type: sp.low ? "C" : "S", physics: sp.low ? "C" : "S", anim: base, ctrl: 0, velset: [0, 0], poweradd: 40 }),
      ctrl(base, "corre", "VelSet", ["AnimElemTime(2) >= 0 && AnimElemTime(3) < 0"], { x: sp.speed ?? 6 }),
      ctrl(base, "freia", "VelSet", ["AnimElem = 3"], { x: 0 }),
      hitDef(base, "golpe", "AnimElem = 2", {
        attr: `${sp.low ? "C" : "S"}, SA`,
        at: "Hard",
        dmg: [sp.damage, Math.round(sp.damage / 8)],
        guard: sp.low ? "L" : "MA",
        trip: sp.low === true,
        pause: [10, 12],
        gvel: -7,
        hittime: 20,
        avel: [-4, -5],
        fall: sp.low ? 1 : 0,
      }),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: sp.low ? 11 : 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states };
  },

  cartwheel(sp, base) {
    const hits = sp.hits ?? 3;
    const frames = [["crouchDown", 3]];
    for (let i = 0; i < hits; i++) frames.push(["capoeira1", 5, H_], ["capoeira2", 5, H_]);
    frames.push(["crouch1", 6]);
    const anims = { [base]: F(frames) };
    const states = [
      statedef(base, { type: "S", physics: "S", anim: base, ctrl: 0, velset: [0, 0], poweradd: 45 }),
      ctrl(base, "anda", "VelSet", [`AnimElemTime(2) >= 0 && AnimElemTime(${hits * 2 + 2}) < 0`], { x: 3.4 }),
      hitDef(
        base,
        "golpe",
        Array.from({ length: hits * 2 }, (_, i) => `AnimElem = ${i + 2}`),
        { attr: "S, SA", at: "Medium", dmg: [sp.damage, 4], pause: [5, 8], gvel: -2.5, hittime: 14, avel: [-2, -4], airfall: 0 },
      ),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states };
  },

  teleport(_sp, base) {
    const anims = { [base]: F([["vanish", 6], ["__empty__", 10], ["crouchDown", 6]]) };
    const states = [
      statedef(base, { type: "S", movetype: "I", physics: "S", anim: base, ctrl: 0, velset: [0, 0] }),
      ctrl(base, "some", "NotHitBy", ["AnimElemTime(3) < 0"], { value: "SCA", time: 2 }),
      ctrl(base, "atras", "PosAdd", ["AnimElem = 2"], { x: "P2Dist X + 40" }),
      ctrl(base, "vira", "Turn", ["AnimElem = 3"]),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states, cost: 0 };
  },

  slam(sp, base, ch) {
    const flight = base + 50;
    const burst = base + 60;
    const anims = {
      [base]: F([["slamWind", 10], ["slam", 4, H_], ["slam", 16], ["crouch1", 8]]),
      [flight]: F([["proj:wave:0", 3], ["proj:wave:1", 3]]),
      [burst]: F([0, 1, 2, 3].map((i) => [`proj:burst:${i}`, 3])),
    };
    const states = [
      statedef(base, { anim: base, ctrl: 0, velset: [0, 0], poweradd: 50 }),
      hitDef(base, "golpe", "AnimElem = 2", {
        attr: "S, SA",
        at: "Hard",
        dmg: [sp.damage, Math.round(sp.damage / 8)],
        pause: [12, 14],
        gvel: -4,
        gvely: -6,
        fall: 1,
        hittime: 20,
        avel: [-3, -6],
      }),
      [
        `[State ${base}, onda]`,
        "type = Projectile",
        "trigger1 = AnimElem = 2",
        `projid = ${base}`,
        `projanim = ${flight}`,
        `projhitanim = ${burst}`,
        "projremovetime = 50",
        `velocity = ${sp.wave.speed}, 0`,
        `offset = ${Math.round(ch.H * 0.5)}, 0`,
        "attr = S, SP",
        `damage = ${sp.wave.damage}, 6`,
        "animtype = Medium",
        "guardflag = L",
        "hitflag = MA",
        "pausetime = 0, 12",
        "ground.type = Trip",
        "ground.hittime = 18",
        "ground.velocity = -3",
        "fall = 1",
      ].join("\n"),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states, triggerAll: [`NumProjID(${base}) = 0`] };
  },

  divekick(sp, base) {
    const anims = { [base]: F([["airKick", -1, H_]]) };
    const states = [
      statedef(base, { type: "A", physics: "N", anim: base, ctrl: 0, poweradd: 35 }),
      ctrl(base, "mergulha", "VelSet", ["1"], { x: 5, y: 6.5 }),
      hitDef(base, "golpe", "Time = 0", {
        attr: "A, SA",
        at: "Medium",
        dmg: [sp.damage, 6],
        guard: "HA",
        pause: [9, 10],
        gvel: -6,
        hittime: 16,
        avel: [-4, -4],
      }),
      ctrl(base, "quica", "VelSet", ["MoveContact = 1"], { x: -2, y: -5 }),
      ctrl(base, "quica2", "ChangeState", ["MoveContact = 1"], { value: 50, ctrl: 0 }),
      ctrl(base, "pousa", "ChangeState", ["Pos Y >= 0 && Time > 0"], { value: 52 }),
    ].join("\n\n");
    return { anims, states, air: true };
  },
};

// especiais adicionados na versão "tunada"
Object.assign(SPECIALS, {
  /** Agarrão de comando: imbloqueável, só de perto, derruba. */
  grab(sp, base) {
    const anims = {
      [base]: F([["grabWind", 4], ["grabReach", 5, H_], ["grabReach", 14], ["stand3", 4]]),
      [base + 1]: F([["grab", 6], ["toss", 10], ["slam", 10], ["crouch1", 8]]),
    };
    const states = [
      statedef(base, { anim: base, ctrl: 0, velset: [0, 0], poweradd: 40 }),
      ctrl(base, "avanca", "VelSet", ["AnimElem = 2"], { x: 2 }),
      ctrl(base, "freia", "VelSet", ["AnimElem = 3"], { x: 0 }),
      hitDef(base, "agarra", "AnimElem = 2", {
        attr: "S, ST",
        at: "Hard",
        dmg: [sp.damage, 0],
        guard: "",
        hitflag: "M-",
        pause: [10, 14],
        gvel: -5,
        gvely: -7,
        avel: [-4, -6],
        fall: 1,
        hittime: 26,
        p1stateno: base + 1,
      }),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
      statedef(base + 1, { anim: base + 1, ctrl: 0, velset: [0, 0] }),
      ctrl(base + 1, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states };
  },

  /** Postura de contra-golpe: invencível; se o oponente atacar perto, revida. */
  counter(sp, base) {
    const anims = {
      [base]: F([["counterStance", 26]]),
      [base + 1]: F([["palmWind", 3], ["dashPunch", 6, H_], ["stand3", 12]]),
    };
    const states = [
      statedef(base, { type: "S", movetype: "I", anim: base, ctrl: 0, velset: [0, 0], poweradd: 20 }),
      ctrl(base, "invencivel", "NotHitBy", ["Time < 22"], { value: "SCA", time: 1 }),
      ctrl(base, "revida", "ChangeState", ["Time >= 2 && Time < 22 && P2MoveType = A && P2BodyDist X < 60"], { value: base + 1 }),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
      statedef(base + 1, { anim: base + 1, ctrl: 0, velset: [0, 0], poweradd: 60 }),
      ctrl(base + 1, "avanca", "PosAdd", ["Time = 0"], { x: 8 }),
      ctrl(base + 1, "invencivel", "NotHitBy", ["Time < 10"], { value: "SCA", time: 1 }),
      hitDef(base + 1, "golpe", "AnimElem = 2", { attr: "S, SA", at: "Hard", dmg: [sp.damage, 0], guard: "", pause: [14, 16], gvel: -6, gvely: -6, avel: [-5, -6], fall: 1, hittime: 24 }),
      ctrl(base + 1, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states };
  },

  /** Projétil lançado do ar, na diagonal para baixo. */
  airProjectile(sp, base, ch) {
    const flight = base + 50;
    const burst = base + 60;
    const anims = {
      [base]: F([["airThrowWind", 5], ["airThrow", 14], ["jumpDown", -1]]),
      [flight]: F([[`proj:${sp.proj}:0`, 3], [`proj:${sp.proj}:1`, 3]]),
      [burst]: F([0, 1, 2, 3].map((i) => [`proj:burst:${i}`, 3])),
    };
    const states = [
      statedef(base, { type: "A", physics: "N", anim: base, ctrl: 0, poweradd: 35 }),
      ctrl(base, "paira", "VelSet", ["Time = 0"], { x: 0.5, y: -1.5 }),
      ctrl(base, "cai", "VelAdd", ["Time > 0"], { y: 0.3 }),
      [
        `[State ${base}, projetil]`,
        "type = Projectile",
        "trigger1 = AnimElem = 2",
        `projid = ${base}`,
        `projanim = ${flight}`,
        `projhitanim = ${burst}`,
        `velocity = ${(sp.speed * 0.8).toFixed(1)}, ${(sp.speed * 0.6).toFixed(1)}`,
        `offset = ${Math.round(ch.H * 0.35)}, ${-Math.round(ch.H * 0.5)}`,
        "attr = A, SP",
        `damage = ${sp.damage}, ${Math.round(sp.damage / 6)}`,
        "animtype = Medium",
        "guardflag = HA",
        "hitflag = MAF",
        "pausetime = 0, 12",
        "ground.hittime = 16",
        "ground.velocity = -4",
        "air.velocity = -3, -4",
      ].join("\n"),
      ctrl(base, "pousa", "ChangeState", ["Pos Y >= 0 && Vel Y > 0"], { value: 52 }),
    ].join("\n\n");
    return { anims, states, triggerAll: [`NumProjID(${base}) = 0`] };
  },

  /** Salta e cai como um martelo; a queda solta uma onda de choque rasteira. */
  groundPound(sp, base, ch) {
    const flight = base + 50;
    const burst = base + 60;
    const anims = {
      [base]: F([["jumpStart", 4], ["jumpUp", 10], ["airHammer", -1, H_]]),
      [base + 1]: F([["slam", 10], ["crouch1", 10]]),
      [flight]: F([["proj:wave:0", 3], ["proj:wave:1", 3]]),
      [burst]: F([0, 1, 2, 3].map((i) => [`proj:burst:${i}`, 3])),
    };
    const states = [
      statedef(base, { type: "A", physics: "N", anim: base, ctrl: 0, poweradd: 45 }),
      ctrl(base, "sobe", "VelSet", ["Time = 4"], { x: 2.2, y: -7 }),
      ctrl(base, "gravidade", "VelAdd", ["Time > 4"], { y: 0.55 }),
      hitDef(base, "corpo", "AnimElem = 3", { attr: "A, SA", at: "Hard", dmg: [Math.round(sp.damage * 0.6), 6], guard: "HA", pause: [10, 12], gvel: -4, gvely: -5, avel: [-3, -5], fall: 1, hittime: 20 }),
      ctrl(base, "pousa", "ChangeState", ["Time > 6 && Pos Y >= 0 && Vel Y > 0"], { value: base + 1 }),
      statedef(base + 1, { type: "S", physics: "S", anim: base + 1, ctrl: 0, velset: [0, 0] }),
      ctrl(base + 1, "chao", "PosSet", ["Time = 0"], { y: 0 }),
      [
        `[State ${base + 1}, onda]`,
        "type = Projectile",
        "trigger1 = Time = 0",
        `projid = ${base}`,
        `projanim = ${flight}`,
        `projhitanim = ${burst}`,
        "projremovetime = 40",
        `velocity = ${sp.speed ?? 4.5}, 0`,
        `offset = ${Math.round(ch.H * 0.3)}, 0`,
        "attr = S, SP",
        `damage = ${sp.damage}, 6`,
        "animtype = Medium",
        "guardflag = L",
        "hitflag = MA",
        "pausetime = 0, 12",
        "ground.type = Trip",
        "ground.hittime = 18",
        "ground.velocity = -3",
        "fall = 1",
      ].join("\n"),
      ctrl(base + 1, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states, triggerAll: [`NumProjID(${base}) = 0`] };
  },

  /** Rajada de golpes no lugar (mãos ou pés). */
  flurry(sp, base) {
    const hits = sp.hits ?? 5;
    const a = sp.kicks ? "shortKick" : "jab";
    const b = sp.kicks ? "midKick" : "straight";
    const frames = [[sp.kicks ? "shortKickWind" : "jabWind", 4]];
    for (let i = 0; i < hits; i++) frames.push([i % 2 ? b : a, 3, H_]);
    frames.push([sp.kicks ? "midKickWind" : "straightWind", 10]);
    const anims = { [base]: F(frames) };
    const states = [
      statedef(base, { anim: base, ctrl: 0, velset: [0, 0], poweradd: 45 }),
      ctrl(base, "avanca", "VelSet", [`AnimElemTime(2) >= 0 && AnimElemTime(${hits + 2}) < 0`], { x: 0.8 }),
      hitDef(
        base,
        "rajada",
        Array.from({ length: hits }, (_, i) => `AnimElem = ${i + 2}`),
        { attr: "S, SA", at: "Medium", dmg: [sp.damage, 3], pause: [3, 6], gvel: -1.6, hittime: 14, avel: [-2, -3], airfall: 0 },
      ),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states };
  },
});

const SUPERS = {
  rush(sp, base, ch) {
    const kicks = sp.kicks === true;
    const seq = kicks
      ? ["shortKick", "midKick", "spinA", "spinB", "roundhouse"]
      : ["jab", "straight", "jab", "hook", "dashPunch"];
    const frames = [["superPose", 14]];
    for (const p of seq.slice(0, -1)) frames.push([p, 4, H_]);
    frames.push([seq[seq.length - 1], 8, H_], ["stand3", 12]);
    const anims = { [base]: F(frames) };
    const per = Math.round(sp.damage * 0.12);
    const states = [
      statedef(base, { anim: base, ctrl: 0, velset: [0, 0] }),
      ctrl(base, "custo", "PowerAdd", ["Time = 0"], { value: -(sp.cost ?? 1000) }),
      ctrl(base, "pausa", "SuperPause", ["Time = 0"], { time: sp.cost >= 2000 ? 45 : 30 }),
      ctrl(base, "invencivel", "NotHitBy", ["Time = 0"], { value: "SCA", time: 20 }),
      ctrl(base, "avanca", "VelSet", [`AnimElemTime(2) >= 0 && AnimElemTime(${seq.length + 1}) < 0`], { x: 3.6 }),
      hitDef(
        base,
        "combo",
        Array.from({ length: seq.length - 1 }, (_, i) => `AnimElem = ${i + 2}`),
        { attr: "S, HA", at: "Medium", dmg: [per, 2], pause: [4, 8], gvel: -1, hittime: 20, avel: [-1, -2], airfall: 0 },
      ),
      hitDef(base, "final", `AnimElem = ${seq.length + 1}`, {
        attr: "S, HA",
        at: "Hard",
        dmg: [sp.damage - per * (seq.length - 1), 10],
        pause: [16, 18],
        gvel: -6,
        gvely: -7,
        fall: 1,
        hittime: 24,
        avel: [-6, -7],
      }),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    void ch;
    return { anims, states };
  },

  beam(sp, base, ch) {
    const flight = base + 50;
    const burst = base + 60;
    const kind = sp.wave ? "wave" : "beam";
    const anims = {
      [base]: F([["superPose", 20], ["palmWind", 10], ["palmThrust", 30], ["stand3", 8]]),
      [flight]: F([[`proj:${kind}:0`, 3], [`proj:${kind}:1`, 3]]),
      [burst]: F([0, 1, 2, 3].map((i) => [`proj:burst:${i}`, 4])),
    };
    const states = [
      statedef(base, { anim: base, ctrl: 0, velset: [0, 0] }),
      ctrl(base, "custo", "PowerAdd", ["Time = 0"], { value: -(sp.cost ?? 1000) }),
      ctrl(base, "pausa", "SuperPause", ["Time = 0"], { time: sp.cost >= 2000 ? 45 : 30 }),
      ctrl(base, "invencivel", "NotHitBy", ["Time = 0"], { value: "SCA", time: 25 }),
      [
        `[State ${base}, raio]`,
        "type = Projectile",
        "trigger1 = AnimElem = 3",
        `projid = ${base}`,
        `projanim = ${flight}`,
        `projhitanim = ${burst}`,
        `velocity = ${kind === "wave" ? 5 : 7}, 0`,
        `offset = ${Math.round(ch.H * 0.4)}, ${kind === "wave" ? 0 : -Math.round(ch.H * 0.55)}`,
        "attr = S, HP",
        `damage = ${sp.damage}, ${Math.round(sp.damage / 6)}`,
        "animtype = Hard",
        `guardflag = ${kind === "wave" ? "L" : "MA"}`,
        "hitflag = MAF",
        "pausetime = 0, 22",
        "ground.type = High",
        "ground.hittime = 24",
        "ground.velocity = -7, -7",
        "air.velocity = -7, -7",
        "fall = 1",
      ].join("\n"),
      ctrl(base, "fim", "ChangeState", ["AnimTime = 0"], { value: 0, ctrl: 1 }),
    ].join("\n\n");
    return { anims, states };
  },
};

/** Super de agarrão: o agarrão de comando com pausa de super, mais dano e invencibilidade. */
SUPERS.grab = (sp, base, ch) => {
  const r = SPECIALS.grab({ ...sp }, base, ch);
  const extra = [
    ctrl(base, "custo", "PowerAdd", ["Time = 0"], { value: -(sp.cost ?? 1000) }),
    ctrl(base, "pausa", "SuperPause", ["Time = 0"], { time: sp.cost >= 2000 ? 45 : 30 }),
    ctrl(base, "invencivel", "NotHitBy", ["Time = 0"], { value: "SCA", time: 12 }),
  ].join("\n\n");
  // o custo e a pausa entram logo depois do cabeçalho do primeiro Statedef
  const first = r.states.indexOf("\n\n");
  const states = `${r.states.slice(0, first)}\n\n${extra}${r.states.slice(first)}`.replace("attr = S, ST", "attr = S, HT");
  return { anims: r.anims, states };
};

// ------------------------------------------------------------ comandos

const CMD_SEQ = {
  super_p: ["~D, DF, F, D, DF, F, x", "~D, DF, F, D, DF, F, y", "~D, DF, F, D, DF, F, z"],
  super_k: ["~D, DF, F, D, DF, F, a", "~D, DF, F, D, DF, F, b", "~D, DF, F, D, DF, F, c"],
  qcf_p: ["~D, DF, F, x", "~D, DF, F, y", "~D, DF, F, z"],
  qcf_k: ["~D, DF, F, a", "~D, DF, F, b", "~D, DF, F, c"],
  qcb_p: ["~D, DB, B, x", "~D, DB, B, y", "~D, DB, B, z"],
  qcb_k: ["~D, DB, B, a", "~D, DB, B, b", "~D, DB, B, c"],
  dp_p: ["~F, D, DF, x", "~F, D, DF, y", "~F, D, DF, z"],
  dp_k: ["~F, D, DF, a", "~F, D, DF, b", "~F, D, DF, c"],
  dd_p: ["~D, D, x", "~D, D, y", "~D, D, z"],
  dd_k: ["~D, D, a", "~D, D, b", "~D, D, c"],
  // supers de 2 estoques: duas meias-luas para trás
  super2_p: ["~D, DB, B, D, DB, B, x", "~D, DB, B, D, DB, B, y", "~D, DB, B, D, DB, B, z"],
  super2_k: ["~D, DB, B, D, DB, B, a", "~D, DB, B, D, DB, B, b", "~D, DB, B, D, DB, B, c"],
  // meia-volta para a frente (agarrões)
  hcf_p: ["~B, DB, D, DF, F, x", "~B, DB, D, DF, F, y", "~B, DB, D, DF, F, z"],
  hcf_k: ["~B, DB, D, DF, F, a", "~B, DB, D, DF, F, b", "~B, DB, D, DF, F, c"],
  // golpes de carga (segurar trás/baixo)
  chg_bf_p: ["~30$B, F, x", "~30$B, F, y", "~30$B, F, z"],
  chg_bf_k: ["~30$B, F, a", "~30$B, F, b", "~30$B, F, c"],
  chg_du_k: ["~30$D, U, a", "~30$D, U, b", "~30$D, U, c"],
  chg_du_p: ["~30$D, U, x", "~30$D, U, y", "~30$D, U, z"],
};

const AIR_KINDS = new Set(["divekick", "airProjectile"]);

function cmdFile(ch, specials, superDef, super2) {
  const out = [
    `; ${ch.name} — comandos (formato MUGEN .cmd)`,
    "; Gerado por scripts/roster/generate.mjs",
    "",
    "[Remap]",
    "x = x",
    "y = y",
    "z = z",
    "a = a",
    "b = b",
    "c = c",
    "s = s",
    "",
    "[Defaults]",
    "command.time = 15",
    "command.buffer.time = 2",
    "",
  ];
  const cmd = (name, command, time = 15) => out.push("[Command]", `name = "${name}"`, `command = ${command}`, `time = ${time}`, "");
  const used = new Set([...(super2 ? [super2.cmd] : []), superDef.cmd, ...specials.map((s) => s.cmd)]);
  for (const name of used) for (const c of CMD_SEQ[name]) cmd(name, c, name.startsWith("super") ? 35 : name.startsWith("chg") ? 12 : 15);
  cmd("FF", "F, >F", 10);
  cmd("BB", "B, >B", 10);
  for (const b of ["x", "y", "z", "a", "b", "c", "s"]) cmd(b, b, 1);
  cmd("holdfwd", "/$F", 1);
  cmd("holdback", "/$B", 1);
  cmd("holdup", "/$U", 1);
  cmd("holddown", "/$D", 1);

  out.push("; ------------------------------------------------------------", "[Statedef -1]", "");
  const entry = (label, value, triggerAll, triggers) => {
    out.push(`[State -1, ${label}]`, "type = ChangeState", `value = ${value}`);
    for (const t of triggerAll) out.push(`triggerall = ${t}`);
    triggers.forEach((t, i) => out.push(`trigger${i + 1} = ${t}`));
    out.push("");
  };

  if (super2) entry(super2.name, 3100, [`command = "${super2.cmd}"`, "power >= 2000", "statetype != A"], ["ctrl", "stateno = [200, 2999] && movecontact"]);
  entry(superDef.name, 3000, [`command = "${superDef.cmd}"`, "power >= 1000", "statetype != A"], ["ctrl", "stateno = [200, 2999] && movecontact"]);
  specials.forEach((sp, i) => {
    const base = 1000 + i * 100;
    const air = AIR_KINDS.has(sp.kind);
    entry(sp.name, base, [`command = "${sp.cmd}"`, air ? "statetype = A" : "statetype != A", ...(sp.triggerAll ?? [])], air ? ["ctrl"] : ["ctrl", "stateno = [200, 499] && movecontact"]);
  });
  entry("Corrida", 100, ['command = "FF"', "statetype = S"], ["ctrl"]);
  entry("Recuo", 105, ['command = "BB"', "statetype = S"], ["ctrl"]);

  for (const n of [...NORMALS].reverse()) {
    for (const b of n.cmds) {
      const ta = [`command = "${b}"`];
      if (n.st === "S") ta.push('command != "holddown"', "statetype != A");
      if (n.st === "C") ta.push('command = "holddown"', "statetype != A");
      if (n.st === "A") ta.push("statetype = A");
      const trig = ["ctrl"];
      if (n.chainFrom?.length) trig.push(`(${n.chainFrom.map((s) => `stateno = ${s}`).join(" || ")}) && movecontact`);
      entry(`Normal ${n.no} (${b})`, n.no, ta, trig);
    }
  }
  return out.join("\n");
}

// -------------------------------------------------------------- arquivos

function defFile(ch) {
  return [
    `; ${ch.name} — ${ch.bio}`,
    "; Personagem original do MUGEN Arena (CONEXUS). Gerado por scripts/roster/generate.mjs.",
    "",
    "[Info]",
    `name = "${ch.name}"`,
    `displayname = "${ch.name}"`,
    "versiondate = 10,18,2026",
    "mugenversion = 1.0",
    'author = "CONEXUS Arena"',
    "localcoord = 320, 240",
    "",
    "[Files]",
    `cmd = ${ch.id}.cmd`,
    `cns = ${ch.id}.cns`,
    "stcommon = common1.cns ; fornecido pela engine",
    `anim = ${ch.id}.air`,
    "",
    "; Extensão do MUGEN Arena (ignorada pelo MUGEN): cores do HUD/efeitos",
    "[Arena]",
    ...Object.entries(ch.style).map(([k, v]) => `${k} = ${v}`),
    "",
  ].join("\n");
}

function cnsHeader(ch) {
  const s = ch.stats;
  const k = (ch.H / 95) * ch.build;
  return [
    `; ${ch.name} — constantes e estados (formato MUGEN .cns)`,
    "; Estados comuns (0, 20, 40, 5000...) vêm do common1 da engine.",
    "",
    "[Data]",
    `life = ${s.life}`,
    "power = 3000",
    `attack = ${s.attack}`,
    `defence = ${s.defence}`,
    "fall.defence_up = 50",
    "liedown.time = 50",
    "airjuggle = 15",
    "",
    "[Size]",
    "xscale = 1",
    "yscale = 1",
    `ground.back = ${Math.round(14 * k)}`,
    `ground.front = ${Math.round(16 * k)}`,
    `air.back = ${Math.round(12 * k)}`,
    `air.front = ${Math.round(12 * k)}`,
    `height = ${Math.round(ch.H * 0.62)}`,
    "attack.dist = 160",
    "proj.attack.dist = 90",
    `head.pos = -5, ${-Math.round(ch.H * 0.92)}`,
    `mid.pos = -5, ${-Math.round(ch.H * 0.6)}`,
    "",
    "[Velocity]",
    `walk.fwd = ${s.walkF}`,
    `walk.back = ${s.walkB}`,
    `run.fwd = ${s.runF}, 0`,
    "run.back = -4.5, -3.8",
    `jump.neu = 0, ${s.jumpY}`,
    "jump.back = -2.55",
    "jump.fwd = 2.5",
    "",
    "[Movement]",
    "yaccel = .44",
    "stand.friction = .85",
    "crouch.friction = .82",
    "",
  ].join("\n");
}

function airFile(ch, anims, spriteOf, P, solved) {
  const out = [`; ${ch.name} — animações (formato MUGEN .air), Clsn derivadas do esqueleto`, ""];
  const fmt = (b) => `${b[0]}, ${b[1]}, ${b[2]}, ${b[3]}`;
  for (const id of Object.keys(anims).map(Number).sort((a, b) => a - b)) {
    const { frames, loopStart } = anims[id];
    out.push(`[Begin Action ${id}]`);
    frames.forEach(([pose, time, active], i) => {
      if (i === loopStart && loopStart > 0) out.push("Loopstart");
      if (pose.startsWith("proj:")) {
        const [, kind] = pose.split(":");
        const r = Math.round(ch.H * (kind === "beam" ? 0.12 : 0.11));
        const box =
          kind === "beam" ? [0, -r, Math.round(r * 7), r] : kind === "wave" ? [-r, -r * 3, r, 0] : kind === "slash" ? [-r, -r * 2, Math.round(r * 1.5), r * 2] : [-r, -r, r, r];
        if (kind !== "burst") out.push("Clsn1: 1", ` Clsn1[0] = ${fmt(box)}`);
        const [g, n] = spriteOf(pose);
        out.push(`${g}, ${n}, 0, 0, ${time}`);
        return;
      }
      if (pose === "__empty__") {
        out.push(`-1, 0, 0, 0, ${time}`);
        return;
      }
      const S = solved(pose);
      const { clsn1, clsn2 } = boxes(P, S, ch.look);
      out.push(`Clsn2: ${clsn2.length}`);
      clsn2.forEach((b, j) => out.push(` Clsn2[${j}] = ${fmt(b)}`));
      if (active && clsn1.length) {
        out.push(`Clsn1: ${clsn1.length}`);
        clsn1.forEach((b, j) => out.push(` Clsn1[${j}] = ${fmt(b)}`));
      }
      const [g, n] = spriteOf(pose);
      out.push(`${g}, ${n}, 0, 0, ${time}`);
    });
    out.push("");
  }
  return out.join("\n");
}

/** Pose no meio do caminho entre duas (ângulos e deslocamentos interpolados). */
function blend(a, b) {
  if (!a || !b) return undefined;
  const out = { ...a };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k];
    const y = b[k];
    if (typeof x === "number" && typeof y === "number") out[k] = (x + y) / 2;
    else if (Array.isArray(x) && Array.isArray(y)) out[k] = x.map((v, i) => (v + y[i]) / 2);
    else if (x === undefined) out[k] = y;
  }
  return out;
}

// ------------------------------------------------- quadros intermediários

const plainPose = (p) => typeof p === "string" && !p.startsWith("proj:") && p !== "__empty__" && !p.includes("~");

/** Pose de descanso para onde o fim do golpe volta (o estado seguinte). */
function restPose(id) {
  if (id >= 200 && id < 300) return "stand1";
  if (id >= 400 && id < 500) return "crouch1";
  return null;
}

/**
 * Divide os quadros longos (≥ 4 ticks, sem acerto) dos golpes em dois: a pose
 * e o meio do caminho até a próxima. O tempo total e o início de cada quadro
 * original não mudam; devolve, por animação, o novo número (1-based) de cada
 * elemento antigo, para renumerar AnimElem/AnimElemTime nos estados.
 */
function tweenAnims(anims) {
  const maps = {};
  for (const key of Object.keys(anims)) {
    const id = Number(key);
    const tweenable = (id >= 190 && id < 200) || (id >= 200 && id < 700) || (id >= 1000 && id < 5000) || id === 5120 || (id >= 6000 && id < 7000);
    if (!tweenable) continue;
    const { frames, loopStart } = anims[key];
    const out = [];
    const map = [];
    frames.forEach((f, i) => {
      map.push(out.length + 1);
      const [pose, time, active] = f;
      let next = frames[i + 1]?.[0];
      if (next === undefined) next = loopStart > 0 ? frames[loopStart][0] : restPose(id);
      if (!active && time >= 4 && plainPose(pose) && plainPose(next) && next !== pose) {
        const a = Math.ceil(time / 2);
        out.push([pose, a], [`${pose}~${next}`, time - a]);
      } else {
        out.push(f);
      }
    });
    if (out.length === frames.length) continue;
    anims[key] = { frames: out, loopStart: loopStart > 0 ? map[loopStart] - 1 : 0 };
    maps[id] = map;
  }
  return maps;
}

/** Ajusta AnimElem = n e AnimElemTime(n) de cada Statedef à animação dele. */
function renumberElems(text, maps) {
  return text
    .split(/(?=\[Statedef )/)
    .map((block) => {
      const anim = /\nanim = (\d+)/.exec(block);
      const map = anim ? maps[Number(anim[1])] : null;
      if (!map) return block;
      const to = (n) => map[Number(n) - 1] ?? n;
      return block.replace(/AnimElem = (\d+)/g, (_, n) => `AnimElem = ${to(n)}`).replace(/AnimElemTime\((\d+)\)/g, (_, n) => `AnimElemTime(${to(n)})`);
    })
    .join("");
}

function generate(ch) {
  const P = proportions(ch.H, ch.build);
  const poses = { ...POSES, ...(ch.poses ?? {}) };
  const anims = commonAnims();
  const stateTexts = [];

  for (const n of NORMALS) {
    anims[n.no] = F(n.frames);
    stateTexts.push(normalStates(n));
  }
  const specials = ch.specials.map((sp, i) => {
    const base = 1000 + i * 100;
    const r = SPECIALS[sp.kind](sp, base, ch);
    Object.assign(anims, r.anims);
    stateTexts.push(r.states);
    return { ...sp, triggerAll: r.triggerAll };
  });
  const sup = SUPERS[ch.super.kind](ch.super, 3000, ch);
  if (ch.super2) {
    const sup2 = SUPERS[ch.super2.kind]({ cost: 2000, ...ch.super2 }, 3100, ch);
    Object.assign(anims, sup2.anims);
    stateTexts.push(sup2.states);
  }
  Object.assign(anims, sup.anims);
  stateTexts.push(sup.states);

  // quadros intermediários nos golpes; renumera AnimElem nos estados
  const elemMaps = tweenAnims(anims);
  const cnsText = renumberElems(stateTexts.join("\n\n"), elemMaps);

  // sprites: um por pose/efeito usado
  const spriteKeys = [];
  const groups = new Map();
  const spriteOf = (key) => {
    if (!groups.has(key)) {
      const g = key.startsWith("proj:") ? 9000 + groups.size : groups.size;
      groups.set(key, [g, 0]);
      spriteKeys.push(key);
    }
    return groups.get(key);
  };
  const cache = new Map();
  const solved = (name) => {
    if (!cache.has(name)) {
      const pose = name.includes("~") ? blend(...name.split("~").map((n) => poses[n])) : poses[name];
      if (!pose) throw new Error(`${ch.id}: pose desconhecida "${name}"`);
      cache.set(name, solve(P, pose));
    }
    return cache.get(name);
  };

  const air = airFile(ch, anims, spriteOf, P, solved);
  const items = spriteKeys.map((key) => {
    let r;
    if (key.startsWith("proj:")) {
      const [, kind, frame] = key.split(":");
      r = paintProjectile(kind, ch.look, ch.H, Number(frame), SCALE);
    } else {
      r = paintFighter(P, solved(key), ch.look, SCALE);
    }
    return { key, canvas: r.canvas, axisX: r.axisX, axisY: r.axisY };
  });
  const { pages, places } = packAtlas(items, 2048);
  const frames = {};
  for (const it of items) {
    const [g, n] = groups.get(it.key);
    const [x, y, page] = places[it.key];
    frames[`${g},${n}`] = [x, y, it.canvas.w, it.canvas.h, Math.round(it.axisX), Math.round(it.axisY), page];
  }

  const dir = path.join(OUT, ch.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${ch.id}.def`), defFile(ch));
  writeFileSync(path.join(dir, `${ch.id}.cns`), `${cnsHeader(ch)}\n${cnsText}\n`);
  writeFileSync(path.join(dir, `${ch.id}.cmd`), cmdFile(ch, specials, ch.super, ch.super2));
  writeFileSync(path.join(dir, `${ch.id}.air`), air);
  for (const f of readdirSync(dir)) if (/^sprites\d+\.(png|webp)$/.test(f)) rmSync(path.join(dir, f));
  pages.forEach((pg, i) => writeFileSync(path.join(dir, `sprites${i}.webp`), encodeWebP(pg)));
  writeFileSync(
    path.join(dir, "sprites.json"),
    `${JSON.stringify({ scale: SCALE, pages: pages.length, frames }, null, 0)}\n`,
  );
  writeFileSync(
    path.join(dir, "meta.json"),
    `${JSON.stringify(
      {
        id: ch.id,
        name: ch.name,
        bio: ch.bio,
        specials: ch.specials.map((s) => ({ name: s.name, cmd: s.cmd })),
        super: { name: ch.super.name, cmd: ch.super.cmd },
        ...(ch.super2 ? { super2: { name: ch.super2.name, cmd: ch.super2.cmd } } : {}),
        quotes: ch.quotes ?? [],
      },
      null,
      2,
    )}\n`,
  );
  return { id: ch.id, sprites: items.length, pages: pages.length };
}

await initPainter();
const only = process.argv.slice(2);
for (const ch of ROSTER) {
  if (only.length && !only.includes(ch.id)) continue;
  const r = generate(ch);
  console.log(`${r.id}: ${r.sprites} sprites em ${r.pages} página(s)`);
}
