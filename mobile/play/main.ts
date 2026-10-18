/**
 * MUGEN Arena — versão web jogável. Usa o mesmo código do app: engine (src/engine),
 * elenco gerado (src/characters), IA e macros (src/game) e o renderizador da luta
 * (src/game/renderer.ts, desenhando em Canvas 2D pelo adaptador skia-canvas2d.ts).
 * Muda só a casca: menus em DOM no padrão W10M e controles de teclado/toque.
 */

import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { getAnim, loadCharacter } from "@/src/engine/character";
import type { Roster } from "@/src/engine/fighter";
import { Btn } from "@/src/engine/input";
import type { CharacterData, WorldState } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";
import { CpuController } from "@/src/game/ai";
import { BUTTONS } from "@/src/game/controlLayout";
import { DEFAULT_PAD, DirectionalPad } from "@/src/game/dpad";
import { GamepadReader, PAD_SELECT, PAD_START, type PadSnapshot } from "@/src/game/gamepad";
import { findCommand, macroFromCommand, MacroPlayer } from "@/src/game/macros";
import { KEY_NAME, SIMPLE_MASK, SimpleBtn, SimpleController, simpleContextOf, simpleKit, SLOT_LABEL, SLOTS } from "@/src/game/simpleMode";
import { FightRenderer } from "@/src/game/renderer";
import { STAGES } from "@/src/game/stages";
import { STAGE_ART } from "@/src/game/stages.generated";

import { AudioDirector } from "@/src/audio/director";
import { WebAudio } from "@/src/audio/web";

import { Canvas2D } from "./skia-canvas2d";

type Mode = "arcade" | "versus" | "training" | "team";

const TEAM_SIZE = 3;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------- elenco

const roster: Roster = {};
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);

const atlases: Record<string, HTMLImageElement[]> = {};
// camadas pintadas dos cenários (o adaptador desenha HTMLImageElement como SkImage)
const stageImages: Record<string, Record<string, HTMLImageElement>> = {};
const stagesReady: Promise<void> = Promise.all(
  Object.entries(STAGE_ART).flatMap(([id, art]) =>
    art.layers.map(
      (l) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = String(l.module);
          (stageImages[id] ??= {})[l.name] = img;
        }),
    ),
  ),
).then(() => undefined);
// todas as páginas do atlas de cada personagem
const atlasReady: Promise<void> = Promise.all(
  BUILTIN_ORDER.flatMap((id) => {
    atlases[id] = [];
    return BUILTIN[id].atlasModules.map(
      (mod, page) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = String(mod);
          atlases[id][page] = img;
        }),
    );
  }),
).then(() => undefined);

/** Desenha o primeiro frame parado do personagem num canvas pequeno (retratos). */
function drawPortrait(canvas: HTMLCanvasElement, id: string, flip = false) {
  const ch = roster[id];
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const frame = getAnim(ch, 0).frames[0];
  const entry = ch.sprites?.frames[`${frame.group},${frame.index}`];
  const img = atlases[id]?.[entry?.[6] ?? 0];
  if (!entry || !img || !img.complete) return;
  const [sx, sy, sw, sh, ax, ay] = entry;
  const scale = ch.sprites?.scale ?? 1;
  const k = (h * 0.9) / (sh / scale);
  ctx.save();
  ctx.translate(w / 2, h * 0.97);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, (-ax / scale) * k, (-ay / scale) * k, (sw / scale) * k, (sh / scale) * k);
  ctx.restore();
}

// ------------------------------------------------------------- áudio

const webAudio = new WebAudio();
let soundOn = true;
try {
  soundOn = localStorage.getItem("mugen-arena.sound") !== "off";
} catch {
  // sem armazenamento: som ligado
}
const audio = new AudioDirector(webAudio, { music: soundOn, sfx: soundOn });
// o navegador só libera o áudio depois de um toque/tecla
for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, () => webAudio.unlock(), { passive: true });

