import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Canvas, Picture, Skia, type SkImage, type SkPicture } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";

import { ArcadeButton } from "@/components/ArcadeButton";
import { TouchControls, type AssistButton } from "@/components/TouchControls";
import { colors, spacing } from "@/constants/theme";
import { BUILTIN } from "@/src/characters/builtin.generated";
import { getCharacter, rosterFor } from "@/src/characters/registry";
import type { Roster } from "@/src/engine/fighter";
import type { WorldState } from "@/src/engine/types";
import { createWorld, stepWorld } from "@/src/engine/world";
import { CpuController } from "@/src/game/ai";
import { loadAtlases } from "@/src/game/atlas";
import { findCommand, macroFromCommand, MacroPlayer, motionCommands } from "@/src/game/macros";
import { FightRenderer } from "@/src/game/renderer";
import { STAGES } from "@/src/game/stages";
import { matchSetup } from "@/src/match";
import { joinMatch, onlineStore, type OnlineMatchHandle } from "@/src/net/online";
import type { RollbackSession } from "@/src/net/rollback";
import { onMatchFinished, showRewarded } from "@/src/services/ads";
import { fetchMe } from "@/src/services/api";
import { app } from "@/src/store";

const STEP_MS = 1000 / 60;

interface Assist {
  id: string;
  label: string;
  cmd: string;
  isSuper: boolean;
}

