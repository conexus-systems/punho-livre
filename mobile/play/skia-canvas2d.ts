/**
 * Adaptador mínimo da API do @shopify/react-native-skia usada pelo renderizador do jogo
 * (src/game/renderer.ts e stages.ts) sobre o Canvas 2D do navegador. Permite rodar o mesmo
 * código de desenho da luta numa página web, sem o CanvasKit (7 MB de wasm).
 */

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type RRect = { rect: Rect; rx: number; ry: number };
type Shader =
  | { kind: "linear"; p0: Pt; p1: Pt; colors: string[]; pos: number[] | null }
  | { kind: "radial"; c: Pt; r: number; colors: string[]; pos: number[] | null };

export const TileMode = { Clamp: 0 } as const;
export const PaintStyle = { Fill: 0, Stroke: 1 } as const;
export const BlendMode = { Plus: "plus" } as const;

export class Paint {
  color = "#000000";
  alpha = 1;
  style = 0;
  strokeWidth = 0;
  shader: Shader | null = null;
  blend: string | null = null;
  setAntiAlias(_aa: boolean) {}
  setColor(c: string) {
    this.color = c;
  }
  setAlphaf(a: number) {
    this.alpha = a;
  }
  setStyle(s: number) {
    this.style = s;
  }
  setStrokeWidth(w: number) {
    this.strokeWidth = w;
  }
  setShader(s: Shader | null) {
    this.shader = s;
  }
  setBlendMode(b: string) {
    this.blend = b;
  }
  copy() {
    return Object.assign(new Paint(), this);
  }
}

export interface Font {
  css: string;
  size: number;
  measureText(s: string): { width: number };
  getSize(): number;
}

let measureCtx: CanvasRenderingContext2D | null = null;

export function matchFont(style: { fontFamily?: string; fontSize?: number; fontWeight?: string }): Font {
  const size = style.fontSize ?? 14;
  const weight = style.fontWeight === "bold" ? "700" : style.fontWeight ?? "400";
  const css = `${weight} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  return {
    css,
    size,
    measureText(s: string) {
      measureCtx ??= document.createElement("canvas").getContext("2d");
      if (!measureCtx) return { width: s.length * size * 0.5 };
      measureCtx.font = css;
      return { width: measureCtx.measureText(s).width };
    },
    getSize: () => size,
  };
}

export const Skia = {
  Paint: () => new Paint(),
  Color: (c: string) => (c === "transparent" ? "rgba(0,0,0,0)" : c),
  XYWHRect: (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height }),
  RRectXY: (rect: Rect, rx: number, ry: number): RRect => ({ rect, rx, ry }),
  Shader: {
    MakeLinearGradient: (p0: Pt, p1: Pt, colors: string[], pos: number[] | null): Shader => ({ kind: "linear", p0, p1, colors, pos }),
    MakeRadialGradient: (c: Pt, r: number, colors: string[], pos: number[] | null): Shader => ({ kind: "radial", c, r, colors, pos }),
  },
};

/** SkCanvas sobre CanvasRenderingContext2D. */
export class Canvas2D {
  constructor(readonly ctx: CanvasRenderingContext2D) {}

  private style(p: Paint): string | CanvasGradient {
    const s = p.shader;
    if (!s) return p.color;
    const g =
      s.kind === "linear"
        ? this.ctx.createLinearGradient(s.p0.x, s.p0.y, s.p1.x, s.p1.y)
        : this.ctx.createRadialGradient(s.c.x, s.c.y, 0, s.c.x, s.c.y, Math.max(0.001, s.r));
    s.colors.forEach((c, i) => g.addColorStop(s.pos?.[i] ?? i / Math.max(1, s.colors.length - 1), c));
    return g;
  }

  private apply(p: Paint, forceStroke = false): boolean {
    const ctx = this.ctx;
    ctx.globalAlpha = p.alpha;
    ctx.globalCompositeOperation = p.blend === "plus" ? "lighter" : "source-over";
    const st = this.style(p);
    const stroke = forceStroke || p.style === 1;
    if (stroke) {
      ctx.strokeStyle = st;
      ctx.lineWidth = p.strokeWidth > 0 ? p.strokeWidth : 1;
    } else {
      ctx.fillStyle = st;
    }
    return stroke;
  }

  private done() {
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = "source-over";
  }

  drawRect(r: Rect, p: Paint) {
    if (this.apply(p)) this.ctx.strokeRect(r.x, r.y, r.width, r.height);
    else this.ctx.fillRect(r.x, r.y, r.width, r.height);
    this.done();
  }

  drawRRect(rr: RRect, p: Paint) {
    const { x, y, width, height } = rr.rect;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, Math.min(rr.rx, width / 2, height / 2));
    if (this.apply(p)) ctx.stroke();
    else ctx.fill();
    this.done();
  }

  drawCircle(cx: number, cy: number, r: number, p: Paint) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
    if (this.apply(p)) ctx.stroke();
    else ctx.fill();
    this.done();
  }

  drawOval(r: Rect, p: Paint) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(r.x + r.width / 2, r.y + r.height / 2, Math.abs(r.width / 2), Math.abs(r.height / 2), 0, 0, Math.PI * 2);
    if (this.apply(p)) ctx.stroke();
    else ctx.fill();
    this.done();
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, p: Paint) {
    const ctx = this.ctx;
    this.apply(p, true);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    this.done();
  }

  drawImageRect(img: CanvasImageSource, src: Rect, dst: Rect, p: Paint) {
    this.ctx.globalAlpha = p.alpha;
    this.ctx.drawImage(img, src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height);
    this.done();
  }

  drawText(str: string, x: number, y: number, p: Paint, font: Font) {
    this.ctx.font = font.css;
    this.apply(p);
    this.ctx.fillText(str, x, y);
    this.done();
  }

  save() {
    this.ctx.save();
  }
  restore() {
    this.ctx.restore();
  }
  translate(x: number, y: number) {
    this.ctx.translate(x, y);
  }
  scale(x: number, y: number) {
    this.ctx.scale(x, y);
  }
}