function setSound(on: boolean) {
  soundOn = on;
  audio.setPrefs({ music: on, sfx: on });
  try {
    localStorage.setItem("mugen-arena.sound", on ? "on" : "off");
  } catch {
    // ignora
  }
  if (on && fight) audio.startMusic(fight.world.stageId);
}

// ------------------------------------------------------------ estado

const state = {
  mode: "versus" as Mode,
  p1: null as string | null,
  p2: null as string | null,
  picking: 1 as 1 | 2,
  cursor: BUILTIN_ORDER[0],
  stage: STAGES[0].id,
  difficulty: 2 as 1 | 2 | 3,
  ladder: [] as string[],
  stageNo: 0,
  /** Equipes 3×3: quem o jogador já escolheu, na ordem de entrada. */
  team: [] as string[],
};

function show(screen: "menu" | "select" | "fight") {
  if (screen !== "fight") audio.stopMusic();
  $("menu").hidden = screen !== "menu";
  $("select").hidden = screen !== "select";
  $("fight").hidden = screen !== "fight";
}

// ------------------------------------------------------------- menu

function startMode(mode: Mode) {
  state.mode = mode;
  state.p1 = null;
  state.p2 = null;
  state.picking = 1;
  state.team = [];
  renderSelect();
  show("select");
}

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
  b.addEventListener("click", () => startMode(b.dataset.mode as Mode));
});
$("help-open").addEventListener("click", () => openHelp());
$("help-close").addEventListener("click", () => closeHelp());

// ---------------------------------------------------------- seleção

const MODE_NAME: Record<Mode, string> = { arcade: "Arcade", versus: "Versus CPU", training: "Treino", team: "Equipes 3×3" };

function renderSelect() {
  const team = state.mode === "team";
  $("select-kicker").textContent = MODE_NAME[state.mode];
  $("select-title").textContent = team
    ? `Lutador ${state.team.length + 1} de ${TEAM_SIZE}`
    : state.picking === 1
      ? "Seu lutador"
      : state.mode === "training"
        ? "Boneco de treino"
        : "Oponente";
  const needsP2 = state.mode !== "arcade" && !team;
  const go = $<HTMLButtonElement>("select-go");
  go.textContent = team ? (state.team.length + 1 < TEAM_SIZE ? "Próximo" : "Lutar") : state.picking === 1 && needsP2 ? "Próximo" : "Lutar";
  const picks = $("team-picks");
  picks.hidden = !team || state.team.length === 0;
  picks.replaceChildren();
  for (const id of state.team) {
    const c = document.createElement("canvas");
    c.setAttribute("aria-label", BUILTIN[id].meta.name);
    picks.append(c);
    requestAnimationFrame(() => drawPortrait(c, id));
  }

  const grid = $("roster");
  grid.replaceChildren();
  for (const id of BUILTIN_ORDER) {
    const b = document.createElement("button");
    b.className = "fighter";
    b.type = "button";
    b.setAttribute("aria-pressed", String(id === state.cursor));
    b.setAttribute("aria-label", `Escolher ${BUILTIN[id].meta.name}`);
    const c = document.createElement("canvas");
    const label = document.createElement("span");
    label.textContent = BUILTIN[id].meta.name;
    b.append(c, label);
    b.addEventListener("click", () => {
      state.cursor = id;
      renderSelect();
    });
    b.addEventListener("dblclick", () => confirmPick());
    grid.append(b);
    requestAnimationFrame(() => drawPortrait(c, id));
  }

  const meta = BUILTIN[state.cursor].meta;
  $("pick-name").textContent = meta.name;
  $("pick-bio").textContent = meta.bio;
  $("pick-moves").textContent = `${meta.specials.map((s) => s.name).join(" · ")} · super ${meta.super.name}`;
  requestAnimationFrame(() => drawPortrait($<HTMLCanvasElement>("pick-portrait"), state.cursor, state.picking === 2));

  const stages = $("stages");
  stages.replaceChildren();
  $("stage-row").hidden = state.mode === "arcade";
  for (const s of STAGES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "link";
    b.setAttribute("aria-pressed", String(s.id === state.stage));
    b.textContent = s.name.toLowerCase();
    b.addEventListener("click", () => {
      state.stage = s.id;
      renderSelect();
    });
    stages.append(b);
  }
  const diff = $("difficulty");
  diff.replaceChildren();
  $("difficulty-row").hidden = state.mode !== "versus" && !team;
  for (const [lvl, name] of [
    [1, "fácil"],
    [2, "normal"],
    [3, "difícil"],
  ] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "link";
    b.setAttribute("aria-pressed", String(lvl === state.difficulty));
    b.textContent = name;
    b.addEventListener("click", () => {
      state.difficulty = lvl;
      renderSelect();
    });
    diff.append(b);
  }
}

