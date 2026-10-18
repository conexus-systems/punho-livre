/**
 * Reconexão do lado do app (online.ts + cable.ts) com um WebSocket falso:
 * queda no meio da luta → nova conexão com `resume` e o primeiro quadro que
 * falta; o `resume` do servidor entrega as entradas do oponente; sem conseguir
 * voltar em 10 s, a partida é dada como perdida.
 */
import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { loadCharacter } from "@/src/engine/character";
import type { Roster } from "@/src/engine/fighter";

jest.mock("@/src/services/auth", () => ({ accessToken: async () => "tok" }));

// eslint-disable-next-line import/first
import { disconnectOnline, joinMatch, onlineStore, RECONNECT_BUDGET_MS, type MatchInfo } from "../online";

class FakeSocket {
  static all: FakeSocket[] = [];
  sent: Record<string, unknown>[] = [];
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {}
  receive(msg: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  /** Mensagem de canal (identifier = a assinatura mais recente). */
  channel(message: Record<string, unknown>) {
    this.receive({ identifier: this.lastSubscription(), message });
  }
  lastSubscription(): string {
    const subs = this.sent.filter((m) => m.command === "subscribe");
    return String(subs[subs.length - 1].identifier);
  }
  actions(): Record<string, unknown>[] {
    return this.sent.filter((m) => m.command === "message").map((m) => JSON.parse(String(m.data)));
  }
}

const roster: Roster = {};
for (const id of ["kaze", "yuki"]) roster[id] = loadCharacter(BUILTIN[id as (typeof BUILTIN_ORDER)[number]].pack);

const match: MatchInfo = {
  matchId: 7,
  side: 0,
  seed: 99,
  inputDelay: 2,
  myCharacter: "kaze",
  opponent: { display_name: "Rival", rating: 1500, character: "yuki", pack_sha256: "a".repeat(64) },
};

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("online: queda e reconexão no meio da luta", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    disconnectOnline();
    FakeSocket.all = [];
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket;
    onlineStore.set({ reconnectingUntil: null, connectionLost: false, opponentAwayUntil: null, voided: null });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  async function startMatch() {
    const handle = joinMatch(match, roster, "dojo", 2);
    await flush();
    const ws = FakeSocket.all[0];
    ws.receive({ type: "welcome" });
    await flush();
    ws.receive({ type: "confirm_subscription", identifier: ws.lastSubscription() });
    expect(ws.actions().map((a) => a.action)).toContain("ready");
    ws.channel({ type: "start", at: Date.now() });
    const session = await handle.session;
    return { handle, ws, session };
  }

  it("reconecta com resume, recebe as entradas registradas e reenvia o registro do ponto certo", async () => {
    const { ws, session } = await startMatch();
    for (let i = 0; i < 5; i++) session.advance(16);
    ws.channel({ type: "input", side: 1, frames: [[3, 4], [4, 4]], ack: 2 });
    expect(session.missingFrom).toBe(5);

    ws.onclose?.(); // a rede caiu
    await flush();
    expect(onlineStore.get().reconnectingUntil).not.toBeNull();
    const ws2 = FakeSocket.all[1];
    expect(ws2).toBeDefined();
    ws2.receive({ type: "welcome" });
    await flush();
    expect(JSON.parse(ws2.lastSubscription())).toEqual({ channel: "MatchChannel", match_id: 7, resume: true, from: 5 });

    ws2.receive({ type: "confirm_subscription", identifier: ws2.lastSubscription() });
    ws2.channel({ type: "resume", status: "active", from: 5, frames: [4, 8, 8], log_next: 1 });
    expect(session.missingFrom).toBe(8);
    expect(onlineStore.get().reconnectingUntil).toBeNull();
    expect(ws2.actions().map((a) => a.action)).not.toContain("ready");

    // o oponente pede nossas entradas desde o 3
    ws2.channel({ type: "resync", side: 1, from: 3 });
    const input = ws2.actions().filter((a) => a.action === "input").pop() as { frames: [number, number][] };
    expect(input.frames[0][0]).toBe(3);
  });

  it("sem conseguir voltar em 10 s: conexão perdida (o servidor dá o abandono)", async () => {
    const { ws } = await startMatch();
    ws.onclose?.();
    for (let t = 0; t <= RECONNECT_BUDGET_MS + 2000; t += 250) {
      // toda tentativa de conexão falha
      const last = FakeSocket.all[FakeSocket.all.length - 1];
      if (last !== ws) last.onerror?.();
      await jest.advanceTimersByTimeAsync(250);
    }
    expect(FakeSocket.all.length).toBeGreaterThan(2);
    expect(onlineStore.get().connectionLost).toBe(true);
    expect(onlineStore.get().reconnectingUntil).toBeNull();
  });

  it("conexão muda (sem pings) é dada como morta pelo vigia e reconecta", async () => {
    await startMatch();
    await jest.advanceTimersByTimeAsync(4000);
    expect(onlineStore.get().reconnectingUntil).not.toBeNull();
    expect(FakeSocket.all.length).toBe(2);
  });

  it("oponente caiu: mostra a contagem; voltou (resync): some", async () => {
    const { ws } = await startMatch();
    ws.channel({ type: "opponent_disconnected", side: 1, grace_ms: 10000 });
    expect(onlineStore.get().opponentAwayUntil).toBeGreaterThan(Date.now());
    ws.channel({ type: "resync", side: 1, from: 1 });
    expect(onlineStore.get().opponentAwayUntil).toBeNull();
  });
});
