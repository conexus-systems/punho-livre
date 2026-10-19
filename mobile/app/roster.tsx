import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { MetroButton, MetroDialog, MetroEmpty, MetroGroup, MetroHeader, MetroMenu, MetroPage, MetroPivot, MetroProgress, MetroRow, type MenuItem } from "@/components/metro";
import { BUILTIN_ORDER, BUILTIN } from "@/src/characters/builtin.generated";
import { install, rosterStore, uninstall } from "@/src/characters/registry";
import { fetchCatalog, fetchPendingCharacters, reviewCharacter, type CharacterSummary } from "@/src/services/api";
import { app } from "@/src/store";
import { bytes, relative } from "@/src/ui/formats";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

export default function RosterScreen() {
  const t = useTokens();
  const installed = rosterStore.use((s) => s.installed);
  const admin = app.use((s) => s.player?.admin === true);
  const [pivot, setPivot] = useState(0);
  const [catalog, setCatalog] = useState<CharacterSummary[] | null>(null);
  const [pending, setPending] = useState<CharacterSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ anchor: { x: number; y: number }; items: MenuItem[] } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => void } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCatalog(await fetchCatalog());
      if (admin) setPending(await fetchPendingCharacters());
    } catch (err) {
      setError((err as Error).message);
      setCatalog([]);
    }
  }, [admin]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (slug: string, fn: () => Promise<void>) => {
    setBusy(slug);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sections = admin ? ["Catálogo", "Instalados", "Revisão"] : ["Catálogo", "Instalados", "Enviar"];

  return (
    <MetroPage>
      <MetroHeader title="Personagens" actions={<MetroButton kind="text" label="Voltar" onPress={() => router.back()} />} />
      <MetroPivot sections={sections} index={pivot} onChange={setPivot}>
        <ScrollView contentContainerStyle={{ paddingBottom: space.lg }}>
          {error ? <Text style={[TYPE.BODY, { color: t.danger }]}>{error}</Text> : null}

          {pivot === 0 ? (
            catalog === null ? (
              <MetroProgress />
            ) : catalog.length === 0 ? (
              <MetroEmpty
                title="Nenhum personagem extra publicado ainda"
                detail="Os 6 lutadores nativos já estão no jogo. Personagens enviados aparecem aqui depois da revisão."
                action={<MetroButton label="Atualizar" glyph="refresh" onPress={() => void load()} style={{ alignSelf: "flex-start" }} />}
              />
            ) : (
              catalog.map((c) => {
                const mine = installed.find((i) => i.slug === c.slug);
                const outdated = Boolean(mine && mine.sha256 !== c.sha256);
                return (
                  <MetroRow
                    key={c.slug}
                    title={c.name}
                    secondary={`por ${c.author} · v${c.version} · ${bytes(c.size_bytes)} · ${relative(c.updated_at)}`}
                    glyph={mine && !outdated ? "check" : "download"}
                    selected={Boolean(mine)}
                    right={
                      busy === c.slug ? (
                        <MetroProgress compact />
                      ) : mine && !outdated ? (
                        <Text style={[TYPE.CAPTION, { color: t.accentText }]}>instalado</Text>
                      ) : (
                        <MetroButton kind="primary" label={outdated ? "Atualizar" : "Baixar"} onPress={() => void act(c.slug, () => install(c))} />
                      )
                    }
                    onLongPress={
                      mine
                        ? (e) =>
                            setMenu({
                              anchor: { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY },
                              items: [{ label: "Remover do aparelho", glyph: "delete", destructive: true, onPress: () => void act(c.slug, () => uninstall(c.slug)) }],
                            })
                        : undefined
                    }
                  />
                );
              })
            )
          ) : null}

          {pivot === 1 ? (
            <View>
              <MetroGroup title="Nativos" />
              {BUILTIN_ORDER.map((id) => (
                <MetroRow key={id} title={BUILTIN[id].meta.name} secondary={BUILTIN[id].meta.bio} glyph="characters" />
              ))}
              <MetroGroup title="Baixados" />
              {installed.length === 0 ? <Text style={[TYPE.CAPTION, { color: t.muted }]}>Nenhum ainda — veja o catálogo.</Text> : null}
              {installed.map((i) => (
                <MetroRow
                  key={i.slug}
                  title={i.name}
                  secondary={`v${i.version} · sha ${i.sha256.slice(0, 12)}`}
                  glyph="characters"
                  right={
                    <MetroButton
                      label="Remover"
                      onPress={() => setConfirm({ title: `Remover ${i.name}?`, message: "Você pode baixar de novo pelo catálogo.", label: "Remover", run: () => void act(i.slug, () => uninstall(i.slug)) })}
                    />
                  }
                />
              ))}
            </View>
          ) : null}

          {pivot === 2 && !admin ? (
            <View style={{ gap: space.sm, maxWidth: 560 }}>
              <Text style={[TYPE.BODY, { color: t.text }]}>
                O MUGEN Arena lê personagens no formato do MUGEN (.def, .air, .cmd, .cns e sprites .sff). Para enviar um, rode na pasta mobile do projeto:
              </Text>
              <Text selectable style={[TYPE.BODY, { color: t.accentText, fontFamily: "monospace" }]}>
                npm run pack -- pasta/do/personagem --upload {"<API>"} --token {"<JWT>"}
              </Text>
              <Text style={[TYPE.CAPTION, { color: t.muted }]}>
                Ele entra em revisão; aprovado, aparece no catálogo para todos e você recebe um e-mail. Envie só personagens que você tem direito de distribuir.
              </Text>
            </View>
          ) : null}

          {pivot === 2 && admin ? (
            pending.length === 0 ? (
              <MetroEmpty title="Nada para revisar" detail="Envios novos aparecem aqui." action={<MetroButton label="Atualizar" glyph="refresh" onPress={() => void load()} style={{ alignSelf: "flex-start" }} />} />
            ) : (
              pending.map((c) => (
                <MetroRow
                  key={`${c.slug}-${c.sha256}`}
                  title={c.name}
                  secondary={`por ${c.author} · ${bytes(c.size_bytes)} · ${relative(c.updated_at)}`}
                  glyph="upload"
                  right={
                    <View style={{ flexDirection: "row", gap: space.sm }}>
                      <MetroButton kind="primary" label="Aprovar" onPress={() => void act(c.slug, async () => { await reviewCharacter(c.slug, "approved"); await load(); })} />
                      <MetroButton label="Recusar" onPress={() => void act(c.slug, async () => { await reviewCharacter(c.slug, "rejected", { reason: "Não aprovado na revisão" }); await load(); })} />
                    </View>
                  }
                />
              ))
            )
          ) : null}
        </ScrollView>
      </MetroPivot>

      <MetroMenu anchor={menu?.anchor ?? null} items={menu?.items ?? []} onClose={() => setMenu(null)} />
      <MetroDialog
        visible={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message}
        positive={confirm?.label}
        negative="Cancelar"
        onPositive={() => {
          confirm?.run();
          setConfirm(null);
        }}
        onNegative={() => setConfirm(null)}
      />
    </MetroPage>
  );
}