function confirmPick() {
  if (state.mode === "team") {
    state.team.push(state.cursor);
    if (state.team.length < TEAM_SIZE) {
      renderSelect();
      return;
    }
    startFight();
    return;
  }
  if (state.picking === 1) {
    state.p1 = state.cursor;
    if (state.mode === "arcade") {
      const others = BUILTIN_ORDER.filter((id) => id !== state.p1).sort(() => Math.random() - 0.5);
      state.p2 = others[0];
      state.ladder = others.slice(1);
      state.stageNo = 1;
      startFight();
      return;
    }
    state.picking = 2;
    state.cursor = BUILTIN_ORDER.find((id) => id !== state.p1) ?? state.cursor;
    renderSelect();
    return;
  }
  state.p2 = state.cursor;
  startFight();
}

$("select-go").addEventListener("click", confirmPick);
$("select-back").addEventListener("click", () => {
  if (state.mode === "team" && state.team.length > 0) {
    state.team.pop();
    renderSelect();
  } else if (state.picking === 2) {
    state.picking = 1;
    renderSelect();
  } else show("menu");
});

// ------------------------------------------------------------ controles

// modo de controle (docs/CONTROLS.md): simples (Especial + direção, auto-combo) ou clássico
type ControlMode = "simple" | "classic";
let controlMode: ControlMode = "simple";
try {
  controlMode = localStorage.getItem("mugen-arena.controls") === "classic" ? "classic" : "simple";
} catch {
  // sem armazenamento: modo simples
}

const DIR_KEYS: Record<string, number> = {
  ArrowUp: Btn.U, KeyW: Btn.U,
  ArrowDown: Btn.D, KeyS: Btn.D,
  ArrowLeft: Btn.L, KeyA: Btn.L,
  ArrowRight: Btn.R, KeyD: Btn.R,
};
// padrão SNK: A = x, B = a, C = z, D = c (ver src/engine/snk.ts)
const KEYMAP_CLASSIC: Record<string, number> = {
  ...DIR_KEYS,
  KeyU: Btn.x, KeyJ: Btn.a,
  KeyI: Btn.z, KeyK: Btn.c,
  KeyO: Btn.x | Btn.a, KeyL: Btn.z | Btn.c,
  KeyM: Btn.x | Btn.a | Btn.z,
};
// simples: U soco, J chute, I especial, K super (os atalhos O, L e M continuam)
const KEYMAP_SIMPLE: Record<string, number> = {
  ...KEYMAP_CLASSIC,
  KeyU: SimpleBtn.punch, KeyJ: SimpleBtn.kick,
  KeyI: SimpleBtn.special, KeyK: SimpleBtn.super,
};
const keymap = () => (controlMode === "simple" ? KEYMAP_SIMPLE : KEYMAP_CLASSIC);
const held = new Set<string>();
let touchBits = 0;

