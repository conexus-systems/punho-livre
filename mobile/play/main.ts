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
import { findCommand, macroFromCommand, MacroPlayer } from "@/src/game/macros";
import { FightRenderer } from "@/src/game/renderer";
import { STAGES } from "@/src/game/stages";

import { Canvas2D } from "./skia-canvas2d";

type Mode = "arcade" | "versus" | "training";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------- elenco

const roster: Roster = {};
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);

const atlases: Record<string, HTMLImageElement[]> = {};
const atlasReady: Promise<void> = Promise.all(
  BUILTIN_ORDER.map(
    (id) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = String(BUILTIN[id].atlasModules[0]);
        atlases[id] = [img];
      }),
  ),
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
};

function show(screen: "menu" | "select" | "fight") {
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
  renderSelect();
  show("select");
}

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
  b.addEventListener("click", () => startMode(b.dataset.mode as Mode));
});
$("help-open").addEventListener("click", () => ($("help").hidden = false));
$("help-close").addEventListener("click", () => ($("help").hidden = true));

// ---------------------------------------------------------- seleção

const MODE_NAME: Record<Mode, string> = { arcade: "Arcade", versus: "Versus CPU", training: "Treino" };

function renderSelect() {
  $("select-kicker").textContent = MODE_NAME[state.mode];
  $("select-title").textContent = state.picking === 1 ? "Seu lutador" : state.mode === "training" ? "Boneco de treino" : "Oponente";
  const needsP2 = state.mode !== "arcade";
  const go = $<HTMLButtonElement>("select-go");
  go.textContent = state.picking === 1 && needsP2 ? "Próximo" : "Lutar";

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
  $("difficulty-row").hidden = state.mode !== "versus";
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
  if (state.picking === 2) {
    state.picking = 1;
    renderSelect();
  } else show("menu");
});

// ------------------------------------------------------------ controles

const KEYMAP: Record<string, number> = {
  ArrowUp: Btn.U, KeyW: Btn.U,
  ArrowDown: Btn.D, KeyS: Btn.D,
  ArrowLeft: Btn.L, KeyA: Btn.L,
  ArrowRight: Btn.R, KeyD: Btn.R,
  KeyU: Btn.x, KeyI: Btn.y, KeyO: Btn.z,
  KeyJ: Btn.a, KeyK: Btn.b, KeyL: Btn.c,
};
const held = new Set<string>();
let touchBits = 0;

window.addEventListener("keydown", (e) => {
  if ($("fight").hidden) {
    if (!$("select").hidden && (e.code === "Enter" || e.code === "Space")) confirmPick();
    return;
  }
  if (e.code in KEYMAP) {
    held.add(e.code);
    e.preventDefault();
  }
  if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") assist(Number(e.code.slice(5)) - 1);
  if (e.code === "Digit4") assist(3);
  if (e.code === "Escape" || e.code === "KeyP") togglePause();
  if (e.code === "KeyB" && fight?.mode === "training") debugBoxes = !debugBoxes;
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => held.clear());

function keyboardBits(): number {
  let bits = 0;
  for (const k of held) bits |= KEYMAP[k] ?? 0;
  return bits | touchBits;
}

// toque: direcional flutuante à esquerda, botões à direita (pointer events, multitoque)
const touchLayer = $("touch");
const stickBase = $("stick");
const stickKnob = $("stick-knob");
const pointers = new Map<number, { x: number; y: number; ox: number; oy: number; kind: "stick" | "button"; bit: number }>();

function dirFrom(dx: number, dy: number): number {
  if (Math.hypot(dx, dy) < 14) return 0;
  const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) & 7;
  return [Btn.R, Btn.R | Btn.D, Btn.D, Btn.D | Btn.L, Btn.L, Btn.L | Btn.U, Btn.U, Btn.U | Btn.R][oct];
}

function updateTouch() {
  let bits = 0;
  let stick: { ox: number; oy: number; x: number; y: number } | null = null;
  for (const p of pointers.values()) {
    if (p.kind === "stick") {
      bits |= dirFrom(p.x - p.ox, p.y - p.oy);
      stick = p;
    } else bits |= p.bit;
  }
  touchBits = bits;
  document.querySelectorAll<HTMLElement>("[data-bit]").forEach((el) => {
    el.classList.toggle("on", (bits & Number(el.dataset.bit)) !== 0);
  });
  stickBase.hidden = !stick;
  if (stick) {
    stickBase.style.left = `${stick.ox - 50}px`;
    stickBase.style.top = `${stick.oy - 50}px`;
    const d = dirFrom(stick.x - stick.ox, stick.y - stick.oy);
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
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: 0, oy: 0, kind: "button", bit: Number(target.dataset.bit) });
  } else if (e.clientX < window.innerWidth * 0.45) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, kind: "stick", bit: 0 });
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

