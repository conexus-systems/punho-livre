/**
 * Netcode com rollback (estilo GGPO) sobre a engine determinística.
 *
 * - O input local é agendado para `frame + inputDelay` e enviado na hora.
 * - O input remoto que ainda não chegou é previsto (repete o último confirmado).
 * - Quando chega um input remoto diferente do previsto, voltamos ao snapshot
 *   daquele frame e re-simulamos até o presente.
 * - Se o remoto ficar mais de `maxRollback` frames atrás, a simulação espera.
 * - A cada `checksumEvery` frames confirmados trocamos o hash do estado e o
 *   hash das entradas para detectar dessincronia (e trapaça: ver docs/ONLINE.md).
 *
 * Robustez de rede: mensagens podem chegar fora de ordem, duplicadas ou se
 * perder (reconexão, relay sobrecarregado). O "confirmado" é sempre o último
 * frame remoto *contíguo*; o envio repete tudo o que o oponente ainda não
 * confirmou (`ack`), e quando a simulação está parada esperando, o reenvio
 * continua a cada `RESEND_WHILE_STALLED` ticks.
 */

import type { Roster } from "@/src/engine/fighter";
import { deepClone } from "@/src/engine/clone";
import type { GameEvent, WorldState } from "@/src/engine/types";
import { stepWorld } from "@/src/engine/world";

import { InputsHash, stateHash } from "./hash";

export interface RollbackTransport {
  sendInputs(frames: [number, number][], ack: number): void;
  sendChecksum(frame: number, value: number, inputsHash: number): void;
}

export interface RollbackStats {
  frame: number;
  /** Último frame remoto contíguo (confirmado). */
  remoteFrame: number;
  rollbacks: number;
  /** Soma das profundidades (frames re-simulados), para a média. */
  rollbackFrames: number;
  maxRollbackDepth: number;
  stalls: number;
  desync: boolean;
  /** Primeiro frame em que o checksum divergiu (-1 = nenhum). */
  desyncFrame: number;
  /** Motivo da dessincronia: estado, entradas, ou histórico perdido (bug). */
  desyncReason: "" | "state" | "inputs" | "history";
}

/** Ticks parados esperando o oponente entre dois reenvios. */
const RESEND_WHILE_STALLED = 6;
/** Teto de frames por mensagem de input (o resto vai na próxima). */
const MAX_FRAMES_PER_MESSAGE = 64;

export class RollbackSession {
  world: WorldState;
  private readonly local = new Map<number, number>();
  private readonly remote = new Map<number, number>();
  /** Input remoto usado em cada frame já simulado (para saber se a previsão errou). */
  private readonly usedRemote = new Map<number, number>();
  /** Estado *depois* de simular o frame f. */
  private readonly snapshots = new Map<number, WorldState>();
  /** Último frame remoto contíguo recebido. */
  private remoteContig = 0;
  /** Maior frame remoto recebido (pode haver buracos antes dele). */
  private remoteMax = 0;
  /** Último frame local que o oponente confirmou ter recebido (contíguo). */
  private remoteAck = 0;
  private rollbackFrom: number | null = null;
  private readonly localChecksums = new Map<number, [number, number]>();
  private readonly remoteChecksums = new Map<number, [number, number]>();
  private lastChecksumFrame = 0;
  private readonly inputsHash = new InputsHash();
  private dirty = false;
  private stalledTicks = 0;
  /** Último frame local já entregue ao registro de entradas do servidor. */
  private loggedLocal = 0;
  stats: RollbackStats = {
    frame: 0,
    remoteFrame: 0,
    rollbacks: 0,
    rollbackFrames: 0,
    maxRollbackDepth: 0,
    stalls: 0,
    desync: false,
    desyncFrame: -1,
    desyncReason: "",
  };
  /** Eventos gerados no último avanço (para efeitos visuais). */
  events: GameEvent[] = [];

  constructor(
    world: WorldState,
    private readonly roster: Roster,
    readonly localSide: 0 | 1,
    private readonly transport: RollbackTransport,
    readonly inputDelay = 2,
    private readonly maxRollback = 8,
    private readonly checksumEvery = 60,
  ) {
    this.world = world;
    this.snapshots.set(world.frame, deepClone(world));
    // frames iniciais (antes do delay) têm input neutro dos dois lados
    for (let f = world.frame + 1; f <= world.frame + inputDelay; f++) {
      this.local.set(f, 0);
      this.remote.set(f, 0);
    }
    this.remoteContig = world.frame + inputDelay;
    this.remoteMax = this.remoteContig;
    this.remoteAck = world.frame + inputDelay;
    this.loggedLocal = world.frame;
    this.inputsHash.frame = world.frame;
  }

