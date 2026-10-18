/**
 * Fluxo online: conexão ActionCable autenticada com o JWT do bff-auth,
 * matchmaking (ranked ou sala com código) e a partida em si (relay de inputs
 * para o RollbackSession). Contrato em docs/PROTOCOL.md; desenho em
 * docs/ONLINE.md.
 *
 * Reconexão: se a conexão cai no meio da luta, a sessão de rollback continua
 * viva (o jogo para de avançar quando a previsão esgota) e tentamos voltar
 * por até RECONNECT_BUDGET_MS: nova conexão, assinatura do MatchChannel com
 * `resume` + o primeiro quadro remoto que falta; o relay devolve as entradas
 * do oponente que ele registrou e o oponente reenvia o resto (`resync`).
 * Passado o prazo, o servidor dá a derrota por abandono.
 */

import { cableUrl } from "@/src/config";
import type { Roster } from "@/src/engine/fighter";
import { createWorld } from "@/src/engine/world";
import { accessToken } from "@/src/services/auth";
import { ensureLicense, licenseMessage } from "@/src/services/license";
import { createStore } from "@/src/store";

import { CableClient, type CableSubscription } from "./cable";
import { RollbackSession } from "./rollback";
import { engineVersion } from "./version";

export interface MatchInfo {
  matchId: number;
  side: 0 | 1;
  seed: number;
  inputDelay: number;
  myCharacter: string;
  opponent: { display_name: string; rating: number; league?: string; character: string; pack_sha256: string };
}

export type OnlinePhase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "queued"; rating?: number; league?: string }
  | { kind: "room"; code: string }
  | { kind: "matched"; match: MatchInfo }
  | { kind: "error"; message: string };

export interface OnlineState {
  phase: OnlinePhase;
  finished: { winner: number | null; ratings?: Record<string, number>; disputed?: boolean } | null;
  opponentLeft: boolean;
  ping: number;
  /** Nossa conexão caiu e estamos tentando voltar (epoch ms do prazo final). */
  reconnectingUntil: number | null;
  /** O oponente caiu; o servidor espera até este horário (epoch ms). */
  opponentAwayUntil: number | null;
  /** Partida anulada pelo anti-trapaça (checksum/entradas/replay divergentes). */
  voided: string | null;
  /** Não deu para reconectar a tempo. */
  connectionLost: boolean;
}

/** Tempo para voltar depois de uma queda (o servidor tolera 10 s; ver RECONNECT_GRACE_SECONDS). */
export const RECONNECT_BUDGET_MS = 10_000;
/** Ping durante a luta (e o vigia da conexão considera morta após 3 s sem nada). */
const MATCH_PING_MS = 1000;
const MATCH_STALE_MS = 3000;

export const onlineStore = createStore<OnlineState>({
  phase: { kind: "idle" },
  finished: null,
  opponentLeft: false,
  ping: 0,
  reconnectingUntil: null,
  opponentAwayUntil: null,
  voided: null,
  connectionLost: false,
});

let client: CableClient | null = null;
let matchmaking: CableSubscription | null = null;
let matchSub: CableSubscription | null = null;
/** Chamado quando a conexão cai (a partida em andamento tenta reconectar). */
let onConnectionLost: (() => void) | null = null;

async function newClient(): Promise<CableClient> {
  const token = await accessToken();
  if (!token) throw new Error("Faça login para jogar online.");
  const c = new CableClient(cableUrl(token));
  await c.connect();
  return c;
}

async function ensureClient(): Promise<CableClient> {
  if (client?.connected) return client;
  const c = await newClient();
  c.onClose = () => {
    if (client === c) client = null;
    if (onConnectionLost) {
      onConnectionLost();
      return;
    }
    const p = onlineStore.get().phase;
    if (p.kind !== "idle") onlineStore.set({ phase: { kind: "error", message: "Conexão perdida." } });
  };
  client = c;
  return c;
}

