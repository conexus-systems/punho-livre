/**
 * Editor de hitbox e frame data (página de desenvolvimento, `npm run editor`).
 *
 * Abre um personagem do elenco embutido ou uma pasta do importador de sprites
 * (manifest.json + PNGs), avança as animações quadro a quadro, mostra Clsn1/Clsn2 e o
 * eixo sobre o sprite, deixa arrastar/redimensionar caixas e mudar ticks, e exporta o
 * .air (e o manifest.json, quando veio de pasta). A frame data é medida na engine com
 * as caixas atuais (src/engine/framedata.ts).
 */

import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import type { FrameData } from "@/src/engine/framedata";
import type { Box } from "@/src/engine/types";

import {
  ACTION_NAMES,
  animTicks,
  charFromManifest,
  charFromPack,
  dragBox,
  exportAir,
  exportManifest,
  measure,
  type EdAnim,
  type EdChar,
  type EdFrame,
  type Handle,
  type Manifest,
} from "./model";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------- estado

let char: EdChar | null = null;
/** Embutido: páginas do atlas; pasta: PNG por nome de arquivo. */
let pages: HTMLImageElement[] = [];
let pngs = new Map<string, HTMLImageElement>();
let actionId = 0;
let frameIdx = 0;
let selected: { kind: 1 | 2; i: number } | null = null;
let zoom = 1;
let playing = false;
let tickInFrame = 0;
/** Nomes dos golpes por estado (da última medição). */
let moveNames = new Map<number, string>();
let lastFrameData: FrameData[] = [];

const canvas = $<HTMLCanvasElement>("view");
const ctx = canvas.getContext("2d")!;

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function anim(): EdAnim | null {
  return char?.anims[actionId] ?? null;
}
function frame(): EdFrame | null {
  const a = anim();
  return a ? a.frames[Math.min(frameIdx, a.frames.length - 1)] ?? null : null;
}
/** Pixels de tela (CSS) por unidade das caixas. */
function scale(): number {
  if (!char) return 1;
  return zoom * (char.unit === "px" ? 1 / char.pixelsPerUnit : 1);
}
function origin(): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: r.width / 2, y: r.height * 0.84 };
}
/** Unidade "base" (1 do MUGEN) expressa na unidade das caixas. */
function unitStep(): number {
  return char?.unit === "px" ? char.pixelsPerUnit : 1;
}

// ------------------------------------------------------------- carregar

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

async function openBuiltin(id: string): Promise<void> {
  const b = BUILTIN[id];
  char = charFromPack(b.pack);
  pngs = new Map();
  pages = await Promise.all(b.atlasModules.map((m) => loadImage(String(m))));
  for (const [i, sp] of b.meta.specials.entries()) moveNames.set(1000 + i * 100, sp.name);
  afterLoad();
  $("load-msg").textContent = `${b.meta.name}: ${Object.keys(char.anims).length} ações, caixas em unidades do MUGEN.`;
}

async function openManifest(m: Manifest, readText: (f: string) => Promise<string | null>, imageUrl: (f: string) => string | null): Promise<void> {
  const texts: Record<string, string> = {};
  for (const f of [m.cns, m.cmd, ...[].concat((m.st as never) ?? [])]) {
    const t = await readText(f);
    if (t === null) throw new Error(`arquivo ${f} não encontrado na pasta`);
    texts[f] = t;
  }
  const c = charFromManifest(m, texts);
  const files = new Set<string>();
  for (const a of Object.values(c.anims)) for (const f of a.frames) if (f.file) files.add(f.file);
  const missing: string[] = [];
  const loaded = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...files].map(async (f) => {
      const url = imageUrl(f);
      if (!url) missing.push(f);
      else loaded.set(f, await loadImage(url));
    }),
  );
  char = c;
  pages = [];
  pngs = loaded;
  moveNames = new Map();
  afterLoad();
  $("load-msg").innerHTML = `${m.name}: ${Object.keys(c.anims).length} ações, caixas em pixels (${m.pixelsPerUnit} px/unidade).${missing.length ? `<br><span class="err">PNG faltando: ${missing.join(", ")}</span>` : ""}`;
}

