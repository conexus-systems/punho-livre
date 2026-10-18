/**
 * Telemetria com consentimento (LGPD): eventos de produto (sessão, luta, fila
 * online) e técnicos (desempenho, falhas) enviados em lote para
 * `POST /api/telemetry/batch` (docs/PROTOCOL.md § Telemetria).
 *
 * - Nada é coletado nem enviado sem o "sim" explícito (Ajustes › Sobre ou o
 *   diálogo da primeira abertura). Recusar ou desligar apaga a fila.
 * - Sem dados pessoais: sem conta, e-mail, nome, IP, ID de aparelho/anúncio.
 *   `session_id` é aleatório por abertura do app. Textos passam por `scrub`.
 * - Fila local com limite (LIMITS.queueMax, descarta os mais antigos), gravada
 *   no AsyncStorage; envio em lotes de até 50 eventos/64 KB, a cada 60 s, ao ir
 *   para segundo plano e ao acumular 20 eventos. Falha de rede/5xx/429 ⇒ tenta
 *   de novo com espera crescente; outro 4xx ⇒ descarta o lote (não insiste).
 */

import { AppState, Dimensions, Platform, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { config } from "@/src/config";
import { createStore } from "@/src/store";

import {
  LIMITS,
  sanitizeProps,
  TELEMETRY_SCHEMA_VERSION,
  type EventName,
  type EventProps,
  type TelemetryBatch,
  type TelemetryEvent,
} from "./telemetrySchema";

const CONSENT_KEY = "mugen-arena.telemetry.consent";
const QUEUE_KEY = "mugen-arena.telemetry.queue";
const FLUSH_EVERY_MS = 60_000;
const FLUSH_AT = 20;
const MAX_BACKOFF_MS = 5 * 60_000;

export const telemetryStore = createStore<{ consent: boolean | null }>({ consent: null });

/** UUID v4 aleatório (não precisa ser criptográfico: só agrupa eventos de uma sessão). */
export function randomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const sessionId = randomId();
let queue: TelemetryEvent[] = [];
let started = false;
let inflight: Promise<void> | null = null;
let failures = 0;
let retryAt = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let foregroundSince = Date.now();
let foregroundMs = 0;

export function telemetryEnabled(): boolean {
  return telemetryStore.get().consent === true;
}

/** Carrega consentimento e fila, liga os gatilhos de envio e registra o início da sessão. */
export async function initTelemetry(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    telemetryStore.set({ consent: raw === "granted" ? true : raw === "denied" ? false : null });
    if (telemetryEnabled()) {
      const q = await AsyncStorage.getItem(QUEUE_KEY);
      const parsed = q ? (JSON.parse(q) as TelemetryEvent[]) : [];
      if (Array.isArray(parsed)) queue = [...parsed.slice(-LIMITS.queueMax), ...queue].slice(-LIMITS.queueMax);
    }
  } catch {
    // armazenamento indisponível: segue sem fila persistida
  }
  AppState.addEventListener("change", onAppState);
  flushTimer = setInterval(() => void flush(), FLUSH_EVERY_MS);
  track("session_start", {});
  void flush();
}

/** Grava a escolha. Recusar apaga a fila (local e persistida). */
export function setTelemetryConsent(granted: boolean): void {
  telemetryStore.set({ consent: granted });
  void AsyncStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied").catch(() => undefined);
  if (!granted) {
    queue = [];
    void AsyncStorage.removeItem(QUEUE_KEY).catch(() => undefined);
  } else {
    track("session_start", {});
  }
}

/** Registra um evento (no-op sem consentimento). Props fora do esquema são descartadas. */
export function track<N extends EventName>(name: N, props: EventProps<N>): void {
  if (!telemetryEnabled()) return;
  const clean = sanitizeProps(name, props as Record<string, unknown>);
  if (!clean) return;
  queue.push({ name, at: new Date().toISOString(), props: clean });
  if (queue.length > LIMITS.queueMax) queue.splice(0, queue.length - LIMITS.queueMax);
  schedulePersist();
  if (queue.length >= FLUSH_AT) void flush();
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistQueue();
  }, 2000);
}

async function persistQueue(): Promise<void> {
  if (!telemetryEnabled()) return;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)).catch(() => undefined);
}

function appInfo(): TelemetryBatch["app"] {
  const { width, height } = Dimensions.get("window");
  const long = Math.max(width, height);
  const short = Math.max(1, Math.min(width, height));
  return {
    version: Constants.expoConfig?.version ?? "0.0.0",
    platform: Platform.OS,
    os_version: String(Platform.Version ?? ""),
    build: typeof __DEV__ !== "undefined" && __DEV__ ? "dev" : "release",
    screen_aspect: Math.round((long / short) * 100) / 100,
  };
}

/** Monta o próximo lote (≤ 50 eventos e ≤ 64 KB). */
export function nextBatch(events: TelemetryEvent[], info: TelemetryBatch["app"], session = sessionId): { batch: TelemetryBatch; body: string } | null {
  let n = Math.min(events.length, LIMITS.eventsPerBatch);
  while (n > 0) {
    const batch: TelemetryBatch = { schema: TELEMETRY_SCHEMA_VERSION, session_id: session, app: info, events: events.slice(0, n) };
    const body = JSON.stringify(batch);
    if (body.length <= LIMITS.maxBatchBytes) return { batch, body };
    n = Math.floor(n / 2);
  }
  return null;
}

/** Envia o que houver na fila. Uma requisição por vez. */
export function flush(): Promise<void> {
  if (inflight) return inflight;
  if (!telemetryEnabled() || queue.length === 0 || Date.now() < retryAt) return Promise.resolve();
  inflight = (async () => {
    try {
      while (queue.length > 0 && telemetryEnabled()) {
        const next = nextBatch(queue, appInfo());
        if (!next) {
          queue.shift(); // um evento sozinho maior que o limite: descarta
          continue;
        }
        const sent = next.batch.events.length;
        let status = 0;
        try {
          const res = await fetch(`${config.apiUrl}/api/telemetry/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: next.body,
          });
          status = res.status;
        } catch {
          status = 0;
        }
        if (status >= 200 && status < 300) {
          queue.splice(0, sent);
          failures = 0;
        } else if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          queue.splice(0, sent); // o servidor recusou o formato: reenviar não adianta
        } else {
          failures++;
          retryAt = Date.now() + Math.min(MAX_BACKOFF_MS, 30_000 * 2 ** (failures - 1));
          break;
        }
      }
    } finally {
      await persistQueue();
      inflight = null;
    }
  })();
  return inflight;
}

function onAppState(state: AppStateStatus): void {
  if (state === "active") {
    foregroundSince = Date.now();
    return;
  }
  if (state === "background") {
    foregroundMs += Date.now() - foregroundSince;
    // a sessão vale pelo processo; o servidor fica com o maior duration_s de cada session_id
    track("session_end", { duration_s: Math.round(foregroundMs / 1000) });
    void flush();
  }
}

/** Só para testes. */
export function __resetTelemetryForTests(): void {
  queue = [];
  started = false;
  inflight = null;
  failures = 0;
  retryAt = 0;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
  telemetryStore.set({ consent: null });
}

export function __queueForTests(): readonly TelemetryEvent[] {
  return queue;
}
