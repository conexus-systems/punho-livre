/**
 * Efeitos visuais da luta (só visuais: não entram no WorldState).
 *
 * - Impacto: clarão, estrela de pontas, rastro de corte e onda de choque nos
 *   golpes fortes, faíscas que caem com gravidade.
 * - Defesa: escudo azul em arco virado para o atacante.
 * - Poeira: ao pousar, quicar no chão, correr e rolar.
 */

import { BlendMode, PaintStyle, Skia, StrokeCap, TileMode, type SkCanvas, type SkPaint } from "@shopify/react-native-skia";

type P = { x: number; y: number };

interface Impact {
  x: number;
  y: number;
  level: number;
  age: number;
  guard: boolean;
  color: string;
  /** Para onde o golpe foi (1 = direita da tela). */
  dir: number;
  spin: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  /** Poeira (cresce e some, sem brilho). */
  dust: boolean;
}

function paint(color: string, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (alpha < 1) p.setAlphaf(Math.max(0, alpha));
  return p;
}

function additive(color: string, alpha: number): SkPaint {
  const p = paint(color, alpha);
  p.setBlendMode(BlendMode.Plus);
  return p;
}

/** Estrela de `n` pontas (caminho fechado) em volta de `c`. */
function star(c: P, n: number, outer: number, inner: number, rot: number) {
  const path = Skia.PathBuilder.Make();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer * (i % 4 === 0 ? 1 : 0.72) : inner;
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const x = c.x + Math.cos(a) * r;
    const y = c.y + Math.sin(a) * r;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.close();
  return path.detach();
}

export class Effects {
  private impacts: Impact[] = [];
  private particles: Particle[] = [];

  hit(x: number, y: number, level: number, color: string, dir: number, guard: boolean): void {
    this.impacts.push({ x, y, level, age: 0, guard, color, dir, spin: Math.random() * Math.PI });
    const n = guard ? 5 : 6 + level * 5;
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * Math.PI * 1.1 + (dir > 0 ? 0 : Math.PI);
      const v = 1.5 + Math.random() * (2 + level * 1.5);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 1.5,
        age: 0,
        life: 14 + Math.random() * 12,
        size: 0.8 + Math.random() * (1 + level * 0.5),
        color: guard ? "#BFDBFE" : Math.random() < 0.5 ? "#FFFFFF" : color,
        dust: false,
      });
    }
  }

  dust(x: number, amount: number, dir = 0): void {
    for (let i = 0; i < amount; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: -1,
        vx: dir * (0.4 + Math.random()) + (Math.random() - 0.5) * 1.2,
        vy: -Math.random() * 0.9,
        age: 0,
        life: 20 + Math.random() * 14,
        size: 3 + Math.random() * 3,
        color: "#D6CBB8",
        dust: true,
      });
    }
  }

  draw(c: SkCanvas, sx: (x: number) => number, sy: (y: number) => number, k: number): void {
    // poeira atrás das faíscas
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age++;
      if (p.age > p.life) continue;
      alive.push(p);
      p.x += p.vx;
      p.y += p.vy;
      const t = p.age / p.life;
      if (p.dust) {
        p.vx *= 0.94;
        p.vy *= 0.94;
        c.drawCircle(sx(p.x), sy(p.y), p.size * k * (0.6 + t), paint(p.color, 0.45 * (1 - t)));
      } else {
        p.vy += 0.25;
        p.vx *= 0.97;
        const pt = additive(p.color, 1 - t);
        pt.setStrokeWidth(p.size * k * (1 - t * 0.5));
        pt.setStrokeCap(StrokeCap.Round);
        c.drawLine(sx(p.x), sy(p.y), sx(p.x - p.vx * 1.6), sy(p.y - p.vy * 1.6), pt);
      }
    }
    this.particles = alive;

    const keep: Impact[] = [];
    for (const s of this.impacts) {
      s.age++;
      const life = s.guard ? 12 : 12 + s.level * 5;
      if (s.age > life) continue;
      keep.push(s);
      const t = s.age / life;
      const c0 = { x: sx(s.x), y: sy(s.y) };
      const base = (9 + s.level * 7) * k;
      if (s.guard) {
        // escudo: arco grosso azul virado para o atacante
        const r = base * (0.9 + t * 0.6);
        const shield = additive("#93C5FD", 0.85 * (1 - t));
        shield.setStyle(PaintStyle.Stroke);
        shield.setStrokeWidth(3.2 * k * (1 - t * 0.6));
        const a0 = s.dir > 0 ? 180 - 70 : -70;
        const arc = Skia.PathBuilder.Make();
        arc.addArc(Skia.XYWHRect(c0.x - r, c0.y - r, r * 2, r * 2), a0, 140);
        c.drawPath(arc.detach(), shield);
        c.drawCircle(c0.x, c0.y, r * 0.55, additive("#DBEAFE", 0.5 * (1 - t)));
        continue;
      }
      // clarão
      const glow = Skia.Paint();
      glow.setBlendMode(BlendMode.Plus);
      const gr = base * (1.3 + t);
      glow.setShader(Skia.Shader.MakeRadialGradient(c0, gr, [Skia.Color("#FFFFFF"), Skia.Color(s.color), Skia.Color("transparent")], [0, 0.3, 1], TileMode.Clamp));
      glow.setAlphaf(1 - t);
      c.drawCircle(c0.x, c0.y, gr, glow);
      // estrela de pontas: cresce rápido e encolhe
      const grow = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
      const outer = base * (1.2 + s.level * 0.25) * (0.5 + grow * 0.8);
      c.drawPath(star(c0, 6 + s.level * 2, outer, outer * 0.28, s.spin + t * 0.6), additive(s.color, 0.9 * (1 - t)));
      c.drawPath(star(c0, 6 + s.level * 2, outer * 0.62, outer * 0.18, s.spin + t * 0.6), additive("#FFFFFF", 1 - t));
      if (s.level >= 1) {
        // rastro do golpe atravessando o ponto de contato
        const len = base * (2.4 + s.level) * (0.6 + t * 0.6);
        const ang = (s.dir > 0 ? -0.35 : Math.PI + 0.35) + (s.spin - 1.5) * 0.15;
        const path = Skia.PathBuilder.Make();
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        const w = base * 0.22 * (1 - t);
        path.moveTo(c0.x - ux * len * 0.5, c0.y - uy * len * 0.5);
        path.lineTo(c0.x - uy * w, c0.y + ux * w);
        path.lineTo(c0.x + ux * len * 0.6, c0.y + uy * len * 0.6);
        path.lineTo(c0.x + uy * w, c0.y - ux * w);
        path.close();
        c.drawPath(path.detach(), additive("#FFFFFF", 0.9 * (1 - t)));
      }
      if (s.level >= 2) {
        // onda de choque
        const ring = additive(s.color, 0.8 * (1 - t));
        ring.setStyle(PaintStyle.Stroke);
        ring.setStrokeWidth(2.4 * k * (1 - t));
        c.drawCircle(c0.x, c0.y, base * (0.6 + t * 2.6), ring);
      }
    }
    this.impacts = keep;
  }
}
