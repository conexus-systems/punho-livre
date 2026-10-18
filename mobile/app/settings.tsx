import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";

import { MetroButton, MetroCheck, MetroDialog, MetroGroup, MetroHeader, MetroPage, MetroPivot, MetroRow, MetroSlider, MetroTextField, MetroToggle } from "@/components/metro";
import { devOptions, setDevOption } from "@/src/services/devOptions";
import { setTelemetryConsent, telemetryStore } from "@/src/services/telemetry";
import { setControls, setSetting } from "@/src/settings";
import { app } from "@/src/store";
import { colorName, ESSENTIALS, forWhiteText, MORE, parseLoose } from "@/src/ui/accent";
import { setTheme, themeStore } from "@/src/ui/theme";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

const DIFFICULTY = { 1: "Fácil", 2: "Normal", 3: "Difícil" } as const;
const SPEED = { 50: "Lenta", 100: "Normal", 150: "Rápida" } as const;

/** Ajustes (W10M): jogo, personalização (tema e cor de destaque) e sobre. */
export default function Settings() {
  const t = useTokens();
  const settings = app.use((s) => s.settings);
  const theme = themeStore.use((s) => s);
  const [pivot, setPivot] = useState(0);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [moreColors, setMoreColors] = useState(false);
  const [custom, setCustom] = useState("");
  const customParsed = parseLoose(custom);
  const telemetry = telemetryStore.use((s) => s.consent);
  const dev = devOptions.use((s) => s);
  const [versionTaps, setVersionTaps] = useState(0);

  const swatch = (hex: string, name: string) => {
    const selected = theme.accent.toUpperCase() === hex.toUpperCase();
    return (
      <Pressable
        key={hex}
        accessibilityRole="radio"
        accessibilityLabel={name}
        accessibilityState={{ checked: selected }}
        onPress={() => setTheme({ accent: hex })}
        style={{ width: 56, height: 56, backgroundColor: forWhiteText(hex), borderWidth: selected ? 3 : 0, borderColor: t.text }}
      />
    );
  };

  return (
    <MetroPage>
      <MetroHeader title="Ajustes" actions={<MetroButton kind="text" label="Voltar" onPress={() => router.back()} />} />
      <MetroPivot sections={["Jogo", "Personalização", "Sobre"]} index={pivot} onChange={setPivot}>
        <ScrollView contentContainerStyle={{ paddingBottom: space.lg, maxWidth: 640 }}>
          {pivot === 0 ? (
            <>
              <MetroToggle
                label="Especiais em um toque"
                description="Botões que executam o comando do especial/super inteiro (meia-lua etc.)."
                value={settings.assist}
                onChange={(v) => setSetting("assist", v)}
              />
              <MetroToggle label="Vibração nos botões" description="Toque nos botões da luta." value={settings.vibration} onChange={(v) => setSetting("vibration", v)} />
              <MetroToggle
                label="Vibração em acertos"
                description="Ao acertar, apanhar e defender (mais forte quando você apanha)."
                value={settings.controls.hitHaptics}
                onChange={(v) => setControls({ hitHaptics: v })}
              />
              <MetroToggle label="Música" description="Uma trilha para cada cenário." value={settings.music} onChange={(v) => setSetting("music", v)} />
              <MetroToggle label="Efeitos sonoros" description="Golpes, defesa, K.O. e anúncios." value={settings.sfx} onChange={(v) => setSetting("sfx", v)} />
              <MetroGroup title="Controles" />
              <MetroCheck
                kind="radio"
                label="Simples"
                description="Especial + direção solta os 4 especiais; Super com barra; toques no Soco fazem um combo curto."
                checked={settings.controls.mode === "simple"}
                onChange={() => setControls({ mode: "simple" })}
              />
              <MetroCheck
                kind="radio"
                label="Clássico"
                description="Comandos de verdade (meia-lua + botão), com os botões escolhidos abaixo."
                checked={settings.controls.mode === "classic"}
                onChange={() => setControls({ mode: "classic" })}
              />
              <MetroGroup title="Direcional" />
              <MetroCheck
                kind="radio"
                label="Flutuante"
                description="Aparece onde o polegar toca, na metade esquerda."
                checked={settings.controls.stick === "floating"}
                onChange={() => setControls({ stick: "floating" })}
              />
              <MetroCheck
                kind="radio"
                label="Fixo"
                description="Sempre no mesmo lugar (ajuste no editor de layout)."
                checked={settings.controls.stick === "fixed"}
                onChange={() => setControls({ stick: "fixed" })}
              />
              <MetroSlider
                label="Zona morta"
                value={settings.controls.deadZone}
                min={6}
                max={40}
                step={2}
                format={(v) => `${v} dp`}
                onChange={(v) => setControls({ deadZone: v })}
              />
              <Text style={[TYPE.CAPTION, { color: t.muted }]}>Quanto o polegar anda antes de contar como direção. As 8 direções têm folga para a diagonal não escorregar.</Text>
              <MetroRow title="Editar layout" secondary="Arrastar, redimensionar, opacidade e padrão." glyph="settings" onPress={() => router.push("/controls")} />
              <MetroGroup title="Botões do modo clássico" />
              <MetroCheck
                kind="radio"
                label="4 botões (padrão SNK)"
                checked={settings.buttons === "snk"}
                onChange={() => setSetting("buttons", "snk")}
              />
              <Text style={[TYPE.CAPTION, { color: t.muted }]}>A e B fracos, C e D fortes, com atalhos A+B (rolamento) e C+D (blowback).</Text>
              <MetroCheck kind="radio" label="6 botões (MUGEN)" checked={settings.buttons === "mugen"} onChange={() => setSetting("buttons", "mugen")} />
              <MetroRow title="Dificuldade da CPU" secondary={DIFFICULTY[settings.difficulty]} glyph="versus" onPress={() => setDifficultyOpen(true)} />
              <MetroSlider
                label="Atraso de input online"
                value={settings.inputDelay}
                min={1}
                max={4}
                format={(v) => `${v} ${v === 1 ? "frame" : "frames"}`}
                onChange={(v) => setSetting("inputDelay", v)}
              />
              <Text style={[TYPE.CAPTION, { color: t.muted }]}>Menos atraso = resposta mais rápida, mais correções (rollback) em conexões ruins.</Text>
            </>
          ) : null}

          {pivot === 1 ? (
            <>
              <MetroGroup title="Tema" />
              <MetroCheck kind="radio" label="Escuro" checked={theme.mode === "dark"} onChange={() => setTheme({ mode: "dark" })} />
              <MetroCheck kind="radio" label="Claro" checked={theme.mode === "light"} onChange={() => setTheme({ mode: "light" })} />
              <MetroGroup title={`Cor de destaque · ${colorName(theme.accent)}`} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{ESSENTIALS.map(([n, c]) => swatch(c, n))}</View>
              <MetroButton kind="text" label={moreColors ? "Menos cores" : "Mais cores"} onPress={() => setMoreColors((v) => !v)} />
              {moreColors ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{MORE.map(([n, c]) => swatch(c, n))}</View> : null}
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, marginTop: space.md }}>
                <View style={{ width: 220 }}>
                  <MetroTextField
                    label="Cor personalizada"
                    value={custom}
                    onChangeText={setCustom}
                    placeholder="#1BA1E2"
                    autoCapitalize="characters"
                    error={custom && !customParsed ? "Use #RRGGBB (ex.: #1BA1E2)." : null}
                  />
                </View>
                {customParsed ? <View style={{ width: 40, height: 40, backgroundColor: forWhiteText(customParsed) }} /> : null}
                <MetroButton kind="primary" label="Aplicar cor" disabled={!customParsed} onPress={() => customParsed && setTheme({ accent: customParsed })} />
              </View>
              <MetroGroup title="Movimento" />
              <MetroToggle label="Animações" description="Entrada das páginas, pivôs e flip dos blocos." value={theme.animations} onChange={(v) => setTheme({ animations: v })} />
              <View style={{ flexDirection: "row", gap: space.md }}>
                {([50, 100, 150] as const).map((s) => (
                  <MetroCheck key={s} kind="radio" label={SPEED[s]} checked={theme.speed === s} onChange={() => setTheme({ speed: s })} />
                ))}
              </View>
            </>
          ) : null}

          {pivot === 2 ? (
            <>
              <MetroRow
                title="MUGEN Arena"
                secondary={`Versão ${Constants.expoConfig?.version ?? "?"}`}
                onPress={() => {
                  // 7 toques na versão liberam as opções de desenvolvedor (QA)
                  const n = versionTaps + 1;
                  setVersionTaps(n);
                  if (n >= 7 && !dev.unlocked) setDevOption({ unlocked: true });
                }}
              />
              <MetroGroup title="Privacidade" />
              <MetroToggle
                label="Enviar dados de uso e falhas"
                description="Anônimos: modo de jogo, duração das lutas, desempenho (fps) e erros do app. Sem nome, e-mail, conta ou identificador do aparelho. Desligar apaga o que ainda não foi enviado."
                value={telemetry === true}
                onChange={(v) => setTelemetryConsent(v)}
              />
              {dev.unlocked ? (
                <>
                  <MetroGroup title="Desenvolvedor" />
                  <MetroToggle
                    label="Overlay de desempenho"
                    description="fps, tempo de quadro, simulação, desenho e rollbacks durante a luta."
                    value={dev.perfOverlay}
                    onChange={(v) => setDevOption({ perfOverlay: v })}
                  />
                  <MetroRow title="Modo bench" secondary="Luta fixa CPU × CPU por 60 s; mostra e exporta os números." onPress={() => router.push("/bench")} />
                  <MetroRow title="Esconder opções de desenvolvedor" onPress={() => {
                      setVersionTaps(0);
                      setDevOption({ unlocked: false, perfOverlay: false });
                    }} />
                </>
              ) : null}
              <MetroGroup title="Sobre" />
              <MetroRow title="Engine" secondary="Compatível com o formato de personagens do MUGEN (.def, .air, .cmd, .cns, .sff). Não usa código da Elecbyte." />
              <MetroRow
                title="Sistema de luta"
                secondary="Inspirado nos jogos da SNK: rolamento, blowback, arremesso com escape, guard cancel, Just Defend, guard crush, modo MAX e equipes 3×3. Personagens e arte originais."
              />
              <MetroRow title="Elenco nativo" secondary="20 lutadores originais da CONEXUS, de Kaze a Kai." />
              <MetroRow title="Conta, pagamentos e mensagens" secondary="Plataforma CONEXUS (bff-auth, bff-payment, bff-api)." />
              <MetroRow title="Anúncios" secondary="Google AdMob. Premium remove os anúncios." />
            </>
          ) : null}
        </ScrollView>
      </MetroPivot>

      <MetroDialog visible={difficultyOpen} title="Dificuldade da CPU" negative="Fechar" onNegative={() => setDifficultyOpen(false)}>
        {([1, 2, 3] as const).map((d) => (
          <MetroCheck
            key={d}
            kind="radio"
            label={DIFFICULTY[d]}
            checked={settings.difficulty === d}
            onChange={() => {
              setSetting("difficulty", d);
              setDifficultyOpen(false);
            }}
          />
        ))}
      </MetroDialog>
    </MetroPage>
  );
}
