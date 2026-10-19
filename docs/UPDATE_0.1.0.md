# MUGEN Arena 0.1.0

Primeira versão. Jogo de luta 2D para Android e iOS (Expo) com engine compatível com o formato de personagens
do MUGEN, online com rollback, AdMob, catálogo de personagens e integração com os BFFs CONEXUS — montado na
stack de app da frota (design system W10M, layout `platform-infra`, processo do launcher/multi-miner).

## O que tem

- **Luta**: engine determinística (`.def/.air/.cmd/.cns`), 6 personagens originais (Kaze, Brasa, Titã, Yuki,
  Volt, Sombra) com 14 normais, 3 especiais e 1 super cada; 3 cenários; arcade, versus CPU, treino (caixas
  Clsn) e online.
- **Online**: ranqueada (Elo) e sala com código; rollback com input delay ajustável (1–4 frames), predição,
  re-simulação e checksum anti-dessincronia; resultado só conta com os dois relatos iguais.
- **Personagens novos**: `npm run pack` importa personagens MUGEN (SFF v1/v2 + `.act`) e envia para revisão;
  admins aprovam no app (opcionalmente como premium); o app baixa, confere sha256 e valida antes de instalar.
- **Visual W10M**: Iniciar com Live Tiles (Arcade com lutador vivo, Online com rating, Personagens com o
  elenco), pivôs, listas, diálogos e controles touch planos; tema escuro/claro, 20 cores de destaque +
  personalizada, animações desligáveis.
- **Monetização**: AdMob (banner nos menus, interstitial a cada 2 lutas com 3 min de intervalo, rewarded para
  continuar no arcade), consentimento UMP + ATT; Premium (bff-payment) remove anúncios.
- **Conta**: login PKCE no bff-auth; perfil, ranking e histórico; e-mails pelo bff-api.
- **Infra**: Rails 8 em `web/`, workflows reutilizáveis do `platform-infra`, Terraform LKE, EAS, release por tag.

## Verificação feita (neste ambiente)

| Gate | Resultado |
|---|---|
| `npm run test:ci` (mobile) | 83 testes jest (engine, determinismo, fuzz 3000 frames × 36 confrontos, rollback com latência simulada, regras/cores/blocos W10M, telas) + 6 testes das ferramentas (SFF/PCX/PNG/pack) + elenco atualizado |
| `npx tsc --noEmit` | sem erros |
| `npx expo export --platform android` | bundle Hermes gerado (5,4 MB) |
| `npm run preview` / `npm run preview:web` | capturas da luta (CanvasKit em Node) e das telas W10M + luta ao vivo no navegador (react-native-web) — `docs/screenshots/` |
| `bundle exec rspec` (web) | 104 exemplos, 0 falhas |
| `bundle exec rubocop`, `bin/brakeman` | sem ofensas, 0 avisos |
| `terraform fmt -check` + `validate` | ok |
| Teste ponta a ponta do online | 2 processos Puma + clientes WebSocket: fila, pareamento, relay de input, ping, Elo, sala, abandono |

## Pendente (não verificado)

- **Aparelho real** Android/iOS: toque multi-dedo, desempenho do Skia, AdMob real, login no navegador do
  sistema. Este ambiente não tem Android SDK nem Xcode; o web confirma a lógica e o visual, não o aparelho.
- No web o texto do HUD da luta não aparece (o Skia web não tem `matchFont`); no nativo usa a fonte do sistema.
- Cadastro nos BFFs (cliente OAuth público, audiências, planos, webhooks), segredos de deploy e `EXPO_TOKEN`.
- Compatibilidade MUGEN parcial (sem Helpers, Explods visuais, sons, arremessos) — ver `docs/CHARACTERS.md`.
- Ficha da Play/App Store e classificação etária (`mobile/PLAY_LISTING.md`).
