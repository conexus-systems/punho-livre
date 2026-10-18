/**
 * Efeitos visuais da luta (só visuais: não entram no WorldState).
 *
 * - Impacto por nível: fraco (estrela pequena), médio (+ rastro do golpe),
 *   forte (+ clarão e onda de choque), especial (+ segunda onda e faíscas da
 *   cor da energia) e super (+ linhas de velocidade).
 * - Contra-ataque: impacto laranja maior com anel duplo.
 * - Defesa: escudo em arco virado para o atacante, faíscas que voltam.
 * - Guard crush: o escudo estilhaça (cacos) com anel vermelho.
 * - Poeira: ao pousar, quicar no chão, correr e rolar.
 *
 * Custo fixo: no máximo MAX_PARTICLES partículas e MAX_IMPACTS impactos vivos
 * (anel circular: o mais antigo sai), e os Paints são reaproveitados entre
 * quadros. A simulação dos efeitos anda em `tick()`, uma vez por quadro
 * simulado, e a aleatoriedade vem de um PRNG semeado pelo quadro do mundo —
 * o mesmo replay desenha os mesmos efeitos.
 */

import { BlendMode, PaintStyle, Skia, StrokeCap, type SkCanvas, type SkPaint } from "@shopify/react-native-skia";

import { noise } from "./camera";

type P = { x: number; y: number };

export type ImpactKind = "hit" | "guard" | "counter" | "crush";

/** Teto de partículas vivas (faíscas + poeira + cacos). */
export const MAX_PARTICLES = 96;
/** Teto de impactos vivos. */
export const MAX_IMPACTS = 10;

/** Faíscas por nível do golpe (fraco, médio, forte, especial, super). */
const SPARKS_BY_LEVEL = [4, 7, 10, 12, 14];
/** Vida (quadros) do desenho do impacto por nível. */
const LIFE_BY_LEVEL = [10, 13, 17, 19, 22];
const COUNTER_COLOR = "#FF6A1F";
const GUARD_COLOR = "#93C5FD";
const CRUSH_COLOR = "#EF4444";

interface Impact {
  alive: boolean;
  kind: ImpactKind;
  x: number;
  y: number;
  level: number;
  age: number;
  life: number;
  color: string;
  /** Para onde o golpe foi (1 = direita da tela). */
  dir: number;
  spin: number;
}

const enum PType {
  Spark,
  Dust,
  Shard,
}

interface Particle {
  alive: boolean;
  type: PType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

/** Gerador pequeno e determinístico (semeado por quadro e evento). */
class Rng {
  private n = 0;
  constructor(
    private readonly frame: number,
    private readonly salt: number,
  ) {}
  next(): number {
    return noise(this.frame, this.salt * 977 + this.n++);
  }
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
  private nextImpact = 0;
  private nextParticle = 0;
  /** Contador de eventos do quadro (sal do PRNG). */
  private salt = 0;
  private frame = 0;
  // Paints reaproveitados (o recorder copia o Paint no draw: mudar depois é seguro)
  private add: SkPaint | null = null;
  private addStroke: SkPaint | null = null;
  private flat: SkPaint | null = null;
  private colors = new Map<string, ReturnType<typeof Skia.Color>>();

  constructor() {
    for (let i = 0; i < MAX_IMPACTS; i++) this.impacts.push({ alive: false, kind: "hit", x: 0, y: 0, level: 0, age: 0, life: 1, color: "#FFFFFF", dir: 1, spin: 0 });
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles.push({ alive: false, type: PType.Spark, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1, color: "#FFFFFF" });
  }

  /** Partículas vivas agora (para medir o custo). */
  get liveParticles(): number {
    let n = 0;
    for (const p of this.particles) if (p.alive) n++;
    return n;
  }

  /** Começo de um quadro simulado: semente dos efeitos criados nele. */
  beginFrame(frame: number): void {
    this.frame = frame;
    this.salt = 0;
  }

  private rng(): Rng {
    return new Rng(this.frame, ++this.salt);
  }

