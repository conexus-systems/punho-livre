# Laboratório de aparelhos — BAMBA

Fase 0 do roadmap comercial: medir antes de otimizar. Este documento diz **o que medir, em quais
aparelhos, como medir e onde ficam os números**. Dono: QA/Performance + Security/DevOps.

> **Estado em 18/10/2026: nenhum aparelho real foi testado.** Tudo abaixo marcado como "medido" foi
> medido em contêiner Linux (CPU Xeon 2,1 GHz compartilhada, sem GPU), não em telefone. As colunas de
> aparelho da matriz estão vazias de propósito.

## Metas

| Meta | Alvo | Como medir | Onde aparece |
|---|---|---|---|
| Fluidez | 60 fps estáveis em Android intermediário (4 GB) | bench no app (60 s) + overlay em luta real | `fps_avg ≥ 59`, `fps_p5 ≥ 55`, `long_frames ≤ 0,5 %` dos quadros |
| Atraso de toque | ≤ 4 quadros (66,7 ms) do dedo ao primeiro pixel do golpe | câmera lenta (abaixo) | planilha do laboratório |
| Estabilidade | sessões sem crash ≥ 99,5 % | Android vitals / Xcode Organizer + telemetria `crash` | console das lojas, `telemetry_events` |
| Download inicial | ≤ 150 MB | `npm run size` + AAB do EAS | CI (`Mobile budget`), release |

## Ferramentas do laboratório

| Ferramenta | O que faz | Como usar |
|---|---|---|
| Overlay de desempenho | fps médio e p5, tempo de quadro p95, simulação p95, desenho p95, rollbacks (janela de 500 ms) | Sempre ligado no build de desenvolvimento. No APK: Ajustes › Sobre › tocar 7× em "BAMBA" › Desenvolvedor › Overlay de desempenho |
| Modo bench (app) | Luta fixa CPU × CPU por 60 s com o mesmo laço e renderizador da luta; mostra e **exporta** o JSON (compartilhar) | Ajustes › Sobre › Desenvolvedor › Modo bench (tela `/bench`) |
| `?bench=1` (web) | A mesma luta fixa na versão web (`mobile/play`), resultado no painel, "Baixar JSON" e `window.__MUGEN_BENCH__` | `npm run play:build` e abrir `play/dist/index.html?bench=1`; `?perf=1` liga só o overlay |
| `npm run bench` | Engine pura em Node: frames/s da simulação e do rollback (8 frames re-simulados por frame) | `BENCH_JSON=out/bench-engine.json npm run bench` |
| `npm run bench:web` | `?bench=1` num Chromium headless (Playwright) | `BENCH_JSON=out/bench-web.json npm run bench:web` |
| `npm run size` | Export Android do Expo contra `mobile/size-budget.json`; com `--apk` mede APK/AAB | ver § Tamanho |

**Luta fixa do bench** (`mobile/src/services/benchFight.ts`): Kaze × Brasa, cenário `dojo`, semente
`20261018`, IA nível 3 nos dois lados com gerador xorshift próprio (não usa `Math.random`), 99 rounds;
se a luta acabar antes dos 60 s recomeça com semente derivada. Mesma luta em todo aparelho ⇒ números
comparáveis entre aparelhos e versões.

**O que cada número mede** (`mobile/src/services/perf.ts`):
- `fps_avg` = quadros / tempo; `fps_p5` = 1000 / p95 do intervalo entre quadros (os 5 % piores);
  `long_frames` = intervalos > 33 ms (travada visível). Intervalo vem do `requestAnimationFrame` do JS.
- `sim_ms_p95` = todos os passos de simulação de um quadro (no online inclui a re-simulação do rollback).
- `draw_ms_p95` = **gravação** da `SkPicture` no JS (app) ou desenho no Canvas 2D (web). No app o
  desenho na GPU acontece na thread de UI e **não** entra nesse número: para ele use
  `adb shell dumpsys gfxinfo br.com.conexus.bamba framestats` ou Perfetto (Android) e
  Instruments › Core Animation (iOS).
