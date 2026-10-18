/**
 * Cenários desenhados proceduralmente com Skia (sem assets de terceiros).
 * Coordenadas em unidades do mundo: chão em y = 0, câmera em `cam`.
 */

import { PaintStyle, Skia, TileMode, type SkCanvas, type SkPaint } from "@shopify/react-native-skia";

export interface StageDef {
  id: string;
  name: string;
  sky: [string, string];
  floor: [string, string];
  draw: (c: SkCanvas, p: StagePainter) => void;
}

/** Ajudante com a transformação mundo → tela e paralaxe. */
export interface StagePainter {
  /** x de tela para um x de mundo com fator de paralaxe (1 = acompanha o chão). */
  sx: (x: number, parallax?: number) => number;
  sy: (y: number) => number;
  /** Tamanho em pixels de `u` unidades do mundo. */
  s: (u: number) => number;
  width: number;
  height: number;
  cam: number;
  frame: number;
  paint: (color: string, alpha?: number) => SkPaint;
}

const rect = (c: SkCanvas, x: number, y: number, w: number, h: number, p: SkPaint) =>
  c.drawRect(Skia.XYWHRect(x, y, w, h), p);

function dojo(c: SkCanvas, p: StagePainter): void {
  // parede de papel com vigas
  const wallTop = p.sy(-230);
  const wallBottom = p.sy(-28);
  rect(c, 0, wallTop, p.width, wallBottom - wallTop, p.paint("#E9DCC0"));
  for (let i = -12; i <= 12; i++) {
    const x = p.sx(i * 70, 0.85);
    rect(c, x - p.s(4), wallTop, p.s(8), wallBottom - wallTop, p.paint("#5B3A21"));
    for (let k = 1; k < 4; k++) rect(c, x, wallTop + ((wallBottom - wallTop) * k) / 4, p.s(70), p.s(1.5), p.paint("#C9B48E"));
  }
  rect(c, 0, wallBottom - p.s(10), p.width, p.s(10), p.paint("#5B3A21"));
  // lanternas
  for (let i = -6; i <= 6; i++) {
    const x = p.sx(i * 140 + 35, 0.85);
    const y = p.sy(-170) + Math.sin((p.frame + i * 20) / 40) * p.s(1.5);
    c.drawLine(x, wallTop, x, y - p.s(12), p.paint("#3B2414"));
    c.drawOval(Skia.XYWHRect(x - p.s(9), y - p.s(13), p.s(18), p.s(26)), p.paint("#DC2626"));
    c.drawOval(Skia.XYWHRect(x - p.s(5), y - p.s(9), p.s(10), p.s(18)), p.paint("#FCA5A5", 0.7));
  }
  // placa
  const sx = p.sx(0, 0.85);
  rect(c, sx - p.s(40), p.sy(-215), p.s(80), p.s(26), p.paint("#3B2414"));
  rect(c, sx - p.s(36), p.sy(-212), p.s(72), p.s(20), p.paint("#F5E6C8"));
  c.drawCircle(sx, p.sy(-202), p.s(7), p.paint("#B91C1C"));
}

function pelourinho(c: SkCanvas, p: StagePainter): void {
  const colors = ["#F59E0B", "#3B82F6", "#EC4899", "#10B981", "#F97316", "#8B5CF6", "#EAB308", "#06B6D4"];
  // morro e igreja ao fundo
  c.drawCircle(p.sx(60, 0.3), p.sy(40), p.s(260), p.paint("#7C9A5C"));
  const ch = p.sx(60, 0.3);
  rect(c, ch - p.s(30), p.sy(-210), p.s(60), p.s(80), p.paint("#F8FAFC"));
  rect(c, ch - p.s(34), p.sy(-250), p.s(14), p.s(50), p.paint("#F8FAFC"));
  rect(c, ch + p.s(20), p.sy(-250), p.s(14), p.s(50), p.paint("#F8FAFC"));
  c.drawCircle(ch, p.sy(-196), p.s(8), p.paint("#60A5FA"));
  // casarões coloniais
  for (let i = -10; i <= 10; i++) {
    const w = 64;
    const x = p.sx(i * w, 0.7);
    const h = 120 + ((i * 37) % 40 + 40) % 40;
    const color = colors[((i % colors.length) + colors.length) % colors.length];
    rect(c, x, p.sy(-h - 20), p.s(w - 2), p.s(h), p.paint(color));
    rect(c, x, p.sy(-h - 26), p.s(w - 2), p.s(8), p.paint("#F8FAFC"));
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 3; j++) {
        const wx = x + p.s(8 + j * 18);
        const wy = p.sy(-h - 8 + k * 50);
        rect(c, wx, wy, p.s(10), p.s(22), p.paint("#1E3A8A"));
        rect(c, wx - p.s(2), wy - p.s(3), p.s(14), p.s(3), p.paint("#F8FAFC"));
      }
    }
  }
  // fitas do Bonfim
  for (let i = -8; i <= 8; i++) {
    const x = p.sx(i * 50, 0.9);
    const sway = Math.sin((p.frame + i * 13) / 25) * p.s(3);
    c.drawLine(x, p.sy(-235), x + sway, p.sy(-200), p.paint(colors[(i + 16) % colors.length], 0.9));
  }
}

