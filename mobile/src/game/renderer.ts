/**
 * Desenha um frame do mundo num SkCanvas (via PictureRecorder a cada frame).
 * Estado visual que não afeta a simulação (faíscas, tremida, barras com
 * atraso, textos do sistema) fica aqui, fora do WorldState determinístico.
 *
 * HUD no estilo KOF: vida com rastro e piscando no vermelho, medidor de
 * defesa, estoques de power com o modo MAX, retratos da equipe e textos de
 * sistema (COUNTER, JUST DEFEND, GUARD CRUSH...).
 *
 * Game feel: câmera viva (camera.ts: segue, zoom por distância, punch e
 * tremor), impactos por nível do golpe (effects.ts), lutador que apanhou
 * vibrando durante o hitstop e flash curto de tela no super e no K.O.
 * Tudo isso anda em `addEvents`, que precisa ser chamado uma vez por quadro
 * simulado: assim o que aparece na tela depende só do histórico da luta (o
 * mesmo replay desenha igual), não da taxa de quadros do aparelho.
 */

import { Platform } from "react-native";
import {
  BlendMode,
  matchFont,
  PaintStyle,
  Skia,
  TileMode,
  type SkCanvas,
  type SkFont,
  type SkImage,
  type SkPaint,
} from "@shopify/react-native-skia";

import { currentFrame, worldBox } from "@/src/engine/anim";
import { getAnim } from "@/src/engine/character";
import { GUARD_MAX, POWER_PER_LEVEL } from "@/src/engine/constants";
import { animCharOf } from "@/src/engine/fighter";
import type { Box, CharacterData, ExplodState, FighterState, GameEvent, ProjectileState, WorldState } from "@/src/engine/types";

import { STAGE_ART } from "./stages.generated";
import { FightCamera } from "./camera";
import { Effects } from "./effects";
import { StageCache, stageById, type StageImages } from "./stages";

export interface RenderInput {
  world: WorldState;
  roster: Record<string, CharacterData>;
  atlases: Record<string, SkImage[]>;
  /** Nomes no HUD (1 contra 1); sem isso, ou nas equipes, usa o nome do personagem. */
  names?: [string, string];
  width: number;
  height: number;
  /** Camadas pintadas do cenário já carregadas (ver stageArt.ts); sem elas, desenho procedural. */
  stageImages?: StageImages;
  /** Mostrar caixas Clsn (modo treino). */
  debugBoxes?: boolean;
  /** Mensagem central extra (ex.: "AGUARDANDO OPONENTE"). */
  banner?: string | null;
  /** Acessibilidade: sem tremor, punch, zoom por distância nem vibração do lutador; flashes fracos. */
  reduceMotion?: boolean;
}

/** Teto do alfa dos flashes de tela com "Reduzir movimento". */
const REDUCED_FLASH_ALPHA = 0.25;
/** Flash branco do super / do K.O. (quadros). */
const SUPER_FLASH_FRAMES = 5;
const KO_FLASH_FRAMES = 12;
/** Alfa do flash no primeiro quadro (cai linearmente). */
const SCREEN_FLASH_ALPHA = 0.7;

/** Texto de sistema que sobe da cabeça do lutador. */
interface Pop {
  text: string;
  x: number;
  y: number;
  age: number;
  color: string;
  /** Texto grande com faixa (COUNTER, GUARD CRUSH). */
  big?: boolean;
}

/** Textos com destaque: faixa inclinada, fonte grande e mais tempo na tela. */
const BIG_POPS = new Set<GameEvent["kind"]>(["counter", "guardcrush"]);
const POP_LIFE = 50;
const BIG_POP_LIFE = 62;

const POP_TEXT: Partial<Record<GameEvent["kind"], [string, string]>> = {
  counter: ["COUNTER", "#F97316"],
  justdefend: ["JUST DEFEND", "#38BDF8"],
  guardcrush: ["GUARD CRUSH", "#EF4444"],
  max: ["MAX", "#FACC15"],
  guardcancel: ["GUARD CANCEL", "#A3E635"],
  tech: ["ESCAPE", "#E5E7EB"],
};