  private spawn(type: PType, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    const p = this.particles[this.nextParticle];
    this.nextParticle = (this.nextParticle + 1) % MAX_PARTICLES;
    p.alive = true;
    p.type = type;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.age = 0;
    p.life = life;
    p.size = size;
    p.color = color;
  }

  /** Impacto de golpe. `dir` = para onde o golpe vai (1 = direita da tela). */
  impact(kind: ImpactKind, x: number, y: number, level: number, color: string, dir: number): void {
    const r = this.rng();
    const lvl = Math.max(0, Math.min(4, Math.round(level)));
    const s = this.impacts[this.nextImpact];
    this.nextImpact = (this.nextImpact + 1) % MAX_IMPACTS;
    const tint = kind === "counter" ? COUNTER_COLOR : kind === "guard" ? GUARD_COLOR : kind === "crush" ? CRUSH_COLOR : color;
    Object.assign(s, {
      alive: true,
      kind,
      x,
      y,
      level: kind === "counter" ? Math.max(lvl, 2) : lvl,
      age: 0,
      life: kind === "guard" ? 11 + lvl : kind === "crush" ? 24 : kind === "counter" ? LIFE_BY_LEVEL[lvl] + 6 : LIFE_BY_LEVEL[lvl],
      color: tint,
      dir,
      spin: r.next() * Math.PI,
    });

    const back = dir > 0 ? Math.PI : 0;
    const fwd = dir > 0 ? 0 : Math.PI;
    if (kind === "guard") {
      // faíscas batem no escudo e voltam para o atacante
      for (let i = 0; i < 4 + lvl; i++) {
        const a = back + (r.next() - 0.5) * 1.4;
        const v = 1.5 + r.next() * 2;
        this.spawn(PType.Spark, x, y, Math.cos(a) * v, Math.sin(a) * v - 1, 10 + r.next() * 6, 0.8 + r.next() * 0.6, i % 2 ? "#FFFFFF" : "#BFDBFE");
      }
      return;
    }
    if (kind === "crush") {
      // cacos do escudo
      for (let i = 0; i < 12; i++) {
        const a = r.next() * Math.PI * 2;
        const v = 2 + r.next() * 3.5;
        this.spawn(PType.Shard, x, y, Math.cos(a) * v, Math.sin(a) * v - 2, 22 + r.next() * 10, 2 + r.next() * 2, i % 3 ? "#BFDBFE" : "#FFFFFF");
      }
      return;
    }
    const n = SPARKS_BY_LEVEL[lvl] + (kind === "counter" ? 4 : 0);
    for (let i = 0; i < n; i++) {
      const a = fwd + (r.next() - 0.5) * Math.PI * (lvl >= 3 ? 1.6 : 1.1);
      const v = 1.5 + r.next() * (2 + lvl * 1.4);
      const energy = lvl >= 3 && i % 3 === 0;
      const c = kind === "counter" ? (i % 2 ? "#FFFFFF" : COUNTER_COLOR) : energy ? tint : r.next() < 0.5 ? "#FFFFFF" : "#FDE68A";
      this.spawn(PType.Spark, x, y, Math.cos(a) * v, Math.sin(a) * v - 1.5, 12 + r.next() * (8 + lvl * 2), 0.8 + r.next() * (0.8 + lvl * 0.35), c);
    }
  }

  dust(x: number, amount: number, dir = 0): void {
    const r = this.rng();
    for (let i = 0; i < amount; i++) {
      this.spawn(PType.Dust, x + (r.next() - 0.5) * 18, -1, dir * (0.4 + r.next()) + (r.next() - 0.5) * 1.2, -r.next() * 0.9, 20 + r.next() * 14, 3 + r.next() * 3, "#D6CBB8");
    }
  }

