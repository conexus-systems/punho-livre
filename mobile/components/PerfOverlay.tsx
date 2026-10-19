import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { formatPerf, type PerfMonitor } from "@/src/services/perf";

/**
 * Overlay de desempenho da luta (dev ou Ajustes › Sobre › Desenvolvedor):
 * fps médio e p5, tempo de quadro p95, simulação e desenho (p95) e rollbacks,
 * na janela dos últimos 500 ms. Atualiza 2×/s: não pesa no quadro.
 */
export function PerfOverlay({ monitor, top = 18 }: { monitor: PerfMonitor; top?: number }) {
  const [line, setLine] = useState("medindo…");
  useEffect(() => {
    const id = setInterval(() => setLine(formatPerf(monitor.windowSnapshot())), 500);
    return () => clearInterval(id);
  }, [monitor]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", top, left: 0, right: 0, alignItems: "center" }}>
      <Text style={{ color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.6)", fontSize: 11, paddingHorizontal: 6, fontVariant: ["tabular-nums"] }}>
        {line}
      </Text>
    </View>
  );
}
