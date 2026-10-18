/**
 * Soak do online: N partidas simuladas (src/net/simnet.ts), cada uma com dois
 * RollbackSession, rede com latência/jitter/perda/queda e CPU nível 3 dos dois
 * lados, conferindo o checksum de todo quadro confirmado e o replay no fim.
 *
 *   npm run soak -- 1000                 # 1000 partidas, um worker por núcleo
 *   npm run soak -- 200 --workers 2 --json /tmp/soak.json
 *
 * Sai com código 1 se houver dessincronia, partida travada ou replay que não
 * reproduz a luta.
 */

import { writeFileSync } from "node:fs";
import os from "node:os";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import type { Roster } from "@/src/engine/fighter";
import { type MatchReport, runOnlineMatch, soakMatch } from "@/src/net/simnet";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (!isMainThread) {
  const roster: Roster = {};
  for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);
  const { indices } = workerData as { indices: number[] };
  for (const i of indices) {
    const m = soakMatch(i, BUILTIN_ORDER);
    const report = runOnlineMatch({ roster, seed: m.seed, chars: m.chars, profile: m.profile });
    parentPort!.postMessage({ i, report });
  }
} else {
  const positional = process.argv.slice(2).filter((a, k, all) => !a.startsWith("--") && !all[k - 1]?.startsWith("--"));
  // --only 12,345: só essas partidas (para reproduzir uma falha pelo índice `i`)
  const only = arg("--only")?.split(",").map(Number);
  const from = Number(arg("--from") ?? 0);
  const indices = only ?? Array.from({ length: Number(positional[0] ?? 100) }, (_, k) => from + k);
  const total = indices.length;
  const workers = Math.max(1, Math.min(total, Number(arg("--workers") ?? os.availableParallelism?.() ?? os.cpus().length)));
  const jsonOut = arg("--json");
  const started = Date.now();
  const reports: MatchReport[] = [];

  console.log(`soak: ${total} partidas, ${workers} workers`);
  const buckets: number[][] = Array.from({ length: workers }, () => []);
  indices.forEach((i, k) => buckets[k % workers].push(i));

  const done = new Promise<void>((resolve, reject) => {
    let alive = workers;
    for (const indices of buckets) {
      const w = new Worker(__filename, { workerData: { indices } });
      w.on("message", ({ i, report }: { i: number; report: MatchReport }) => {
        reports.push(report);
        if (report.desync || report.stuck || !report.replayOk) {
          console.log(
            `  ! partida i=${i} seed=${report.seed} ${report.profile} ${report.chars.join(" x ")}: ` +
              `desync=${report.desync}@${report.desyncFrame}(${report.desyncReason}) stuck=${report.stuck} replay=${report.replayOk}`,
          );
        }
        if (reports.length % 50 === 0 || reports.length === total) {
          const s = ((Date.now() - started) / 1000).toFixed(0);
          console.log(`  ${reports.length}/${total} (${s} s)`);
        }
      });
      w.on("error", reject);
      w.on("exit", () => {
        alive--;
        if (alive === 0) resolve();
      });
    }
  });

  done
    .then(() => {
      const sum = (f: (r: MatchReport) => number, rs = reports) => rs.reduce((a, r) => a + f(r), 0);
      const max = (f: (r: MatchReport) => number, rs = reports) => rs.reduce((a, r) => Math.max(a, f(r)), 0);
      const n = reports.length;
      const frames = sum((r) => r.frames);
      const desyncs = reports.filter((r) => r.desync).length;
      const stuck = reports.filter((r) => r.stuck).length;
      const badReplay = reports.filter((r) => !r.stuck && !r.replayOk).length;
      const rb = sum((r) => r.rollbacks);
      const lines = [
        `partidas: ${n}  quadros confirmados: ${frames}  quadros conferidos (checksum dos dois lados): ${sum((r) => r.checkedFrames)}`,
        `dessincronias: ${desyncs}  travadas: ${stuck}  replays divergentes: ${badReplay}`,
        `rollbacks por partida (2 lados): média ${(rb / n).toFixed(1)}  máx ${max((r) => r.rollbacks)}`,
        `profundidade do rollback: média ${(sum((r) => r.rollbackFrames) / Math.max(1, rb)).toFixed(2)} quadros  máx ${max((r) => r.maxRollbackDepth)}`,
        `stalls (ticks esperando o oponente, 2 lados): média ${(sum((r) => r.stalls) / n).toFixed(1)}/partida  máx ${max((r) => r.stalls)}  ` +
          `(${((sum((r) => r.stalls) / Math.max(1, 2 * frames)) * 100).toFixed(2)}% dos ticks)`,
        `ticks segurados p/ sincronizar relógio (inclui a espera durante quedas): média ${(sum((r) => r.syncSkips) / n).toFixed(1)}/partida  ` +
          `máx ${max((r) => r.syncSkips)}  (${((sum((r) => r.syncSkips) / Math.max(1, 2 * frames)) * 100).toFixed(2)}% dos ticks)`,
        ...(() => {
          const rec = reports.filter((r) => r.recoveryMs >= 0);
          return rec.length
            ? [`quedas de rede: ${rec.length}  volta ao jogo normal após reconectar: média ${(sum((r) => r.recoveryMs, rec) / rec.length).toFixed(0)} ms  máx ${max((r) => r.recoveryMs, rec)} ms`]
            : [];
        })(),
        `mensagens: ${sum((r) => r.messages)}  perdidas: ${sum((r) => r.dropped)}`,
        `tempo: ${((Date.now() - started) / 1000).toFixed(1)} s`,
      ];
      console.log("\n" + lines.join("\n"));
      console.log("\npor perfil de rede:");
      for (const p of [...new Set(reports.map((r) => r.profile))].sort()) {
        const rs = reports.filter((r) => r.profile === p);
        const prb = sum((r) => r.rollbacks, rs);
        console.log(
          `  ${p.padEnd(6)} ${String(rs.length).padStart(5)} partidas  desync ${rs.filter((r) => r.desync).length}  ` +
            `travadas ${rs.filter((r) => r.stuck).length}  rollbacks/partida ${(prb / rs.length).toFixed(1)} (máx ${max((r) => r.rollbacks, rs)})  ` +
            `prof. média ${(sum((r) => r.rollbackFrames, rs) / Math.max(1, prb)).toFixed(2)} (máx ${max((r) => r.maxRollbackDepth, rs)})  ` +
            `stalls/partida ${(sum((r) => r.stalls, rs) / rs.length).toFixed(1)} (máx ${max((r) => r.stalls, rs)})`,
        );
      }
      if (jsonOut) writeFileSync(jsonOut, JSON.stringify(reports, null, 1));
      process.exit(desyncs || stuck || badReplay ? 1 : 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(2);
    });
}