async function openFolder(list: FileList): Promise<void> {
  const byName = new Map<string, File>();
  for (const f of Array.from(list)) byName.set(f.name, f);
  const mf = byName.get("manifest.json");
  if (!mf) throw new Error("a pasta não tem manifest.json");
  const m = JSON.parse(await mf.text()) as Manifest;
  await openManifest(
    m,
    async (f) => (byName.get(f) ? await byName.get(f)!.text() : null),
    (f) => (byName.get(f) ? URL.createObjectURL(byName.get(f)!) : null),
  );
  const opt = document.createElement("option");
  opt.value = "@pasta";
  opt.textContent = `${m.name} (pasta)`;
  $<HTMLSelectElement>("char").append(opt);
  $<HTMLSelectElement>("char").value = "@pasta";
}

async function openManifestUrl(url: string): Promise<void> {
  const base = new URL(url, location.href);
  const m = (await (await fetch(base)).json()) as Manifest;
  await openManifest(
    m,
    async (f) => {
      const r = await fetch(new URL(f, base));
      return r.ok ? r.text() : null;
    },
    (f) => new URL(f, base).href,
  );
}

function afterLoad(): void {
  if (!char) return;
  actionId = char.anims[actionId] ? actionId : char.anims[0] ? 0 : Number(Object.keys(char.anims)[0]);
  frameIdx = 0;
  selected = null;
  fitZoom();
  renderActions();
  selectAction(actionId);
  scheduleMeasure(0);
}

function fitZoom(): void {
  const r = canvas.getBoundingClientRect();
  zoom = Math.max(1, Math.min(4, (r.height * 0.7) / 120));
}

// ------------------------------------------------------------- lista e timeline

function actionLabel(id: number): string {
  return moveNames.get(id) ?? ACTION_NAMES[id] ?? (id >= 200 && id < 700 ? "normal" : id >= 1000 && id < 3000 ? "especial" : id >= 3000 && id < 5000 ? "super" : "");
}

function renderActions(): void {
  const nav = $("actions");
  nav.textContent = "";
  if (!char) return;
  const q = $<HTMLInputElement>("filter").value.trim().toLowerCase();
  for (const a of Object.values(char.anims).sort((x, y) => x.id - y.id)) {
    const label = actionLabel(a.id);
    if (q && !`${a.id} ${label}`.toLowerCase().includes(q)) continue;
    const b = document.createElement("button");
    b.setAttribute("aria-current", String(a.id === actionId));
    b.innerHTML = `<span class="n">${a.id}</span><span class="d">${label}</span><span class="d" style="flex:none">${a.frames.length}q · ${animTicks(a)}t</span>`;
    b.onclick = () => selectAction(a.id);
    nav.append(b);
  }
}

function selectAction(id: number): void {
  actionId = id;
  frameIdx = 0;
  tickInFrame = 0;
  selected = null;
  for (const b of Array.from($("actions").children)) b.setAttribute("aria-current", String(b.querySelector(".n")?.textContent === String(id)));
  syncAll();
  renderFrameData();
}

function renderTimeline(): void {
  const tl = $("timeline");
  tl.textContent = "";
  const a = anim();
  if (!a) return;
  a.frames.forEach((f, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-current", String(i === frameIdx));
    if (f.clsn1.length) b.classList.add("hit");
    b.innerHTML = `<span class="t">${i + 1}</span><span class="s">${f.time < 0 ? "∞" : `${f.time}t`}${i === a.loopStart && a.loopStart > 0 ? " ↺" : ""}</span>`;
    b.title = `quadro ${i + 1}: sprite ${f.file ?? `${f.group},${f.index}`}, ${f.time} ticks, ${f.clsn1.length} Clsn1, ${f.clsn2.length} Clsn2`;
    b.onclick = () => {
      frameIdx = i;
      tickInFrame = 0;
      selected = null;
      syncAll();
    };
    tl.append(b);
  });
}

function syncInspector(): void {
  const f = frame();
  const a = anim();
  $<HTMLInputElement>("ticks").value = f ? String(f.time) : "";
  $<HTMLInputElement>("sprite").value = f ? (f.file !== undefined ? f.file ?? "(vazio)" : `${f.group},${f.index}`) : "";
  $<HTMLInputElement>("flip").checked = f?.flipH ?? false;
  $<HTMLInputElement>("loop").checked = a?.loop ?? true;
  $("box-unit").textContent = char ? `(${char.unit === "px" ? "pixels" : "unidades"}, relativas ao eixo)` : "";
  const b = selectedBox();
  for (const k of ["x1", "y1", "x2", "y2"] as const) {
    const input = $<HTMLInputElement>(`b${k}`);
    input.disabled = !b;
    input.value = b ? String(b[k]) : "";
  }
  $("box-msg").textContent = b ? `Clsn${selected!.kind}[${selected!.i}] selecionada` : "Clsn1 = onde o golpe acerta (vermelho); Clsn2 = onde o corpo apanha (azul). Clique numa caixa para selecionar.";
  $<HTMLButtonElement>("export-manifest").disabled = !char?.manifest;
  const ticks = a ? animTicks(a) : 0;
  $("info").textContent = a && f ? `ação ${a.id} · quadro ${frameIdx + 1}/${a.frames.length} · ${ticks} ticks${a.frames.some((x) => x.time < 0) ? " + ∞" : ""} · zoom ${zoom.toFixed(1)}×` : "";
}

