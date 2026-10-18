/**
 * Desenha um frame do mundo num SkCanvas (via PictureRecorder a cada frame).
 * Estado visual que não afeta a simulação (faíscas, tremida, barras com
 * atraso) fica aqui, fora do WorldState determinístico.
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
import type { Box, CharacterData, FighterState, GameEvent, ProjectileState, WorldState } from "@/src/engine/types";

import { drawStage, stageById, type StagePainter } from "./stages";

export interface RenderInput {
  world: WorldState;
  roster: Record<string, CharacterData>;
  atlases: Record<string, SkImage[]>;
  names: [string, string];
  width: number;
  height: number;
  /** Mostrar caixas Clsn (modo treino). */
  debugBoxes?: boolean;
  /** Mensagem central extra (ex.: "AGUARDANDO OPONENTE"). */
  banner?: string | null;
}

interface Spark {
  x: number;
  y: number;
  level: number;
  age: number;
  guard: boolean;
  color: string;
}

const fontFamily = Platform.select({ ios: "Helvetica Neue", default: "sans-serif-condensed" });
let fonts: { small: SkFont; medium: SkFont; big: SkFont; huge: SkFont } | null = null;
function getFonts(h: number) {
  if (!fonts) {
    fonts = {
      small: matchFont({ fontFamily, fontSize: Math.round(h * 0.035), fontWeight: "bold" }),
      medium: matchFont({ fontFamily, fontSize: Math.round(h * 0.05), fontWeight: "bold" }),
      big: matchFont({ fontFamily, fontSize: Math.round(h * 0.075), fontWeight: "bold" }),
      huge: matchFont({ fontFamily, fontSize: Math.round(h * 0.15), fontWeight: "bold" }),
    };
  }
  return fonts;
}

function paint(color: string, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (alpha < 1) p.setAlphaf(alpha);
  return p;
}

export class FightRenderer {
  private sparks: Spark[] = [];
  private shake = 0;
  private lifeTrail: [number, number] = [1, 1];
  private superFlash = 0;
  private frame = 0;

  addEvents(events: GameEvent[], world: WorldState, roster: Record<string, CharacterData>): void {
    for (const e of events) {
      if (e.kind === "hit" || e.kind === "guard") {
        const owner = world.fighters[e.side];
        this.sparks.push({
          x: e.x,
          y: e.y,
          level: e.level,
          age: 0,
          guard: e.kind === "guard",
          color: roster[owner.charId]?.style.energy ?? "#FDE047",
        });
        if (e.kind === "hit") this.shake = Math.max(this.shake, 3 + e.level * 3);
      } else if (e.kind === "ko") {
        this.shake = 14;
      } else if (e.kind === "super") {
        this.superFlash = 30;
      }
    }
  }