- Amostragem: histograma de baldes de 0,25 ms, O(1) por quadro, sem alocação; percentis só quando o
  overlay (2×/s) ou o fim da luta pedem.

## Matriz de aparelhos

Escolher um aparelho por linha (de preferência os mais vendidos no Brasil na faixa). Anotar modelo,
SoC, RAM, Android/iOS, resolução, taxa de atualização e o JSON do bench.

| # | Sistema | RAM | Tela | Faixa | Prioridade | Modelo | fps_avg / p5 | Toque (quadros) | Status |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Android 10 | 3 GB | 16:9 HD | entrada antiga | alta (piso) | — | — | — | não testado |
| A2 | Android 11 | 3 GB | 19,5:9 HD+ | entrada | alta | — | — | — | não testado |
| A3 | Android 12 | 4 GB | 20:9 HD+ | **intermediário (meta 60 fps)** | crítica | — | — | — | não testado |
| A4 | Android 13 | 4 GB | 20:9 FHD+ 90 Hz | intermediário | crítica | — | — | — | não testado |
| A5 | Android 14 | 6 GB | 20:9 FHD+ 120 Hz | intermediário-alto | alta | — | — | — | não testado |
| A6 | Android 15 | 8 GB | 20:9 FHD+ 120 Hz | topo | média | — | — | — | não testado |
| A7 | Android 16 | 8 GB | 21:9 FHD+ | topo/alongado | média | — | — | — | não testado |
| A8 | Android 13–14 | 4 GB | tablet 16:10 | tablet | baixa | — | — | — | não testado |
| I1 | iOS 16.4 | 2–3 GB | 16:9 (botão Home) | piso iOS | alta | — | — | — | não testado |
| I2 | iOS 17 | 4 GB | 19,5:9 (notch) | intermediário | alta | — | — | — | não testado |
| I3 | iOS 18+ | 6 GB | 19,5:9 120 Hz (Dynamic Island) | topo | média | — | — | — | não testado |
| I4 | iPadOS 17+ | 4 GB+ | 4:3 | tablet | baixa | — | — | — | não testado |

Cobertura obrigatória antes do lançamento: A1, A3, A4, A7, I1, I2 (piso de RAM, meta de 60 fps,
tela alongada e piso do iOS). Telas > 60 Hz: o jogo simula a 60 Hz fixos; conferir que o
`requestAnimationFrame` a 90/120 Hz não gera passo duplo/falta de passo (`sim_steps` ≈ 60 × duração).

## Como rodar uma sessão de laboratório

1. Instalar o APK da release (perfil `preview` do EAS) ou o build de desenvolvimento.
2. Aparelho com bateria > 50 %, fora do carregador, brilho 50 %, modo avião desligado, sem economia de bateria.
3. Abrir o jogo, aceitar ou recusar a telemetria (anotar qual), liberar as opções de desenvolvedor.
4. **Bench frio**: Modo bench logo depois de abrir. Exportar o JSON.
5. **Bench quente**: jogar 10 min (arcade) e rodar o bench de novo (estrangulamento térmico).
6. Roteiro manual (abaixo), com o overlay ligado.
7. Colar os JSONs e observações na planilha do laboratório (uma linha por aparelho × versão).

## Roteiro de teste manual

Cada caso: passos → resultado esperado. Anotar "ok", "falhou (descrição + vídeo)" ou "não testado".

