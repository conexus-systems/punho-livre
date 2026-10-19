/**
 * Partida online simulada para testes e para o soak (`npm run soak`).
 *
 * Dois RollbackSession, cada um com o próprio relógio de 60 Hz (com deriva),
 * ligados por uma rede simulada com latência, jitter, perda, reordenação e
 * queda temporária de um dos lados (reconexão com `resume`/`resync` como no
 * MatchChannel). As entradas vêm da CPU do jogo, uma por lado, cada uma lendo
 * o próprio mundo (previsto), como um jogador faria.
 *
 * Confere o checksum de *todo* quadro confirmado nos dois lados e, no fim,
 * re-simula a luta só com as entradas registradas (o replay que o servidor
 * guarda) para conferir que o replay reproduz a partida.
 *
 * Não é importado pelo app.
 */

import type { Roster } from "@/src/engine/fighter";
import { createWorld, stepWorld } from "@/src/engine/world";
import { CpuController } from "@/src/game/ai";

import { stateHash } from "./hash";
import { RollbackSession, type RollbackTransport } from "./rollback";

export interface NetProfile {
  name: string;
  /** Latência de ida (ms). */
  latencyMs: number;
  /** Jitter uniforme ± (ms). */
  jitterMs: number;
  /** Probabilidade de perder cada mensagem. */
  loss: number;
  /** Mensagens podem chegar fora de ordem (senão a entrega é FIFO por sentido). */
  reorder: boolean;
  /** Diferença de relógio entre os aparelhos (0.002 = 0,2%). */
  drift: number;
  /** Queda de rede de um lado: [início ms, duração ms]. */
  blackout?: { side: 0 | 1; atMs: number; durationMs: number };
}

export const PROFILES: NetProfile[] = [
  { name: "wifi", latencyMs: 15, jitterMs: 5, loss: 0, reorder: false, drift: 0.001 },
  { name: "4g", latencyMs: 60, jitterMs: 25, loss: 0.01, reorder: false, drift: 0.002 },
  { name: "ruim", latencyMs: 110, jitterMs: 60, loss: 0.03, reorder: true, drift: 0.003 },
  { name: "queda", latencyMs: 45, jitterMs: 15, loss: 0.005, reorder: false, drift: 0.002 },
];

export interface MatchReport {
  seed: number;
  profile: string;
  chars: [string, string];
  /** Quadro final (confirmado nos dois lados). */
  frames: number;
  winner: number;
  /** Algum quadro com checksum diferente, ou um lado acusou dessincronia. */
  desync: boolean;
  desyncFrame: number;
  desyncReason: string;
  /** Quadros conferidos (checksum dos dois lados presente). */
  checkedFrames: number;
  /** O replay (seed + entradas) reproduziu o estado final. */
  replayOk: boolean;
  /** A partida não terminou no tempo limite (travou esperando o oponente). */
  stuck: boolean;
  rollbacks: number;
  rollbackFrames: number;
  maxRollbackDepth: number;
  stalls: number;
  /** Ticks em que um lado segurou um quadro para sincronizar o relógio. */
  syncSkips: number;
  messages: number;
  dropped: number;
  /** Duração simulada (ms). */
  simMs: number;
  /** Queda de rede: ms entre a volta da conexão e o jogo voltar a andar normal (-1 = sem queda). */
  recoveryMs: number;
}

/** PRNG xorshift32 (determinística, só para a simulação). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

interface Packet {
  at: number;
  seq: number;
  to: 0 | 1;
  deliver: () => void;
}

/** Fila de prioridade mínima por (at, seq). */
class Queue {
  private heap: Packet[] = [];
  get size(): number {
    return this.heap.length;
  }
  peek(): Packet | undefined {
    return this.heap[0];
  }
  push(p: Packet): void {
    const h = this.heap;
    h.push(p);
    let i = h.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (less(h[parent], h[i])) break;
      [h[parent], h[i]] = [h[i], h[parent]];
      i = parent;
    }
  }
  pop(): Packet | undefined {
    const h = this.heap;
    const top = h[0];
    const last = h.pop();
    if (h.length && last) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && less(h[l], h[m])) m = l;
        if (r < h.length && less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
}
const less = (a: Packet, b: Packet) => a.at < b.at || (a.at === b.at && a.seq < b.seq);

export interface SimOptions {
  roster: Roster;
  seed: number;
  chars: [string, string];
  profile: NetProfile;
  inputDelay?: number;
  maxRollback?: number;
  /** Conferir o checksum a cada N quadros (1 = todo quadro). */
  checksumEvery?: number;
  roundsToWin?: number;
  roundTime?: number;
  /** Limite de tempo simulado (ms) antes de declarar a partida travada. */
  maxSimMs?: number;
  /** Testes: altera as entradas que um lado manda ao relay (trapaça / bug de rede). */
  tamper?: (from: 0 | 1, frames: [number, number][]) => [number, number][];
}