export async function findMatch(opts: { mode: "ranked" | "room"; roomCode?: string; character: string; sha256: string }): Promise<void> {
  onlineStore.set({
    phase: { kind: "connecting" },
    finished: null,
    opponentLeft: false,
    reconnectingUntil: null,
    opponentAwayUntil: null,
    voided: null,
    connectionLost: false,
  });
  try {
    // jogo pago: o online só aceita cópia comprada na Google Play
    await ensureLicense();
    const c = await ensureClient();
    matchmaking?.unsubscribe();
    matchmaking = c.subscribe(
      {
        channel: "MatchmakingChannel",
        mode: opts.mode,
        ...(opts.roomCode ? { room_code: opts.roomCode.toUpperCase() } : {}),
        character: opts.character,
        pack_sha256: opts.sha256,
        engine_version: engineVersion(),
      },
      {
        onReject: () => onlineStore.set({ phase: { kind: "error", message: "Matchmaking recusou a entrada." } }),
        onMessage: (msg) => {
          switch (msg.type) {
            case "queued":
              onlineStore.set({
                phase: {
                  kind: "queued",
                  rating: msg.rating === undefined ? undefined : Number(msg.rating),
                  league: msg.league === undefined ? undefined : String(msg.league),
                },
              });
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
                version_mismatch: "O dono da sala está com outra versão do jogo. Atualizem os dois.",
                license_required: licenseMessage("not_licensed"),
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
  /** Sai do canal; se já relatou o resultado, espera o "finished" (até 4 s). Antes disso, é desistência. */
  leave(): Promise<void>;
}

/** Texto do aviso sobre a luta (desync, anulação, quedas), ou null. */
export function onlineBanner(session: RollbackSession | null): string | null {
  const s = onlineStore.get();
  if (s.voided) return "PARTIDA ANULADA";
  if (session?.stats.desync) return "DESSINCRONIA";
  if (s.connectionLost) return "CONEXÃO PERDIDA";
  const now = Date.now();
  if (s.reconnectingUntil) return `RECONECTANDO… ${Math.max(0, Math.ceil((s.reconnectingUntil - now) / 1000))}`;
  if (s.opponentAwayUntil && !s.opponentLeft) {
    return `OPONENTE RECONECTANDO… ${Math.max(0, Math.ceil((s.opponentAwayUntil - now) / 1000))}`;
  }
  return null;
}

/** Entra no MatchChannel e devolve a sessão de rollback quando os dois estiverem prontos. */
export function joinMatch(match: MatchInfo, roster: Roster, stageId: string, inputDelay: number): OnlineMatchHandle {
  let session: RollbackSession | null = null;
  let reported = false;
  let leaving = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let logTimer: ReturnType<typeof setInterval> | null = null;
  const chars: [string, string] =
    match.side === 0 ? [match.myCharacter, match.opponent.character] : [match.opponent.character, match.myCharacter];

  const perform = (action: string, data?: Record<string, unknown>) => matchSub?.perform(action, data);

  /** Registro das entradas no servidor (reconexão + replay), em blocos de ~1 s. */
  const sendInputLog = (force = false) => {
    if (!session || !client?.connected) return;
    for (let chunk = session.takeInputLog(60, force); chunk; chunk = force ? session.takeInputLog(1, true) : null) {
      perform("input_log", { from: chunk.from, bits: chunk.bits });
    }
  };

  const onMessage = (msg: Record<string, unknown>, resolve: (s: RollbackSession) => void) => {
    const fromOpponent = msg.side !== undefined && Number(msg.side) !== match.side;
    switch (msg.type) {
      case "start": {
        if (session) break;
        const world = createWorld({ chars, stageId, seed: match.seed, roundsToWin: 2, roundTime: 99 }, roster);
        session = new RollbackSession(
          world,
          roster,
          match.side,
          {
            sendInputs: (frames, ack) => perform("input", { frames, ack }),
            sendChecksum: (frame, value, inputsHash) => perform("checksum", { frame, value, inputs_hash: inputsHash }),
          },
          Math.max(match.inputDelay, inputDelay),
        );
        logTimer = setInterval(() => sendInputLog(false), 500);
        resolve(session);
        break;
      }
      case "input":
        if (fromOpponent) session?.onRemoteInputs(msg.frames as [number, number][], Number(msg.ack ?? 0));
        break;
      case "checksum":
        if (fromOpponent) {
          session?.onRemoteChecksum(Number(msg.frame), Number(msg.value), msg.inputs_hash == null ? undefined : Number(msg.inputs_hash));
        }
        break;
      case "resume": {
        // reconectamos: entradas do oponente que o relay registrou + de onde continuar o nosso registro
        const from = Number(msg.from);
        const bits = (msg.frames as number[]) ?? [];
        session?.onRemoteInputs(bits.map((b, k) => [from + k, b] as [number, number]), 0);
        session?.rewindInputLog(Number(msg.log_next ?? 1));
        onlineStore.set({ reconnectingUntil: null });
        break;
      }
      case "resync":
        // o oponente voltou e pede nossas entradas desde `from`
        if (fromOpponent) {
          session?.resendFrom(Number(msg.from));
          onlineStore.set({ opponentAwayUntil: null });
        }
        break;
      case "input_log_gap":
        session?.rewindInputLog(Number(msg.next));
        break;
      case "opponent_disconnected":
        if (fromOpponent) onlineStore.set({ opponentAwayUntil: Date.now() + Number(msg.grace_ms ?? RECONNECT_BUDGET_MS) });
        break;
      case "pong":
        onlineStore.set({ ping: Date.now() - Number(msg.t) });
        break;
      case "opponent_left":
        if (msg.side === undefined || fromOpponent) onlineStore.set({ opponentLeft: true, opponentAwayUntil: null });
        break;
      case "voided":
        onlineStore.set({ voided: String(msg.reason ?? "") });
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
  };

  const subscribe = (c: CableClient, resume: boolean, resolve: (s: RollbackSession) => void, reject: (e: Error) => void) => {
    c.staleAfterMs = MATCH_STALE_MS;
    matchSub = c.subscribe(
      resume ? { channel: "MatchChannel", match_id: match.matchId, resume: true, from: session?.missingFrom ?? 1 } : { channel: "MatchChannel", match_id: match.matchId },
      {
        onConfirm: () => {
          if (!resume) perform("ready");
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = setInterval(() => perform("ping", { t: Date.now() }), MATCH_PING_MS);
        },
        onReject: () => {
          if (resume) {
            // a partida já foi encerrada (abandono por tempo ou anulada)
            onlineStore.set({ reconnectingUntil: null, connectionLost: true });
          } else reject(new Error("Partida indisponível."));
        },
        onMessage: (msg) => onMessage(msg, resolve),
      },
    );
  };

  const reconnect = async (resolve: (s: RollbackSession) => void, reject: (e: Error) => void) => {
    if (leaving || onlineStore.get().reconnectingUntil) return;
    const deadline = Date.now() + RECONNECT_BUDGET_MS;
    onlineStore.set({ reconnectingUntil: deadline });
    if (pingTimer) clearInterval(pingTimer);
    matchSub = null;
    for (let attempt = 0; Date.now() < deadline && !leaving; attempt++) {
      try {
        const c = await ensureClient();
        subscribe(c, true, resolve, reject);
        return; // o `resume` limpa reconnectingUntil
      } catch {
        await new Promise((r) => setTimeout(r, Math.min(2000, 250 * 2 ** attempt)));
      }
    }
    if (!leaving) onlineStore.set({ reconnectingUntil: null, connectionLost: true });
  };

  const ready = (async () => {
    const c = await ensureClient();
    return new Promise<RollbackSession>((resolve, reject) => {
      onConnectionLost = () => void reconnect(resolve, reject);
      subscribe(c, false, resolve, reject);
    });
  })();

  return {
    session: ready,
    reportResult(winnerSide) {
      reported = true;
      // o registro de entradas termina antes do relato (o servidor confere o replay)
      sendInputLog(true);
      perform("result", { winner_side: winnerSide });
    },
    async leave() {
      leaving = true;
      onConnectionLost = null;
      if (pingTimer) clearInterval(pingTimer);
      if (logTimer) clearInterval(logTimer);
      const s = onlineStore.get();
      if (!reported && !s.opponentLeft && !s.voided && !s.connectionLost) {
        // saiu no meio da luta: desistência (derrota imediata, sem esperar a tolerância)
        perform("leave");
      }
      // sair antes do oponente relatar faria o servidor tratar como queda
      for (let i = 0; reported && i < 20 && !onlineStore.get().finished && !onlineStore.get().opponentLeft && !onlineStore.get().voided; i++) {
        await new Promise((r) => setTimeout(r, 200));
      }
      matchSub?.unsubscribe();
      matchSub = null;
      onlineStore.set({ phase: { kind: "idle" }, reconnectingUntil: null, opponentAwayUntil: null });
    },
  };
}

export function disconnectOnline(): void {
  onConnectionLost = null;
  matchmaking?.unsubscribe();
  matchSub?.unsubscribe();
  client?.close();
  client = null;
  onlineStore.set({ phase: { kind: "idle" } });
}