function syncAll(): void {
  renderTimeline();
  syncInspector();
  draw();
}

// ------------------------------------------------------------- desenho

function selectedBox(): Box | null {
  const f = frame();
  if (!f || !selected) return null;
  return (selected.kind === 1 ? f.clsn1 : f.clsn2)[selected.i] ?? null;
}

function drawSprite(f: EdFrame, s: number, o: { x: number; y: number }, alpha = 1): void {
  if (!char) return;
  let img: HTMLImageElement | undefined;
  let sx = 0;
  let sy = 0;
  let sw = 0;
  let sh = 0;
  let ax = 0;
  let ay = 0;
  if (char.source === "builtin") {
    const e = char.atlasFrames?.[`${f.group},${f.index}`];
    if (!e) return;
    [sx, sy, sw, sh, ax, ay] = e;
    img = pages[e[6] ?? 0];
  } else {
    if (!f.file) return;
    img = pngs.get(f.file);
    if (!img) return;
    sw = img.naturalWidth;
    sh = img.naturalHeight;
    [ax, ay] = f.axis ?? [0, 0];
  }
  if (!img || !img.complete || !img.naturalWidth) return;
  const k = 1 / char.imagePxPerUnit; // px de imagem → unidade das caixas
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(o.x + f.ox * s, o.y + f.oy * s);
  if (f.flipH) ctx.scale(-1, 1);
  if (f.flipV) ctx.scale(1, -1);
  ctx.imageSmoothingEnabled = s * k < 2;
  ctx.drawImage(img, sx, sy, sw, sh, -ax * k * s, -ay * k * s, sw * k * s, sh * k * s);
  ctx.restore();
}

function drawBoxes(list: Box[], kind: 1 | 2, s: number, o: { x: number; y: number }): void {
  const color = css(kind === 1 ? "--clsn1" : "--clsn2");
  list.forEach((b, i) => {
    const x = o.x + b.x1 * s;
    const y = o.y + b.y1 * s;
    const w = (b.x2 - b.x1) * s;
    const h = (b.y2 - b.y1) * s;
    const sel = selected?.kind === kind && selected.i === i;
    ctx.fillStyle = color;
    ctx.globalAlpha = sel ? 0.35 : 0.2;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
    if (sel) {
      ctx.fillStyle = "#ffffff";
      for (const [hx, hy] of handlePoints(b, s, o)) ctx.fillRect(hx - 4, hy - 4, 8, 8);
    }
  });
}

function handlePoints(b: Box, s: number, o: { x: number; y: number }): [number, number, Handle][] {
  const x1 = o.x + b.x1 * s;
  const x2 = o.x + b.x2 * s;
  const y1 = o.y + b.y1 * s;
  const y2 = o.y + b.y2 * s;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return [
    [x1, y1, "nw"],
    [mx, y1, "n"],
    [x2, y1, "ne"],
    [x2, my, "e"],
    [x2, y2, "se"],
    [mx, y2, "s"],
    [x1, y2, "sw"],
    [x1, my, "w"],
  ];
}

function draw(): void {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) {
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, r.width, r.height);
  const o = origin();
  const s = scale();
  // grade a cada 10 unidades do MUGEN
  const step = 10 * unitStep() * s;
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = o.x % step; x < r.width; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, r.height);
  }
  for (let y = o.y % step; y < r.height; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(r.width, Math.round(y) + 0.5);
  }
  ctx.stroke();
  // chão
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(0, Math.round(o.y) + 0.5);
  ctx.lineTo(r.width, Math.round(o.y) + 0.5);
  ctx.stroke();

  const f = frame();
  const a = anim();
  if (!f || !a) return;
  // quadro anterior bem apagado (referência de movimento)
  if (!playing && frameIdx > 0) drawSprite(a.frames[frameIdx - 1], s, o, 0.18);
  drawSprite(f, s, o);
  drawBoxes(f.clsn2, 2, s, o);
  drawBoxes(f.clsn1, 1, s, o);
  // eixo
  ctx.strokeStyle = css("--axis");
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x - 10, o.y);
  ctx.lineTo(o.x + 10, o.y);
  ctx.moveTo(o.x, o.y - 10);
  ctx.lineTo(o.x, o.y + 10);
  ctx.stroke();
}