  /** Avança um quadro simulado. */
  tick(): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      if (++p.age > p.life) {
        p.alive = false;
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === PType.Dust) {
        p.vx *= 0.94;
        p.vy *= 0.94;
      } else {
        p.vy += p.type === PType.Shard ? 0.32 : 0.25;
        p.vx *= 0.97;
      }
    }
    for (const s of this.impacts) if (s.alive && ++s.age > s.life) s.alive = false;
  }

  private color(c: string) {
    let v = this.colors.get(c);
    if (!v) {
      v = Skia.Color(c);
      this.colors.set(c, v);
    }
    return v;
  }

  private additive(color: string, alpha: number): SkPaint {
    if (!this.add) {
      this.add = Skia.Paint();
      this.add.setAntiAlias(true);
      this.add.setBlendMode(BlendMode.Plus);
    }
    this.add.setColor(this.color(color));
    this.add.setAlphaf(Math.max(0, Math.min(1, alpha)));
    return this.add;
  }

  private stroke(color: string, alpha: number, width: number): SkPaint {
    if (!this.addStroke) {
      this.addStroke = Skia.Paint();
      this.addStroke.setAntiAlias(true);
      this.addStroke.setBlendMode(BlendMode.Plus);
      this.addStroke.setStyle(PaintStyle.Stroke);
      this.addStroke.setStrokeCap(StrokeCap.Round);
    }
    this.addStroke.setColor(this.color(color));
    this.addStroke.setAlphaf(Math.max(0, Math.min(1, alpha)));
    this.addStroke.setStrokeWidth(Math.max(0.5, width));
    return this.addStroke;
  }

  private plain(color: string, alpha: number): SkPaint {
    if (!this.flat) {
      this.flat = Skia.Paint();
      this.flat.setAntiAlias(true);
    }
    this.flat.setColor(this.color(color));
    this.flat.setAlphaf(Math.max(0, Math.min(1, alpha)));
    return this.flat;
  }

  draw(c: SkCanvas, sx: (x: number) => number, sy: (y: number) => number, k: number): void {
    // poeira atrás, faíscas e cacos na frente
    for (const p of this.particles) {
      if (!p.alive || p.type !== PType.Dust) continue;
      const t = p.age / p.life;
      c.drawCircle(sx(p.x), sy(p.y), p.size * k * (0.6 + t), this.plain(p.color, 0.45 * (1 - t)));
    }
    for (const p of this.particles) {
      if (!p.alive || p.type === PType.Dust) continue;
      const t = p.age / p.life;
      const tail = p.type === PType.Shard ? 0.8 : 1.6;
      c.drawLine(sx(p.x), sy(p.y), sx(p.x - p.vx * tail), sy(p.y - p.vy * tail), this.stroke(p.color, 1 - t, p.size * k * (1 - t * 0.5)));
    }

    for (const s of this.impacts) {
      if (!s.alive) continue;
      const t = s.age / s.life;
      const c0 = { x: sx(s.x), y: sy(s.y) };
      const base = (8 + s.level * 5) * k;
      if (s.kind === "guard") this.drawShield(c, s, c0, base, t, k);
      else if (s.kind === "crush") this.drawCrush(c, s, c0, k, t);
      else this.drawHit(c, s, c0, base, t, k);
    }
  }

  private drawShield(c: SkCanvas, s: Impact, c0: P, base: number, t: number, k: number): void {
    // escudo: três segmentos de arco virados para o atacante + brilho no centro
    const r = base * (1 + t * 0.5);
    const a0 = s.dir > 0 ? 180 - 70 : -70;
    for (let i = 0; i < 3; i++) {
      const arc = Skia.PathBuilder.Make();
      arc.addArc(Skia.XYWHRect(c0.x - r, c0.y - r, r * 2, r * 2), a0 + i * 48, 42);
      c.drawPath(arc.detach(), this.stroke(i === 1 ? "#DBEAFE" : GUARD_COLOR, 0.9 * (1 - t), 3.4 * k * (1 - t * 0.6)));
    }
    c.drawCircle(c0.x, c0.y, r * 0.5, this.additive("#DBEAFE", 0.45 * (1 - t)));
  }

  private drawCrush(c: SkCanvas, s: Impact, c0: P, k: number, t: number): void {
    // anel vermelho que abre e um clarão curto
    c.drawCircle(c0.x, c0.y, (20 + t * 46) * k, this.stroke(CRUSH_COLOR, 0.9 * (1 - t), 3.5 * k * (1 - t)));
    c.drawCircle(c0.x, c0.y, (12 + t * 30) * k, this.stroke("#FFFFFF", 0.7 * (1 - t), 2 * k * (1 - t)));
    if (t < 0.3) c.drawCircle(c0.x, c0.y, 22 * k, this.additive("#FECACA", 0.7 * (1 - t / 0.3)));
  }

  private drawHit(c: SkCanvas, s: Impact, c0: P, base: number, t: number, k: number): void {
    const lvl = s.level;
    const counter = s.kind === "counter";
    // clarão (forte para cima): halo da cor do golpe + miolo branco (dois
    // círculos somados; sem criar shader de gradiente a cada quadro)
    if (lvl >= 2 && t < 0.6) {
      const gr = base * (1.4 + t);
      const a = 1 - t / 0.6;
      c.drawCircle(c0.x, c0.y, gr, this.additive(s.color, 0.28 * a));
      c.drawCircle(c0.x, c0.y, gr * 0.62, this.additive(s.color, 0.35 * a));
      c.drawCircle(c0.x, c0.y, gr * 0.32, this.additive("#FFFFFF", 0.85 * a));
    } else if (lvl < 2 && t < 0.4) {
      c.drawCircle(c0.x, c0.y, base * (0.7 + t), this.additive("#FFFFFF", 0.6 * (1 - t / 0.4)));
    }
    // estrela de pontas: cresce rápido e encolhe
    const grow = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
    const outer = base * (1.1 + lvl * 0.2) * (0.5 + grow * 0.8) * (counter ? 1.25 : 1);
    const points = 5 + lvl * 2;
    c.drawPath(star(c0, points, outer, outer * 0.28, s.spin + t * 0.6), this.additive(s.color, 0.9 * (1 - t)));
    c.drawPath(star(c0, points, outer * 0.62, outer * 0.18, s.spin + t * 0.6), this.additive("#FFFFFF", 1 - t));
    if (lvl >= 1) {
      // rastro do golpe atravessando o ponto de contato
      const len = base * (2.2 + lvl * 0.8) * (0.6 + t * 0.6);
      const ang = (s.dir > 0 ? -0.35 : Math.PI + 0.35) + (s.spin - 1.5) * 0.15;
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const w = base * 0.22 * (1 - t);
      const path = Skia.PathBuilder.Make();
      path.moveTo(c0.x - ux * len * 0.5, c0.y - uy * len * 0.5);
      path.lineTo(c0.x - uy * w, c0.y + ux * w);
      path.lineTo(c0.x + ux * len * 0.6, c0.y + uy * len * 0.6);
      path.lineTo(c0.x + uy * w, c0.y - ux * w);
      path.close();
      c.drawPath(path.detach(), this.additive("#FFFFFF", 0.9 * (1 - t)));
    }
    if (lvl >= 2) {
      // onda de choque (dupla no especial, super e contra-ataque)
      c.drawCircle(c0.x, c0.y, base * (0.6 + t * 2.6), this.stroke(s.color, 0.8 * (1 - t), 2.4 * k * (1 - t)));
      if (lvl >= 3 || counter) c.drawCircle(c0.x, c0.y, base * (0.3 + t * 1.6), this.stroke("#FFFFFF", 0.7 * (1 - t), 1.6 * k * (1 - t)));
    }
    if (lvl >= 4 && t < 0.7) {
      // super: linhas de velocidade saindo do impacto
      for (let i = 0; i < 10; i++) {
        const a = s.spin + (i / 10) * Math.PI * 2;
        const r0 = base * (1.2 + t * 2);
        const r1 = r0 + base * (1.6 - t);
        c.drawLine(c0.x + Math.cos(a) * r0, c0.y + Math.sin(a) * r0, c0.x + Math.cos(a) * r1, c0.y + Math.sin(a) * r1, this.stroke(i % 2 ? s.color : "#FFFFFF", 0.8 * (1 - t / 0.7), 1.6 * k));
      }
    }
  }
}
