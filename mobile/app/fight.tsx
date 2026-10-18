import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Canvas, Picture, Skia, type SkImage, type SkPicture } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { useSharedValue } from "react-native-reanimated";

import { MetroButton, MetroProgress } from "@/components/metro";
import { PerfOverlay } from "@/components/PerfOverlay";
import { TouchControls, type AssistButton } from "@/components/TouchControls";
import { TYPE } from "@/src/ui/type";
import { space, useTokens, type Tokens } from "@/src/ui/theme";
import { BUILTIN } from "@/src/characters/builtin.generated";
import { getCharacter, rosterFor } from "@/src/characters/registry";
import type { Roster } from "@/src/engine/fighter";
import { Btn } from "@/src/engine/input";
import type { GameEvent, WorldState } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";
import { CpuController } from "@/src/game/ai";
import { loadAtlases } from "@/src/game/atlas";
import { layoutFor, schemeOf } from "@/src/game/controlLayout";
import { HapticGate, hitFeel } from "@/src/game/feedback";
import { SimpleController, simpleContextOf, simpleKit } from "@/src/game/simpleMode";
import { loadStageArt } from "@/src/game/stageArt";
import type { StageImages } from "@/src/game/stages";
import { findCommand, macroFromCommand, MacroPlayer, motionCommands } from "@/src/game/macros";
import { FightRenderer } from "@/src/game/renderer";
import { STAGES } from "@/src/game/stages";
import { audio } from "@/src/audio";
import { matchSetup } from "@/src/match";
import { joinMatch, onlineStore, type OnlineMatchHandle } from "@/src/net/online";
import type { RollbackSession } from "@/src/net/rollback";
import { onMatchFinished, showRewarded } from "@/src/services/ads";
import { fetchMe } from "@/src/services/api";
import { devOptions, perfOverlayOn } from "@/src/services/devOptions";
import { FightTelemetry, resultFor } from "@/src/services/fightTelemetry";
import { now, PerfMonitor } from "@/src/services/perf";
import { app } from "@/src/store";

const STEP_MS = 1000 / 60;

interface Assist {
  id: string;
  label: string;
  cmd: string;
  isSuper: boolean;
  /** Estoques de power necessários (padrão 1000). */
  cost?: number;
}

/** A+B+C por alguns frames: liga o MAX (bits relativos = absolutos para botões). */
const MAX_MACRO = [Btn.x | Btn.a | Btn.z, Btn.x | Btn.a | Btn.z, Btn.x | Btn.a | Btn.z, 0];

/** Uma frase de vitória do personagem nativo (null para importados). */
function pickQuote(charId: string): string | null {
  const quotes = BUILTIN[charId]?.meta.quotes ?? [];
  return quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : null;
}

function assistsFor(charId: string): Assist[] {
  const builtin = BUILTIN[charId];
  if (builtin) {
    return [
      ...builtin.meta.specials.map((s, i) => ({ id: `sp${i}`, label: s.name, cmd: s.cmd, isSuper: false })),
      { id: "super", label: "SUPER", cmd: builtin.meta.super.cmd, isSuper: true },
      ...(builtin.meta.super2 ? [{ id: "super2", label: "SUPER 2", cmd: builtin.meta.super2.cmd, isSuper: true, cost: 2000 }] : []),
    ];
  }
  // personagem MUGEN importado: usa os comandos de movimento do .cmd
  return motionCommands(getCharacter(charId))
    .slice(0, 4)
    .map((c, i) => ({ id: `cmd${i}`, label: c.name.toUpperCase().slice(0, 10), cmd: c.name, isSuper: false }));
}