  draw(c: SkCanvas, input: RenderInput): void {
    const { world: w, width, height } = input;
    this.frame++;
    const k = height / 250; // px por unidade
    const groundPx = height * 0.8;
    const shakeX = this.shake > 0 ? (this.frame % 2 === 0 ? 1 : -1) * this.shake * 0.35 * k : 0;
    if (this.shake > 0) this.shake *= 0.82;
    if (this.shake < 0.4) this.shake = 0;

    const cam = w.cameraX;
    const sx = (x: number, parallax = 1) => (x - cam * parallax) * k + width / 2 + shakeX;
    const sy = (y: number) => groundPx + y * k;
    const painter: StagePainter = {
      sx,
      sy,
      s: (u) => u * k,
      width,
      height,
      cam,
      frame: this.frame,
      paint,
    };

    drawStage(c, stageById(w.stageId), painter);

    if (this.superFlash > 0) {
      c.drawRect(Skia.XYWHRect(0, 0, width, height), paint("#000000", Math.min(0.55, this.superFlash / 40)));
      this.superFlash--;
    }

    // sombras
    for (const f of w.fighters) {
      const shadowW = 34 * k * Math.max(0.4, 1 + f.y / 200);
      c.drawOval(Skia.XYWHRect(sx(f.x) - shadowW / 2, sy(0) - 4 * k, shadowW, 8 * k), paint("#000000", 0.28));
    }

    // quem está atacando fica na frente
    const order = [...w.fighters].sort((a, b) => (a.moveType === "A" ? 1 : 0) - (b.moveType === "A" ? 1 : 0));
    for (const f of order) this.drawFighter(c, f, input, sx, sy, k);
    for (const p of w.projectiles) this.drawProjectile(c, p, input, sx, sy, k);
    if (input.debugBoxes) for (const f of w.fighters) this.drawBoxes(c, f, input, sx, sy, k);
    this.drawSparks(c, sx, sy, k);
    this.drawHud(c, input);
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
    if (flip) c.scale(-1, 1);
    const p = Skia.Paint();
    if (alpha < 1) p.setAlphaf(alpha);
    c.drawImageRect(
      img,
      Skia.XYWHRect(fx, fy, fw, fh),
      Skia.XYWHRect((ox - ax / scale) * k, (oy - ay / scale) * k, (fw / scale) * k, (fh / scale) * k),
      p,
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
    const anim = getAnim(ch, f.anim);
    const frame = currentFrame(f, anim);
    const flip = (f.facing === -1) !== frame.flipH;
    const blink = f.notHitBy > 0 && f.stateNo !== 5120 && this.frame % 4 < 2 ? 0.55 : 1;
    const ok = this.drawSprite(c, ch, input.atlases[f.charId], frame.group, frame.index, sx(f.x), sy(f.y), flip, frame.ox, frame.oy, k, blink);
    if (!ok) this.drawBoxBody(c, f, ch, frame.clsn2, sx, sy, k);
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
    for (const b of world) {
      const r = Skia.XYWHRect(sx(b.x1), sy(b.y1), (b.x2 - b.x1) * k, (b.y2 - b.y1) * k);
      c.drawRRect(Skia.RRectXY(r, 5 * k, 5 * k), paint(ch.style.body));
      const outline = paint(ch.style.trim);
      outline.setStyle(PaintStyle.Stroke);
      outline.setStrokeWidth(1.2 * k);
      c.drawRRect(Skia.RRectXY(r, 5 * k, 5 * k), outline);
    }
    const head = { x: (top.x1 + top.x2) / 2, y: top.y1 - 7 };
    c.drawCircle(sx(head.x), sy(head.y), 8 * k, paint(ch.style.skin));
    c.drawCircle(sx(head.x + 3 * f.facing), sy(head.y - 1), 1.5 * k, paint("#111111"));
    c.drawRect(Skia.XYWHRect(sx(head.x) - 8 * k, sy(head.y - 5), 16 * k, 3 * k), paint(ch.style.accent));
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
    const ch = input.roster[f.charId];
    const frame = currentFrame(f, getAnim(ch, f.anim));
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
      for (const b of list) {
        const wb = worldBox(b, f.x, f.y, f.facing);
        c.drawRect(Skia.XYWHRect(sx(wb.x1), sy(wb.y1), (wb.x2 - wb.x1) * k, (wb.y2 - wb.y1) * k), stroke(color));
      }
    }
    c.drawLine(sx(f.x) - 4, sy(f.y), sx(f.x) + 4, sy(f.y), stroke("#FACC15"));
  }