const fontFamily = Platform.select({ ios: "Helvetica Neue", default: "sans-serif-condensed" });
type Fonts = { small: SkFont; medium: SkFont; big: SkFont; huge: SkFont };
let fonts: Fonts | null | undefined;
let fontsFor = 0;
/** Fontes do sistema para o HUD; null quando não há (ex.: navegador sem fontes do Skia) — o HUD desenha sem texto. */
function getFonts(h: number): Fonts | null {
  if (fonts === undefined || (fonts !== null && fontsFor !== h)) {
    try {
      fonts = {
        small: matchFont({ fontFamily, fontSize: Math.round(h * 0.035), fontWeight: "bold" }),
        medium: matchFont({ fontFamily, fontSize: Math.round(h * 0.05), fontWeight: "bold" }),
        big: matchFont({ fontFamily, fontSize: Math.round(h * 0.075), fontWeight: "bold" }),
        huge: matchFont({ fontFamily, fontSize: Math.round(h * 0.15), fontWeight: "bold" }),
      };
      fontsFor = h;
    } catch {
      fonts = null;
    }
  }
  return fonts;
}

/** Paint novo (para quem vai mexer nele: traço, shader, alfa variável). */
function paint(color: string, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (alpha < 1) p.setAlphaf(alpha);
  return p;
}

export class FightRenderer {
  private fx = new Effects();
  private camera = new FightCamera();
  /** Flash branco curto (super, K.O.): quadros restantes e duração. */
  private screenFlash = 0;
  private screenFlashLen = 1;
  /** Clarão branco no lutador que acabou de apanhar (frames restantes). */
  private flash: [number, number] = [0, 0];
  /** Estado anterior de cada lutador (para poeira ao pousar, quicar, correr). */
  private lastState: [number, number] = [-1, -1];
  private pops: Pop[] = [];
  private lifeTrail: [number, number] = [1, 1];
  private superFlash = 0;
  private superColor = "#000000";
  private frame = 0;
  private stage = new StageCache();
  /** Paints de cor sólida reaproveitados entre frames (só leitura: nunca altere o que `solid` devolve). */
  private solids = new Map<string, SkPaint>();
  private gradients = new Map<string, SkPaint>();

  /**
   * Um quadro simulado: avança efeitos, câmera e contadores e reage aos
   * eventos do quadro. Chame uma vez por stepWorld (não por desenho).
   */
  addEvents(events: GameEvent[], world: WorldState, roster: Record<string, CharacterData>): void {
    this.fx.beginFrame(world.frame);
    this.fx.tick();
    this.camera.update(world, events);
    for (let i = 0; i < 2; i++) if (this.flash[i] > 0) this.flash[i]--;
    if (this.superFlash > 0) this.superFlash--;
    if (this.screenFlash > 0) this.screenFlash--;
    if (this.pops.length) {
      for (const p of this.pops) p.age++;
      this.pops = this.pops.filter((p) => p.age <= (p.big ? BIG_POP_LIFE : POP_LIFE));
    }

    // poeira ao pousar, cair, correr e rolar
    for (const f of world.fighters) {
      const prev = this.lastState[f.side];
      if (f.stateNo !== prev) {
        if (f.stateNo === 52) this.fx.dust(f.x, 4);
        else if (f.stateNo === 5100) this.fx.dust(f.x, 10);
        else if (f.stateNo === 100 || f.stateNo === 6000 || f.stateNo === 6001) this.fx.dust(f.x, 5, -f.facing);
        this.lastState[f.side] = f.stateNo;
      }
    }

    const counterHit = events.some((e) => e.kind === "counter");
    for (const e of events) {
      if (e.kind === "hit" || e.kind === "guard") {
        const owner = world.fighters[e.side];
        const guard = e.kind === "guard";
        const color = roster[owner.charId]?.style.energy ?? "#FDE047";
        this.fx.impact(guard ? "guard" : counterHit ? "counter" : "hit", e.x, e.y, e.level, color, owner.facing);
        if (!guard) this.flash[e.side === 0 ? 1 : 0] = e.level >= 2 || counterHit ? 6 : 4;
      } else if (e.kind === "ko") {
        this.flashScreen(KO_FLASH_FRAMES);
      } else if (e.kind === "super") {
        this.superFlash = 30;
        this.superColor = e.level >= 3 ? "#7F1D1D" : "#000000";
        this.flashScreen(SUPER_FLASH_FRAMES);
        if (e.level >= 3) this.pops.push({ text: "MAX SUPER", x: e.x, y: e.y - 20, age: 0, color: "#FACC15", big: true });
      } else {
        const pop = POP_TEXT[e.kind];
        // os grandes sobem acima da cabeça para não cobrir o rosto
        const big = BIG_POPS.has(e.kind);
        if (pop) this.pops.push({ text: pop[0], x: e.x, y: big ? e.y - 38 : e.y, age: 0, color: pop[1], big });
        if (e.kind === "guardcrush") this.fx.impact("crush", e.x, e.y + 30, 2, "#EF4444", 1);
        if (e.kind === "max") {
          this.superFlash = 18;
          this.superColor = "#78350F";
        }
      }
    }
  }