  private remoteFor(frame: number): number {
    const confirmed = this.remote.get(frame);
    if (confirmed !== undefined) return confirmed;
    // previsão: último input remoto contíguo
    return this.remote.get(this.remoteContig) ?? 0;
  }

  private inputsFor(frame: number): [number, number] {
    const mine = this.local.get(frame) ?? 0;
    const theirs = this.remoteFor(frame);
    this.usedRemote.set(frame, theirs);
    return this.localSide === 0 ? [mine, theirs] : [theirs, mine];
  }

  private simulate(): void {
    const next = this.world.frame + 1;
    stepWorld(this.world, this.inputsFor(next), this.roster);
    this.events.push(...this.world.events);
    this.snapshots.set(this.world.frame, deepClone(this.world));
  }

  /** Recebe inputs do oponente (em qualquer ordem, com repetições). */
  onRemoteInputs(frames: [number, number][], ack: number): void {
    if (Number.isFinite(ack) && ack > this.remoteAck) this.remoteAck = ack;
    for (const [frame, bits] of frames) {
      if (!Number.isInteger(frame) || this.remote.has(frame)) continue;
      // frame já confirmado e descartado do histórico: só pode ser repetição
      if (frame <= this.remoteContig) continue;
      this.remote.set(frame, bits);
      if (frame > this.remoteMax) this.remoteMax = frame;
      const used = this.usedRemote.get(frame);
      if (frame <= this.world.frame && used !== bits) {
        this.rollbackFrom = this.rollbackFrom === null ? frame : Math.min(this.rollbackFrom, frame);
      }
    }
    while (this.remote.has(this.remoteContig + 1)) this.remoteContig++;
  }

  onRemoteChecksum(frame: number, value: number, inputsHash?: number): void {
    this.remoteChecksums.set(frame, [value, inputsHash ?? -1]);
    this.compareChecksum(frame);
  }

  private compareChecksum(frame: number): void {
    const mine = this.localChecksums.get(frame);
    const theirs = this.remoteChecksums.get(frame);
    if (!mine || !theirs || this.stats.desync) return;
    const inputsDiffer = theirs[1] !== -1 && theirs[1] !== mine[1];
    if (mine[0] !== theirs[0] || inputsDiffer) {
      this.stats.desync = true;
      this.stats.desyncFrame = frame;
      this.stats.desyncReason = inputsDiffer ? "inputs" : "state";
    }
  }

  /**
   * Avança um frame com o input local deste tick. Retorna false se precisou
   * esperar o oponente (stall).
   */
  advance(localBits: number): boolean {
    this.events = [];
    const target = this.world.frame + 1;
    if (!this.local.has(target + this.inputDelay)) {
      this.local.set(target + this.inputDelay, localBits);
      this.dirty = true;
    }

    this.applyRollback();

    if (target - this.remoteContig > this.maxRollback) {
      this.stats.stalls++;
      this.stalledTicks++;
      if (this.stalledTicks % RESEND_WHILE_STALLED === 0) this.dirty = true;
      this.flush();
      return false;
    }
    this.stalledTicks = 0;
    this.flush();
    this.simulate();
    this.afterStep();
    return true;
  }

