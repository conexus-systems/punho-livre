/**
 * Fluxo online: conexão ActionCable autenticada com o JWT do bff-auth,
 * matchmaking (ranked ou sala com código) e a partida em si (relay de inputs
 * para o RollbackSession). Contrato em docs/PROTOCOL.md.
 */

import { cableUrl } from "@/src/config";
import type { Roster } from "@/src/engine/fighter";
import { createWorld } from "@/src/engine/world";
import { accessToken } from "@/src/services/auth";
import { createStore } from "@/src/store";

import { CableClient, type CableSubscription } from "./cable";
import { RollbackSession } from "./rollback";

export interface MatchInfo {
  matchId: number;
  side: 0 | 1;
  seed: number;
  inputDelay: number;
  myCharacter: string;
  opponent: { display_name: string; rating: number; character: string; pack_sha256: string };
}

export type OnlinePhase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "queued" }
  | { kind: "room"; code: string }
  | { kind: "matched"; match: MatchInfo }
  | { kind: "error"; message: string };

export const onlineStore = createStore<{ phase: OnlinePhase; finished: { winner: number | null; ratings?: Record<string, number>; disputed?: boolean } | null; opponentLeft: boolean; ping: number }>(
  { phase: { kind: "idle" }, finished: null, opponentLeft: false, ping: 0 },
);

let client: CableClient | null = null;
let matchmaking: CableSubscription | null = null;
let matchSub: CableSubscription | null = null;

async function ensureClient(): Promise<CableClient> {
  if (client) return client;
  const token = await accessToken();
  if (!token) throw new Error("Faça login para jogar online.");
  const c = new CableClient(cableUrl(token));
  c.onClose = () => {
    client = null;
    const p = onlineStore.get().phase;
    if (p.kind !== "idle") onlineStore.set({ phase: { kind: "error", message: "Conexão perdida." } });
  };
  await c.connect();
  client = c;
  return c;
}

export async function findMatch(opts: { mode: "ranked" | "room"; roomCode?: string; character: string; sha256: string }): Promise<void> {
  onlineStore.set({ phase: { kind: "connecting" }, finished: null, opponentLeft: false });
  try {
    const c = await ensureClient();
    matchmaking?.unsubscribe();
    matchmaking = c.subscribe(
      {
        channel: "MatchmakingChannel",
        mode: opts.mode,
        ...(opts.roomCode ? { room_code: opts.roomCode.toUpperCase() } : {}),
        character: opts.character,
        pack_sha256: opts.sha256,
      },
      {
        onReject: () => onlineStore.set({ phase: { kind: "error", message: "Matchmaking recusou a entrada." } }),
        onMessage: (msg) => {
          switch (msg.type) {
            case "queued":
              onlineStore.set({ phase: { kind: "queued" } });
              break;
            case "room_created":
              onlineStore.set({ phase: { kind: "room", code: String(msg.room_code) } });
              break;
            case "matched":
              onlineStore.set({
                phase: {
                  kind: "matched",
                  match: {
                    matchId: Number(msg.match_id),
                    side: Number(msg.side) === 1 ? 1 : 0,
                    seed: Number(msg.seed) | 0,
                    inputDelay: Number(msg.input_delay ?? 2),
                    myCharacter: opts.character,
                    opponent: msg.opponent as MatchInfo["opponent"],
                  },
                },
              });
              matchmaking?.unsubscribe();
              matchmaking = null;
              break;
            case "error": {
              const map: Record<string, string> = {
                room_not_found: "Sala não encontrada.",
                room_full: "Sala cheia.",
                already_queued: "Você já está na fila.",
              };
              onlineStore.set({ phase: { kind: "error", message: map[String(msg.error)] ?? String(msg.error) } });
              break;
            }
          }
        },
      },
    );
  } catch (err) {
    onlineStore.set({ phase: { kind: "error", message: (err as Error).message } });
  }
}

export function cancelMatchmaking(): void {
  matchmaking?.perform("cancel");
  matchmaking?.unsubscribe();
  matchmaking = null;
  onlineStore.set({ phase: { kind: "idle" } });
}

export interface OnlineMatchHandle {
  session: Promise<RollbackSession>;
  reportResult(winnerSide: number | null): void;
  /** Sai do canal; se já relatou o resultado, espera o "finished" (até 4 s). */
  leave(): Promise<void>;
}

/** Entra no MatchChannel e devolve a sessão de rollback quando os dois estiverem prontos. */
export function joinMatch(match: MatchInfo, roster: Roster, stageId: string, inputDelay: number): OnlineMatchHandle {
  let session: RollbackSession | null = null;
  let reported = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  const chars: [string, string] =
    match.side === 0 ? [match.myCharacter, match.opponent.character] : [match.opponent.character, match.myCharacter];

  const ready = (async () => {
    const c = await ensureClient();
    return new Promise<RollbackSession>((resolve, reject) => {
      matchSub = c.subscribe(
        { channel: "MatchChannel", match_id: match.matchId },
        {
          onConfirm: () => {
            matchSub?.perform("ready");
            pingTimer = setInterval(() => matchSub?.perform("ping", { t: Date.now() }), 2000);
          },
          onReject: () => reject(new Error("Partida indisponível.")),
          onMessage: (msg) => {
            switch (msg.type) {
              case "start": {
                const world = createWorld(
                  { chars, stageId, seed: match.seed, roundsToWin: 2, roundTime: 99 },
                  roster,
                );
                session = new RollbackSession(
                  world,
                  roster,
                  match.side,
                  {
                    sendInputs: (frames, ack) => matchSub?.perform("input", { frames, ack }),
                    sendChecksum: (frame, value) => matchSub?.perform("checksum", { frame, value }),
                  },
                  Math.max(match.inputDelay, inputDelay),
                );
                resolve(session);
                break;
              }
              case "input":
                if (Number(msg.side) !== match.side) {
                  session?.onRemoteInputs(msg.frames as [number, number][], Number(msg.ack ?? 0));
                }
                break;
              case "checksum":
                if (Number(msg.side) !== match.side) session?.onRemoteChecksum(Number(msg.frame), Number(msg.value));
                break;
              case "pong":
                onlineStore.set({ ping: Date.now() - Number(msg.t) });
                break;
              case "opponent_left":
                onlineStore.set({ opponentLeft: true });
                break;
              case "finished":
                onlineStore.set({
                  finished: {
                    winner: msg.winner_side === null || msg.winner_side === undefined ? null : Number(msg.winner_side),
                    ratings: msg.ratings as Record<string, number> | undefined,
                    disputed: msg.disputed === true,
                  },
                });
                break;
            }
          },
        },
      );
    });
  })();

  return {
    session: ready,
    reportResult(winnerSide) {
      reported = true;
      matchSub?.perform("result", { winner_side: winnerSide });
    },
    async leave() {
      if (pingTimer) clearInterval(pingTimer);
      // sair antes do oponente relatar faria o servidor tratar como abandono
      for (let i = 0; reported && i < 20 && !onlineStore.get().finished && !onlineStore.get().opponentLeft; i++) {
        await new Promise((r) => setTimeout(r, 200));
      }
      matchSub?.unsubscribe();
      matchSub = null;
      onlineStore.set({ phase: { kind: "idle" } });
    },
  };
}

export function disconnectOnline(): void {
  matchmaking?.unsubscribe();
  matchSub?.unsubscribe();
  client?.close();
  client = null;
  onlineStore.set({ phase: { kind: "idle" } });
}
