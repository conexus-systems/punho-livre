import type { Animation, AnimFrame, Box } from "./types";

export interface AnimCursor {
  anim: number;
  animElem: number;
  animElemTime: number;
  animTick: number;
}

export function resetAnim(o: AnimCursor, id: number, anim: Animation, elem = 0): void {
  const e = Math.max(0, Math.min(elem, anim.frames.length - 1));
  o.anim = id;
  o.animElem = e;
  o.animElemTime = 0;
  o.animTick = anim.starts[e] ?? 0;
}

export function advanceAnim(o: AnimCursor, anim: Animation): void {
  if (o.animElem >= anim.frames.length) o.animElem = 0;
  const f = anim.frames[o.animElem];
  o.animTick++;
  // quadro infinito (-1): o tempo no elemento continua contando, como no MUGEN; senão AnimElem = n
  // ficaria verdadeiro para sempre e um HitDef nele rearmaria depois de cada acerto
  o.animElemTime++;
  if (f.time < 0) return;
  if (o.animElemTime >= f.time) {
    o.animElem++;
    o.animElemTime = 0;
    if (o.animElem >= anim.frames.length) {
      o.animElem = anim.loopStart;
      o.animTick = anim.starts[anim.loopStart] ?? 0;
    }
  }
}

/** 0 no último tick da animação; negativo antes. */
export function animTime(o: AnimCursor, anim: Animation): number {
  return o.animTick - anim.totalTime + 1;
}

export function currentFrame(o: AnimCursor, anim: Animation): AnimFrame {
  return anim.frames[Math.min(o.animElem, anim.frames.length - 1)];
}

/** Caixa de colisão em coordenadas do mundo. */
export function worldBox(b: Box, x: number, y: number, facing: 1 | -1): Box {
  if (facing === 1) return { x1: x + b.x1, x2: x + b.x2, y1: y + b.y1, y2: y + b.y2 };
  return { x1: x - b.x2, x2: x - b.x1, y1: y + b.y1, y2: y + b.y2 };
}

export function overlap(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

/** Centro da interseção (para posicionar a faísca do golpe). */
export function contactPoint(a: Box, b: Box): { x: number; y: number } {
  const x1 = Math.max(a.x1, b.x1);
  const x2 = Math.min(a.x2, b.x2);
  const y1 = Math.max(a.y1, b.y1);
  const y2 = Math.min(a.y2, b.y2);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}
