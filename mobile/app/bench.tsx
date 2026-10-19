import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, PixelRatio, Platform, ScrollView, Share, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { Canvas, Picture, Skia, type SkImage, type SkPicture } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";

import { MetroButton, MetroProgress } from "@/components/metro";
import { PerfOverlay } from "@/components/PerfOverlay";
import { rosterFor } from "@/src/characters/registry";
import { stepWorld } from "@/src/engine/world";
import { loadAtlases } from "@/src/game/atlas";
import { FightRenderer } from "@/src/game/renderer";
import { loadStageArt } from "@/src/game/stageArt";
import type { StageImages } from "@/src/game/stages";
import { BENCH, createBenchFight, type BenchFight, type BenchReport } from "@/src/services/benchFight";
import { now, PerfMonitor } from "@/src/services/perf";
import { track } from "@/src/services/telemetry";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

const STEP_MS = 1000 / 60;

/**
 * Modo bench (Ajustes › Sobre › Desenvolvedor): a luta fixa CPU × CPU de
 * src/services/benchFight.ts por 60 s, com o mesmo laço e renderizador da tela
 * de luta, sem toque nem áudio. No fim mostra os números e permite exportar
 * (compartilhar o JSON) para a planilha do laboratório (docs/DEVICE_LAB.md).
 */
export default function Bench() {
  const t = useTokens();
  const { width, height } = useWindowDimensions();
  const roster = useMemo(() => rosterFor(BENCH.chars), []);
  const picture = useSharedValue<SkPicture>(blank());
  const perf = useRef(new PerfMonitor());
  const renderer = useRef(new FightRenderer());
  const fight = useRef<BenchFight | null>(null);
  const atlases = useRef<Record<string, SkImage[]>>({});
  const stage = useRef<StageImages | undefined>(undefined);
  const [phase, setPhase] = useState<"loading" | "running" | "done">("loading");
  const [report, setReport] = useState<BenchReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [a, art] = await Promise.all([loadAtlases(BENCH.chars), loadStageArt(BENCH.stage)]);
      if (cancelled) return;
      atlases.current = a;
      stage.current = art;
      fight.current = createBenchFight(roster);
      setPhase("running");
    })();
    return () => {
      cancelled = true;
    };
  }, [roster]);

  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    let start = 0;
    let last = 0;
    let acc = 0;
    let steps = 0;
    let fights = 0;
    const startedAt = new Date().toISOString();
    perf.current.reset();
    const frame = (ts: number) => {
      const f = fight.current;
      if (!f) return;
      if (start === 0) start = last = ts;
      if (ts - start >= BENCH.seconds * 1000) {
        const s = perf.current.totalSnapshot();
        const r: BenchReport = {
          format: "mugen-arena-bench/1",
          platform: Platform.OS,
          os_version: String(Platform.Version ?? ""),
          app_version: Constants.expoConfig?.version ?? "?",
          device: "",
          width: Math.round(Dimensions.get("window").width),
          height: Math.round(Dimensions.get("window").height),
          pixel_ratio: PixelRatio.get(),
          duration_s: Math.round((ts - start) / 100) / 10,
          sim_steps: steps,
          started_at: startedAt,
          ...s,
        };
        setReport(r);
        setPhase("done");
        track("perf", { mode: "bench", ...s });
        return;
      }
      raf = requestAnimationFrame(frame);
      acc += Math.min(100, ts - last);
      last = ts;
      perf.current.frame(ts);
      const simStart = now();
      let n = 0;
      while (acc >= STEP_MS && n < 4) {
        stepWorld(f.world, [f.cpus[0].next(f.world), f.cpus[1].next(f.world)], roster);
        renderer.current.addEvents(f.world.events, f.world, roster);
        acc -= STEP_MS;
        n++;
        steps++;
      }
      if (n > 0) perf.current.sim(now() - simStart);
      if (f.world.matchWinner >= 0 && f.world.roundStateTime > 120) fight.current = createBenchFight(roster, ++fights);
      const drawStart = now();
      const rec = Skia.PictureRecorder();
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
      renderer.current.draw(canvas, {
        world: f.world,
        roster,
        atlases: atlases.current,
        stageImages: stage.current,
        names: [roster[BENCH.chars[0]].displayName, roster[BENCH.chars[1]].displayName],
        width,
        height,
        debugBoxes: false,
        banner: null,
      });
      picture.value = rec.finishRecordingAsPicture();
      perf.current.draw(now() - drawStart);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const restart = () => {
    fight.current = createBenchFight(roster);
    renderer.current = new FightRenderer();
    setReport(null);
    setPhase("running");
  };

  const exportReport = () => {
    if (report) void Share.share({ message: JSON.stringify(report, null, 2) }).catch(() => undefined);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Canvas style={{ position: "absolute", left: 0, top: 0, width, height }}>
        <Picture picture={picture} />
      </Canvas>
      {phase === "loading" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MetroProgress />
        </View>
      ) : null}
      {phase === "running" ? <PerfOverlay monitor={perf.current} top={height - 24} /> : null}
      {phase === "running" ? (
        <View style={{ position: "absolute", right: space.sm, top: space.sm }}>
          <MetroButton label="Cancelar" onPress={() => router.back()} />
        </View>
      ) : null}
      {report ? (
        <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: t.scrim, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 520, maxWidth: "94%", maxHeight: "92%", padding: space.lg, gap: space.sm, backgroundColor: t.chrome }}>
            <Text accessibilityRole="header" style={[TYPE.HEADER, { color: t.text }]}>
              bench · {BENCH.seconds} s
            </Text>
            <ScrollView style={{ flexGrow: 0 }}>
              {(
                [
                  ["fps médio", report.fps_avg],
                  ["fps p5 (5% piores)", report.fps_p5],
                  ["quadro p95 / máx (ms)", `${report.frame_ms_p95} / ${report.frame_ms_max}`],
                  ["travadas (> 33 ms)", report.long_frames],
                  ["simulação p95 (ms)", report.sim_ms_p95],
                  ["desenho p95 (ms)", report.draw_ms_p95],
                  ["quadros / passos", `${report.frames} / ${report.sim_steps}`],
                  ["tela", `${report.width}×${report.height} @${report.pixel_ratio}x`],
                  ["sistema", `${report.platform} ${report.os_version} · app ${report.app_version}`],
                ] as const
              ).map(([k, v]) => (
                <Text key={k} style={[TYPE.BODY, { color: t.text }]}>
                  <Text style={{ color: t.muted }}>{k}: </Text>
                  {String(v)}
                </Text>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <MetroButton kind="primary" label="Exportar" onPress={exportReport} />
              <MetroButton label="Repetir" onPress={restart} />
              <MetroButton label="Voltar" onPress={() => router.back()} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function blank(): SkPicture {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
}