| Caso | Passos | Esperado |
|---|---|---|
| Multitoque | Segurar direcional para frente + apertar A, B, C, D em sequência e juntos (A+B, C+D); soltar o direcional com um botão ainda pressionado | Todos os toques registrados; nenhum botão "preso"; rolamento e blowback saem com os dois dedos |
| Toque nas bordas | Usar o direcional encostado na borda esquerda e os botões na direita, com capinha | Sem gesto do sistema roubando o toque (voltar/home) |
| Especiais em um toque | Usar os atalhos de especial/super | Saem na hora; super só com barra |
| Perda de rede (online) | No meio de uma luta ranked, ligar o modo avião por 5 s e desligar | Aviso de conexão; ou retoma, ou encerra com mensagem clara; sem travar a tela; resultado não fica "pendurado" |
| Rede ruim (online) | Wi-Fi com 150–300 ms (hotspot distante ou limitador) | `ping` em vermelho, rollbacks no overlay, jogo continua jogável; sem dessincronia |
| Segundo plano | Na luta, apertar Home, esperar 30 s, voltar | Volta pausado ou no mesmo ponto, sem pular rounds; áudio volta; no online, conta como desconexão só se passar do limite |
| Ligação/alarme | Receber ligação durante a luta | Áudio para; ao voltar, retoma |
| Pouca memória | Abrir 5–6 apps pesados (câmera, jogo 3D, navegador com abas), voltar ao jogo; Android: `adb shell am send-trim-memory br.com.conexus.bamba RUNNING_CRITICAL` | Se o sistema matar o processo, o jogo reabre no menu sem perder ajustes/conta; sem crash |
| Rotação | Girar o aparelho em todas as telas | Fica em paisagem (rotação travada) |
| Recortes de tela | Telas com notch/furo e 21:9 | HUD e botões fora do recorte; nada cortado |
| Fonte grande | Fonte do sistema no máximo | Menus legíveis; a luta não quebra |
| Primeira abertura | Instalação limpa | Só a pergunta de telemetria, uma vez (sem anúncio nem pedido de rastreamento: jogo pago); "Agora não" funciona |
| Licença do online (Android) | Faixa de teste interno: conta de teste de licença; depois um APK instalado fora da Play | Cópia da Play entra no online; a de fora recebe a mensagem de compra só no online; offline funciona nas duas (`docs/PROTOCOL.md` § Licença) |
| Falha simulada | Build de dev: forçar um erro numa tela | Painel "algo deu errado" com "Voltar ao menu"; com telemetria aceita, evento `crash` no próximo envio |
| Bateria/temperatura | 20 min de arcade | Sem queda > 10 % no fps_p5 entre o bench frio e o quente; aparelho não fica quente demais ao toque |

## Atraso de toque com câmera lenta

Meta: **≤ 4 quadros a 60 Hz (≤ 66,7 ms)** do instante em que o dedo encosta na tela até o primeiro
pixel do golpe aparecer.

Material: um segundo celular que filme a **240 fps** (1 quadro de câmera = 4,17 ms), tripé ou apoio,
boa luz. Aparelho em teste a 60 Hz (se a tela for 90/120 Hz, medir também nesse modo e anotar).

1. Modo **Treino**, boneco parado, overlay ligado (confirma que está a ~60 fps durante a medição).
2. Filmar de lado e um pouco de cima, com o dedo e o personagem no mesmo quadro.
3. Tocar o botão do soco fraco (A) com um movimento rápido e seco, 20 vezes, com 1–2 s entre toques.
4. No vídeo, quadro a quadro, para cada toque:
   - `t0` = primeiro quadro em que a ponta do dedo **achata** na tela (contato);
   - `t1` = primeiro quadro em que o personagem **muda de pose** (primeiro quadro da animação do golpe).
5. Atraso = `(t1 − t0) / 240 × 1000` ms; em quadros do jogo = ms / 16,67.
6. Descartar toques ambíguos (dedo fora de foco). Reportar **mediana e p90** de ≥ 15 toques válidos.

Como interpretar: o total soma amostragem do toque (digitalizador 120–240 Hz), evento até o JS, espera
do próximo passo de 60 Hz, gravação + composição + vsync (1–3 quadros). Para separar a parte da tela,
medir do mesmo jeito um elemento nativo (ex.: tecla do teclado do sistema acendendo) — essa é a base
do aparelho; o que passar dela é custo do jogo. Atraso de input online (`inputDelay`, 2 quadros por
padrão) **soma** a isso e é medido à parte, numa partida online.

## Números medidos até agora (contêiner, não aparelho)

Medidos em 18/10/2026 nesta máquina (4 vCPU Xeon 2,1 GHz compartilhada com outros processos; load
average ~9 durante as medições, por isso a variação entre execuções).