export default function Fight() {
  const setup = matchSetup.get();
  const settings = app.use((s) => s.settings);
  const { width, height } = useWindowDimensions();
  const t = useTokens();
  const online = setup.mode === "online" && setup.online !== null;

  const teams: [string[], string[]] | null = setup.mode === "team" && setup.team1.length > 0 && setup.team2.length > 0 ? [setup.team1, setup.team2] : null;
  const p1 = online ? (setup.online!.side === 0 ? setup.online!.myCharacter : setup.online!.opponent.character) : teams ? teams[0][0] : setup.p1!;
  const p2 = online ? (setup.online!.side === 0 ? setup.online!.opponent.character : setup.online!.myCharacter) : teams ? teams[1][0] : setup.p2!;
  const localSide: 0 | 1 = online ? setup.online!.side : 0;
  const everyone = useMemo(() => [...new Set(teams ? [...teams[0], ...teams[1]] : [p1, p2])], [teams, p1, p2]);

  const roster: Roster = useMemo(() => rosterFor(everyone), [everyone]);
  // nas equipes o lutador muda a cada round: o HUD usa o nome do personagem em campo
  const names: [string, string] | undefined = teams ? undefined : [roster[p1].displayName, roster[p2].displayName];

  const picture = useSharedValue<SkPicture>(emptyPicture());
  const inputRef = useRef(0);
  const macro = useRef(new MacroPlayer());
  const simple = useRef<SimpleController | null>(null);
  const hapticGate = useRef(new HapticGate());
  const renderer = useRef(new FightRenderer());
  const worldRef = useRef<WorldState | null>(null);
  const sessionRef = useRef<RollbackSession | null>(null);
  const onlineRef = useRef<OnlineMatchHandle | null>(null);
  const cpu = useRef<CpuController | null>(null);
  const atlases = useRef<Record<string, SkImage[]>>({});
  const stageImages = useRef<Record<string, StageImages>>({});
  const pausedRef = useRef(false);
  const reported = useRef(false);
  // QA: desempenho (overlay + resumo na telemetria) e eventos da luta
  const perf = useRef(new PerfMonitor());
  const fightTel = useRef<FightTelemetry | null>(null);
  const showPerf = devOptions.use(perfOverlayOn);

  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ winner: number } | null>(null);
  const [power, setPower] = useState(0);
  const [maxReady, setMaxReady] = useState(false);
  const [localChar, setLocalChar] = useState(localSide === 0 ? p1 : p2);
  const [winner, setWinner] = useState<{ char: string; quote: string | null } | null>(null);
  const [debugBoxes, setDebugBoxes] = useState(setup.mode === "training");
  const [error, setError] = useState<string | null>(null);
  const finished = onlineStore.use((s) => s.finished);
  const opponentLeft = onlineStore.use((s) => s.opponentLeft);
  const ping = onlineStore.use((s) => s.ping);

  const controls = settings.controls;
  const scheme = schemeOf(controls, settings.buttons);
  const simpleMode = scheme === "simple";
  const controlItems = useMemo(() => layoutFor(scheme, controls.layouts), [scheme, controls.layouts]);
  const assists = useMemo(() => assistsFor(localChar), [localChar]);
  // modo simples: o kit (especiais por direção, super, auto-combo) muda com o lutador em campo
  useEffect(() => {
    if (!simpleMode) {
      simple.current = null;
      return;
    }
    const ch = roster[localChar];
    const kit = simpleKit(ch, BUILTIN[localChar]?.meta);
    if (simple.current) simple.current.setCharacter(ch, kit);
    else simple.current = new SimpleController(ch, kit);
  }, [simpleMode, localChar, roster]);
  const assistButtons: AssistButton[] = [
    // no modo simples os especiais já estão no botão Especial; fica só o MAX
    ...(settings.assist && !simpleMode ? assists.map((a) => ({ id: a.id, label: a.label, enabled: !a.isSuper || power >= (a.cost ?? 1000) })) : []),
    // MAX (A+B+C) num toque: gasta 1 estoque
    { id: "max", label: "MAX", enabled: maxReady },
  ];

  // ------------------------------------------------------------ setup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedAtlases, art] = await Promise.all([
        loadAtlases(everyone),
        Promise.all(STAGES.map(async (s) => [s.id, await loadStageArt(s.id)] as const)),
      ]);
      atlases.current = loadedAtlases;
      stageImages.current = Object.fromEntries(art);
      if (cancelled) return;
      if (online) {
        const handle = joinMatch(setup.online!, roster, STAGES[setup.online!.matchId % STAGES.length].id, settings.inputDelay);
        onlineRef.current = handle;
        try {
          sessionRef.current = await handle.session;
        } catch (err) {
          setError((err as Error).message);
          return;
        }
      } else {
        const stage = setup.mode === "arcade" ? STAGES[(setup.stageNo - 1) % STAGES.length].id : setup.stage;
        worldRef.current = createWorld(
          {
            chars: [p1, p2],
            teams: teams ?? undefined,
            stageId: stage,
            seed: (Math.random() * 2 ** 31) | 0,
            roundsToWin: setup.mode === "training" ? 99 : 2,
            roundTime: setup.mode === "training" ? -1 : 99,
            training: setup.mode === "training",
          },
          roster,
        );
        if (setup.mode !== "training") {
          const level = setup.mode === "arcade" ? (Math.min(3, 1 + Math.floor(setup.stageNo / 3)) as 1 | 2 | 3) : settings.difficulty;
          cpu.current = new CpuController(1, roster, level);
        }
      }
      setLoading(false);
      const startWorld = sessionRef.current?.world ?? worldRef.current;
      if (startWorld) audio.startMusic(startWorld.stageId);
      perf.current.reset();
      fightTel.current = new FightTelemetry({
        mode: setup.mode,
        p1,
        p2,
        stage: startWorld?.stageId ?? "",
        difficulty: setup.mode === "versus" || setup.mode === "team" ? settings.difficulty : undefined,
      });
      fightTel.current.start();
    })();
    return () => {
      cancelled = true;
      fightTel.current?.end(onlineStore.get().opponentLeft ? "abandoned" : "quit", perf.current);
      audio.stopMusic();
      void onlineRef.current?.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ loop
  const feel = useCallback(
    (events: readonly GameEvent[]) => {
      if (!app.get().settings.controls.hitHaptics) return;
      const f = hitFeel(events, localSide);
      if (!f || !hapticGate.current.allow(Date.now())) return;
      const style = f === "hurt" ? Haptics.ImpactFeedbackStyle.Heavy : f === "hit" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
      void Haptics.impactAsync(style).catch(() => undefined);
    },
    [localSide],
  );

  /** Entrada local do frame: atalho em andamento, senão o toque (traduzido no modo simples). */
  const localInput = useCallback(
    (w: WorldState): number => {
      const raw = inputRef.current;
      let base = raw;
      if (simple.current) {
        // modo simples: vira entrada normal aqui, antes da engine e da rede
        const me = w.fighters[localSide];
        base = simple.current.step(raw, simpleContextOf(me));
      }
      return macro.current.next() ?? base;
    },
    [localSide],
  );

  const tick = useCallback(() => {
    const session = sessionRef.current;
    if (session) {
      // se estivermos muito à frente do oponente, segura um frame de vez em quando
      if (session.framesAhead > 6 && session.world.frame % 4 === 0) return;
      session.advance(localInput(session.world));
      renderer.current.addEvents(session.events, session.world, roster);
      audio.update(session.world, session.events, roster);
      feel(session.events);
      return;
    }
    const w = worldRef.current;
    if (!w || pausedRef.current) return;
    const local = localInput(w);
    const p2Input = cpu.current ? cpu.current.next(w) : 0;
    stepWorld(w, [local, p2Input], roster);
    renderer.current.addEvents(w.events, w, roster);
    audio.update(w, w.events, roster);
    feel(w.events);
  }, [roster, localInput, feel]);

  useEffect(() => {
    if (loading) return;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let lastUi = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (last === 0) last = t;
      acc += Math.min(100, t - last);
      last = t;
      perf.current.frame(t);
      const simStart = now();
      let steps = 0;
      while (acc >= STEP_MS && steps < 4) {
        tick();
        acc -= STEP_MS;
        steps++;
      }
      if (steps > 0) perf.current.sim(now() - simStart);
      if (sessionRef.current) perf.current.setRollbacks(sessionRef.current.stats.rollbacks);
      const w = sessionRef.current?.world ?? worldRef.current;
      if (!w) return;
      const drawStart = now();
      const rec = Skia.PictureRecorder();
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
      renderer.current.draw(canvas, {
        world: w,
        roster,
        atlases: atlases.current,
        stageImages: stageImages.current[w.stageId],
        names,
        width,
        height,
        debugBoxes,
        banner: sessionRef.current?.stats.desync ? "DESSINCRONIA" : null,
      });
      picture.value = rec.finishRecordingAsPicture();
      perf.current.draw(now() - drawStart);

      if (t - lastUi > 200) {
        lastUi = t;
        const me = w.fighters[localSide];
        setPower(me.power);
        setMaxReady(me.power >= 1000 && me.maxTime === 0 && me.ctrl);
        setLocalChar(me.charId);
        if (w.matchWinner >= 0 && w.roundStateTime > 120 && !reported.current) {
          reported.current = true;
          if (w.matchWinner === 0 || w.matchWinner === 1) {
            const char = w.fighters[w.matchWinner].charId;
            setWinner({ char, quote: pickQuote(char) });
          }
          onlineRef.current?.reportResult(w.matchWinner === 2 ? null : w.matchWinner);
          fightTel.current?.end(resultFor(w.matchWinner, localSide), perf.current);
          setResult({ winner: w.matchWinner });
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, width, height, debugBoxes, tick]);

  const onAssist = useCallback(
    (id: string) => {
      const w = sessionRef.current?.world ?? worldRef.current;
      if (!w) return;
      if (id === "max") {
        macro.current.play(MAX_MACRO, w.fighters[localSide].facing);
        return;
      }
      const a = assists.find((x) => x.id === id);
      if (!a) return;
      const cmd = findCommand(roster[localChar], a.cmd);
      if (cmd) macro.current.play(macroFromCommand(cmd), w.fighters[localSide].facing);
    },
    [assists, roster, localChar, localSide],
  );

  const setPause = (v: boolean) => {
    pausedRef.current = v;
    setPaused(v);
    audio.duck(v);
  };

  // ---------------------------------------------------------- fim de luta
  const leave = async (to: "menu" | "rematch" | "select" | "next") => {
    audio.stopMusic();
    await onlineRef.current?.leave();
    await onMatchFinished();
    if (online) void fetchMe().catch(() => undefined);
    if (to === "menu") router.replace("/");
    else if (to === "select") {
      matchSetup.set({ p1: null, p2: null, team1: [], team2: [] });
      router.replace(online ? "/online" : "/select");
    } else if (to === "rematch") router.replace("/fight");
    else if (to === "next") {
      const [next, ...rest] = setup.ladder;
      matchSetup.set({ p2: next, ladder: rest, stageNo: setup.stageNo + 1 });
      router.replace("/fight");
    }
  };

  const continueWithAd = async () => {
    const ok = await showRewarded();
    if (ok) {
      matchSetup.set({ continues: setup.continues + 1 });
      router.replace("/fight");
    }
  };

  const won = result && result.winner === localSide;
  const arcadeDone = setup.mode === "arcade" && won && setup.ladder.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Canvas style={{ position: "absolute", left: 0, top: 0, width, height }}>
        <Picture picture={picture} />
      </Canvas>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {error ? (
            <>
              <Text style={[TYPE.BODY, { color: t.danger, marginBottom: space.md }]}>{error}</Text>
              <MetroButton label="Voltar" onPress={() => router.replace("/online")} />
            </>
          ) : (
            <>
              <MetroProgress />
              <Text style={[TYPE.BODY, { color: "#CCCCCC", marginTop: space.sm }]}>
                {online ? "Aguardando o oponente…" : "Carregando lutadores…"}
              </Text>
            </>
          )}
        </View>
      ) : (
        <TouchControls
          inputRef={inputRef}
          assists={assistButtons}
          onAssist={onAssist}
          haptics={settings.vibration}
          onPause={() => setPause(true)}
          layout={scheme}
          items={controlItems}
          opacity={controls.opacity}
          stickMode={controls.stick}
          deadZone={controls.deadZone}
          superReady={power >= 1000}
        />
      )}

      {online && !loading ? (
        <Text style={{ position: "absolute", top: 4, left: width / 2 + 50, color: ping > 150 ? t.danger : t.accentText, fontSize: 11 }}>
          {ping} ms
        </Text>
      ) : null}
      {setup.mode === "arcade" && !loading ? (
        <Text style={{ position: "absolute", top: 4, left: width / 2 - 140, color: "#CCCCCC", fontSize: 11 }}>
          LUTA {setup.stageNo}/{setup.stageNo + setup.ladder.length}
        </Text>
      ) : null}

      {showPerf && !loading ? <PerfOverlay monitor={perf.current} /> : null}

      {paused ? (
        <Overlay t={t} title="PAUSA">
          {!online ? <MetroButton kind="primary" label="Continuar" onPress={() => setPause(false)} /> : null}
          {setup.mode === "training" ? (
            <MetroButton label={debugBoxes ? "Esconder caixas" : "Mostrar caixas"} onPress={() => setDebugBoxes((v) => !v)} />
          ) : null}
          {!online ? <MetroButton label="Reiniciar" onPress={() => router.replace("/fight")} /> : null}
          <MetroButton label={online ? "Desistir" : "Sair da luta"} onPress={() => void leave("menu")} />
          {online ? <MetroButton label="Voltar à luta" onPress={() => setPause(false)} /> : null}
        </Overlay>
      ) : null}

      {opponentLeft && !result ? (
        <Overlay t={t} title="OPONENTE SAIU">
          <Text style={[TYPE.BODY, { color: t.text }]}>Vitória por abandono.</Text>
          <MetroButton kind="primary" label="Menu" onPress={() => void leave("menu")} />
        </Overlay>
      ) : null}

      {result ? (
        <Overlay t={t} title={result.winner === 2 ? "EMPATE" : won ? (arcadeDone ? "CAMPEÃO!" : "VITÓRIA!") : "DERROTA"}>
          {winner?.quote ? (
            <Text style={[TYPE.BODY, { color: t.text }]}>
              <Text style={{ color: t.accentText }}>{roster[winner.char]?.displayName ?? winner.char}: </Text>“{winner.quote}”
            </Text>
          ) : null}
          {online && finished?.ratings ? (
            <Text style={[TYPE.BODY, { color: t.text }]}>Novo rating: {finished.ratings[String(localSide)]}</Text>
          ) : null}
          {online && finished?.disputed ? <Text style={[TYPE.BODY, { color: t.danger }]}>Resultado em disputa — não contou para o ranking.</Text> : null}
          {setup.mode === "arcade" ? (
            won && !arcadeDone ? (
              <MetroButton kind="primary" label="Próxima luta" onPress={() => void leave("next")} />
            ) : !won ? (
              <>
                <MetroButton kind="primary" label={app.get().premium ? "Continuar" : "Continuar (assistir anúncio)"} onPress={() => void continueWithAd()} />
                <MetroButton label="Desistir" onPress={() => void leave("menu")} />
              </>
            ) : (
              <MetroButton kind="primary" label="Menu" onPress={() => void leave("menu")} />
            )
          ) : online ? (
            <>
              <MetroButton kind="primary" label="Nova partida" onPress={() => void leave("select")} />
              <MetroButton label="Menu" onPress={() => void leave("menu")} />
            </>
          ) : (
            <>
              <MetroButton kind="primary" label="Revanche" onPress={() => void leave("rematch")} />
              <MetroButton label="Trocar lutadores" onPress={() => void leave("select")} />
              <MetroButton label="Menu" onPress={() => void leave("menu")} />
            </>
          )}
        </Overlay>
      ) : null}
    </View>
  );
}

function emptyPicture(): SkPicture {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
}

/** Painel W10M sobre a luta: fundo escurecido 60%, 480 dp no centro, título leve à esquerda. */
function Overlay({ t, title, children }: { t: Tokens; title: string; children: React.ReactNode }) {
  return (
    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: t.scrim, alignItems: "center", justifyContent: "center" }}>
      <View accessibilityViewIsModal style={{ width: 480, maxWidth: "92%", gap: space.sm, padding: space.lg, backgroundColor: t.chrome }}>
        <Text accessibilityRole="header" style={[TYPE.HEADER, { color: t.text, marginBottom: space.sm }]}>
          {title.toLowerCase()}
        </Text>
        {children}
      </View>
    </View>
  );
}
