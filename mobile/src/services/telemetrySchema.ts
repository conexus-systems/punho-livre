/**
 * Esquema dos eventos de telemetria (docs/PROTOCOL.md § Telemetria).
 * O backend valida com a mesma tabela (web/app/services/telemetry/schema.rb):
 * chave fora do esquema, tipo errado ou texto longo demais ⇒ o evento é descartado.
 *
 * Nada aqui identifica a pessoa: sem conta, e-mail, nome, IP, ID de aparelho ou de
 * anúncio. `session_id` é aleatório e muda a cada abertura do app.
 */

export const TELEMETRY_SCHEMA_VERSION = 1;

type PropSpec = { type: "string"; max: number; values?: readonly string[] } | { type: "number" } | { type: "integer" } | { type: "boolean" };

const str = (max: number, values?: readonly string[]): PropSpec => ({ type: "string", max, values });
const num: PropSpec = { type: "number" };
const int: PropSpec = { type: "integer" };
const bool: PropSpec = { type: "boolean" };

export const FIGHT_MODES = ["arcade", "versus", "training", "team", "online", "bench"] as const;

const PERF_PROPS = {
  mode: str(16, FIGHT_MODES),
  frames: int,
  fps_avg: num,
  fps_p5: num,
  frame_ms_p95: num,
  frame_ms_max: num,
  sim_ms_p95: num,
  draw_ms_p95: num,
  rollbacks: int,
  long_frames: int,
} as const;

export const EVENT_SCHEMA = {
  // ---- produto
  session_start: {},
  session_end: { duration_s: int },
  /** Reservado: o jogo ainda não tem tutorial. */
  tutorial: { step: str(32), completed: bool },
  fight_start: { mode: str(16, FIGHT_MODES), p1: str(32), p2: str(32), stage: str(32), difficulty: int },
  fight_end: {
    mode: str(16, FIGHT_MODES),
    p1: str(32),
    p2: str(32),
    result: str(16, ["win", "loss", "draw", "abandoned", "quit"]),
    duration_s: int,
  },
  online_queue: { mode: str(8, ["ranked", "room"]), outcome: str(16, ["matched", "canceled", "error"]), wait_s: int, error: str(64) },
  // ---- técnicos
  perf: PERF_PROPS,
  crash: {
    message: str(300),
    stack: str(2000),
    fatal: bool,
    source: str(16, ["global", "boundary", "promise"]),
    screen: str(64),
    previous_session: bool,
  },
} as const satisfies Record<string, Record<string, PropSpec>>;

export type EventName = keyof typeof EVENT_SCHEMA;
export type EventProps<N extends EventName> = { [K in keyof (typeof EVENT_SCHEMA)[N]]?: string | number | boolean };

export interface TelemetryEvent {
  name: EventName;
  /** ISO 8601 (UTC). */
  at: string;
  props: Record<string, string | number | boolean>;
}

export interface TelemetryBatch {
  schema: typeof TELEMETRY_SCHEMA_VERSION;
  session_id: string;
  app: { version: string; platform: string; os_version: string; build: "dev" | "release"; screen_aspect: number };
  events: TelemetryEvent[];
}

/** Limites do lado do app (o servidor tem os mesmos, ver PROTOCOL.md). */
export const LIMITS = { eventsPerBatch: 50, maxBatchBytes: 64 * 1024, queueMax: 300 } as const;

const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/gi;
const JWT = /eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]*/g;
const BEARER = /bearer\s+\S+/gi;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const QUERY = /\?[^\s)'"]*/g;
const LONG_TOKEN = /[A-Za-z0-9+/_-]{40,}={0,2}/g;

/** Remove do texto o que poderia identificar alguém (e-mail, tokens, IDs, query strings). */
export function scrub(text: string): string {
  return text
    .replace(EMAIL, "<email>")
    .replace(JWT, "<token>")
    .replace(BEARER, "Bearer <token>")
    .replace(UUID, "<uuid>")
    .replace(QUERY, "?<q>")
    .replace(LONG_TOKEN, "<id>");
}

/**
 * Normaliza as props de um evento conforme o esquema: descarta chaves
 * desconhecidas e tipos errados, corta textos e limpa PII. Devolve null se o
 * nome não existir.
 */
export function sanitizeProps(name: string, props: Record<string, unknown>): Record<string, string | number | boolean> | null {
  const spec = (EVENT_SCHEMA as Record<string, Record<string, PropSpec>>)[name];
  if (!spec) return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    const s = spec[key];
    if (!s || value === undefined || value === null) continue;
    if (s.type === "string" && typeof value === "string") {
      const v = scrub(value).slice(0, s.max);
      if (s.values && !s.values.includes(v)) continue;
      out[key] = v;
    } else if (s.type === "number" && typeof value === "number" && Number.isFinite(value)) out[key] = Math.round(value * 100) / 100;
    else if (s.type === "integer" && typeof value === "number" && Number.isFinite(value)) out[key] = Math.round(value);
    else if (s.type === "boolean" && typeof value === "boolean") out[key] = value;
  }
  return out;
}