**`npm run bench` (Node 22, engine pura, 20 personagens, 4 lutas × 5000 frames)** — 4 execuções:

| Medida | Faixa observada |
|---|---|
| carregar 20 personagens | 483 e 1016 ms (nas 2 execuções em que foi registrado) |
| simulação | 0,029–0,065 ms/frame (15 364–34 764 frames/s, 256×–579× tempo real) |
| rollback (8 frames re-simulados por frame) | 0,185–0,275 ms/frame (3 640–5 416 frames/s, 61×–90× tempo real) |

Leitura: a engine sobra folga no desktop; em celular intermediário (CPU 3–6× mais lenta em JS, Hermes
sem JIT) a re-simulação de 8 frames ainda deve caber em poucos ms, **mas isso é hipótese até rodar o
bench no aparelho**.

**`npm run bench:web` (Chromium 141 headless, sem GPU, 915×412 @2x, 60 s)** — 1 execução:
`fps_avg 51,1`, `fps_p5 29,9`, `frame_ms_p95 33,5`, `frame_ms_max 333,3`, `long_frames 169` de 3 063
quadros, `sim_ms_p95 0,5`, `draw_ms_p95 22`, 3 583 passos de simulação. O gargalo é o desenho em
Canvas 2D por software (22 ms p95), não a simulação (0,5 ms). Serve como linha de base para comparar
versões no CI, não como número de aparelho.

**Tamanho** — ver § Tamanho.

## Tamanho (orçamento ≤ 150 MB)

`npm run size` (medido em 18/10/2026, versão 0.4.0 + este trabalho; MiB):

| Parte | Tamanho |
|---|---|
| Export Android total (bundle + assets) | **26,73** (baseline sem este trabalho: 26,69 — bundle 6 964 203 B) |
| Bundle JS (Hermes bytecode) | 6,68 |
| Assets — `characters/*` (atlas WebP de 20 lutadores, 0,6–1,2 cada) | 17,94 |
| Assets — `assets/stages` (camadas dos 8 cenários) | 2,08 |
| Assets — outros (expo-router) | 0,02 |
| Por tipo | webp 17,94 · png 1,33 · jpg 0,77 |

**Não medido**: a parte nativa (Hermes, React Native, Skia, Reanimated, módulos Expo; o AdMob saiu na 0.5.0). Ainda não
existe release com APK no GitHub (`gh api repos/tantoniazi/mugen/releases` vazio), então não há número
real de APK/AAB. `size-budget.json` usa `native_estimate_mb: 60` como **hipótese de planejamento** para
o "download estimado" (26,7 + 60 = 86,7 MB < 150). Assim que houver build EAS:
`npm run size -- --apk mugen-arena-X.Y.Z.apk` (o workflow de release já roda isso e só avisa) e trocar a
estimativa pelo número real. Atenção: o APK `preview` é universal (todas as ABIs); o que conta para a
meta é o download da Play por aparelho, que vem do AAB (`bundletool get-size total --apks=...`).

Plano para ficar ≤ 150 MB com folga conforme o elenco crescer:
1. **AAB por ABI** (já é o perfil `production`): a Play entrega só `arm64-v8a` ao aparelho.
2. **Minificação nativa**: ligar `enableProguardInReleaseBuilds` e `enableShrinkResourcesInReleaseBuilds`
   no `expo-build-properties` (medir antes/depois com `--apk`).
3. **Elenco sob demanda**: o app já baixa personagens do catálogo (`GET /api/v1/characters/:slug/pack`).
   Embutir só o elenco inicial (ex.: 8 lutadores ≈ 7 MiB) e baixar o resto na primeira vez que for
   escolhido, com cache em disco. Cada lutador novo custa ~0,9 MiB e deixa de pesar no download inicial.
4. **Cenários sob demanda** do mesmo jeito (≈ 0,26 MiB cada hoje).
5. **Play Asset Delivery** (fast-follow/on-demand) se o volume embutido passar de ~50 MiB.
6. Orçamento no CI: `Mobile budget` falha se export > 32, bundle > 8,5 ou assets > 24 MiB
   (`mobile/size-budget.json`, ~20 % de folga sobre o medido). Subir um limite exige justificar no PR.

