/**
 * Medição leve de desempenho da luta: intervalo entre quadros (fps), tempo da
 * simulação (stepWorld/rollback) e do desenho (gravação da Picture no JS) e
 * contagem de rollbacks.
 *
 * Cada amostra custa O(1): vai para um histograma de baldes de 0,25 ms (até
 * 100 ms). Percentis só são calculados quando alguém pede (overlay a cada
 * 500 ms, telemetria no fim da luta). Sem alocação por quadro.
 *
 * Código puro (sem React Native): usado pelo app, pela versão web (play/) e
 * pelos testes.
 */

const BUCKET_MS = 0.25;
const BUCKETS = 400; // 0–100 ms; acima disso cai no último balde

class Histogram {
  private readonly bins = new Uint32Array(BUCKETS);
  count = 0;
  sum = 0;
  max = 0;

  add(ms: number): void {
    if (!(ms >= 0)) return;
    const i = Math.min(BUCKETS - 1, Math.floor(ms / BUCKET_MS));
    this.bins[i]++;
    this.count++;
    this.sum += ms;
    if (ms > this.max) this.max = ms;
  }

  /** Percentil p (0–100), com resolução de 0,25 ms (limite superior do balde). */
  percentile(p: number): number {
    if (this.count === 0) return 0;
    const target = Math.max(1, Math.ceil((p / 100) * this.count));
    let seen = 0;
    for (let i = 0; i < BUCKETS; i++) {
      seen += this.bins[i];
      if (seen >= target) return i === BUCKETS - 1 ? this.max : Math.min(this.max, (i + 1) * BUCKET_MS);
    }
    return this.max;
  }

  mean(): number {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  reset(): void {
    this.bins.fill(0);
    this.count = 0;
    this.sum = 0;
    this.max = 0;
  }
}

export interface PerfSnapshot {
  /** Quadros desenhados no período. */
  frames: number;
  /** fps médio = quadros / tempo. */
  fps_avg: number;
  /** fps no 5º percentil (os 5% piores quadros), = 1000 / p95 do intervalo. */
  fps_p5: number;
  /** Intervalo entre quadros, p95 (ms). */
  frame_ms_p95: number;
  /** Pior intervalo entre quadros (ms). */
  frame_ms_max: number;
  /** Simulação por quadro desenhado (todos os passos do quadro, incl. re-simulação do rollback), p95 (ms). */
  sim_ms_p95: number;
  /** Desenho (gravação da Picture/canvas no JS), p95 (ms). */
  draw_ms_p95: number;
  /** Rollbacks no período (só online). */
  rollbacks: number;
  /** Quadros com intervalo > 2× o alvo (≈ 33 ms): travadas visíveis. */
  long_frames: number;
}

class Window {
  readonly frame = new Histogram();
  readonly sim = new Histogram();
  readonly draw = new Histogram();
  rollbacks = 0;
  longFrames = 0;
  elapsed = 0;

  reset(): void {
    this.frame.reset();
    this.sim.reset();
    this.draw.reset();
    this.rollbacks = 0;
    this.longFrames = 0;
    this.elapsed = 0;
  }

  snapshot(): PerfSnapshot {
    const p95 = this.frame.percentile(95);
    return {
      frames: this.frame.count,
      fps_avg: this.elapsed > 0 ? round1((this.frame.count * 1000) / this.elapsed) : 0,
      fps_p5: p95 > 0 ? round1(1000 / p95) : 0,
      frame_ms_p95: round2(p95),
      frame_ms_max: round2(this.frame.max),
      sim_ms_p95: round2(this.sim.percentile(95)),
      draw_ms_p95: round2(this.draw.percentile(95)),
      rollbacks: this.rollbacks,
      long_frames: this.longFrames,
    };
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Intervalo acima disto (ms) conta como travada (2 quadros a 60 Hz). */
const LONG_FRAME_MS = 1000 / 30;

/**
 * Uso no laço de quadros:
 *   perf.frame(t)          // início do quadro (timestamp do rAF)
 *   perf.sim(ms) / perf.draw(ms)
 *   perf.setRollbacks(session.stats.rollbacks)
 *
 * `total` acumula desde `reset()` (resumo da luta para a telemetria);
 * `window` é reiniciada a cada `windowSnapshot()` (overlay).
 */
export class PerfMonitor {
  private readonly total = new Window();
  private readonly window = new Window();
  private lastT = -1;
  private rollbackBase = -1;
  private rollbackSeen = 0;

  frame(t: number): void {
    if (this.lastT >= 0) {
      const dt = t - this.lastT;
      // pausas longas (app em segundo plano, pausa do jogo) não são quadros
      if (dt > 0 && dt < 1000) {
        for (const w of [this.total, this.window]) {
          w.frame.add(dt);
          w.elapsed += dt;
          if (dt > LONG_FRAME_MS) w.longFrames++;
        }
      }
    }
    this.lastT = t;
  }

  sim(ms: number): void {
    this.total.sim.add(ms);
    this.window.sim.add(ms);
  }

  draw(ms: number): void {
    this.total.draw.add(ms);
    this.window.draw.add(ms);
  }

  /** Recebe o contador cumulativo de rollbacks da sessão (RollbackSession.stats.rollbacks). */
  setRollbacks(cumulative: number): void {
    if (this.rollbackBase < 0) this.rollbackBase = cumulative;
    const n = cumulative - this.rollbackBase;
    const delta = n - this.rollbackSeen;
    if (delta > 0) {
      this.total.rollbacks += delta;
      this.window.rollbacks += delta;
      this.rollbackSeen = n;
    }
  }

  /** Esquece o último timestamp (ex.: depois de uma pausa) sem zerar as estatísticas. */
  pause(): void {
    this.lastT = -1;
  }

  /** Números desde o último `windowSnapshot()` e reinicia a janela. */
  windowSnapshot(): PerfSnapshot {
    const s = this.window.snapshot();
    this.window.reset();
    return s;
  }

  /** Números desde o último `reset()`. */
  totalSnapshot(): PerfSnapshot {
    return this.total.snapshot();
  }

  reset(): void {
    this.total.reset();
    this.window.reset();
    this.lastT = -1;
    this.rollbackBase = -1;
    this.rollbackSeen = 0;
  }
}

/** Relógio de alta resolução disponível em Hermes, navegador e Node. */
export const now: () => number =
  typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : () => Date.now();

/** Linha curta para o overlay. */
export function formatPerf(s: PerfSnapshot): string {
  const rb = s.rollbacks > 0 ? ` · rb ${s.rollbacks}` : "";
  return `${Math.round(s.fps_avg)} fps (p5 ${Math.round(s.fps_p5)}) · quadro p95 ${s.frame_ms_p95.toFixed(1)} ms · sim ${s.sim_ms_p95.toFixed(2)} · desenho ${s.draw_ms_p95.toFixed(2)}${rb}`;
}