interface Fight {
  mode: Mode;
  world: WorldState;
  cpu: CpuController | null;
  macro: MacroPlayer;
  renderer: FightRenderer;
  names: [string, string];
  assists: { label: string; cmd: string; isSuper: boolean }[];
  over: boolean;
}

let fight: Fight | null = null;
let paused = false;
let debugBoxes = false;

function startFight() {
  const p1 = state.p1!;
  const p2 = state.p2!;
  const training = state.mode === "training";
  const stageId = state.mode === "arcade" ? STAGES[(state.stageNo - 1) % STAGES.length].id : state.stage;
  const meta = BUILTIN[p1].meta;
  fight = {
    mode: state.mode,
    world: createWorld({ chars: [p1, p2], stageId, seed: (Math.random() * 2 ** 31) | 0, roundsToWin: training ? 99 : 2, roundTime: training ? -1 : 99, training }, roster),
    cpu: training ? null : new CpuController(1, roster[p2] as CharacterData, state.mode === "arcade" ? (Math.min(3, 1 + Math.floor(state.stageNo / 2)) as 1 | 2 | 3) : state.difficulty),
    macro: new MacroPlayer(),
    renderer: new FightRenderer(),
    names: [roster[p1].displayName, roster[p2].displayName],
    assists: [...meta.specials.map((s) => ({ label: s.name, cmd: s.cmd, isSuper: false })), { label: "Super", cmd: meta.super.cmd, isSuper: true }],
    over: false,
  };
  debugBoxes = training;
  paused = false;
  $("overlay").hidden = true;
  $("arcade-step").textContent = state.mode === "arcade" ? `luta ${state.stageNo} de ${state.stageNo + state.ladder.length}` : "";
  const assistBox = $("assists");
  assistBox.replaceChildren();
  fight.assists.forEach((a, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.assist = String(i);
    b.className = "assist";
    b.textContent = a.label;
    b.title = `Tecla ${i + 1}`;
    assistBox.append(b);
  });
  show("fight");
  resize();
}

function assist(i: number) {
  if (!fight || paused) return;
  const a = fight.assists[i];
  if (!a) return;
  const me = fight.world.fighters[0];
  if (a.isSuper && me.power < 1000) return;
  const cmd = findCommand(roster[me.charId], a.cmd);
  if (cmd) fight.macro.play(macroFromCommand(cmd), me.facing);
}

function togglePause() {
  if (!fight || fight.over) return;
  paused = !paused;
  showPanel(paused ? "pause" : null);
}

$("pause-btn").addEventListener("click", togglePause);

function showPanel(kind: "pause" | "result" | null, title = "") {
  const overlay = $("overlay");
  overlay.hidden = kind === null;
  if (!kind || !fight) return;
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

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
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
  if (!fight || $("fight").hidden) {
    last = t;
    return;
  }
  if (last === 0) last = t;
  acc += Math.min(100, t - last);
  last = t;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    if (!paused) {
      const w = fight.world;
      const local = fight.macro.next() ?? keyboardBits();
      const cpu = fight.cpu ? fight.cpu.next(w) : 0;
      stepWorld(w, [local, cpu], roster);
      fight.renderer.addEvents(w.events, w, roster);
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
    names: fight.names,
    width: cssW,
    height: cssH,
    debugBoxes,
  });

  if (t - lastUi > 150) {
    lastUi = t;
    const ready = fight.world.fighters[0].power >= 1000;
    document.querySelectorAll<HTMLButtonElement>(".assist").forEach((b, i) => {
      b.disabled = fight!.assists[i]?.isSuper === true && !ready;
    });
    const w = fight.world;
    if (!fight.over && w.matchWinner >= 0 && w.roundStateTime > 120) {
      fight.over = true;
      const title =
        w.matchWinner === 2
          ? "Empate"
          : w.matchWinner === 0
            ? fight.mode === "arcade" && state.ladder.length === 0
              ? "Campeão!"
              : "Vitória"
            : "Derrota";
      showPanel("result", title);
    }
  }
}

// --------------------------------------------------------------- início

if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");
window.addEventListener("touchstart", () => document.body.classList.add("touch"), { once: true, passive: true });

atlasReady.then(() => {
  document.querySelectorAll<HTMLCanvasElement>("canvas[data-hero]").forEach((c) => drawPortrait(c, c.dataset.hero!, c.dataset.flip === "1"));
  $("loading").hidden = true;
  show("menu");
  requestAnimationFrame(frame);
});
