import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";

import { MetroButton, MetroCheck, MetroDialog, MetroGroup, MetroHeader, MetroPage, MetroPivot, MetroRow, MetroSlider, MetroTextField, MetroToggle } from "@/components/metro";
import { setSetting } from "@/src/settings";
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
              <MetroToggle label="Vibração" description="Toque nos botões da luta." value={settings.vibration} onChange={(v) => setSetting("vibration", v)} />
              <MetroToggle label="Música" description="Uma trilha para cada cenário." value={settings.music} onChange={(v) => setSetting("music", v)} />
              <MetroToggle label="Efeitos sonoros" description="Golpes, defesa, K.O. e anúncios." value={settings.sfx} onChange={(v) => setSetting("sfx", v)} />
              <MetroToggle
                label="Reduzir movimento"
                description="Sem tremor de tela e zoom nos impactos; flashes mais fracos."
                value={settings.reduceMotion}
                onChange={(v) => setSetting("reduceMotion", v)}
              />
              <MetroGroup title="Botões" />
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
              <MetroRow title="MUGEN Arena" secondary={`Versão ${Constants.expoConfig?.version ?? "?"}`} />
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