window.addEventListener("keydown", (e) => {
  if (!$("help").hidden) {
    if (e.code === "Escape" || e.code === "KeyH") closeHelp();
    return;
  }
  if ($("fight").hidden) {
    if (e.code === "KeyH") openHelp();
    if (!$("select").hidden && (e.code === "Enter" || e.code === "Space")) confirmPick();
    return;
  }
  if (e.code in keymap()) {
    held.add(e.code);
    e.preventDefault();
  }
  if (/^Digit[1-9]$/.test(e.code)) assist(Number(e.code.slice(5)) - 1);
  if (e.code === "KeyT") setControlMode(controlMode === "simple" ? "classic" : "simple");
  if (e.code === "KeyH") openHelp();
  if (e.code === "Escape" || e.code === "KeyP") togglePause();
  if (e.code === "KeyN") setSound(!soundOn);
  if (e.code === "KeyB" && fight?.mode === "training") debugBoxes = !debugBoxes;
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => held.clear());

function keyboardBits(): number {
  let bits = 0;
  const map = keymap();
  for (const k of held) bits |= map[k] ?? 0;
  return bits | touchBits | padBits;
}

// controle físico (Gamepad API, mapeamento standard; ver src/game/gamepad.ts)
const gamepad = new GamepadReader();
let padBits = 0;
let padName: string | null = null;

function readGamepad() {
  const pads = typeof navigator.getGamepads === "function" ? Array.from(navigator.getGamepads()) : [];
  const live = pads.filter((p): p is Gamepad => !!p && p.connected);
  const gp = live.find((p) => p.mapping === "standard") ?? live[0];
  if (!gp) {
    padBits = 0;
    if (padName) setPadName(null);
    return;
  }
  if (padName !== gp.id) setPadName(gp.id);
  const snap: PadSnapshot = { buttons: gp.buttons.map((b) => b.pressed), axes: gp.axes };
  const edges = gamepad.pressed(snap);
  padBits = gamepad.bits(snap, controlMode);
  if (edges.has(PAD_START)) togglePause();
  if (edges.has(PAD_SELECT)) setControlMode(controlMode === "simple" ? "classic" : "simple");
}

function setPadName(name: string | null) {
  padName = name;
  $("pad-status").textContent = name ? `controle: ${name.replace(/\s*\(.*$/, "").slice(0, 40)}` : "";
}

function setControlMode(mode: ControlMode) {
  controlMode = mode;
  try {
    localStorage.setItem("mugen-arena.controls", mode);
  } catch {
    // ignora
  }
  held.clear();
  pointers.clear();
  touchBits = 0;
  fight?.simple.reset();
  renderPad();
  renderAssists();
  updateHints();
}

function updateHints() {
  const simple = controlMode === "simple";
  $("mode-btn").textContent = simple ? "modo: simples" : "modo: clássico";
  $("mode-btn").setAttribute("aria-label", `Modo de controle: ${simple ? "simples" : "clássico"}. Tecla T troca.`);
  $("keys-hint").textContent = simple
    ? "mover: setas/WASD · soco U (toques seguidos = combo) · chute J · especial I (+ direção) · super K (↓ + K = super 2) · rolar O · blowback L · MAX M · modo T · ajuda H · som N · pausa Esc"
    : "mover: setas/WASD · A U · B J · C I · D K · rolar O (A+B) · blowback L (C+D) · MAX M · especiais e supers 1–6 · modo T · ajuda H · som N · pausa Esc";
  renderMoves();
}

/** Tabela "Especial + direção → golpe" do lutador do P1 (ajuda). */
function renderMoves() {
  const box = $("simple-moves");
  box.replaceChildren();
  const id = fight?.world.fighters[0].charId ?? state.p1 ?? state.cursor;
  const kit = simpleKit(roster[id], BUILTIN[id]?.meta);
  const rows: [string, string][] = SLOTS.map((s) => [s === "neutral" ? "Especial" : `${SLOT_LABEL[s]} + Especial`, kit.specials[s]?.name ?? "—"]);
  if (kit.super) rows.push(["Super (1 estoque)", kit.super.name]);
  if (kit.super2) rows.push(["baixo + Super (2 estoques)", kit.super2.name]);
  rows.push(["Soco, soco, soco…", kit.combo.length ? kit.combo.map((c) => (c.kind === "button" ? KEY_NAME[c.key] : (SLOTS.map((sl) => kit.specials[sl]).find((m) => m?.cmd === c.cmd)?.name ?? "especial"))).join(" → ") : "soco"]);
  $("simple-moves-title").textContent = `modo simples · ${BUILTIN[id]?.meta.name ?? id}`;
  for (const [k, v] of rows) {
    const tr = document.createElement("tr");
    const a = document.createElement("td");
    const b = document.createElement("td");
    a.textContent = k;
    b.textContent = v;
    tr.append(a, b);
    box.append(tr);
  }
}

let helpPaused = false;
function openHelp() {
  renderMoves();
  $("help").hidden = false;
  if (fight && !paused && !fight.over && !$("fight").hidden) {
    helpPaused = true;
    paused = true;
    audio.duck(true);
  }
  $<HTMLButtonElement>("help-close").focus();
}
function closeHelp() {
  $("help").hidden = true;
  if (helpPaused) {
    helpPaused = false;
    paused = false;
    audio.duck(false);
  }
}

/** Botões touch do modo atual (clássico SNK ou simples). */
function renderPad() {
  const pad = $("pad");
  pad.replaceChildren();
  pad.classList.toggle("simple", controlMode === "simple");
  const defs = controlMode === "simple" ? BUTTONS.simple : BUTTONS.snk;
  for (const d of defs) {
    const b = document.createElement("div");
    b.className = d.small ? "b combo" : "b";
    b.dataset.bit = String(d.bit);
    b.dataset.id = d.id;
    b.setAttribute("role", "button");
    b.setAttribute("aria-label", d.a11y);
    b.textContent = d.label;
    pad.append(b);
  }
}

// toque: direcional flutuante à esquerda, botões à direita (pointer events, multitoque)
const touchLayer = $("touch");
const stickBase = $("stick");
const stickKnob = $("stick-knob");
const moveHint = document.querySelector<HTMLElement>(".move-hint")!;
// cada dedo no direcional tem o seu (zona morta + 8 direções com histerese, src/game/dpad.ts)
type Pointer = { x: number; y: number; ox: number; oy: number; kind: "stick" | "button"; bit: number; pad: DirectionalPad | null; dir: number };
const pointers = new Map<number, Pointer>();

function updateTouch() {
  let bits = 0;
  let stick: Pointer | null = null;
  for (const p of pointers.values()) {
    if (p.kind === "stick" && p.pad) {
      p.dir = p.pad.update(p.x - p.ox, p.y - p.oy);
      bits |= p.dir;
      stick = p;
    } else bits |= p.bit;
  }
  touchBits = bits;
  document.querySelectorAll<HTMLElement>("[data-bit]").forEach((el) => {
    const bit = Number(el.dataset.bit);
    el.classList.toggle("on", (bits & bit) === bit);
  });
  stickBase.hidden = !stick;
  moveHint.hidden = !!stick;
  if (stick) {
    stickBase.style.left = `${stick.ox - 50}px`;
    stickBase.style.top = `${stick.oy - 50}px`;
    const d = stick.dir;
    const dx = d & Btn.R ? 26 : d & Btn.L ? -26 : 0;
    const dy = d & Btn.D ? 26 : d & Btn.U ? -26 : 0;
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    stickKnob.classList.toggle("on", d !== 0);
  }
}

touchLayer.addEventListener("pointerdown", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-bit],[data-assist]");
  if (target?.dataset.assist) {
    assist(Number(target.dataset.assist));
    return;
  }
  touchLayer.setPointerCapture(e.pointerId);
  if (target?.dataset.bit) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: 0, oy: 0, kind: "button", bit: Number(target.dataset.bit), pad: null, dir: 0 });
  } else if (e.clientX < window.innerWidth * 0.45) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, kind: "stick", bit: 0, pad: new DirectionalPad(DEFAULT_PAD), dir: 0 });
  }
  updateTouch();
  e.preventDefault();
});
touchLayer.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  if (p.kind === "stick") {
    const d = Math.hypot(p.x - p.ox, p.y - p.oy);
    if (d > 60) {
      p.ox = p.x - ((p.x - p.ox) / d) * 60;
      p.oy = p.y - ((p.y - p.oy) / d) * 60;
    }
  } else {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-bit]");
    p.bit = el ? Number(el.dataset.bit) : 0;
  }
  updateTouch();
});
const release = (e: PointerEvent) => {
  pointers.delete(e.pointerId);
  updateTouch();
};
touchLayer.addEventListener("pointerup", release);
touchLayer.addEventListener("pointercancel", release);

