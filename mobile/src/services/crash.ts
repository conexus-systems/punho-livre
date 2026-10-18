/**
 * Captura de falhas sem SDK de terceiros:
 * - handler global de erros JS (ErrorUtils) — fatais e não fatais;
 * - promessas rejeitadas sem tratamento (rastreador do Hermes, quando existe);
 * - error boundary das telas (components/ErrorBoundary.tsx chama `recordCrash`).
 *
 * A falha é gravada **de forma síncrona** num arquivo local (o processo pode
 * morrer logo depois de um erro fatal) e enviada como evento `crash` da
 * telemetria no próximo início — só com consentimento; sem ele, o arquivo é
 * apagado sem envio. Não pega crash nativo (Java/ObjC/C++): ver
 * docs/DEVICE_LAB.md § Falhas nativas.
 */

import { File, Paths } from "expo-file-system";

import { scrub } from "./telemetrySchema";
import { telemetryEnabled, track } from "./telemetry";

export interface CrashRecord {
  message: string;
  stack: string;
  fatal: boolean;
  source: "global" | "boundary" | "promise";
  screen: string;
  at: string;
}

const FILE_NAME = "mugen-arena-crash.json";
let currentScreen = "";
let installed = false;

export function setCurrentScreen(path: string): void {
  currentScreen = path.slice(0, 64);
}

function crashFile(): File | null {
  try {
    return new File(Paths.document, FILE_NAME);
  } catch {
    return null;
  }
}

export function toCrashRecord(error: unknown, fatal: boolean, source: CrashRecord["source"]): CrashRecord {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "erro não identificado");
  return {
    message: scrub(`${err.name}: ${err.message}`).slice(0, 300),
    stack: scrub(err.stack ?? "").slice(0, 2000),
    fatal,
    source,
    screen: currentScreen,
    at: new Date().toISOString(),
  };
}

/**
 * Registra uma falha. Fatal ⇒ só grava no arquivo (o envio fica para o próximo
 * início). Não fatal ⇒ vai direto para a fila da telemetria (se houver consentimento).
 */
export function recordCrash(error: unknown, opts: { fatal: boolean; source: CrashRecord["source"] }): CrashRecord {
  const rec = toCrashRecord(error, opts.fatal, opts.source);
  if (opts.fatal) {
    try {
      crashFile()?.write(JSON.stringify(rec));
    } catch {
      // sem disco: perde-se este relato
    }
  } else if (telemetryEnabled()) {
    track("crash", { ...rec, previous_session: false });
  }
  return rec;
}

/** Lê e apaga a falha fatal da sessão anterior; envia se houver consentimento. */
export function sendPendingCrash(): CrashRecord | null {
  const file = crashFile();
  if (!file?.exists) return null;
  let rec: CrashRecord | null = null;
  try {
    rec = JSON.parse(file.textSync()) as CrashRecord;
  } catch {
    rec = null;
  }
  try {
    file.delete();
  } catch {
    // ignora
  }
  if (rec && telemetryEnabled()) {
    track("crash", {
      message: rec.message,
      stack: rec.stack,
      fatal: rec.fatal,
      source: rec.source,
      screen: rec.screen,
      previous_session: true,
    });
  }
  return rec;
}

interface HermesInternalLike {
  enablePromiseRejectionTracker?: (opts: { allRejections: boolean; onUnhandled: (id: number, error: unknown) => void }) => void;
}

/** Instala os handlers globais (uma vez). Mantém o handler anterior (tela vermelha no dev, encerramento no release). */
export function installCrashHandler(): void {
  if (installed) return;
  installed = true;
  const utils = (globalThis as { ErrorUtils?: typeof ErrorUtils }).ErrorUtils;
  if (utils) {
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      try {
        recordCrash(error, { fatal: Boolean(isFatal), source: "global" });
      } catch {
        // nunca deixar o handler de falha falhar
      }
      previous(error, isFatal);
    });
  }
  // no dev o próprio React Native já usa o rastreador do Hermes (aviso amarelo); não substituir
  if (typeof __DEV__ !== "undefined" && __DEV__) return;
  const hermes = (globalThis as { HermesInternal?: HermesInternalLike }).HermesInternal;
  hermes?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, error) => {
      try {
        recordCrash(error, { fatal: false, source: "promise" });
      } catch {
        // ignora
      }
    },
  });
}