function assistsFor(charId: string): Assist[] {
  const builtin = BUILTIN[charId];
  if (builtin) {
    return [
      ...builtin.meta.specials.map((s, i) => ({ id: `sp${i}`, label: s.name, cmd: s.cmd, isSuper: false })),
      { id: "super", label: "SUPER", cmd: builtin.meta.super.cmd, isSuper: true },
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
  const online = setup.mode === "online" && setup.online !== null;

  const p1 = online ? (setup.online!.side === 0 ? setup.online!.myCharacter : setup.online!.opponent.character) : setup.p1!;
  const p2 = online ? (setup.online!.side === 0 ? setup.online!.opponent.character : setup.online!.myCharacter) : setup.p2!;
  const localSide: 0 | 1 = online ? setup.online!.side : 0;
  const localChar = localSide === 0 ? p1 : p2;

  const roster: Roster = useMemo(() => rosterFor([p1, p2]), [p1, p2]);
  const names: [string, string] = [roster[p1].displayName, roster[p2].displayName];

  const picture = useSharedValue<SkPicture>(emptyPicture());
  const inputRef = useRef(0);
  const macro = useRef(new MacroPlayer());
  const renderer = useRef(new FightRenderer());
  const worldRef = useRef<WorldState | null>(null);
  const sessionRef = useRef<RollbackSession | null>(null);
  const onlineRef = useRef<OnlineMatchHandle | null>(null);
  const cpu = useRef<CpuController | null>(null);
  const atlases = useRef<Record<string, SkImage[]>>({});
  const pausedRef = useRef(false);
  const reported = useRef(false);

  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ winner: number } | null>(null);
  const [superReady, setSuperReady] = useState(false);
  const [debugBoxes, setDebugBoxes] = useState(setup.mode === "training");
  const [error, setError] = useState<string | null>(null);
  const finished = onlineStore.use((s) => s.finished);
  const opponentLeft = onlineStore.use((s) => s.opponentLeft);
  const ping = onlineStore.use((s) => s.ping);

  const assists = useMemo(() => assistsFor(localChar), [localChar]);
  const assistButtons: AssistButton[] = settings.assist
    ? assists.map((a) => ({ id: a.id, label: a.label, enabled: !a.isSuper || superReady }))
    : [];

  // ------------------------------------------------------------ setup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      atlases.current = await loadAtlases([p1, p2]);
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
          cpu.current = new CpuController(1, roster[p2], level);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      void onlineRef.current?.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ loop
  const tick = useCallback(() => {
    const local = macro.current.next() ?? inputRef.current;
    const session = sessionRef.current;
    if (session) {
      // se estivermos muito à frente do oponente, segura um frame de vez em quando
      if (session.framesAhead > 6 && session.world.frame % 4 === 0) return;
      session.advance(local);
      renderer.current.addEvents(session.events, session.world, roster);
      return;
    }
    const w = worldRef.current;
    if (!w || pausedRef.current) return;
    const p2Input = cpu.current ? cpu.current.next(w) : 0;
    stepWorld(w, [local, p2Input], roster);
    renderer.current.addEvents(w.events, w, roster);
  }, [roster]);

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
      let steps = 0;
      while (acc >= STEP_MS && steps < 4) {
        tick();
        acc -= STEP_MS;
        steps++;
      }
      const w = sessionRef.current?.world ?? worldRef.current;
      if (!w) return;
      const rec = Skia.PictureRecorder();
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
      renderer.current.draw(canvas, {
        world: w,
        roster,
        atlases: atlases.current,
        names,
        width,
        height,
        debugBoxes,
        banner: sessionRef.current?.stats.desync ? "DESSINCRONIA" : null,
      });
      picture.value = rec.finishRecordingAsPicture();

      if (t - lastUi > 200) {
        lastUi = t;
        setSuperReady(w.fighters[localSide].power >= 1000);
        if (w.matchWinner >= 0 && w.roundStateTime > 120 && !reported.current) {
          reported.current = true;
          onlineRef.current?.reportResult(w.matchWinner === 2 ? null : w.matchWinner);
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
      const a = assists.find((x) => x.id === id);
      const w = sessionRef.current?.world ?? worldRef.current;
      if (!a || !w) return;
      const cmd = findCommand(roster[localChar], a.cmd);
      if (cmd) macro.current.play(macroFromCommand(cmd), w.fighters[localSide].facing);
    },
    [assists, roster, localChar, localSide],
  );

  const setPause = (v: boolean) => {
    pausedRef.current = v;
    setPaused(v);
  };

  // ---------------------------------------------------------- fim de luta
  const leave = async (to: "menu" | "rematch" | "select" | "next") => {
    await onlineRef.current?.leave();
    await onMatchFinished();
    if (online) void fetchMe().catch(() => undefined);
    if (to === "menu") router.replace("/");
    else if (to === "select") {
      matchSetup.set({ p1: null, p2: null });
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
              <Text style={{ color: colors.error, marginBottom: spacing.md }}>{error}</Text>
              <ArcadeButton label="VOLTAR" onPress={() => router.replace("/online")} />
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.inkSecondary, marginTop: spacing.sm }}>
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
        />
      )}

      {online && !loading ? (
        <Text style={{ position: "absolute", top: 4, left: width / 2 + 50, color: ping > 150 ? colors.error : colors.success, fontSize: 11 }}>
          {ping} ms
        </Text>
      ) : null}
      {setup.mode === "arcade" && !loading ? (
        <Text style={{ position: "absolute", top: 4, left: width / 2 - 140, color: colors.inkSecondary, fontSize: 11 }}>
          LUTA {setup.stageNo}/{setup.stageNo + setup.ladder.length}
        </Text>
      ) : null}

      {paused ? (
        <Overlay title="PAUSA">
          {!online ? <ArcadeButton variant="primary" label="CONTINUAR" onPress={() => setPause(false)} /> : null}
          {setup.mode === "training" ? (
            <ArcadeButton label={debugBoxes ? "ESCONDER CAIXAS" : "MOSTRAR CAIXAS"} onPress={() => setDebugBoxes((v) => !v)} />
          ) : null}
          {!online ? <ArcadeButton label="REINICIAR" onPress={() => router.replace("/fight")} /> : null}
          <ArcadeButton variant="danger" label={online ? "DESISTIR" : "SAIR"} onPress={() => void leave("menu")} />
          {online ? <ArcadeButton label="VOLTAR À LUTA" onPress={() => setPause(false)} /> : null}
        </Overlay>
      ) : null}

      {opponentLeft && !result ? (
        <Overlay title="OPONENTE SAIU">
          <Text style={{ color: colors.inkSecondary }}>Vitória por abandono.</Text>
          <ArcadeButton variant="primary" label="MENU" onPress={() => void leave("menu")} />
        </Overlay>
      ) : null}

      {result ? (
        <Overlay title={result.winner === 2 ? "EMPATE" : won ? (arcadeDone ? "CAMPEÃO!" : "VITÓRIA!") : "DERROTA"}>
          {online && finished?.ratings ? (
            <Text style={{ color: colors.inkSecondary }}>Novo rating: {finished.ratings[String(localSide)]}</Text>
          ) : null}
          {online && finished?.disputed ? <Text style={{ color: colors.error }}>Resultado em disputa — não contou para o ranking.</Text> : null}
          {setup.mode === "arcade" ? (
            won && !arcadeDone ? (
              <ArcadeButton variant="primary" label="PRÓXIMA LUTA" onPress={() => void leave("next")} />
            ) : !won ? (
              <>
                <ArcadeButton variant="primary" label="CONTINUAR" sublabel={app.get().premium ? undefined : "Assista a um anúncio"} onPress={() => void continueWithAd()} />
                <ArcadeButton label="DESISTIR" onPress={() => void leave("menu")} />
              </>
            ) : (
              <ArcadeButton variant="primary" label="MENU" onPress={() => void leave("menu")} />
            )
          ) : online ? (
            <>
              <ArcadeButton variant="online" label="NOVA PARTIDA" onPress={() => void leave("select")} />
              <ArcadeButton label="MENU" onPress={() => void leave("menu")} />
            </>
          ) : (
            <>
              <ArcadeButton variant="primary" label="REVANCHE" onPress={() => void leave("rematch")} />
              <ArcadeButton label="TROCAR LUTADORES" onPress={() => void leave("select")} />
              <ArcadeButton label="MENU" onPress={() => void leave("menu")} />
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

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center" }}>
      <View style={{ minWidth: 300, gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border }}>
        <Text style={{ color: colors.primary, fontSize: 30, fontWeight: "900", textAlign: "center", marginBottom: spacing.sm }}>{title}</Text>
        {children}
      </View>
    </View>
  );
}