// ---------------------------------------------------------------- luta

interface Assist {
  label: string;
  cmd: string;
  kind: "special" | "super" | "super2" | "max";
}

interface Fight {
  mode: Mode;
  world: WorldState;
  cpu: CpuController | null;
  macro: MacroPlayer;
  /** Modo simples do P1: traduz Soco/Chute/Especial/Super em entradas normais. */
  simple: SimpleController;
  renderer: FightRenderer;
  /** Nomes no HUD; nas equipes fica a cargo do renderizador (o lutador muda). */
  names?: [string, string];
  /** Personagem do P1 para quem os atalhos foram montados. */
  assistsFor: string;
  assists: Assist[];
  over: boolean;
}

let fight: Fight | null = null;
let paused = false;
let debugBoxes = false;

function assistsOf(charId: string): Assist[] {
  const meta = BUILTIN[charId].meta;
  // no modo simples os especiais e o super já estão nos botões; fica só o MAX
  if (controlMode === "simple") return [{ label: "MAX", cmd: "", kind: "max" }];
  return [
    ...meta.specials.map((s) => ({ label: s.name, cmd: s.cmd, kind: "special" as const })),
    { label: "Super", cmd: meta.super.cmd, kind: "super" },
    ...(meta.super2 ? [{ label: "Super 2", cmd: meta.super2.cmd, kind: "super2" as const }] : []),
    { label: "MAX", cmd: "", kind: "max" },
  ];
}

