/**
 * Versão da engine/protocolo usada no matchmaking: o servidor só junta
 * aparelhos com a mesma `engine_version` (versões diferentes da engine
 * dessincronizam). Muda junto com a versão do app; `NET_PROTOCOL` sobe quando
 * o contrato do online (docs/PROTOCOL.md) muda de forma incompatível.
 */

import Constants from "expo-constants";

export const NET_PROTOCOL = 2;

export function engineVersion(): string {
  const app = Constants.expoConfig?.version ?? "dev";
  return `${app}+net${NET_PROTOCOL}`;
}