// ------------------------------------------------------------- mouse

let drag: { kind: 1 | 2; i: number; handle: Handle; orig: Box; u: number; v: number } | null = null;

function toUnits(ev: PointerEvent): { u: number; v: number; px: number; py: number } {
  const r = canvas.getBoundingClientRect();
  const o = origin();
  const s = scale();
  const px = ev.clientX - r.left;
  const py = ev.clientY - r.top;
  return { u: (px - o.x) / s, v: (py - o.y) / s, px, py };
}

function hit(ev: PointerEvent): { kind: 1 | 2; i: number; handle: Handle } | null {
  const f = frame();
  if (!f) return null;
  const { u, v, px, py } = toUnits(ev);
  const b = selectedBox();
  if (b && selected) {
    for (const [hx, hy, h] of handlePoints(b, scale(), origin())) {
      if (Math.abs(px - hx) <= 6 && Math.abs(py - hy) <= 6) return { ...selected, handle: h };
    }
  }
  let best: { kind: 1 | 2; i: number; handle: Handle; area: number } | null = null;
  for (const kind of [1, 2] as const) {
    (kind === 1 ? f.clsn1 : f.clsn2).forEach((bx, i) => {
      if (u >= bx.x1 && u <= bx.x2 && v >= bx.y1 && v <= bx.y2) {
        const area = (bx.x2 - bx.x1) * (bx.y2 - bx.y1);
        if (!best || area < best.area) best = { kind, i, handle: "move", area };
      }
    });
  }
  return best;
}

const CURSORS: Record<Handle, string> = { move: "move", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };

canvas.addEventListener("pointerdown", (ev) => {
  const h = hit(ev);
  if (!h) {
    selected = null;
    syncInspector();
    draw();
    return;
  }
  selected = { kind: h.kind, i: h.i };
  const f = frame()!;
  const { u, v } = toUnits(ev);
  drag = { ...h, orig: { ...(h.kind === 1 ? f.clsn1 : f.clsn2)[h.i] }, u, v };
  canvas.setPointerCapture(ev.pointerId);
  syncInspector();
  draw();
});

canvas.addEventListener("pointermove", (ev) => {
  if (!drag) {
    const h = hit(ev);
    canvas.style.cursor = h ? CURSORS[h.handle] : "crosshair";
    return;
  }
  const f = frame();
  if (!f) return;
  const { u, v } = toUnits(ev);
  const list = drag.kind === 1 ? f.clsn1 : f.clsn2;
  list[drag.i] = dragBox(drag.orig, drag.handle, Math.round(u - drag.u), Math.round(v - drag.v));
  syncInspector();
  draw();
});

canvas.addEventListener("pointerup", () => {
  if (drag) {
    drag = null;
    edited();
  }
});

canvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  setZoom(zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1));
});

function setZoom(z: number): void {
  zoom = Math.max(0.5, Math.min(12, z));
  syncInspector();
  draw();
}

// ------------------------------------------------------------- edição

function edited(): void {
  renderTimeline();
  syncInspector();
  draw();
  renderActions();
  scheduleMeasure();
}

function step(d: number): void {
  const a = anim();
  if (!a) return;
  frameIdx = (frameIdx + d + a.frames.length) % a.frames.length;
  tickInFrame = 0;
  selected = null;
  syncAll();
}

function addBox(kind: 1 | 2): void {
  const f = frame();
  if (!f) return;
  const k = unitStep();
  const b = kind === 1 ? { x1: 10 * k, y1: -70 * k, x2: 45 * k, y2: -55 * k } : { x1: -15 * k, y1: -90 * k, x2: 15 * k, y2: 0 };
  const list = kind === 1 ? f.clsn1 : f.clsn2;
  list.push(b);
  selected = { kind, i: list.length - 1 };
  edited();
}

function deleteBox(): void {
  const f = frame();
  if (!f || !selected) return;
  (selected.kind === 1 ? f.clsn1 : f.clsn2).splice(selected.i, 1);
  selected = null;
  edited();
}