/** Botões de atalho do P1 (refeitos quando o lutador muda nas equipes). */
function renderAssists() {
  if (!fight) return;
  fight.assists = assistsOf(fight.assistsFor);
  const assistBox = $("assists");
  assistBox.replaceChildren();
  fight.assists.forEach((a, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.assist = String(i);
    b.className = "assist";
    b.textContent = a.label;
    b.title = a.kind === "max" ? "Tecla M (A+B+C)" : i < 9 ? `Tecla ${i + 1}` : "";
    assistBox.append(b);
  });
}

function startFight() {
  const team = state.mode === "team";
  let teams: [string[], string[]] | undefined;
  if (team) {
    // equipe da CPU: sorteada entre quem sobrou
    const rest = BUILTIN_ORDER.filter((id) => !state.team.includes(id)).sort(() => Math.random() - 0.5);
    teams = [[...state.team], rest.slice(0, TEAM_SIZE)];
    state.p1 = teams[0][0];
    state.p2 = teams[1][0];
  }
  const p1 = state.p1!;
  const p2 = state.p2!;
  const training = state.mode === "training";
  const stageId = state.mode === "arcade" ? STAGES[(state.stageNo - 1) % STAGES.length].id : state.stage;
  const level = state.mode === "arcade" ? (Math.min(3, 1 + Math.floor(state.stageNo / 2)) as 1 | 2 | 3) : state.difficulty;
  fight = {
    mode: state.mode,
    world: createWorld(
      { chars: [p1, p2], teams, stageId, seed: (Math.random() * 2 ** 31) | 0, roundsToWin: training ? 99 : 2, roundTime: training ? -1 : 99, training },
      roster,
    ),
    cpu: training ? null : new CpuController(1, roster, level),
    macro: new MacroPlayer(),
    simple: new SimpleController(roster[p1], simpleKit(roster[p1], BUILTIN[p1].meta)),
    renderer: new FightRenderer(),
    names: team ? undefined : [roster[p1].displayName, roster[p2].displayName],
    assistsFor: p1,
    assists: assistsOf(p1),
    over: false,
  };
  debugBoxes = training;
  paused = false;
  $("overlay").hidden = true;
  $("arcade-step").textContent = state.mode === "arcade" ? `luta ${state.stageNo} de ${state.stageNo + state.ladder.length}` : "";
  renderAssists();
  updateHints();
  show("fight");
  resize();
  webAudio.unlock();
  audio.stopMusic();
  audio.startMusic(stageId);
}

