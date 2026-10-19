import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import { checksum } from "@/src/engine/clone";
import type { CharacterData } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";

import { RollbackSession, type RollbackTransport } from "../rollback";

const roster: Record<string, CharacterData> = {};
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);
const cfg = { chars: ["kaze", "yuki"] as [string, string], stageId: "dojo", seed: 4242, roundsToWin: 2, roundTime: 99 };

type Msg = { at: number; deliver: () => void };

function linked(latency: (tick: number) => number) {
  const queue: Msg[] = [];
  let tick = 0;
  const sessions: RollbackSession[] = [];
  const transport = (from: 0 | 1): RollbackTransport => ({
    sendInputs: (frames, ack) => {
      const copy = frames.map((f) => [...f] as [number, number]);
      // WebSocket entrega em ordem: nunca antes da mensagem anterior
      const last = queue.filter((m) => (m as Msg & { from?: number }).from === from).reduce((a, m) => Math.max(a, m.at), 0);
      const msg = { at: Math.max(last, tick + latency(tick)), from, deliver: () => sessions[from === 0 ? 1 : 0].onRemoteInputs(copy, ack) };
      queue.push(msg);
    },
    sendChecksum: (frame, value, inputsHash) => {
      queue.push({ at: tick + latency(tick), deliver: () => sessions[from === 0 ? 1 : 0].onRemoteChecksum(frame, value, inputsHash) });
    },
  });
  sessions.push(new RollbackSession(createWorld(cfg, roster), roster, 0, transport(0), 2, 10));
  sessions.push(new RollbackSession(createWorld(cfg, roster), roster, 1, transport(1), 2, 10));
  const pump = () => {
    tick++;
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0].at <= tick) queue.shift()?.deliver();
  };
  return { sessions, pump };
}

function inputs(seed: number, n: number): number[] {
  let s = seed;
  const out: number[] = [];
  let cur = 0;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    if (i % 7 === 0) cur = (s >> 4) & 2047; // segura a mesma entrada por alguns frames
    out.push(cur);
  }
  return out;
}

describe("rollback", () => {
  it.each([
    ["sem latência", () => 0],
    ["latência fixa de 4 ticks", () => 4],
    ["latência variável 1..9", (t: number) => 1 + ((t * 7919) % 9)],
  ])("%s: os dois lados convergem para a simulação de referência", (_name, latency) => {
    const N = 1500;
    const a = inputs(1, N + 50);
    const b = inputs(2, N + 50);
    const { sessions, pump } = linked(latency);
    const consumed = [0, 0];
    for (let guard = 0; guard < N * 4 && (sessions[0].world.frame < N || sessions[1].world.frame < N); guard++) {
      for (const side of [0, 1] as const) {
        const s = sessions[side];
        if (s.world.frame >= N) continue;
        const bits = (side === 0 ? a : b)[consumed[side]];
        if (s.advance(bits)) consumed[side]++;
      }
      pump();
    }
    // entrega o que restou e deixa cada lado corrigir a última previsão
    for (let i = 0; i < 30; i++) pump();
    for (const s of sessions) s.advance(0);

    // referência sem rede: input local é aplicado 2 frames depois (input delay)
    const ref = createWorld(cfg, roster);
    const delayed = (arr: number[], f: number) => (f - 2 >= 1 ? arr[f - 3] : 0);
    const target = Math.min(sessions[0].world.frame, sessions[1].world.frame);
    while (ref.frame < target) stepWorld(ref, [delayed(a, ref.frame + 1), delayed(b, ref.frame + 1)], roster);

    expect(sessions[0].world.frame).toBe(sessions[1].world.frame);
    expect(checksum(sessions[0].world)).toBe(checksum(sessions[1].world));
    expect(checksum(sessions[0].world)).toBe(checksum(ref));
    expect(sessions[0].stats.desync || sessions[1].stats.desync).toBe(false);
    if (latency(0) > 0) {
      // com latência a previsão erra e o rollback precisa corrigir
      expect(sessions[0].stats.rollbacks + sessions[1].stats.rollbacks).toBeGreaterThan(10);
    }
  });
});
