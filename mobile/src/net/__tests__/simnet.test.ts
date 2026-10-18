import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import type { Roster } from "@/src/engine/fighter";
import { createWorld } from "@/src/engine/world";

import { InputsHash } from "../hash";
import { RollbackSession, type RollbackTransport } from "../rollback";
import { PROFILES, runOnlineMatch, soakMatch } from "../simnet";

const roster: Roster = {};
for (const id of BUILTIN_ORDER) roster[id] = loadCharacter(BUILTIN[id].pack);

const short = { roundsToWin: 1, roundTime: 20 };
const profile = (name: string) => PROFILES.find((p) => p.name === name)!;

describe("partida online simulada (soak curto)", () => {
  it("rede ruim (perda, jitter, fora de ordem): sem dessincronia, sem travar, replay reproduz a luta", () => {
    const r = runOnlineMatch({ roster, seed: 77, chars: ["kaze", "yuki"], profile: profile("ruim"), ...short });
    expect(r.stuck).toBe(false);
    expect(r.desync).toBe(false);
    expect(r.replayOk).toBe(true);
    expect(r.dropped).toBeGreaterThan(0);
    expect(r.rollbacks).toBeGreaterThan(10);
    expect(r.checkedFrames).toBeGreaterThanOrEqual(r.frames);
  });

  it("queda de 6 s de um lado no meio da luta: reconecta, recupera as entradas e segue sincronizado", () => {
    const r = runOnlineMatch({
      roster,
      seed: 91,
      chars: ["kaze", "yuki"],
      profile: { ...profile("queda"), blackout: { side: 1, atMs: 4000, durationMs: 6000 } },
      ...short,
    });
    expect(r.stuck).toBe(false);
    expect(r.desync).toBe(false);
    expect(r.replayOk).toBe(true);
    expect(r.recoveryMs).toBeGreaterThanOrEqual(0);
    expect(r.recoveryMs).toBeLessThan(2000);
  });

  it("regressão do soak (partida 819): queda + relógio adiantado não trava os dois lados", () => {
    const m = soakMatch(819, BUILTIN_ORDER);
    const r = runOnlineMatch({ roster, seed: m.seed, chars: m.chars, profile: m.profile });
    expect(r.stuck).toBe(false);
    expect(r.desync).toBe(false);
    expect(r.replayOk).toBe(true);
  });

  it("entrada adulterada no relay é acusada pelo checksum (estado ou hash das entradas)", () => {
    let tampered = false;
    const r = runOnlineMatch({
      roster,
      seed: 5,
      chars: ["kaze", "yuki"],
      profile: profile("wifi"),
      ...short,
      tamper: (from, frames) => {
        if (from !== 0) return frames;
        return frames.map(([f, bits]) => {
          if (f !== 400) return [f, bits];
          tampered = true;
          return [f, bits ^ 16];
        });
      },
    });
    expect(tampered).toBe(true);
    expect(r.desync).toBe(true);
    expect(r.desyncFrame).toBeGreaterThanOrEqual(400);
    expect(r.desyncFrame).toBeLessThan(400 + 2);
  });
});

describe("RollbackSession: rede imperfeita", () => {
  const cfg = { chars: ["kaze", "yuki"] as [string, string], stageId: "dojo", seed: 1, roundsToWin: 2, roundTime: 99 };
  const sent: { frames: [number, number][]; ack: number }[] = [];
  const transport: RollbackTransport = {
    sendInputs: (frames, ack) => sent.push({ frames, ack }),
    sendChecksum: () => undefined,
  };

  beforeEach(() => {
    sent.length = 0;
  });

  it("entradas fora de ordem e repetidas: só confirma o que é contíguo", () => {
    const s = new RollbackSession(createWorld(cfg, roster), roster, 0, transport, 2, 8);
    s.onRemoteInputs([[5, 1], [4, 1]], 0);
    expect(s.missingFrom).toBe(3);
    s.onRemoteInputs([[3, 1], [3, 9]], 0);
    expect(s.missingFrom).toBe(6);
    expect(s.remoteInputs()).toEqual([0, 0, 1, 1, 1]);
  });

  it("parado esperando o oponente, continua reenviando o que não foi confirmado", () => {
    const s = new RollbackSession(createWorld(cfg, roster), roster, 0, transport, 2, 8);
    for (let i = 0; i < 40; i++) s.advance(i);
    expect(s.world.frame).toBe(10); // 2 de atraso + 8 de previsão
    const after = sent.length;
    for (let i = 0; i < 12; i++) s.advance(0);
    expect(sent.length).toBeGreaterThan(after); // reenvio durante o stall
    expect(sent[sent.length - 1].frames[0][0]).toBe(3); // desde o primeiro não confirmado
    // oponente confirma até 8 → próximo envio começa no 9
    s.onRemoteInputs([[3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]], 8);
    s.advance(0); // o input deste tick já tinha sido agendado durante o stall
    s.advance(0);
    expect(sent[sent.length - 1].frames[0][0]).toBe(9);
    // reconexão do oponente pedindo desde o 4
    s.resendFrom(4);
    expect(sent[sent.length - 1].frames[0][0]).toBe(4);
  });

  it("registro de entradas em blocos, com rebobinar quando o servidor acusa buraco", () => {
    const s = new RollbackSession(createWorld(cfg, roster), roster, 1, transport, 2, 200);
    for (let i = 0; i < 70; i++) s.advance(i & 7);
    const first = s.takeInputLog(60);
    expect(first?.from).toBe(1);
    expect(first?.bits.length).toBeGreaterThanOrEqual(60);
    expect(first?.bits.slice(0, 3)).toEqual([0, 0, 0]);
    expect(s.takeInputLog(60)).toBeNull();
    s.rewindInputLog(31);
    const again = s.takeInputLog(1, true);
    expect(again?.from).toBe(31);
  });

  it("hash das entradas é o mesmo FNV-1a do servidor (vetor fixo)", () => {
    const h = new InputsHash();
    h.push(1, 0, 0);
    h.push(2, 16, 1024);
    h.push(3, 0x7ff, 3);
    // mesmo vetor em web/spec/services/matches/inputs_hash_spec.rb
    expect(h.value).toBe(INPUTS_HASH_VECTOR);
  });
});

const INPUTS_HASH_VECTOR = 1965842172;