const MAX_MACRO = [Btn.x | Btn.a | Btn.z, Btn.x | Btn.a | Btn.z, Btn.x | Btn.a | Btn.z, 0];

function assist(i: number) {
  if (!fight || paused) return;
  const a = fight.assists[i];
  if (!a) return;
  const me = fight.world.fighters[0];
  if (a.kind !== "special" && me.power < (a.kind === "super2" ? 2000 : 1000)) return;
  if (a.kind === "max") {
    if (me.maxTime === 0) fight.macro.play(MAX_MACRO, me.facing);
    return;
  }
  const cmd = findCommand(roster[me.charId], a.cmd);
  if (cmd) fight.macro.play(macroFromCommand(cmd), me.facing);
}

function togglePause() {
  if (!fight || fight.over) return;
  paused = !paused;
  audio.duck(paused);
  showPanel(paused ? "pause" : null);
}

$("pause-btn").addEventListener("click", togglePause);
$("mode-btn").addEventListener("click", () => setControlMode(controlMode === "simple" ? "classic" : "simple"));
$("help-btn").addEventListener("click", () => openHelp());
window.addEventListener("gamepadconnected", (e) => setPadName((e as GamepadEvent).gamepad.id));
window.addEventListener("gamepaddisconnected", () => setPadName(null));

function showPanel(kind: "pause" | "result" | null, title = "", quote: { name: string; text: string } | null = null) {
  const overlay = $("overlay");
  overlay.hidden = kind === null;
  if (!kind || !fight) return;
  const text = $("panel-text");
  text.hidden = !quote;
  text.replaceChildren();
  if (quote) {
    const who = document.createElement("b");
    who.textContent = `${quote.name}: `;
    text.append(who, `“${quote.text}”`);
  }
  const actions = $("panel-actions");
  actions.replaceChildren();
  const add = (label: string, primary: boolean, fn: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = primary ? "btn primary" : "btn";
    b.textContent = label;
    b.addEventListener("click", fn);
    actions.append(b);
    return b;
  };
  $("panel-title").textContent = kind === "pause" ? "pausa" : title.toLowerCase();
  if (kind === "pause") {
    add("Continuar", true, togglePause).focus();
    add(soundOn ? "Som: ligado" : "Som: desligado", false, () => {
      setSound(!soundOn);
      showPanel("pause");
    });
    if (fight.mode === "training") add(debugBoxes ? "Esconder caixas" : "Mostrar caixas", false, () => {
      debugBoxes = !debugBoxes;
      togglePause();
    });
    add("Reiniciar", false, startFight);
    add("Sair da luta", false, () => {
      fight = null;
      show("menu");
    });
    return;
  }
  const won = fight.world.matchWinner === 0;
  if (fight.mode === "arcade") {
    if (won && state.ladder.length > 0) {
      add("Próxima luta", true, () => {
        state.p2 = state.ladder.shift()!;
        state.stageNo++;
        startFight();
      }).focus();
    } else if (!won) {
      add("Tentar de novo", true, startFight).focus();
    }
    add("Menu", !(!won || state.ladder.length > 0), () => show("menu"));
    return;
  }
  add("Revanche", true, startFight).focus();
  add("Trocar lutadores", false, () => startMode(fight!.mode));
  add("Menu", false, () => show("menu"));
}

// --------------------------------------------------------------- loop

const canvas = $<HTMLCanvasElement>("stage");
const ctx2d = canvas.getContext("2d")!;
const skCanvas = new Canvas2D(ctx2d);
let cssW = 0;
let cssH = 0;

/**
 * Resolução adaptativa: começa na do aparelho (até 2×) e, se os frames ficarem
 * lentos (navegador sem GPU para o canvas), cai para 1,5× e depois 1×.
 */
let maxDpr = 2;
let slowFrames = 0;
let sampledFrames = 0;