  private drawSparks(c: SkCanvas, sx: (x: number) => number, sy: (y: number) => number, k: number): void {
    const keep: Spark[] = [];
    for (const s of this.sparks) {
      s.age++;
      const life = 14 + s.level * 4;
      if (s.age > life) continue;
      keep.push(s);
      const t = s.age / life;
      const r = (8 + s.level * 6) * k * (0.4 + t);
      const alpha = 1 - t;
      const center = { x: sx(s.x), y: sy(s.y) };
      const glow = Skia.Paint();
      glow.setBlendMode(BlendMode.Plus);
      glow.setShader(
        Skia.Shader.MakeRadialGradient(
          center,
          r,
          [Skia.Color(s.guard ? "#93C5FD" : "#FFFFFF"), Skia.Color(s.guard ? "#3B82F6" : s.color), Skia.Color("transparent")],
          [0, 0.35, 1],
          TileMode.Clamp,
        ),
      );
      glow.setAlphaf(alpha);
      c.drawCircle(center.x, center.y, r, glow);
      const ray = paint(s.guard ? "#DBEAFE" : "#FEF9C3", alpha);
      ray.setStrokeWidth(2 * k * (1 - t));
      const n = 6 + s.level * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + s.x;
        const r0 = r * 0.3;
        const r1 = r * (1.1 + (i % 2) * 0.4);
        c.drawLine(center.x + Math.cos(a) * r0, center.y + Math.sin(a) * r0, center.x + Math.cos(a) * r1, center.y + Math.sin(a) * r1, ray);
      }
    }
    this.sparks = keep;
  }

  // ---------------------------------------------------------------- HUD

  private drawHud(c: SkCanvas, input: RenderInput): void {
    const { world: w, width: W, height: H } = input;
    const f = getFonts(H);
    const barW = W * 0.36;
    const barH = H * 0.05;
    const top = H * 0.05;
    const margin = W * 0.06;

    w.fighters.forEach((p, i) => {
      const ratio = Math.max(0, p.life / p.lifeMax);
      this.lifeTrail[i] = Math.max(ratio, this.lifeTrail[i] - 0.006);
      if (this.lifeTrail[i] < ratio) this.lifeTrail[i] = ratio;
      const x0 = i === 0 ? margin : W - margin - barW;
      // fundo
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x0 - 3, top - 3, barW + 6, barH + 6), 4, 4), paint("#0B0B12", 0.85));
      // rastro de dano
      const trailW = barW * this.lifeTrail[i];
      c.drawRect(Skia.XYWHRect(i === 0 ? x0 + barW - trailW : x0, top, trailW, barH), paint("#DC2626"));
      // vida
      const lifeW = barW * ratio;
      const life = Skia.Paint();
      life.setShader(
        Skia.Shader.MakeLinearGradient(
          { x: 0, y: top },
          { x: 0, y: top + barH },
          [Skia.Color(ratio > 0.3 ? "#FDE047" : "#FB923C"), Skia.Color(ratio > 0.3 ? "#CA8A04" : "#C2410C")],
          null,
          TileMode.Clamp,
        ),
      );
      c.drawRect(Skia.XYWHRect(i === 0 ? x0 + barW - lifeW : x0, top, lifeW, barH), life);
      // nome
      const name = input.names[i].toUpperCase();
      const nameW = f.small.measureText(name).width;
      c.drawText(name, i === 0 ? x0 : x0 + barW - nameW, top + barH + f.small.getSize() * 1.15, paint("#FFFFFF"), f.small);
      // rounds vencidos
      for (let r = 0; r < w.roundsToWin; r++) {
        const cx = i === 0 ? x0 + barW - 8 - r * 14 : x0 + 8 + r * 14;
        const won = r < p.roundsWon;
        c.drawCircle(cx, top + barH + f.small.getSize() * 0.75, 5, paint(won ? "#FACC15" : "#3F3F46"));
      }
      // barra de super (níveis de 1000)
      const pw = barW * 0.6;
      const px = i === 0 ? x0 : x0 + barW - pw;
      const py = top + barH + f.small.getSize() * 1.6;
      c.drawRect(Skia.XYWHRect(px, py, pw, H * 0.018), paint("#0B0B12", 0.8));
      const pr = p.power / p.powerMax;
      const full = p.power >= 1000;
      c.drawRect(
        Skia.XYWHRect(i === 0 ? px : px + pw - pw * pr, py, pw * pr, H * 0.018),
        paint(full && this.frame % 20 < 10 ? "#FFFFFF" : "#38BDF8"),
      );
      const lvl = `${Math.floor(p.power / 1000)}`;
      c.drawText(lvl, i === 0 ? px + pw + 6 : px - 6 - f.small.measureText(lvl).width, py + H * 0.018, paint("#38BDF8"), f.small);
      // combo
      const opp = w.fighters[i === 0 ? 1 : 0];
      if (opp.comboHits >= 2 && opp.moveType === "H") {
        const txt = `${opp.comboHits} HITS`;
        c.drawText(txt, i === 0 ? margin : W - margin - f.big.measureText(txt).width, H * 0.38, paint("#FDE047"), f.big);
      }
    });

    // relógio
    const time = w.timer < 0 ? "∞" : `${Math.ceil(w.timer / 60)}`;
    const tw = f.big.measureText(time).width;
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(W / 2 - H * 0.07, top - 6, H * 0.14, barH + 18), 6, 6), paint("#0B0B12", 0.85));
    c.drawText(time, W / 2 - tw / 2, top + barH + 2, paint("#FFFFFF"), f.big);

    // mensagens centrais
    let msg: string | null = input.banner ?? null;
    if (!msg) {
      if (w.roundState === 1) msg = w.roundStateTime < 60 ? `ROUND ${w.roundNo}` : "LUTE!";
      else if (w.roundState === 3 && w.roundStateTime < 90) {
        msg = w.fighters.some((p) => p.life <= 0) ? "K.O." : "TEMPO!";
      } else if (w.roundState === 4) {
        if (w.matchWinner === 0 || w.matchWinner === 1) msg = `${input.names[w.matchWinner].toUpperCase()} VENCE!`;
        else if (w.matchWinner === 2) msg = "EMPATE";
        else msg = w.roundWinner === 2 ? "EMPATE" : `${input.names[w.roundWinner === 1 ? 1 : 0].toUpperCase()} VENCE O ROUND`;
      }
    }
    if (msg) {
      const font = msg.length > 12 ? f.big : f.huge;
      const mw = font.measureText(msg).width;
      const y = H * 0.45;
      const shadow = paint("#000000", 0.7);
      c.drawText(msg, W / 2 - mw / 2 + 3, y + 3, shadow, font);
      c.drawText(msg, W / 2 - mw / 2, y, paint(msg === "K.O." ? "#EF4444" : "#FDE047"), font);
    }
  }
}
