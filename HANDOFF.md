# Handoff — MUGEN Arena

Data: 18/10/2026. Versão **0.2.0** (sistema SNK; ver `docs/UPDATE_0.2.0.md`). Branch de trabalho: `ccr-0c9af399-ubmxeu` em `tantoniazi/mugen`
(privado). O repositório definitivo deve ser `conexus-systems/mugen-arena` (privado) — a criação na org foi
negada à integração e precisa ser feita por um admin.

## 1. Comece por aqui

1. `AGENTS.md` (regras), `SKILL.md` + `agents/` (fluxo com agentes), `templates/TASK.md`.
2. `docs/UPDATE_0.2.0.md` (sistema SNK, equipes, Kenshi e Lua, otimização) e `docs/UPDATE_0.1.0.md` — o que existe, o que foi verificado e o que está pendente.
3. `docs/W10M_DESIGN_SYSTEM.md` — design system (mesmo do conexus-launcher/multi-miner, em RN).
4. `docs/PROTOCOL.md` — contrato app ⇄ web (REST, ActionCable, webhooks, pack de personagem).
5. `docs/CHARACTERS.md` — formato MUGEN, importação, compatibilidade da engine.
6. `web/README.md` e `deploy/terraform/linode/README.md` — backend, deploy e cadastro nos BFFs.

## 2. Objetivo e decisões do usuário

Jogo de luta para Android e iOS "usando MUGEN", com vários personagens, AdMob, luta online, possibilidade de
adicionar personagens, repositório na Conexus e integração com os BFFs. Depois: "montar uma stack de app para
game usando a stack do W10M". Decisão (do usuário): **manter Expo (Android + iOS)** e adotar a stack W10M no
visual e no processo, em vez de reescrever em Kotlin nativo (que perderia o iOS).

O MUGEN original (Elecbyte) é fechado e só Windows: o jogo reimplementa o **formato** em TypeScript. Nenhum
personagem de terceiros é distribuído; os 6 nativos são originais.

## 3. Stack

| Item | Valor |
|---|---|
| App | Expo SDK 58, React Native 0.88, expo-router, @shopify/react-native-skia 2.14, Reanimated 4.7 |
| Visual | W10M: `mobile/src/ui` + `mobile/components/metro` |
| Anúncios | react-native-google-mobile-ads 17 (IDs de teste por padrão) |
| Testes | Jest (jest-expo) + react-test-renderer, `node --test`, Playwright (preview web) |
| Web | Rails 8.1 API, Postgres, Solid Queue/Cable/Cache, RSpec, `conexus-platform` vendorizada |
| Infra | `platform-infra` (callers), GHCR, Terraform LKE (`deploy/terraform/linode`), EAS |
| IDs | `br.com.conexus.mugenarena`, slug `mugen-arena`, redirect `br.com.conexus.mugenarena://oauth/callback` |

## 4. Mapa do código

- `mobile/src/engine/` — parsers MUGEN, expressões, estados, `stepWorld` (determinístico), common1.
- `mobile/src/net/` — cliente ActionCable, `RollbackSession`, fluxo online.
- `mobile/src/game/` — renderizador Skia, cenários, IA, macros, atlas.
- `mobile/src/ui/`, `mobile/components/metro/` — W10M.
- `mobile/app/` — telas (Iniciar, seleção, luta, online, personagens, perfil, ajustes, premium).
- `mobile/scripts/` — gerador do elenco, importador `mugen-pack`, previews.
- `web/` — API, canais, webhooks, jobs. `deploy/` — Terraform. `.github/` — callers e release.

## 5. Próximos passos sugeridos

1. Criar `conexus-systems/mugen-arena`, mover o histórico e abrir o PR para `main`.
2. Cadastro nos BFFs + segredos (lista em `web/README.md`), `EXPO_TOKEN`, primeiro deploy e build EAS.
3. QA em aparelho (matriz em `agents/qa.md`), ajustar desempenho do Skia se preciso.
4. Engine: Helpers e Explods visuais, sons (.snd), arremessos — com teste cada um.
5. Ficha da Play/App Store e políticas (`mobile/PLAY_LISTING.md`).
