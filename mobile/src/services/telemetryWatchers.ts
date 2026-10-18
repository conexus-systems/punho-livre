/**
 * Eventos de produto observados de fora (sem mexer em src/net): a fila online
 * é acompanhada pelas transições do `onlineStore`.
 *
 *   connecting → queued (ranked) | room (sala criada) → matched | idle (cancelou) | error
 *   connecting → matched direto = entrou numa sala pelo código
 */

import { onlineStore, type OnlinePhase } from "@/src/net/online";

import { track } from "./telemetry";

let unsubscribe: (() => void) | null = null;

export function watchOnlineQueue(): () => void {
  if (unsubscribe) return unsubscribe;
  let since = 0;
  let mode: "ranked" | "room" | null = null;
  let prev: OnlinePhase["kind"] = onlineStore.get().phase.kind;
  const off = onlineStore.subscribe(() => {
    const phase = onlineStore.get().phase;
    if (phase.kind === prev) return;
    prev = phase.kind;
    if (phase.kind === "connecting") {
      since = Date.now();
      mode = null;
      return;
    }
    if (phase.kind === "queued") mode = "ranked";
    else if (phase.kind === "room") mode = "room";
    if (since === 0) return;
    const wait_s = Math.round((Date.now() - since) / 1000);
    const m = mode ?? "room";
    if (phase.kind === "matched") track("online_queue", { mode: m, outcome: "matched", wait_s });
    else if (phase.kind === "idle") track("online_queue", { mode: m, outcome: "canceled", wait_s });
    else if (phase.kind === "error") track("online_queue", { mode: m, outcome: "error", wait_s, error: phase.message });
    else return;
    since = 0;
  });
  unsubscribe = () => {
    off();
    unsubscribe = null;
  };
  return unsubscribe;
}
