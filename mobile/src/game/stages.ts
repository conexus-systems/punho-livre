/**
 * Cenários desenhados proceduralmente com Skia (sem assets de terceiros).
 *
 * Cada cenário é uma pilha de camadas com paralaxe. As camadas paradas são
 * gravadas uma vez numa SkPicture (no navegador, num bitmap) e depois só
 * deslocadas com a câmera: um drawPicture por camada em vez de centenas de
 * retângulos por frame. As camadas `live` (lanternas, fitas, neon) são
 * redesenhadas a cada frame.
 */

import { PaintStyle, Skia, TileMode, type SkCanvas, type SkPaint, type SkPicture } from "@shopify/react-native-skia";

/** Desenho de uma camada em coordenadas da própria camada (x = 0 no centro do cenário). */
export interface LayerPainter {
  /** x em pixels de um x do mundo. */
  x: (u: number) => number;
  /** y em pixels de um y do mundo (chão em 0, para cima negativo). */
  y: (u: number) => number;
  /** Tamanho em pixels de `u` unidades. */
  s: (u: number) => number;
  /** Faixa visível da camada em unidades do mundo (para preencher a largura). */
  left: number;
  right: number;
  frame: number;
  paint: (color: string, alpha?: number) => SkPaint;
}

export interface StageLayer {
  /** 0 = parado no céu, 1 = acompanha o chão. */
  parallax: number;
  /** Alto e baixo da camada em unidades (para o tamanho do cache). */
  top: number;
  bottom: number;
  draw: (c: SkCanvas, p: LayerPainter) => void;
  /** Animada: redesenha a cada frame em vez de usar o cache. */
  live?: boolean;
}

export interface StageDef {
  id: string;
  name: string;
  sky: [string, string];
  floor: [string, string];
  layers: StageLayer[];
}

/** O que o renderizador passa para desenhar o cenário. */
export interface StageView {
  /** Pixels por unidade do mundo. */
  k: number;
  width: number;
  height: number;
  /** y de tela do chão. */
  groundPx: number;
  cam: number;
  /** Tremida horizontal da tela, em pixels. */
  shakeX: number;
  frame: number;
}

/** Até onde a câmera anda (STAGE_RIGHT - meia tela), em unidades. */
const CAM_LIMIT = 230;

const rect = (c: SkCanvas, x: number, y: number, w: number, h: number, p: SkPaint) =>
  c.drawRect(Skia.XYWHRect(x, y, w, h), p);

// ----------------------------------------------------------------- dojo

const dojoWall: StageLayer = {
  parallax: 0.85,
  top: -235,
  bottom: -18,
  draw(c, p) {
    // parede de papel com vigas
    const wallTop = p.y(-230);
    const wallBottom = p.y(-28);
    rect(c, p.x(p.left), wallTop, p.s(p.right - p.left), wallBottom - wallTop, p.paint("#E9DCC0"));
    const beam = p.paint("#5B3A21");
    const seam = p.paint("#C9B48E");
    for (let i = -12; i <= 12; i++) {
      const x = p.x(i * 70);
      rect(c, x - p.s(4), wallTop, p.s(8), wallBottom - wallTop, beam);
      for (let k = 1; k < 4; k++) rect(c, x, wallTop + ((wallBottom - wallTop) * k) / 4, p.s(70), p.s(1.5), seam);
    }
    rect(c, p.x(p.left), wallBottom - p.s(10), p.s(p.right - p.left), p.s(10), beam);
    // placa
    rect(c, p.x(-40), p.y(-215), p.s(80), p.s(26), p.paint("#3B2414"));
    rect(c, p.x(-36), p.y(-212), p.s(72), p.s(20), p.paint("#F5E6C8"));
    c.drawCircle(p.x(0), p.y(-202), p.s(7), p.paint("#B91C1C"));
  },
};

const dojoLanterns: StageLayer = {
  parallax: 0.85,
  top: -235,
  bottom: -140,
  live: true,
  draw(c, p) {
    const cord = p.paint("#3B2414");
    const red = p.paint("#DC2626");
    const glow = p.paint("#FCA5A5", 0.7);
    for (let i = -6; i <= 6; i++) {
      const x = p.x(i * 140 + 35);
      const y = p.y(-170) + Math.sin((p.frame + i * 20) / 40) * p.s(1.5);
      c.drawLine(x, p.y(-230), x, y - p.s(12), cord);
      c.drawOval(Skia.XYWHRect(x - p.s(9), y - p.s(13), p.s(18), p.s(26)), red);
      c.drawOval(Skia.XYWHRect(x - p.s(5), y - p.s(9), p.s(10), p.s(18)), glow);
    }
  },
};