  private flashScreen(frames: number): void {
    if (frames >= this.screenFlash) {
      this.screenFlash = frames;
      this.screenFlashLen = frames;
    }
  }

  private solid(color: string, alpha = 1): SkPaint {
    const key = alpha < 1 ? `${color}/${alpha.toFixed(2)}` : color;
    let p = this.solids.get(key);
    if (!p) {
      p = paint(color, alpha);
      this.solids.set(key, p);
    }
    return p;
  }

  private vGradient(top: number, bottom: number, from: string, to: string): SkPaint {
    const key = `${top}:${bottom}:${from}:${to}`;
    let p = this.gradients.get(key);
    if (!p) {
      p = Skia.Paint();
      p.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: top }, { x: 0, y: bottom }, [Skia.Color(from), Skia.Color(to)], null, TileMode.Clamp));
      if (this.gradients.size > 64) this.gradients.clear();
      this.gradients.set(key, p);
    }
    return p;
  }

  draw(c: SkCanvas, input: RenderInput): void {
    const { world: w, width, height } = input;
    this.frame++;
    const reduce = input.reduceMotion === true;
    this.camera.reduceMotion = reduce;
    const k = height / 250; // px por unidade (zoom 1)
    const groundPx = height * 0.8;
    const view = this.camera.view({ width, height, k, groundPx, hudPx: height * 0.2 });

    const cam = view.x;
    const sx = (x: number) => (x - cam) * k + width / 2;
    const sy = (y: number) => groundPx + y * k;

    // mundo com a câmera (zoom em volta do pivô + tremor); HUD e flashes ficam fora
    c.save();
    c.translate(view.pivotX + view.shakeX, view.pivotY + view.shakeY);
    if (view.zoom !== 1) c.scale(view.zoom, view.zoom);
    c.translate(-view.pivotX, -view.pivotY);

    this.stage.draw(c, stageById(w.stageId), { k, width, height, groundPx, cam, shakeX: 0, frame: this.frame }, STAGE_ART[w.stageId], input.stageImages);

    if (this.superFlash > 0) {
      c.drawRect(Skia.XYWHRect(0, 0, width, height), paint(this.superColor, Math.min(0.55, this.superFlash / 40)));
    }

    // sombras
    const shadow = this.solid("#000000", 0.28);
    for (const f of w.fighters) {
      const shadowW = 34 * k * Math.max(0.4, 1 + f.y / 200);
      c.drawOval(Skia.XYWHRect(sx(f.x) - shadowW / 2, sy(0) - 4 * k, shadowW, 8 * k), shadow);
    }

    // quem está atacando fica na frente
    const [f0, f1] = w.fighters;
    const order = f0.moveType === "A" && f1.moveType !== "A" ? [f1, f0] : [f0, f1];
    for (const e of w.explods) if (!e.onTop) this.drawExplod(c, e, input, sx, sy, k);
    for (const h of w.helpers) this.drawFighter(c, h, input, sx, sy, k);
    for (const f of order) {
      if (f.maxTime > 0) this.drawAura(c, f, input, sx, sy, k);
      this.drawFighter(c, f, input, sx, sy, k);
    }
    for (const p of w.projectiles) this.drawProjectile(c, p, input, sx, sy, k);
    for (const e of w.explods) if (e.onTop) this.drawExplod(c, e, input, sx, sy, k);
    if (input.debugBoxes) for (const f of w.fighters) this.drawBoxes(c, f, input, sx, sy, k);
    this.fx.draw(c, sx, sy, k);
    this.drawPops(c, input, sx, sy);
    c.restore();

    const cap = reduce ? REDUCED_FLASH_ALPHA : 1;
    if (this.screenFlash > 0) {
      c.drawRect(Skia.XYWHRect(0, 0, width, height), paint("#FFFFFF", Math.min(cap, SCREEN_FLASH_ALPHA * (this.screenFlash / this.screenFlashLen))));
    }
    this.drawHud(c, input);
  }

  /** Partículas vivas (para benchmark/diagnóstico). */
  get liveParticles(): number {
    return this.fx.liveParticles;
  }

  // ---------------------------------------------------------- lutadores

  private drawSprite(
    c: SkCanvas,
    ch: CharacterData,
    images: SkImage[] | undefined,
    group: number,
    index: number,
    x: number,
    y: number,
    flip: boolean,
    ox: number,
    oy: number,
    k: number,
    alpha = 1,
    over?: SkPaint,
    scaleX = 1,
    scaleY = 1,
  ): boolean {
    if (group < 0) return true; // frame vazio (invisível)
    const sheet = ch.sprites;
    if (!sheet || !images || images.length === 0) return false;
    const entry = sheet.frames[`${group},${index}`];
    if (!entry) return false;
    const [fx, fy, fw, fh, ax, ay, page = 0] = entry;
    const img = images[page];
    if (!img) return false;
    const scale = sheet.scale ?? 1;
    c.save();
    c.translate(x, y);
    if (flip || scaleX !== 1 || scaleY !== 1) c.scale(flip ? -scaleX : scaleX, scaleY);
    c.drawImageRect(
      img,
      Skia.XYWHRect(fx, fy, fw, fh),
      Skia.XYWHRect((ox - ax / scale) * k, (oy - ay / scale) * k, (fw / scale) * k, (fh / scale) * k),
      over ?? this.solid("#FFFFFF", alpha),
    );
    c.restore();
    return true;
  }

  private drawFighter(
    c: SkCanvas,
    f: FighterState,
    input: RenderInput,
    sx: (x: number) => number,
    sy: (y: number) => number,
    k: number,
  ): void {
    const ch = input.roster[f.charId];
    // arremesso do MUGEN: quem é arremessado usa as animações do atacante
    const animCh = animCharOf(input.world, input.roster, f);
    const anim = getAnim(animCh, f.anim);
    const frame = currentFrame(f, anim);
    const flip = (f.facing === -1) !== frame.flipH;
    // invencível pisca (menos ao levantar e no rolamento, que já se vê)
    const blink = f.notHitBy > 0 && f.stateNo !== 5120 && (f.stateNo < 6000 || f.stateNo > 6070) && this.frame % 4 < 2 ? 0.55 : 1;
    // quem apanhou vibra durante o hitstop (o shaketime do MUGEN)
    const shake = f.hitPause > 0 && f.moveType === "H" && !input.reduceMotion ? (input.world.frame % 2 === 0 ? 1 : -1) * Math.min(2.2, 0.6 + f.hitPause * 0.12) * k : 0;
    const fx = sx(f.x) + shake;
    const ok = this.drawSprite(c, animCh, input.atlases[animCh.id], frame.group, frame.index, fx, sy(f.y), flip, frame.ox, frame.oy, k, blink);
    if (!ok) this.drawBoxBody(c, f, ch, frame.clsn2, (x) => sx(x) + shake, sy, k);
    // clarão de quem apanhou: o mesmo sprite somado por cima
    if (ok && this.flash[f.side] > 0 && !f.helper) {
      const over = Skia.Paint();
      over.setBlendMode(BlendMode.Plus);
      over.setAlphaf(Math.min(1, 0.16 * this.flash[f.side]));
      this.drawSprite(c, animCh, input.atlases[animCh.id], frame.group, frame.index, fx, sy(f.y), flip, frame.ox, frame.oy, k, 1, over);
    }
  }

  /** Explod do MUGEN: sprite do dono, com escala e soma de luz opcional. */
  private drawExplod(
    c: SkCanvas,
    e: ExplodState,
    input: RenderInput,
    sx: (x: number) => number,
    sy: (y: number) => number,
    k: number,
  ): void {
    const ch = input.roster[e.charId];
    if (!ch) return;
    const frame = currentFrame(e, getAnim(ch, e.anim));
    let over: SkPaint | undefined;
    if (e.additive) {
      over = Skia.Paint();
      over.setBlendMode(BlendMode.Plus);
    }
    this.drawSprite(c, ch, input.atlases[e.charId], frame.group, frame.index, sx(e.x), sy(e.y), (e.facing === -1) !== frame.flipH, frame.ox, frame.oy, k, 1, over, e.scaleX, e.scaleY);
  }

  /** Brilho do modo MAX em volta do lutador. */
  private drawAura(
    c: SkCanvas,
    f: FighterState,
    input: RenderInput,
    sx: (x: number) => number,
    sy: (y: number) => number,
    k: number,
  ): void {
    const color = input.roster[f.charId]?.style.energy ?? "#FACC15";
    const pulse = 0.8 + 0.2 * Math.sin(this.frame / 4);
    const cx = sx(f.x);
    const cy = sy(f.y - 48);
    const r = 62 * k * pulse;
    const glow = Skia.Paint();
    glow.setBlendMode(BlendMode.Plus);
    glow.setShader(Skia.Shader.MakeRadialGradient({ x: cx, y: cy }, r, [Skia.Color(color), Skia.Color("transparent")], [0, 1], TileMode.Clamp));
    glow.setAlphaf(0.5);
    c.drawCircle(cx, cy, r, glow);
  }

  /** Personagem sem sprites: desenha o corpo a partir das Clsn2 (estilo "debug" do MUGEN, mas bonito). */
  private drawBoxBody(
    c: SkCanvas,
    f: FighterState,
    ch: CharacterData,
    boxes: Box[],
    sx: (x: number) => number,
    sy: (y: number) => number,
    k: number,
  ): void {
    if (boxes.length === 0) return;
    const world = boxes.map((b) => worldBox(b, f.x, f.y, f.facing));
    const top = world.reduce((a, b) => (b.y1 < a.y1 ? b : a));
    const outline = paint(ch.style.trim);
    outline.setStyle(PaintStyle.Stroke);
    outline.setStrokeWidth(1.2 * k);
    for (const b of world) {
      const r = Skia.XYWHRect(sx(b.x1), sy(b.y1), (b.x2 - b.x1) * k, (b.y2 - b.y1) * k);
      c.drawRRect(Skia.RRectXY(r, 5 * k, 5 * k), this.solid(ch.style.body));
      c.drawRRect(Skia.RRectXY(r, 5 * k, 5 * k), outline);
    }
    const head = { x: (top.x1 + top.x2) / 2, y: top.y1 - 7 };
    c.drawCircle(sx(head.x), sy(head.y), 8 * k, this.solid(ch.style.skin));
    c.drawCircle(sx(head.x + 3 * f.facing), sy(head.y - 1), 1.5 * k, this.solid("#111111"));
    c.drawRect(Skia.XYWHRect(sx(head.x) - 8 * k, sy(head.y - 5), 16 * k, 3 * k), this.solid(ch.style.accent));
  }

  private drawProjectile(
    c: SkCanvas,
    p: ProjectileState,
    input: RenderInput,
    sx: (x: number) => number,
    sy: (y: number) => number,
    k: number,
  ): void {
    const owner = input.world.fighters[p.owner];
    const ch = input.roster[owner.charId];
    const anim = getAnim(ch, p.anim);
    const frame = currentFrame(p, anim);
    const ok = this.drawSprite(c, ch, input.atlases[owner.charId], frame.group, frame.index, sx(p.x), sy(p.y), p.facing === -1, frame.ox, frame.oy, k);
    if (!ok) {
      const glow = Skia.Paint();
      glow.setShader(
        Skia.Shader.MakeRadialGradient(
          { x: sx(p.x), y: sy(p.y) },
          14 * k,
          [Skia.Color("#FFFFFF"), Skia.Color(ch.style.energy), Skia.Color("transparent")],
          [0, 0.45, 1],
          TileMode.Clamp,
        ),
      );
      c.drawCircle(sx(p.x), sy(p.y), 14 * k, glow);
    }
  }

  private drawBoxes(
    c: SkCanvas,
    f: FighterState,
    input: RenderInput,
    sx: (x: number) => number,
    sy: (y: number) => number,
    k: number,
  ): void {
    const frame = currentFrame(f, getAnim(animCharOf(input.world, input.roster, f), f.anim));
    const stroke = (color: string) => {
      const p = paint(color, 0.9);
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(1);
      return p;
    };
    for (const [list, color] of [
      [frame.clsn2, "#3B82F6"],
      [f.hitDefActive ? frame.clsn1 : [], "#EF4444"],
    ] as const) {
      const p = stroke(color);
      for (const b of list) {
        const wb = worldBox(b, f.x, f.y, f.facing);
        c.drawRect(Skia.XYWHRect(sx(wb.x1), sy(wb.y1), (wb.x2 - wb.x1) * k, (wb.y2 - wb.y1) * k), p);
      }
    }
    c.drawLine(sx(f.x) - 4, sy(f.y), sx(f.x) + 4, sy(f.y), stroke("#FACC15"));
  }

  private drawPops(c: SkCanvas, input: RenderInput, sx: (x: number) => number, sy: (y: number) => number): void {
    if (this.pops.length === 0) return;
    const fonts = getFonts(input.height);
    if (!fonts) return;
    for (const p of this.pops) {
      const font = p.big ? fonts.big : fonts.medium;
      const life = p.big ? BIG_POP_LIFE : POP_LIFE;
      const fade = life - 12;
      const rise = Math.min(p.age, 12) * (p.big ? 0.8 : 1.2);
      const alpha = p.age < fade ? 1 : 1 - (p.age - fade) / 12;
      // entra grande e "assenta" (punch do texto)
      const grow = p.big ? (p.age < 6 ? 1.6 - p.age * 0.1 : 1) : p.age < 5 ? 1.4 - p.age * 0.08 : 1;
      const tw = font.measureText(p.text).width * grow;
      const x = Math.max(4, Math.min(input.width - tw - 4, sx(p.x) - tw / 2));
      c.save();
      c.translate(x, sy(p.y - rise));
      c.scale(grow, grow);
      if (p.big) {
        // faixa inclinada atrás do texto, com um fio da cor do texto
        const h = font.getSize();
        const w = tw / grow;
        const band = Skia.PathBuilder.Make();
        band.moveTo(-h * 0.5, -h * 0.95);
        band.lineTo(w + h * 0.8, -h * 0.95);
        band.lineTo(w + h * 0.5, h * 0.25);
        band.lineTo(-h * 0.8, h * 0.25);
        band.close();
        c.drawPath(band.detach(), paint("#0B0B12", 0.72 * alpha));
        c.drawRect(Skia.XYWHRect(-h * 0.8, h * 0.25, w + h * 1.3, Math.max(2, h * 0.08)), paint(p.color, alpha));
      }
      c.drawText(p.text, 2, 2, paint("#000000", 0.75 * alpha), font);
      // pisca branco nos primeiros quadros
      c.drawText(p.text, 0, 0, paint(p.big && p.age % 6 < 3 && p.age < 18 ? "#FFFFFF" : p.color, alpha), font);
      c.restore();
    }
  }

  // ---------------------------------------------------------------- HUD

  private drawHud(c: SkCanvas, input: RenderInput): void {
    const { world: w, width: W, height: H } = input;
    const f = getFonts(H);
    const text = (str: string, x: number, y: number, p: SkPaint, font: SkFont | undefined) => {
      if (font) c.drawText(str, x, y, p, font);
    };
    const width = (str: string, font: SkFont | undefined) => (font ? font.measureText(str).width : 0);
    const size = (font: SkFont | undefined) => (font ? font.getSize() : H * 0.035);
    const barW = W * 0.36;
    const barH = H * 0.05;
    const top = H * 0.05;
    const margin = W * 0.06;
    const panel = this.solid("#0B0B12", 0.85);
    // faixa escura atrás do HUD: nomes e barras legíveis em qualquer cenário
    const band = this.gradients.get(`band:${H}`) ?? (() => {
      const p = Skia.Paint();
      p.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: H * 0.26 }, [Skia.Color("rgba(5,4,12,0.72)"), Skia.Color("rgba(5,4,12,0)")], null, TileMode.Clamp));
      this.gradients.set(`band:${H}`, p);
      return p;
    })();
    c.drawRect(Skia.XYWHRect(0, 0, W, H * 0.26), band);
    const names = input.names && !w.teams ? input.names : w.fighters.map((p) => input.roster[p.charId]?.displayName ?? p.charId);

    w.fighters.forEach((p, i) => {
      const left = i === 0;
      const ratio = Math.max(0, p.life / p.lifeMax);
      this.lifeTrail[i] = Math.max(ratio, this.lifeTrail[i] - 0.006);
      if (this.lifeTrail[i] < ratio) this.lifeTrail[i] = ratio;
      const x0 = left ? margin : W - margin - barW;
      // fundo
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x0 - 3, top - 3, barW + 6, barH + 6), 4, 4), panel);
      // rastro de dano
      const trailW = barW * this.lifeTrail[i];
      c.drawRect(Skia.XYWHRect(left ? x0 + barW - trailW : x0, top, trailW, barH), this.solid("#DC2626"));
      // vida; no vermelho (≤ 25%) pisca, como no KOF
      const lifeW = barW * ratio;
      const low = ratio <= 0.25;
      const blink = low && this.frame % 16 < 8;
      const life = low
        ? this.vGradient(top, top + barH, blink ? "#FCA5A5" : "#F87171", blink ? "#EF4444" : "#B91C1C")
        : this.vGradient(top, top + barH, "#FDE047", "#CA8A04");
      c.drawRect(Skia.XYWHRect(left ? x0 + barW - lifeW : x0, top, lifeW, barH), life);
      // medidor de defesa (fino, embaixo da vida)
      const gRatio = Math.max(0, p.guardMeter / GUARD_MAX);
      const gy = top + barH + 2;
      const gh = Math.max(2, H * 0.008);
      c.drawRect(Skia.XYWHRect(x0, gy, barW, gh), this.solid("#0B0B12", 0.8));
      c.drawRect(Skia.XYWHRect(left ? x0 + barW - barW * gRatio : x0, gy, barW * gRatio, gh), this.solid(gRatio < 0.3 ? "#F97316" : "#60A5FA"));
      // nome
      const name = names[i].toUpperCase();
      const nameY = top + barH + size(f?.small) * 1.3;
      text(name, left ? x0 : x0 + barW - width(name, f?.small), nameY, this.solid("#FFFFFF"), f?.small);
      // rounds vencidos ou retratos da equipe, no canto de dentro
      const midY = nameY - size(f?.small) * 0.35;
      if (w.teams) this.drawTeam(c, input, i as 0 | 1, left ? x0 + barW : x0, midY, left);
      else {
        for (let r = 0; r < Math.min(w.roundsToWin, 5); r++) {
          const cx = left ? x0 + barW - 8 - r * 14 : x0 + 8 + r * 14;
          c.drawCircle(cx, midY, 5, this.solid(r < p.roundsWon ? "#FACC15" : "#3F3F46"));
        }
      }
      this.drawPower(c, p, left, left ? x0 : x0 + barW, nameY + H * 0.03, barW * 0.55, H, f);
      // combo
      const opp = w.fighters[left ? 1 : 0];
      if (opp.comboHits >= 2 && opp.moveType === "H") {
        const txt = `${opp.comboHits} HITS`;
        text(txt, left ? margin : W - margin - width(txt, f?.big), H * 0.4, this.solid("#FDE047"), f?.big);
      }
    });

    // relógio (vermelho piscando nos últimos 10 s)
    const time = w.timer < 0 ? "∞" : `${Math.ceil(w.timer / 60)}`;
    const tw = width(time, f?.big);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(W / 2 - H * 0.07, top - 6, H * 0.14, barH + 18), 6, 6), panel);
    const hurry = w.timer >= 0 && w.timer < 600 && w.roundState === 2 && this.frame % 30 < 15;
    text(time, W / 2 - tw / 2, top + barH + 2, this.solid(hurry ? "#F87171" : "#FFFFFF"), f?.big);

    // mensagens centrais
    let msg: string | null = input.banner ?? null;
    let color = "#FDE047";
    if (!msg) {
      const [a, b] = w.fighters;
      const finalRound = !w.teams && a.roundsWon === w.roundsToWin - 1 && b.roundsWon === w.roundsToWin - 1;
      if (w.roundState === 1) msg = w.roundStateTime < 55 ? (finalRound ? "FINAL ROUND" : `ROUND ${w.roundNo}`) : "READY";
      else if (w.roundState === 2 && w.roundStateTime < 40) msg = "GO!";
      else if (w.roundState === 3 && w.roundStateTime < 90) {
        msg = a.life <= 0 || b.life <= 0 ? "K.O." : "TIME UP";
        color = "#EF4444";
      } else if (w.roundState === 4) {
        if (w.matchWinner === 0 || w.matchWinner === 1) msg = `${names[w.matchWinner].toUpperCase()} VENCE!`;
        else if (w.matchWinner === 2 || w.roundWinner === 2) msg = "EMPATE";
        else {
          const winner = w.fighters[w.roundWinner === 1 ? 1 : 0];
          msg = winner.life >= winner.lifeMax ? "PERFECT" : `${names[winner.side].toUpperCase()} VENCE${w.teams ? "" : " O ROUND"}`;
        }
      }
    }
    if (msg) {
      const font = msg.length > 12 ? f?.big : f?.huge;
      const mw = width(msg, font);
      const y = H * 0.45;
      text(msg, W / 2 - mw / 2 + 3, y + 3, this.solid("#000000", 0.7), font);
      text(msg, W / 2 - mw / 2, y, this.solid(color), font);
    }
  }

  /**
   * Estoques de power (KOF '98): caixa com o número de estoques e barra até o
   * próximo; no MAX a barra vira o relógio do MAX. `anchor` é a borda de fora
   * (esquerda do P1, direita do P2).
   */
  private drawPower(c: SkCanvas, p: FighterState, left: boolean, anchor: number, y: number, pw: number, H: number, f: Fonts | null): void {
    const bh = H * 0.022;
    const box = H * 0.045;
    const stocks = Math.floor(p.power / POWER_PER_LEVEL);
    const full = stocks >= Math.floor(p.powerMax / POWER_PER_LEVEL);
    const boxX = left ? anchor : anchor - box;
    const bx = left ? boxX + box + 4 : boxX - 4 - pw;
    const by = y + (box - bh) / 2;
    c.drawRect(Skia.XYWHRect(boxX, y, box, box), this.solid(p.maxTime > 0 ? "#B45309" : "#1E3A8A"));
    const n = `${stocks}`;
    if (f) c.drawText(n, boxX + box / 2 - f.medium.measureText(n).width / 2, y + box / 2 + f.medium.getSize() * 0.36, this.solid("#FFFFFF"), f.medium);
    c.drawRect(Skia.XYWHRect(bx, by, pw, bh), this.solid("#0B0B12", 0.8));
    let ratio: number;
    let color: string;
    if (p.maxTime > 0) {
      ratio = p.maxTime / Math.max(1, p.maxTotal);
      color = this.frame % 10 < 5 ? "#F97316" : "#FACC15";
    } else {
      ratio = full ? 1 : (p.power % POWER_PER_LEVEL) / POWER_PER_LEVEL;
      color = full && this.frame % 20 < 10 ? "#FFFFFF" : "#38BDF8";
    }
    c.drawRect(Skia.XYWHRect(left ? bx : bx + pw - pw * ratio, by, pw * ratio, bh), this.solid(color));
    const label = p.maxTime > 0 ? "MAX" : full ? "MAXIMUM" : "";
    if (f && label) {
      const lw = f.small.measureText(label).width;
      c.drawText(label, left ? bx + pw + 6 : bx - 6 - lw, by + bh, this.solid(p.maxTime > 0 ? "#FACC15" : "#38BDF8"), f.small);
    }
  }

  /** Retratos da equipe: quadrados com a inicial; quem já caiu fica riscado. `edge` é a borda de dentro da barra. */
  private drawTeam(c: SkCanvas, input: RenderInput, side: 0 | 1, edge: number, y: number, left: boolean): void {
    const team = input.world.teams?.[side];
    if (!team) return;
    const f = getFonts(input.height);
    const s = input.height * 0.045;
    team.members.forEach((id, j) => {
      const x = left ? edge - (j + 1) * (s + 4) : edge + j * (s + 4);
      const ch = input.roster[id];
      const out = j < team.index;
      c.drawRect(Skia.XYWHRect(x, y - s / 2, s, s), this.solid(ch?.style.body ?? "#3F3F46", out ? 0.35 : 1));
      if (j === team.index) {
        const border = paint("#FACC15");
        border.setStyle(PaintStyle.Stroke);
        border.setStrokeWidth(2);
        c.drawRect(Skia.XYWHRect(x, y - s / 2, s, s), border);
      }
      const initial = (ch?.displayName ?? id).charAt(0).toUpperCase();
      if (f) c.drawText(initial, x + s / 2 - f.small.measureText(initial).width / 2, y + f.small.getSize() * 0.36, this.solid(ch?.style.trim ?? "#FFFFFF", out ? 0.4 : 1), f.small);
      if (out) {
        const cross = paint("#EF4444");
        cross.setStrokeWidth(2);
        c.drawLine(x, y - s / 2, x + s, y + s / 2, cross);
        c.drawLine(x + s, y - s / 2, x, y + s / 2, cross);
      }
    });
  }
}