  /** Reenvia tudo o que o oponente ainda não confirmou (sempre em ordem crescente). */
  private flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const frames: [number, number][] = [];
    for (let f = this.remoteAck + 1; frames.length < MAX_FRAMES_PER_MESSAGE; f++) {
      const v = this.local.get(f);
      if (v === undefined) break;
      frames.push([f, v]);
    }
    if (frames.length) this.transport.sendInputs(frames, this.remoteContig);
  }

  /**
   * O oponente reconectou e pede tudo a partir de `from` (ver `resync` em
   * docs/PROTOCOL.md): volta o ack e reenvia no próximo avanço.
   */
  resendFrom(from: number): void {
    this.remoteAck = Math.min(this.remoteAck, Math.max(0, from - 1));
    this.dirty = true;
    this.flush();
  }

  /** Reenvia o que estiver pendente sem avançar (fim de luta, tela parada). */
  flushPending(): void {
    this.dirty = true;
    this.flush();
  }

  /** O servidor avisou que o registro de entradas parou em `next - 1` (ver `resume`). */
  rewindInputLog(next: number): void {
    this.loggedLocal = Math.min(this.loggedLocal, Math.max(0, next - 1));
  }

  /** Primeiro frame remoto que ainda falta (para pedir ao relay depois de reconectar). */
  get missingFrom(): number {
    return this.remoteContig + 1;
  }

  /**
   * Entradas locais decididas e ainda não registradas no servidor, a partir
   * do frame 1, em blocos de `min` frames (o último bloco sai com `force`).
   */
  takeInputLog(min = 60, force = false, max = 600): { from: number; bits: number[] } | null {
    const from = this.loggedLocal + 1;
    const bits: number[] = [];
    for (let f = from; this.local.has(f) && bits.length < max; f++) bits.push(this.local.get(f)!);
    if (bits.length === 0 || (!force && bits.length < min)) return null;
    this.loggedLocal += bits.length;
    return { from, bits };
  }

  /** Todas as entradas locais (para replay): índice 0 = frame 1. */
  localInputs(): number[] {
    const out: number[] = [];
    for (let f = 1; this.local.has(f); f++) out.push(this.local.get(f)!);
    return out;
  }

  /** Entradas remotas contíguas confirmadas: índice 0 = frame 1. */
  remoteInputs(): number[] {
    const out: number[] = [];
    for (let f = 1; f <= this.remoteContig; f++) out.push(this.remote.get(f) ?? 0);
    return out;
  }

  private applyRollback(): void {
    if (this.rollbackFrom === null) return;
    const from = this.rollbackFrom;
    this.rollbackFrom = null;
    const base = this.snapshots.get(from - 1);
    if (!base) {
      // não deveria acontecer (o stall garante o histórico): melhor acusar do que esconder
      this.stats.desync = true;
      this.stats.desyncFrame = from;
      this.stats.desyncReason = "history";
      return;
    }
    const now = this.world.frame;
    this.world = deepClone(base);
    const depth = now - from + 1;
    this.stats.rollbacks++;
    this.stats.rollbackFrames += depth;
    this.stats.maxRollbackDepth = Math.max(this.stats.maxRollbackDepth, depth);
    const keepEvents = this.events;
    while (this.world.frame < now) this.simulate();
    this.events = keepEvents; // eventos re-simulados já foram mostrados
  }

  /** Frame até onde os dois lados têm todas as entradas. */
  get confirmedFrame(): number {
    return Math.min(this.world.frame, this.remoteContig);
  }

  /** Estado no último frame confirmado (não muda mais com rollback). Não modificar. */
  get confirmedWorld(): WorldState {
    return this.snapshots.get(this.confirmedFrame) ?? this.world;
  }

  private afterStep(): void {
    const f = this.world.frame;
    this.stats.frame = f;
    this.stats.remoteFrame = this.remoteContig;
    const confirmed = this.confirmedFrame;
    // checksum de cada fronteira já confirmada pelos dois lados
    for (let ck = this.lastChecksumFrame + this.checksumEvery; ck <= confirmed; ck += this.checksumEvery) {
      const snap = this.snapshots.get(ck);
      if (!snap) break;
      for (let g = this.inputsHash.frame + 1; g <= ck; g++) {
        const mine = this.local.get(g) ?? 0;
        const theirs = this.remote.get(g) ?? 0;
        if (this.localSide === 0) this.inputsHash.push(g, mine, theirs);
        else this.inputsHash.push(g, theirs, mine);
      }
      const value = stateHash(snap);
      this.localChecksums.set(ck, [value, this.inputsHash.value]);
      this.lastChecksumFrame = ck;
      this.transport.sendChecksum(ck, value, this.inputsHash.value);
      this.compareChecksum(ck);
    }
    // limpa histórico antigo (mantém o snapshot do último frame confirmado)
    const keepFrom = Math.min(confirmed, this.lastChecksumFrame) - 1;
    for (const key of this.snapshots.keys()) if (key < keepFrom) this.snapshots.delete(key);
    for (const key of this.usedRemote.keys()) if (key < keepFrom) this.usedRemote.delete(key);
  }

  /** Quantos frames estamos à frente do oponente (para desacelerar levemente). */
  get framesAhead(): number {
    return this.world.frame - this.remoteContig + this.inputDelay;
  }

  private ticks = 0;

  /**
   * Sincronia de relógio, chamada uma vez por tick antes do `advance`: muito à
   * frente do oponente → segura 1 de cada 4 ticks. Conta ticks, não quadros:
   * com `world.frame % 4` o quadro parado ficava parado para sempre e, se uma
   * mensagem se perdesse, os dois lados travavam sem reenviar (achado do soak).
   */
  syncSkip(limit = 6): boolean {
    this.ticks++;
    return this.framesAhead > limit && this.ticks % 4 === 0;
  }

  /** Checksums locais por frame (para o soak comparar os dois lados). */
  checksums(): ReadonlyMap<number, [number, number]> {
    return this.localChecksums;
  }
}
