/**
 * Laboratório na versão web (docs/DEVICE_LAB.md):
 * - `?bench=1`: roda a luta fixa CPU × CPU (src/services/benchFight.ts) por 60 s,
 *   mostra os números e deixa baixar o JSON; o resultado também fica em
 *   `window.__MUGEN_BENCH__` (usado por `npm run bench:web`).
 * - `?perf=1`: só o overlay de desempenho nas lutas normais.
 */

import type { BenchReport } from "@/src/services/benchFight";
import { formatPerf, type PerfMonitor, type PerfSnapshot } from "@/src/services/perf";

const params = new URLSearchParams(location.search);

export const benchRequested = params.get("bench") === "1";
export const perfRequested = benchRequested || params.get("perf") === "1";

/** Faixa de texto no topo da luta, atualizada 2×/s. */
export function mountPerfLabel(host: HTMLElement, monitor: PerfMonitor): void {
  const el = document.createElement("div");
  el.id = "perf";
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:absolute;bottom:4px;left:50%;transform:translateX(-50%);z-index:5;font:11px/1.4 monospace;color:#fff;background:rgba(0,0,0,.6);padding:0 6px;white-space:nowrap;pointer-events:none";
  el.textContent = "medindo…";
  host.append(el);
  setInterval(() => {
    if (!host.hidden) el.textContent = formatPerf(monitor.windowSnapshot());
  }, 500);
}

export function buildReport(s: PerfSnapshot, extra: { duration_s: number; sim_steps: number; started_at: string; pixel_ratio: number }): BenchReport {
  return {
    format: "mugen-arena-bench/1",
    platform: "web",
    os_version: "",
    app_version: "play",
    device: navigator.userAgent,
    width: window.innerWidth,
    height: window.innerHeight,
    ...extra,
    ...s,
  };
}

export function downloadJson(report: BenchReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mugen-bench-${report.started_at.replace(/[:.]/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Linhas legíveis do resultado (painel). */
export function reportLines(r: BenchReport): string[] {
  return [
    `fps médio ${r.fps_avg} · p5 ${r.fps_p5}`,
    `quadro p95 ${r.frame_ms_p95} ms · máx ${r.frame_ms_max} ms · travadas ${r.long_frames}`,
    `simulação p95 ${r.sim_ms_p95} ms · desenho p95 ${r.draw_ms_p95} ms`,
    `${r.frames} quadros · ${r.sim_steps} passos em ${r.duration_s} s · ${r.width}×${r.height} @${r.pixel_ratio}x`,
  ];
}
