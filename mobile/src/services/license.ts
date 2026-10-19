/**
 * Licença do jogo pago (docs/PROTOCOL.md → Licença). O online só aceita cópias compradas na
 * Google Play: o servidor confere o veredito do Play Integrity (cópia licenciada, app
 * reconhecido, aparelho íntegro) e libera por 7 dias. O modo offline nunca passa por aqui.
 *
 * iOS: a compra na App Store não tem veredito equivalente (App Attest só prova que o app é
 * genuíno); por ora não há checagem lá.
 */

import { Platform } from "react-native";
import * as AppIntegrity from "@expo/app-integrity";
import * as Crypto from "expo-crypto";

import { config } from "@/src/config";
import { app } from "@/src/store";

import { url } from "./api";
import { HttpError, requestJson } from "./http";

/** Renova antes de vencer para não travar a fila no meio de uma sessão. */
const RENEW_BEFORE_MS = 24 * 3600_000;

const MESSAGES: Record<string, string> = {
  not_licensed: "O online é para quem comprou o jogo na Google Play. Compre ou reinstale pela Play Store.",
  unrecognized_app: "Esta cópia do jogo não veio da Google Play. Instale pela Play Store para jogar online.",
  device_integrity: "Este aparelho não passou na verificação de segurança da Google Play; o online fica indisponível nele.",
  license_unavailable: "Não foi possível verificar a compra agora. Tente de novo em instantes.",
};

let prepared = false;

export function licenseMessage(code: string): string {
  return MESSAGES[code] ?? "Não foi possível verificar a compra do jogo.";
}

/** Garante a licença antes de entrar no online. Lança Error com a mensagem para o jogador. */
export async function ensureLicense(now = Date.now()): Promise<void> {
  if (Platform.OS !== "android") return;
  const player = app.get().player;
  if (!player?.license_required) return;
  if (player.licensed_until && Date.parse(player.licensed_until) - now > RENEW_BEFORE_MS) return;
  if (!config.playCloudProject) throw new Error("Verificação de compra não configurada nesta versão do app.");

  try {
    const { nonce } = await requestJson<{ nonce: string }>(url("/api/v1/license/challenge"), { method: "POST", auth: true });
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    if (!prepared) {
      await AppIntegrity.prepareIntegrityTokenProviderAsync(config.playCloudProject);
      prepared = true;
    }
    const token = await AppIntegrity.requestIntegrityCheckAsync(hash);
    const { licensed_until } = await requestJson<{ licensed_until: string }>(url("/api/v1/license/verify"), {
      method: "POST",
      auth: true,
      body: JSON.stringify({ nonce, token }),
    });
    app.set({ player: { ...player, licensed_until } });
  } catch (err) {
    const code = err instanceof HttpError ? err.code : null;
    throw new Error(code ? licenseMessage(code) : licenseMessage("license_unavailable"));
  }
}