function download(name: string, text: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("prev").onclick = () => step(-1);
$("next").onclick = () => step(1);
$("add1").onclick = () => addBox(1);
$("add2").onclick = () => addBox(2);
$("del").onclick = deleteBox;
$("copy-prev").onclick = () => {
  const a = anim();
  const f = frame();
  if (!a || !f || frameIdx === 0) return;
  const p = a.frames[frameIdx - 1];
  f.clsn1 = p.clsn1.map((b) => ({ ...b }));
  f.clsn2 = p.clsn2.map((b) => ({ ...b }));
  selected = null;
  edited();
};
$("zoom-in").onclick = () => setZoom(zoom * 1.25);
$("zoom-out").onclick = () => setZoom(zoom / 1.25);
$("play").onclick = () => togglePlay();
$<HTMLInputElement>("ticks").onchange = (ev) => {
  const f = frame();
  const v = Math.trunc(Number((ev.target as HTMLInputElement).value));
  if (!f || !Number.isFinite(v) || (v < 1 && v !== -1)) return syncInspector();
  f.time = v;
  edited();
};
$<HTMLInputElement>("flip").onchange = (ev) => {
  const f = frame();
  if (!f) return;
  f.flipH = (ev.target as HTMLInputElement).checked;
  edited();
};
$<HTMLInputElement>("loop").onchange = (ev) => {
  const a = anim();
  if (!a) return;
  a.loop = (ev.target as HTMLInputElement).checked;
  edited();
};
for (const k of ["x1", "y1", "x2", "y2"] as const) {
  $<HTMLInputElement>(`b${k}`).onchange = (ev) => {
    const b = selectedBox();
    const v = Number((ev.target as HTMLInputElement).value);
    if (!b || !Number.isFinite(v)) return;
    b[k] = Math.round(v);
    const f = frame()!;
    const list = selected!.kind === 1 ? f.clsn1 : f.clsn2;
    list[selected!.i] = dragBox(b, "se", 0, 0);
    edited();
  };
}
$("export-air").onclick = () => {
  if (!char) return;
  download(`${char.id}.air`, exportAir(char));
  $("export-msg").textContent = `${char.id}.air baixado. ${char.source === "builtin" ? "Elenco embutido: leve as mudanças para scripts/roster (o .air dele é gerado)." : ""}`;
};
$("export-manifest").onclick = () => {
  if (!char?.manifest) return;
  download("manifest.json", `${JSON.stringify(exportManifest(char), null, 2)}\n`);
  $("export-msg").textContent = "manifest.json baixado. Rode npm run import-sprites -- <pasta> para gerar o atlas e o .air.";
};
$<HTMLInputElement>("filter").oninput = renderActions;
$("open-folder").onclick = () => $<HTMLInputElement>("folder").click();
$<HTMLInputElement>("folder").onchange = async (ev) => {
  const files = (ev.target as HTMLInputElement).files;
  if (!files?.length) return;
  try {
    await openFolder(files);
  } catch (err) {
    $("load-msg").innerHTML = `<span class="err">${(err as Error).message}</span>`;
  }
};
$<HTMLSelectElement>("char").onchange = (ev) => {
  const v = (ev.target as HTMLSelectElement).value;
  if (BUILTIN[v]) void openBuiltin(v);
};

document.addEventListener("keydown", (ev) => {
  if ((ev.target as HTMLElement).closest("input, select")) return;
  if (ev.key === "ArrowLeft") step(-1);
  else if (ev.key === "ArrowRight") step(1);
  else if (ev.key === " ") togglePlay();
  else if (ev.key === "Delete" || ev.key === "Backspace") deleteBox();
  else if (ev.key === "1") addBox(1);
  else if (ev.key === "2") addBox(2);
  else if (ev.key === "+" || ev.key === "=") setZoom(zoom * 1.25);
  else if (ev.key === "-") setZoom(zoom / 1.25);
  else return;
  ev.preventDefault();
});

// ------------------------------------------------------------- tocar

let lastTime = 0;
function togglePlay(): void {
  playing = !playing;
  $("play").textContent = playing ? "❚❚ Pausar" : "▶ Tocar";
  selected = null;
  lastTime = performance.now();
  if (playing) requestAnimationFrame(tick);
  else syncAll();
}

function tick(now: number): void {
  if (!playing) return;
  const a = anim();
  if (!a) return;
  const ticks = Math.min(10, Math.floor(((now - lastTime) * 60) / 1000));
  if (ticks > 0) lastTime += (ticks * 1000) / 60;
  for (let i = 0; i < ticks; i++) {
    const f = a.frames[frameIdx];
    if (f.time < 0) break;
    tickInFrame++;
    if (tickInFrame >= f.time) {
      tickInFrame = 0;
      frameIdx++;
      if (frameIdx >= a.frames.length) frameIdx = a.loop ? a.loopStart : 0;
    }
  }
  if (ticks > 0) {
    renderTimeline();
    syncInspector();
    draw();
  }
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------- frame data

let measureTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleMeasure(delay = 350): void {
  if (measureTimer) clearTimeout(measureTimer);
  measureTimer = setTimeout(runMeasure, delay);
}

function runMeasure(): void {
  if (!char) return;
  try {
    const t0 = performance.now();
    const { data } = measure(char);
    lastFrameData = data.moves;
    for (const m of data.moves) if (!moveNames.has(m.state)) moveNames.set(m.state, m.name);
    $("fd-msg").textContent = `${data.moves.length} golpes medidos em ${Math.round(performance.now() - t0)} ms (boneco: o próprio personagem).`;
    renderActions();
  } catch (err) {
    lastFrameData = [];
    $("fd-msg").innerHTML = `<span class="err">a engine não carregou o personagem: ${(err as Error).message}</span>`;
  }
  renderFrameData();
}

const signed = (v: number | null) => (v === null ? "—" : v > 0 ? `+${v}` : `${v}`);
const plain = (v: number | null) => (v === null ? "—" : `${v}`);

function renderFrameData(): void {
  const box = $("fd");
  if (!lastFrameData.length) {
    box.textContent = "";
    return;
  }
  const rows = lastFrameData
    .map(
      (m) =>
        `<tr class="${m.state === actionId ? "cur" : ""}" data-state="${m.state}" title="${m.name} (estado ${m.state})"><td>${m.state} ${m.name}</td><td>${plain(m.startup)}</td><td>${m.projectile ? "proj" : plain(m.active)}</td><td>${plain(m.recovery)}</td><td>${signed(m.onHit)}${m.knockdown ? " KD" : ""}</td><td>${signed(m.onBlock)}</td><td>${m.damage}</td></tr>`,
    )
    .join("");
  box.innerHTML = `<table><thead><tr><th>Golpe</th><th>St</th><th>Atv</th><th>Rec</th><th>Acerto</th><th>Def.</th><th>Dano</th></tr></thead><tbody>${rows}</tbody></table>`;
  for (const tr of Array.from(box.querySelectorAll("tr[data-state]"))) {
    const st = Number((tr as HTMLElement).dataset.state);
    (tr as HTMLElement).style.cursor = char?.anims[st] ? "pointer" : "default";
    (tr as HTMLElement).onclick = () => char?.anims[st] && selectAction(st);
  }
}

// ------------------------------------------------------------- início

window.addEventListener("resize", () => draw());

const select = $<HTMLSelectElement>("char");
for (const id of BUILTIN_ORDER) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = BUILTIN[id].meta.name;
  select.append(o);
}

const params = new URLSearchParams(location.search);
actionId = Number(params.get("action") ?? 0);
const start = async () => {
  const manifestUrl = params.get("manifest");
  if (manifestUrl) await openManifestUrl(manifestUrl);
  else {
    const id = params.get("char") ?? BUILTIN_ORDER[0];
    select.value = id;
    await openBuiltin(BUILTIN[id] ? id : BUILTIN_ORDER[0]);
  }
  const f = Number(params.get("frame") ?? 0);
  if (f > 0) {
    frameIdx = Math.min(f - 1, (anim()?.frames.length ?? 1) - 1);
    syncAll();
  }
  document.body.dataset.ready = "1";
};
start().catch((err) => {
  $("load-msg").innerHTML = `<span class="err">${(err as Error).message}</span>`;
  document.body.dataset.ready = "erro";
});

// usado pelo teste com Playwright
(window as unknown as { editor: unknown }).editor = {
  state: () => ({ char: char?.id, actionId, frameIdx, selected, frame: frame() }),
  exportAir: () => (char ? exportAir(char) : ""),
  exportManifest: () => (char?.manifest ? exportManifest(char) : null),
  frameData: () => lastFrameData,
  measureNow: () => runMeasure(),
};