// ----------------------------------------------------------- pelourinho

const COLONIAL = ["#F59E0B", "#3B82F6", "#EC4899", "#10B981", "#F97316", "#8B5CF6", "#EAB308", "#06B6D4"];

const pelourinhoHill: StageLayer = {
  parallax: 0.3,
  top: -260,
  bottom: 40,
  draw(c, p) {
    // morro e igreja ao fundo
    c.drawCircle(p.x(60), p.y(40), p.s(260), p.paint("#7C9A5C"));
    const white = p.paint("#F8FAFC");
    rect(c, p.x(30), p.y(-210), p.s(60), p.s(80), white);
    rect(c, p.x(26), p.y(-250), p.s(14), p.s(50), white);
    rect(c, p.x(80), p.y(-250), p.s(14), p.s(50), white);
    c.drawCircle(p.x(60), p.y(-196), p.s(8), p.paint("#60A5FA"));
  },
};

const pelourinhoHouses: StageLayer = {
  parallax: 0.7,
  top: -190,
  bottom: -18,
  draw(c, p) {
    const white = p.paint("#F8FAFC");
    const window = p.paint("#1E3A8A");
    for (let i = -10; i <= 10; i++) {
      const w = 64;
      const x = i * w;
      const h = 120 + ((((i * 37) % 40) + 40) % 40);
      const color = COLONIAL[((i % COLONIAL.length) + COLONIAL.length) % COLONIAL.length];
      rect(c, p.x(x), p.y(-h - 20), p.s(w - 2), p.s(h), p.paint(color));
      rect(c, p.x(x), p.y(-h - 26), p.s(w - 2), p.s(8), white);
      for (let k = 0; k < 2; k++) {
        for (let j = 0; j < 3; j++) {
          const wx = p.x(x + 8 + j * 18);
          const wy = p.y(-h - 8 + k * 50);
          rect(c, wx, wy, p.s(10), p.s(22), window);
          rect(c, wx - p.s(2), wy - p.s(3), p.s(14), p.s(3), white);
        }
      }
    }
  },
};

const pelourinhoRibbons: StageLayer = {
  parallax: 0.9,
  top: -240,
  bottom: -195,
  live: true,
  draw(c, p) {
    // fitas do Bonfim
    for (let i = -8; i <= 8; i++) {
      const x = p.x(i * 50);
      const sway = Math.sin((p.frame + i * 13) / 25) * p.s(3);
      c.drawLine(x, p.y(-235), x + sway, p.y(-200), p.paint(COLONIAL[(i + 16) % COLONIAL.length], 0.9));
    }
  },
};

// ------------------------------------------------------------- metrópole

function buildings(parallax: number, color: string, base: number): StageLayer {
  return {
    parallax,
    top: -(base + 90),
    bottom: 0,
    draw(c, p) {
      const body = p.paint(color);
      const lit = p.paint("#FDE68A", 0.75);
      for (let i = -14; i <= 14; i++) {
        const w = 46 + ((((i * 13) % 20) + 20) % 20);
        const h = base + ((((i * 53) % 80) + 80) % 80);
        const x = i * 60;
        rect(c, p.x(x), p.y(-h), p.s(w), p.s(h), body);
        for (let k = 0; k < h / 18; k++) {
          for (let j = 0; j < w / 14; j++) {
            if ((i * 7 + k * 3 + j) % 4 === 0) rect(c, p.x(x + 4 + j * 14), p.y(-h + 8 + k * 18), p.s(6), p.s(8), lit);
          }
        }
      }
    },
  };
}

const metroMoon: StageLayer = {
  parallax: 0.1,
  top: -230,
  bottom: -180,
  draw(c, p) {
    c.drawCircle(p.x(-120), p.y(-205), p.s(22), p.paint("#FEF3C7", 0.9));
  },
};

const NEON = ["#F472B6", "#22D3EE", "#A3E635"];

