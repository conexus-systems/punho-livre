import { MetroDialog } from "@/components/metro";
import { setTelemetryConsent, telemetryStore } from "@/src/services/telemetry";

/**
 * Pergunta única (primeira abertura, depois do consentimento de anúncios):
 * "Permitir" e "Agora não" lado a lado, sem pré-seleção; a escolha muda em
 * Ajustes › Sobre.
 */
export function TelemetryConsentDialog({ ready }: { ready: boolean }) {
  const consent = telemetryStore.use((s) => s.consent);
  return (
    <MetroDialog
      visible={ready && consent === null}
      title="Ajudar a melhorar o jogo?"
      message="Podemos enviar dados anônimos de uso (modo de jogo, duração das lutas), desempenho (fps) e falhas do app. Sem nome, e-mail, conta ou identificador do aparelho. Você pode mudar isso em Ajustes › Sobre."
      positive="Permitir"
      negative="Agora não"
      onPositive={() => setTelemetryConsent(true)}
      onNegative={() => setTelemetryConsent(false)}
    />
  );
}