function adapt(dt: number) {
  sampledFrames++;
  if (dt > 26) slowFrames++;
  if (sampledFrames < 90) return;
  if (slowFrames > 45 && maxDpr > 1) {
    maxDpr = maxDpr > 1.5 ? 1.5 : 1;
    resize();
  }
  sampledFrames = 0;
  slowFrames = 0;
}

function resize() {
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  cssW = canvas.clientWidth;
  cssH = canvas.clientHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);

const STEP = 1000 / 60;
let last = 0;
let acc = 0;
let lastUi = 0;

function frame(t: number) {
  requestAnimationFrame(frame);
  readGamepad();
  if (!fight || $("fight").hidden) {
    last = t;
    return;
  }
  if (last === 0) last = t;
  if (!paused) adapt(t - last);
  acc += Math.min(100, t - last);
  last = t;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    if (!paused) {
      const w = fight.world;
      const me = w.fighters[0];
      const raw = keyboardBits();
      // modo simples: vira entrada normal aqui, antes da engine (como no app); bits virtuais nunca chegam nela
      const base =
        controlMode === "simple"
          ? fight.simple.step(raw, simpleContextOf(me))
          : raw & ~SIMPLE_MASK;
      const local = fight.macro.next() ?? base;
      const cpu = fight.cpu ? fight.cpu.next(w) : 0;
      stepWorld(w, [local, cpu], roster);
      fight.renderer.addEvents(w.events, w, roster);
      audio.update(w, w.events, roster);
    }
    acc -= STEP;
    steps++;
  }
  if (cssW === 0) resize();
  ctx2d.clearRect(0, 0, cssW, cssH);
  fight.renderer.draw(skCanvas as never, {
    world: fight.world,
    roster,
    atlases: atlases as never,
    stageImages: stageImages[fight.world.stageId] as never,
    names: fight.names,
    width: cssW,
    height: cssH,
    debugBoxes,
  });

  if (t - lastUi > 150) {
    lastUi = t;
    const me = fight.world.fighters[0];
    if (me.charId !== fight.assistsFor) {
      fight.assistsFor = me.charId;
      fight.simple.setCharacter(roster[me.charId], simpleKit(roster[me.charId], BUILTIN[me.charId].meta));
      renderAssists();
    }
    const ready = me.power >= 1000;
    $("pad").querySelector<HTMLElement>('[data-id="super"]')?.classList.toggle("off", !ready);
    document.querySelectorAll<HTMLButtonElement>(".assist").forEach((b, i) => {
      const kind = fight!.assists[i]?.kind;
      b.disabled = (kind === "super" && !ready) || (kind === "super2" && me.power < 2000) || (kind === "max" && (!ready || me.maxTime > 0));
    });
    const w = fight.world;
    if (!fight.over && w.matchWinner >= 0 && w.roundStateTime > 120) {
      fight.over = true;
      const winner = w.matchWinner === 0 || w.matchWinner === 1 ? w.fighters[w.matchWinner].charId : null;
      const quotes = winner ? (BUILTIN[winner]?.meta.quotes ?? []) : [];
      const quote = winner && quotes.length ? { name: roster[winner].displayName, text: quotes[Math.floor(Math.random() * quotes.length)] } : null;
      const title =
        w.matchWinner === 2
          ? "Empate"
          : w.matchWinner === 0
            ? fight.mode === "arcade" && state.ladder.length === 0
              ? "Campeão!"
              : "Vitória"
            : "Derrota";
      showPanel("result", title, quote);
    }
  }
}

// --------------------------------------------------------------- início

if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");
window.addEventListener("touchstart", () => document.body.classList.add("touch"), { once: true, passive: true });

Promise.all([atlasReady, stagesReady]).then(() => {
  document.querySelectorAll<HTMLCanvasElement>("canvas[data-hero]").forEach((c) => drawPortrait(c, c.dataset.hero!, c.dataset.flip === "1"));
  $("loading").hidden = true;
  renderPad();
  updateHints();
  show("menu");
  requestAnimationFrame(frame);
});
