import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, View } from "react-native";

import { MetroButton } from "@/components/metro";
import { recordCrash } from "@/src/services/crash";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

type Props = { readonly children: ReactNode; readonly onReset?: () => void };

/**
 * Pega erros de renderização das telas: registra a falha (src/services/crash.ts,
 * envia só com consentimento) e mostra um painel W10M com saída real em vez de
 * fechar o app.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (info.componentStack && err.stack) err.stack = `${err.stack}\n--- componentes ---${info.componentStack}`;
    recordCrash(err, { fatal: false, source: "boundary" });
  }

  private reset = () => {
    this.setState({ failed: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.failed) return <Fallback onReset={this.reset} />;
    return this.props.children;
  }
}

function Fallback({ onReset }: { onReset: () => void }) {
  const t = useTokens();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: "center", padding: space.lg, gap: space.md }}>
      <Text accessibilityRole="header" style={[TYPE.HEADER, { color: t.text }]}>
        algo deu errado
      </Text>
      <Text style={[TYPE.BODY, { color: t.muted, maxWidth: 520 }]}>
        A tela encontrou um erro e foi fechada. Se você permitiu o envio de dados de falhas, o relato já está na fila para a gente
        corrigir.
      </Text>
      <View style={{ alignSelf: "flex-start" }}>
        <MetroButton kind="primary" label="Voltar ao menu" onPress={onReset} />
      </View>
    </View>
  );
}
