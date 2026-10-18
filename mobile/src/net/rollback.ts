/**
 * Netcode com rollback (estilo GGPO) sobre a engine determinística.
 *
 * - O input local é agendado para `frame + inputDelay` e enviado na hora.
 * - O input remoto que ainda não chegou é previsto (repete o último confirmado).
 * - Quando chega um input remoto diferente do previsto, voltamos ao snapshot
 *   daquele frame e re-simulamos até o presente.
 * - Se o remoto ficar mais de `maxRollback` frames atrás, a simulação espera.
 * - A cada `checksumEvery` frames confirmados trocamos um hash do estado para
 *   detectar dessincronia.
 */

import { checksum, deepClone } from "@/src/engine/clone";
import type { Roster } from "@/src/engine/fighter";
import type { GameEvent, WorldState } from "@/src/engine/types";
import { stepWorld } from "@/src/engine/world";

export interface RollbackTransport {
  sendInputs(frames: [number, number][], ack: number): void;
  sendChecksum(frame: number, value: number): void;
}

export interface RollbackStats {
  frame: number;
  remoteFrame: number;
  rollbacks: number;
  maxRollbackDepth: number;
  stalls: number;
  desync: boolean;
}

export class RollbackSession {
  world: WorldState;
  private readonly local = new Map<number, number>();
  private readonly remote = new Map<number, number>();
  /** Input remoto usado em cada frame já simulado (para saber se a previsão errou). */
  private readonly usedRemote = new Map<number, number>();
  /** Estado *depois* de simular o frame f. */
  private readonly snapshots = new Map<number, WorldState>();
  private lastRemoteFrame = 0;
  private remoteAck = 0;
  private rollbackFrom: number | null = null;
  private readonly localChecksums = new Map<number, number>();
  private readonly remoteChecksums = new Map<number, number>();
  private unsent: [number, number][] = [];
  stats: RollbackStats = { frame: 0, remoteFrame: 0, rollbacks: 0, maxRollbackDepth: 0, stalls: 0, desync: false };
  /** Eventos gerados no último avanço (para efeitos visuais). */
  events: GameEvent[] = [];

  constructor(
    world: WorldState,
    private readonly roster: Roster,
    readonly localSide: 0 | 1,
    private readonly transport: RollbackTransport,
    private readonly inputDelay = 2,
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
    this.lastRemoteFrame = world.frame + inputDelay;
  }

  private remoteFor(frame: number): number {
    const confirmed = this.remote.get(frame);
    if (confirmed !== undefined) return confirmed;
    // previsão: último input remoto conhecido
    return this.remote.get(this.lastRemoteFrame) ?? 0;
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

  /** Recebe inputs do oponente. */
  onRemoteInputs(frames: [number, number][], ack: number): void {
    this.remoteAck = Math.max(this.remoteAck, ack);
    for (const [frame, bits] of frames) {
      if (this.remote.has(frame)) continue;
      this.remote.set(frame, bits);
      if (frame > this.lastRemoteFrame) this.lastRemoteFrame = frame;
      const used = this.usedRemote.get(frame);
      if (used !== undefined && used !== bits && frame <= this.world.frame) {
        this.rollbackFrom = this.rollbackFrom === null ? frame : Math.min(this.rollbackFrom, frame);
      }
    }
    // frames entre o último confirmado contíguo e o novo: tudo chega em ordem pelo WebSocket
  }

  onRemoteChecksum(frame: number, value: number): void {
    this.remoteChecksums.set(frame, value);
    const mine = this.localChecksums.get(frame);
    if (mine !== undefined && mine !== value) this.stats.desync = true;
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
      this.unsent.push([target + this.inputDelay, localBits]);
    }
    this.flush();

    this.applyRollback();

    if (target - this.lastRemoteFrame > this.maxRollback) {
      this.stats.stalls++;
      return false;
    }
    this.simulate();
    this.afterStep();
    return true;
  }

  private flush(): void {
    if (this.unsent.length === 0) return;
    // reenvia os últimos frames não confirmados pelo oponente (robustez)
    const resend: [number, number][] = [];
    for (let f = Math.max(this.remoteAck + 1, this.world.frame - 10); f <= this.world.frame + this.inputDelay + 1; f++) {
      const v = this.local.get(f);
      if (v !== undefined) resend.push([f, v]);
    }
    this.transport.sendInputs(resend.length ? resend : this.unsent, this.lastRemoteFrame);
    this.unsent = [];
  }

  private applyRollback(): void {
    if (this.rollbackFrom === null) return;
    const from = this.rollbackFrom;
    this.rollbackFrom = null;
    const base = this.snapshots.get(from - 1);
    if (!base) return;
    const now = this.world.frame;
    this.world = deepClone(base);
    this.stats.rollbacks++;
    this.stats.maxRollbackDepth = Math.max(this.stats.maxRollbackDepth, now - from + 1);
    const keepEvents = this.events;
    while (this.world.frame < now) this.simulate();
    this.events = keepEvents; // eventos re-simulados já foram mostrados
  }

  private afterStep(): void {
    const f = this.world.frame;
    this.stats.frame = f;
    this.stats.remoteFrame = this.lastRemoteFrame;
    // checksum de um frame já confirmado pelos dois lados
    const confirmed = Math.min(f, this.lastRemoteFrame);
    const ck = confirmed - (confirmed % this.checksumEvery);
    if (ck > 0 && !this.localChecksums.has(ck)) {
      const snap = this.snapshots.get(ck);
      if (snap) {
        const value = checksum(snap);
        this.localChecksums.set(ck, value);
        this.transport.sendChecksum(ck, value);
        const theirs = this.remoteChecksums.get(ck);
        if (theirs !== undefined && theirs !== value) this.stats.desync = true;
      }
    }
    // limpa histórico antigo
    const keepFrom = Math.min(confirmed, f) - this.maxRollback - 4;
    for (const key of this.snapshots.keys()) if (key < keepFrom) this.snapshots.delete(key);
    for (const key of this.usedRemote.keys()) if (key < keepFrom) this.usedRemote.delete(key);
  }

  /** Quantos frames estamos à frente do oponente (para desacelerar levemente). */
  get framesAhead(): number {
    return this.world.frame - this.lastRemoteFrame + this.inputDelay;
  }
}