## Telemetria e falhas

- App: `mobile/src/services/telemetry.ts` (fila, lote, consentimento), `telemetrySchema.ts` (esquema +
  limpeza de PII), `crash.ts` (ErrorUtils, promessas no release, arquivo local síncrono),
  `components/ErrorBoundary.tsx` (telas), `fightTelemetry.ts` (luta + resumo `perf`),
  `telemetryWatchers.ts` (fila online observando o `onlineStore`). Contrato: docs/PROTOCOL.md § Telemetria.
- Servidor: `POST /api/telemetry/batch` → `telemetry_events` (90 dias).

Consultas úteis (Postgres):
```sql
-- fps da luta por versão e plataforma (perf = resumo de cada luta)
SELECT app_version, platform, count(*) lutas,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'fps_avg')::float) fps_mediana,
       percentile_cont(0.1) WITHIN GROUP (ORDER BY (props->>'fps_p5')::float)  fps_p5_p10
FROM telemetry_events WHERE name = 'perf' AND props->>'mode' <> 'bench'
GROUP BY 1, 2 ORDER BY 1 DESC;

-- sessões sem crash (aprox.): o crash fatal chega na sessão seguinte (previous_session = true)
SELECT date_trunc('day', occurred_at) dia,
       1 - count(*) FILTER (WHERE name = 'crash' AND (props->>'fatal')::bool)::float
         / NULLIF(count(*) FILTER (WHERE name = 'session_start'), 0) AS sem_crash
FROM telemetry_events GROUP BY 1 ORDER BY 1 DESC;
```
A taxa só vale para quem aceitou a telemetria (amostra enviesada). A fonte oficial de crash rate é o
**Android vitals** (Play Console) e o **Xcode Organizer** (App Store Connect): não precisam de SDK,
pegam crash nativo, ANR e encerramento por memória — usar desde o primeiro teste fechado.

### Falhas nativas e SDK de terceiros

O que existe pega só erro **JS** (handler global, promessas sem tratamento no release, error boundary).
Não pega crash nativo (Skia, Reanimated, JNI), ANR nem processo morto por falta de memória —
esses aparecem só no Android vitals / Xcode Organizer, sem pilha simbolizada do JS.

Recomendação para antes do lançamento aberto (não adicionado agora, por não haver aparelho para validar
e por ser decisão de privacidade): **Sentry** (`@sentry/react-native` com o plugin Expo) — cobre JS e
nativo nos dois sistemas, símbolos do Hermes (source maps) e ANR. Condições: `sendDefaultPii: false`,
sem replay de sessão, `beforeSend` com o mesmo `scrub` do `telemetrySchema.ts`, ligado só com o mesmo
consentimento, DPA assinado e região de dados definida; custo de tamanho a medir com `npm run size -- --apk` antes de adotar. Alternativa sem custo de
licença: **Firebase Crashlytics** (`@react-native-firebase/crashlytics`) — bom no nativo Android, pilha JS
mais pobre e traz o Google Play services/Firebase para o app. Em ambos os casos, manter o
`/api/telemetry/batch` para os eventos de produto e desempenho.

## CI

- `.github/workflows/mobile-budget.yml` (PR e push em `main` com `mobile/**`): `npm run bench`,
  `npm run bench:web` (Chromium do Playwright) e `npm run size`; publica `mobile/out/*.json` como
  artifact `mobile-budget` e no resumo do job. Sem segredos. O job falha se o tamanho estourar o
  orçamento; os benches só registram (sem limite, por causa da variação das máquinas do GitHub).
- `.github/workflows/github-release.yml`: depois do APK do EAS, `npm run size -- --apk` (só avisa).
- Bench em aparelho real no CI (Firebase Test Lab, BrowserStack, AWS Device Farm) fica pendente:
  exige conta e segredo — decisão de custo para o Security/DevOps e o PO.
