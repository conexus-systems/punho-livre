import AsyncStorage from "@react-native-async-storage/async-storage";

import { recordCrash, sendPendingCrash, toCrashRecord } from "../crash";
import { FightTelemetry } from "../fightTelemetry";
import { PerfMonitor } from "../perf";
import { __queueForTests, __resetTelemetryForTests, flush, nextBatch, setTelemetryConsent, telemetryEnabled, track } from "../telemetry";
import { LIMITS, sanitizeProps, scrub, type TelemetryEvent } from "../telemetrySchema";

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const respond = (status: number) => fetchMock.mockResolvedValueOnce({ status, ok: status < 300, text: async () => "{}" });

beforeEach(async () => {
  __resetTelemetryForTests();
  fetchMock.mockReset();
  await AsyncStorage.clear();
});

afterAll(() => __resetTelemetryForTests());

describe("consentimento", () => {
  it("sem consentimento não coleta nada", () => {
    track("fight_start", { mode: "versus", p1: "kaze", p2: "brasa" });
    expect(__queueForTests()).toHaveLength(0);
    expect(telemetryEnabled()).toBe(false);
  });

  it("aceitar começa a sessão; recusar apaga a fila e a escolha fica gravada", async () => {
    setTelemetryConsent(true);
    track("fight_start", { mode: "versus", p1: "kaze", p2: "brasa" });
    expect(__queueForTests().map((e) => e.name)).toEqual(["session_start", "fight_start"]);
    setTelemetryConsent(false);
    expect(__queueForTests()).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(await AsyncStorage.getItem("mugen-arena.telemetry.consent")).toBe("denied");
  });
});

describe("esquema e PII", () => {
  it("descarta chaves fora do esquema, tipos errados e valores fora da lista", () => {
    expect(sanitizeProps("fight_end", { mode: "versus", result: "win", duration_s: 61.4, email: "a@b.com", p1: 3 })).toEqual({
      mode: "versus",
      result: "win",
      duration_s: 61,
    });
    expect(sanitizeProps("fight_end", { result: "hacked" })).toEqual({});
    expect(sanitizeProps("nao_existe", {})).toBeNull();
  });

  it("limpa e-mail, tokens, UUIDs e query strings dos textos", () => {
    const s = scrub(
      "Falha para ryo@exemplo.com.br com Bearer abc.def eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig id 123e4567-e89b-42d3-a456-426614174000 em https://x.y/a?token=1",
    );
    expect(s).not.toMatch(/ryo@|eyJ|123e4567|token=1|abc\.def/);
    expect(s).toContain("<email>");
  });

  it("corta textos longos no limite do esquema", () => {
    const p = sanitizeProps("crash", { message: "erro ".repeat(200), fatal: true });
    expect((p?.message as string).length).toBe(300);
  });
});

describe("fila e envio", () => {
  it("fila tem limite e descarta os mais antigos", () => {
    setTelemetryConsent(true);
    for (let i = 0; i < LIMITS.queueMax + 50; i++) track("session_end", { duration_s: i });
    const q = __queueForTests();
    expect(q).toHaveLength(LIMITS.queueMax);
    expect(q[q.length - 1].props.duration_s).toBe(LIMITS.queueMax + 49);
  });

  it("lote ≤ 50 eventos e ≤ 64 KB", () => {
    const big = Array.from({ length: 50 }, (): TelemetryEvent => ({ name: "crash", at: "2026-10-18T00:00:00Z", props: { stack: "s".repeat(2000) } }));
    const info = { version: "0.4.0", platform: "android", os_version: "14", build: "release" as const, screen_aspect: 2.22 };
    const r = nextBatch(big, info, "sess");
    expect(r).not.toBeNull();
    expect(r!.body.length).toBeLessThanOrEqual(LIMITS.maxBatchBytes);
    expect(r!.batch.events.length).toBeLessThan(50);
    expect(r!.batch).toMatchObject({ schema: 1, session_id: "sess" });
  });

  it("envia para /api/telemetry/batch sem Authorization e esvazia a fila no 202", async () => {
    setTelemetryConsent(true);
    track("fight_end", { mode: "arcade", result: "loss", duration_s: 80 });
    respond(202);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/telemetry\/batch$/);
    expect(init.headers.Authorization).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.events.map((e: TelemetryEvent) => e.name)).toEqual(["session_start", "fight_end"]);
    expect(body.app).toHaveProperty("platform");
    expect(JSON.stringify(body)).not.toMatch(/conexus_user_id|email|display_name/);
    expect(__queueForTests()).toHaveLength(0);
  });

  it("erro 5xx mantém a fila (tenta depois); 422 descarta o lote", async () => {
    setTelemetryConsent(true);
    respond(503);
    await flush();
    expect(__queueForTests()).toHaveLength(1);
    // em espera (backoff): não tenta de novo na hora
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    __resetTelemetryForTests();
    setTelemetryConsent(true);
    respond(422);
    await flush();
    expect(__queueForTests()).toHaveLength(0);
  });
});

describe("falhas e luta", () => {
  it("falha não fatal entra na fila com o texto limpo", () => {
    setTelemetryConsent(true);
    recordCrash(new Error("quebrou para ana@x.com"), { fatal: false, source: "boundary" });
    const crash = __queueForTests().find((e) => e.name === "crash");
    expect(crash?.props).toMatchObject({ fatal: false, source: "boundary", previous_session: false });
    expect(String(crash?.props.message)).toContain("<email>");
  });

  it("registro de falha tem nome, mensagem e pilha", () => {
    const rec = toCrashRecord(new TypeError("x is undefined"), true, "global");
    expect(rec.message).toBe("TypeError: x is undefined");
    expect(rec.fatal).toBe(true);
    expect(sendPendingCrash()).toBeNull(); // nada gravado no armazenamento simulado
  });

  it("fight_end e perf saem uma vez só, com o resumo da luta", () => {
    setTelemetryConsent(true);
    const perf = new PerfMonitor();
    for (let i = 0; i <= 120; i++) perf.frame(i * 16.7);
    const ft = new FightTelemetry({ mode: "versus", p1: "kaze", p2: "brasa", stage: "dojo", difficulty: 2 });
    ft.start();
    ft.end("win", perf);
    ft.end("quit", perf);
    const names = __queueForTests().map((e) => e.name);
    expect(names).toEqual(["session_start", "fight_start", "fight_end", "perf"]);
    expect(__queueForTests()[3].props).toMatchObject({ mode: "versus", frames: 120 });
  });
});