const metroNeon: StageLayer = {
  parallax: 0.8,
  top: -125,
  bottom: -98,
  live: true,
  draw(c, p) {
    for (let i = -5; i <= 5; i++) {
      const x = p.x(i * 120 + 40);
      const on = Math.floor((p.frame + i * 17) / 30) % 5 !== 0;
      const paint = p.paint(NEON[(i + 15) % 3], on ? 0.95 : 0.25);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(p.s(2.5));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, p.y(-120), p.s(46), p.s(18)), p.s(4), p.s(4)), paint);
    }
  },
};

export const STAGES: StageDef[] = [
  {
    id: "dojo",
    name: "Dojo do Vento",
    sky: ["#F8E7C9", "#E9D2A8"],
    floor: ["#9A6B3F", "#6B4423"],
    layers: [dojoWall, dojoLanterns],
  },
  {
    id: "pelourinho",
    name: "Pelourinho",
    sky: ["#38BDF8", "#BAE6FD"],
    floor: ["#A8A29E", "#78716C"],
    layers: [pelourinhoHill, pelourinhoHouses, pelourinhoRibbons],
  },
  {
    id: "metro",
    name: "Metrópole",
    sky: ["#0B1020", "#312E81"],
    floor: ["#27272A", "#18181B"],
    layers: [metroMoon, buildings(0.35, "#1E1B4B", 180), buildings(0.6, "#111827", 140), metroNeon],
  },
];

export function stageById(id: string): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

// ---------------------------------------------------------------- cache

function freshPaint(color: string, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (alpha < 1) p.setAlphaf(alpha);
  return p;
}

function gradient(x0: number, y0: number, x1: number, y1: number, colors: [string, string]): SkPaint {
  const p = Skia.Paint();
  p.setShader(Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, [Skia.Color(colors[0]), Skia.Color(colors[1])], null, TileMode.Clamp));
  return p;
}

interface CachedLayer {
  picture: SkPicture;
}

/**
 * Guarda as camadas paradas já gravadas e os gradientes. Um por tela de luta;
 * invalida sozinho quando o tamanho da tela muda.
 */
export class StageCache {
  private key = "";
  private layers = new Map<StageLayer, CachedLayer>();
  private sky: SkPaint | null = null;
  private floor: SkPaint | null = null;
  private line: SkPaint | null = null;
  /** Camadas gravadas desde a criação (para testes e diagnóstico). */
  recorded = 0;

  draw(c: SkCanvas, stage: StageDef, v: StageView): void {
    const key = `${stage.id}:${v.width}x${v.height}`;
    if (key !== this.key) {
      this.key = key;
      this.layers.clear();
      this.sky = gradient(0, 0, 0, v.groundPx, stage.sky);
      this.floor = gradient(0, v.groundPx, 0, v.height, stage.floor);
      this.line = freshPaint("#000000", 0.12);
    }
    rect(c, 0, 0, v.width, v.height, this.sky!);

    const half = v.width / 2 / v.k;
    for (const layer of stage.layers) {
      // faixa que a câmera pode mostrar desta camada
      const reach = CAM_LIMIT * layer.parallax + half + 20;
      const painter: LayerPainter = {
        x: (u) => u * v.k,
        y: (u) => v.groundPx + u * v.k,
        s: (u) => u * v.k,
        left: -reach,
        right: reach,
        frame: v.frame,
        paint: freshPaint,
      };
      c.save();
      c.translate(v.width / 2 + v.shakeX - v.cam * layer.parallax * v.k, 0);
      if (layer.live) {
        layer.draw(c, painter);
      } else {
        let cached = this.layers.get(layer);
        if (!cached) {
          const rec = Skia.PictureRecorder();
          const bounds = Skia.XYWHRect(-reach * v.k, painter.y(layer.top), reach * 2 * v.k, (layer.bottom - layer.top) * v.k);
          layer.draw(rec.beginRecording(bounds), painter);
          cached = { picture: rec.finishRecordingAsPicture() };
          this.layers.set(layer, cached);
          this.recorded++;
        }
        c.drawPicture(cached.picture);
      }
      c.restore();
    }

    rect(c, 0, v.groundPx - 2 * v.k, v.width, v.height - v.groundPx + 2 * v.k, this.floor!);
    // linhas de perspectiva do chão
    const sx = (x: number) => (x - v.cam) * v.k + v.width / 2 + v.shakeX;
    for (let i = -20; i <= 20; i++) c.drawLine(sx(i * 40), v.groundPx, sx(i * 40 * 1.6), v.height, this.line!);
  }
}