const TICK_MS = 1000 / 60;
/** Mesma regra do app/fight.tsx: muito à frente → segura um quadro de vez em quando. */
const AHEAD_LIMIT = 6;

export function runOnlineMatch(opts: SimOptions): MatchReport {
  const { roster, seed, chars, profile } = opts;
  const inputDelay = opts.inputDelay ?? 2;
  const maxRollback = opts.maxRollback ?? 8;
  const checksumEvery = opts.checksumEvery ?? 1;
  const cfg = { chars, stageId: "dojo", seed, roundsToWin: opts.roundsToWin ?? 2, roundTime: opts.roundTime ?? 99 };
  const maxSimMs = opts.maxSimMs ?? 15 * 60 * 1000;
  const net = rng(seed ^ 0x5eed);
  const queue = new Queue();
  let seq = 0;
  let now = 0;
  let messages = 0;
  let dropped = 0;
  /** Último horário de entrega por sentido (entrega FIFO quando não há reordenação). */
  const lastAt = [0, 0];
  const blackout = profile.blackout;
  const offline = (side: 0 | 1, t: number) =>
    !!blackout && blackout.side === side && t >= blackout.atMs && t < blackout.atMs + blackout.durationMs;

  // "relay": registro de entradas por lado, como Matches::InputLog guarda no servidor
  const relayLog: number[][] = [[], []];

  const send = (from: 0 | 1, deliver: () => void) => {
    messages++;
    const to = (1 - from) as 0 | 1;
    if (offline(from, now) || net() < profile.loss) {
      dropped++;
      return;
    }
    let at = now + Math.max(1, profile.latencyMs + (net() * 2 - 1) * profile.jitterMs);
    if (!profile.reorder) at = Math.max(at, lastAt[from]);
    lastAt[from] = at;
    queue.push({ at, seq: seq++, to, deliver });
  };

  const sessions: RollbackSession[] = [];
  const transport = (from: 0 | 1): RollbackTransport => ({
    sendInputs: (frames, ack) => {
      let copy = frames.map((f) => [f[0], f[1]] as [number, number]);
      if (opts.tamper) copy = opts.tamper(from, copy);
      send(from, () => sessions[1 - from].onRemoteInputs(copy, ack));
    },
    sendChecksum: (frame, value, inputsHash) => {
      send(from, () => sessions[1 - from].onRemoteChecksum(frame, value, inputsHash));
    },
  });
  for (const side of [0, 1] as const) {
    sessions.push(
      new RollbackSession(createWorld(cfg, roster), roster, side, transport(side), inputDelay, maxRollback, checksumEvery),
    );
  }
  const r0 = rng(seed * 31 + 7);
  const r1 = rng(seed * 17 + 3);
  const cpus = [new CpuController(0, roster, 3, r0), new CpuController(1, roster, 3, r1)];
  const period = [TICK_MS * (1 + profile.drift / 2), TICK_MS * (1 - profile.drift / 2)];
  const nextTick = [0, period[1] / 3];
  const done = [false, false];
  const doneFrame = [0, 0];
  let syncSkips = 0;
  const wasOffline = [false, false];

  const logInputs = (side: 0 | 1, force: boolean) => {
    const chunk = sessions[side].takeInputLog(60, force);
    if (!chunk) return;
    // input_log também passa pela rede: se perder, o servidor acusa o buraco no resume
    if (offline(side, now) || net() < profile.loss) {
      dropped++;
      return;
    }
    messages++;
    const log = relayLog[side];
    if (chunk.from === log.length + 1) log.push(...chunk.bits);
    else if (chunk.from <= log.length) log.push(...chunk.bits.slice(log.length + 1 - chunk.from));
    else sessions[side].rewindInputLog(log.length + 1); // buraco: o servidor pede de novo
  };

  /** Reconexão: `resume` (relay devolve o registro do oponente) + `resync` (oponente reenvia). */
  let recoverFrom = -1;
  let recoveryMs = -1;
  const reconnect = (side: 0 | 1) => {
    recoverFrom = now;
    const me = sessions[side];
    const other = (1 - side) as 0 | 1;
    const from = me.missingFrom;
    const log = relayLog[other];
    const frames: [number, number][] = [];
    for (let f = from; f <= log.length; f++) frames.push([f, log[f - 1]]);
    me.rewindInputLog(relayLog[side].length + 1);
    queue.push({ at: now + profile.latencyMs, seq: seq++, to: side, deliver: () => me.onRemoteInputs(frames, 0) });
    queue.push({ at: now + profile.latencyMs * 2, seq: seq++, to: other, deliver: () => sessions[other].resendFrom(from) });
  };

  while (!(done[0] && done[1]) && now < maxSimMs) {
    const nextMsg = queue.peek()?.at ?? Infinity;
    const side: 0 | 1 = nextTick[0] <= nextTick[1] ? 0 : 1;
    if (nextMsg <= nextTick[side]) {
      const p = queue.pop()!;
      now = p.at;
      if (offline(p.to, now)) dropped++;
      else p.deliver();
      continue;
    }
    now = nextTick[side];
    nextTick[side] += period[side];
    const isOffline = offline(side, now);
    if (wasOffline[side] && !isOffline) reconnect(side);
    wasOffline[side] = isOffline;

    const s = sessions[side];
    if (s.syncSkip(AHEAD_LIMIT)) {
      // mesma regra do app (fight.tsx): o tick é pulado inteiro
      syncSkips++;
      continue;
    }
    // depois do fim o app continua avançando (tela de resultado) até sair do canal
    const advanced = s.advance(cpus[side].next(s.world));
    if (recoverFrom >= 0 && advanced && sessions[0].framesAhead <= AHEAD_LIMIT && sessions[1].framesAhead <= AHEAD_LIMIT) {
      recoveryMs = now - recoverFrom;
      recoverFrom = -1;
    }
    if (!offline(side, now)) logInputs(side, false);
    const c = s.confirmedWorld;
    if (!done[side] && c.matchWinner >= 0 && c.roundStateTime > 120) {
      done[side] = true;
      doneFrame[side] = c.frame;
      if (!offline(side, now)) logInputs(side, true);
    }
  }
  // completa o registro do relay: no app o último input_log sai antes do `result`, e um bloco
  // perdido volta como `input_log_gap` (o cliente rebobina e reenvia)
  for (const side of [0, 1] as const) {
    const s = sessions[side];
    const log = relayLog[side];
    s.rewindInputLog(log.length + 1);
    for (let chunk = s.takeInputLog(1, true); chunk; chunk = s.takeInputLog(1, true)) {
      log.push(...chunk.bits.slice(log.length + 1 - chunk.from));
    }
  }

  const stuck = !(done[0] && done[1]);
  // confere o checksum de todo quadro presente nos dois lados
  const a = sessions[0].checksums();
  const b = sessions[1].checksums();
  let checked = 0;
  let desyncFrame = -1;
  let desyncReason = "";
  for (const [frame, [hv, ih]] of a) {
    const other = b.get(frame);
    if (!other) continue;
    checked++;
    if ((other[0] !== hv || other[1] !== ih) && (desyncFrame < 0 || frame < desyncFrame)) {
      desyncFrame = frame;
      desyncReason = other[1] !== ih ? "inputs" : "state";
    }
  }
  for (const s of sessions) {
    if (s.stats.desync && desyncFrame < 0) {
      desyncFrame = s.stats.desyncFrame;
      desyncReason = s.stats.desyncReason;
    }
  }

  // replay: seed + entradas registradas no relay → mesmo estado no quadro final
  const final = Math.min(doneFrame[0] || sessions[0].world.frame, doneFrame[1] || sessions[1].world.frame);
  let replayOk = false;
  const finalHash = a.get(final)?.[0];
  if (!stuck && finalHash !== undefined && relayLog[0].length >= final && relayLog[1].length >= final) {
    const replay = createWorld(cfg, roster);
    while (replay.frame < final) {
      const f = replay.frame + 1;
      stepWorld(replay, [relayLog[0][f - 1], relayLog[1][f - 1]], roster);
    }
    replayOk = stateHash(replay) === finalHash;
  }

  const st = sessions.map((s) => s.stats);
  return {
    seed,
    profile: profile.name,
    chars,
    frames: final,
    winner: sessions[0].world.matchWinner,
    desync: desyncFrame >= 0,
    desyncFrame,
    desyncReason,
    checkedFrames: checked,
    replayOk,
    stuck,
    rollbacks: st[0].rollbacks + st[1].rollbacks,
    rollbackFrames: st[0].rollbackFrames + st[1].rollbackFrames,
    maxRollbackDepth: Math.max(st[0].maxRollbackDepth, st[1].maxRollbackDepth),
    stalls: st[0].stalls + st[1].stalls,
    syncSkips,
    messages,
    dropped,
    simMs: Math.round(now),
    recoveryMs: Math.round(recoveryMs),
  };
}

/** Configuração da partida `i` do soak: personagens, perfil de rede e queda. */
export function soakMatch(i: number, ids: readonly string[]): { seed: number; chars: [string, string]; profile: NetProfile } {
  const seed = (Math.imul(i + 1, 0x9e3779b1) >>> 0) || 1;
  const r = rng(seed);
  const chars: [string, string] = [ids[Math.floor(r() * ids.length)], ids[Math.floor(r() * ids.length)]];
  const base = PROFILES[i % PROFILES.length];
  const profile: NetProfile =
    base.name === "queda"
      ? { ...base, blackout: { side: (i & 1) as 0 | 1, atMs: 5000 + Math.floor(r() * 20000), durationMs: 1000 + Math.floor(r() * 7000) } }
      : base;
  return { seed, chars, profile };
}