function metro(c: SkCanvas, p: StagePainter): void {
  // lua e prédios em camadas
  c.drawCircle(p.sx(-120, 0.1), p.sy(-205), p.s(22), p.paint("#FEF3C7", 0.9));
  for (const [par, color, base] of [
    [0.35, "#1E1B4B", 180],
    [0.6, "#111827", 140],
  ] as const) {
    for (let i = -14; i <= 14; i++) {
      const w = 46 + ((i * 13) % 20 + 20) % 20;
      const h = base + ((i * 53) % 80 + 80) % 80;
      const x = p.sx(i * 60, par);
      rect(c, x, p.sy(-h), p.s(w), p.s(h), p.paint(color));
      for (let k = 0; k < h / 18; k++) {
        for (let j = 0; j < w / 14; j++) {
          if ((i * 7 + k * 3 + j) % 4 === 0) {
            rect(c, x + p.s(4 + j * 14), p.sy(-h + 8 + k * 18), p.s(6), p.s(8), p.paint("#FDE68A", 0.75));
          }
        }
      }
    }
  }
  // letreiros neon
  const neon = ["#F472B6", "#22D3EE", "#A3E635"];
  for (let i = -5; i <= 5; i++) {
    const x = p.sx(i * 120 + 40, 0.8);
    const on = Math.floor((p.frame + i * 17) / 30) % 5 !== 0;
    const paint = p.paint(neon[(i + 15) % 3], on ? 0.95 : 0.25);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(p.s(2.5));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, p.sy(-120), p.s(46), p.s(18)), p.s(4), p.s(4)), paint);
  }
}

export const STAGES: StageDef[] = [
  { id: "dojo", name: "Dojo do Vento", sky: ["#F8E7C9", "#E9D2A8"], floor: ["#9A6B3F", "#6B4423"], draw: dojo },
  { id: "pelourinho", name: "Pelourinho", sky: ["#38BDF8", "#BAE6FD"], floor: ["#A8A29E", "#78716C"], draw: pelourinho },
  { id: "metro", name: "Metrópole", sky: ["#0B1020", "#312E81"], floor: ["#27272A", "#18181B"], draw: metro },
];

export function stageById(id: string): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export function drawStage(c: SkCanvas, stage: StageDef, p: StagePainter): void {
  const sky = Skia.Paint();
  sky.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: p.sy(0) },
      [Skia.Color(stage.sky[0]), Skia.Color(stage.sky[1])],
      null,
      TileMode.Clamp,
    ),
  );
  rect(c, 0, 0, p.width, p.height, sky);
  stage.draw(c, p);

  const floor = Skia.Paint();
  floor.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: p.sy(0) },
      { x: 0, y: p.height },
      [Skia.Color(stage.floor[0]), Skia.Color(stage.floor[1])],
      null,
      TileMode.Clamp,
    ),
  );
  rect(c, 0, p.sy(-2), p.width, p.height - p.sy(-2), floor);
  // linhas de perspectiva do chão
  const line = p.paint("#000000", 0.12);
  for (let i = -20; i <= 20; i++) {
    const x0 = p.sx(i * 40);
    const x1 = p.sx(i * 40 * 1.6);
    c.drawLine(x0, p.sy(0), x1, p.height, line);
  }
}
