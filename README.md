# MUGEN Arena

Jogo de luta 2D para **Android e iOS** (Expo / React Native) com engine própria
compatível com o formato de personagens do **MUGEN**, **luta online com rollback**,
**AdMob**, catálogo de **personagens baixáveis** e integração com os BFFs da CONEXUS
(`bff-auth`, `bff-payment`, `bff-api`).

| Intro | Golpe (treino, com caixas Clsn) | Projétil | Chute alto |
|---|---|---|---|
| ![](docs/screenshots/intro.png) | ![](docs/screenshots/soco.png) | ![](docs/screenshots/projetil.png) | ![](docs/screenshots/chute-alto.png) |

*Capturas geradas pelo próprio renderizador do app (`npm run preview`, Skia/CanvasKit).*

## O que tem

- **Engine MUGEN em TypeScript** (`mobile/src/engine`): lê `.def`, `.air`, `.cmd` e `.cns`
  de verdade — estados, triggers com expressões, `HitDef`, `Projectile`, caixas Clsn1/Clsn2,
  comandos com `~ / $ >`, rounds, KO, tempo. 100% determinística (requisito do rollback).
  O MUGEN original (Elecbyte) é fechado e só roda no Windows; aqui reimplementamos o formato.
- **6 personagens originais** (sem IP de terceiros): Kaze, Brasa, Titã, Yuki, Volt e Sombra,
  cada um com 14 golpes normais, 3 especiais e 1 super, escritos no formato MUGEN
  (`mobile/characters/<id>/`) e com sprites gerados por um rig esquelético.
- **Adicionar personagens**: `npm run pack` converte uma pasta de personagem MUGEN
  (incluindo `.sff` v1/v2 e paleta `.act`) num pack e envia ao backend; após aprovação
  de um admin ele aparece no catálogo do app para download. Ver [docs/CHARACTERS.md](docs/CHARACTERS.md).
- **Modos**: Arcade (escada de oponentes, continue com anúncio premiado), Versus CPU,
  Treino (caixas de colisão, barra cheia) e Online (ranqueada por Elo ou sala com código).
- **Online**: netcode com rollback (input delay + predição + re-simulação + checksum
  anti-dessincronia) sobre ActionCable (Solid Cable, sem Redis).
- **Controles touch**: direcional flutuante, os 6 botões do MUGEN (x y z / a b c) e
  botões "assistidos" que executam especiais/super num toque.
- **AdMob**: banner nos menus, interstitial entre partidas (a cada 2, intervalo mínimo
  de 3 min), rewarded para continuar no arcade; consentimento UMP + ATT no iOS.
  Premium remove anúncios.
- **CONEXUS**: login PKCE no `bff-auth`, premium/checkout no `bff-payment`, e-mails
  (personagem enviado/aprovado) pelo `bff-api` via gem `conexus-platform`.

## Estrutura

```
mobile/    App Expo (Android/iOS) — engine, renderizador Skia, netcode, telas
  src/engine/        engine MUGEN determinística (+ testes)
  src/net/           ActionCable + rollback (+ testes)
  src/game/          renderizador, cenários, IA, macros de comando
  characters/        elenco nativo em formato MUGEN (.def/.air/.cmd/.cns + atlas)
  scripts/roster/    gerador do elenco (rig → sprites → arquivos MUGEN)
  scripts/mugen-pack.mjs  importador de personagens MUGEN (SFF v1/v2 → atlas)
backend/   Rails 8 API — perfil, catálogo de personagens, matchmaking, relay online,
           webhooks CONEXUS, e-mails via bff-api
docs/      PROTOCOL.md (contrato app ⇄ backend), CHARACTERS.md, screenshots
```

## Rodando

**App** (precisa de development build — AdMob e Skia são módulos nativos):

```bash
cd mobile
cp .env.example .env          # URLs dos BFFs, client_id OAuth, IDs AdMob
npm install
npm run test:all              # jest (engine, rollback) + testes das ferramentas + tsc
npx expo run:android          # ou: npx expo run:ios  /  eas build --profile development
```

**Backend** (ver [backend/README.md](backend/README.md)):

```bash
cd backend
cp .env.example .env
bundle install && bin/rails db:prepare
bin/dev                       # web + Solid Queue
bundle exec rspec             # 104 exemplos
```

## Integração CONEXUS (resumo)

| BFF | Uso | Onde |
|---|---|---|
| `bff-auth` | Login OAuth2 + PKCE (cliente público), JWT RS256 verificado pelo backend via JWKS | `mobile/src/services/auth.ts`, `backend/app/services/auth/` |
| `bff-payment` | `GET /v1/me/entitlements` (premium) e `POST /v1/me/checkouts` (checkout web); webhook `entitlement.changed` | `mobile/src/services/payments.ts`, `backend/app/controllers/concerns/conexus_webhook_handler.rb` |
| `bff-api` | E-mails de personagem enviado/aprovado/recusado (`POST /webhooks/messages` assinado) | `backend/app/services/notifications/conexus_messenger.rb` |

Cadastro necessário nos BFFs (feito por quem opera a plataforma) — ver
[backend/README.md](backend/README.md#registro-nos-bffs-conexus).

## Limitações conhecidas

- Compatibilidade MUGEN é um **subconjunto**: sem Helpers, Explods visuais, sons (.snd),
  arremessos com `p2stateno`/Target*, juggle points e cenários/screenpacks do MUGEN.
  Controladores não suportados são ignorados e listados ao carregar. Detalhes em
  [docs/CHARACTERS.md](docs/CHARACTERS.md).
- O app não foi executado em aparelho/emulador neste ambiente: a engine, o rollback,
  as ferramentas e o renderizador foram validados por testes e renders em Node; o backend
  por specs e um teste ponta a ponta de WebSocket. Falta um teste em device real
  (build EAS de desenvolvimento).
- Distribua apenas personagens que você tem direito de distribuir.
