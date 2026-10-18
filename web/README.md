# MUGEN Arena — web (API Rails)

API Rails 8.1 (API-only) + Action Cable do **MUGEN Arena**, jogo de luta 2D mobile.
Fica em `web/` (layout "produto Expo" da frota CONEXUS: app em `mobile/`, Rails em `web/`,
Terraform em `deploy/terraform/linode` na raiz). O contrato com o app (`mobile/`) está em [`../docs/PROTOCOL.md`](../docs/PROTOCOL.md): mudou lá, muda aqui.

Esta API é um **consumidor** da plataforma CONEXUS (template `conexus-bff-stack`):

| Papel | Quem faz | Aqui |
|---|---|---|
| Login, OAuth2/PKCE, JWT | `bff-auth` | só **verifica** o JWT (JWKS) e faz upsert do `Player` |
| Assinatura / premium | `bff-payment` | recebe webhook e liga/desliga `Player#premium` |
| E-mail | `bff-api` | job Solid Queue → `Conexus::Messaging::Client#dispatch` |

Não há Devise/OmniAuth, SDK Stripe/Mercado Pago, Resend/Twilio nem mailer neste app.
Sem Redis/Sidekiq (ADR 0001): **Solid Queue**, **Solid Cache** e **Solid Cable**, todos no
mesmo Postgres.

## Stack

- Ruby **4.0.2** (`.ruby-version`, Docker). O `Gemfile` não fixa `ruby`, então o bundle também
  resolve em Ruby 3.3+ local.
- Rails ~> 8.1, PostgreSQL (banco único — tabelas Solid* vêm de `db/migrate`).
- Gem `conexus-platform` vendorizada em `vendor/conexus-platform` (`path:` no Gemfile).
- RSpec + WebMock + FactoryBot, `rubocop-rails-omakase`, Brakeman.

## Setup local

```bash
cp .env.example .env            # ajuste DATABASE_* e CONEXUS_AUTH_ALLOWED_AUDIENCES
bundle install
bin/rails db:prepare            # cria banco + migra (inclui Solid Queue/Cache/Cable)
bin/dev                         # web (Puma + /cable) + worker (Solid Queue) via Procfile.dev
```

Postgres local: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16` ou o do
sistema (usuário/senha padrão `postgres`/`postgres`, porta 5432).

Gates (os mesmos do CI do platform-infra):

```bash
bundle exec rubocop --parallel --format progress
bundle exec rspec
bin/brakeman --quiet --no-pager
bin/ci                          # tudo acima em sequência
```

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `AUTH_PROVIDER` / `BILLING_PROVIDER` / `MESSAGING_PROVIDER` | flags CONEXUS; sempre `conexus` |
| `CONEXUS_AUTH_URL` | bff-auth; JWKS em `<url>/.well-known/jwks.json` |
| `CONEXUS_AUTH_ISSUER` | `iss` esperado (padrão: `CONEXUS_AUTH_URL`) |
| `CONEXUS_AUTH_ALLOWED_AUDIENCES` | client_id(s) aceitos no `aud` (o client público do app) |
| `CONEXUS_PAYMENTS_URL`, `CONEXUS_API_URL` | hosts dos BFFs de pagamento e mensagens |
| `CONEXUS_WEBHOOK_SECRET` | HMAC dos webhooks recebidos (bff-auth / bff-payment) |
| `CONEXUS_API_WEBHOOK_SECRET` | HMAC dos dispatches ao bff-api (sem ele, e-mails são pulados e logados) |
| `CONEXUS_PRODUCT_SLUG` | `mugen-arena` — filtra eventos de cobrança e vira `source_app` |
| `CONEXUS_AUTH_CLIENT_ID` / `_SECRET` | reservado (o app mobile é cliente público; a API não troca código) |
| `ADMIN_GROUPS` | claim `groups` com acesso admin (padrão `mugen-arena-admin,admin`) |
| `ADMIN_NOTIFY_EMAILS` | moderadores avisados de novas submissões |
| `RATED_ROOM_MATCHES` | `true` para salas privadas mexerem no Elo (padrão `false`) |
| `DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD`, `PGSSLMODE` | Postgres (nunca `DATABASE_URL`) |
| `DATABASE_IDLE_TIMEOUT` / `DATABASE_REAPING_FREQUENCY` | pool do Postgres compartilhado (padrão `60`/`30` s) |
| `RAILS_MAX_THREADS` | threads do Puma (padrão `3`); o pool do AR é `RAILS_MAX_THREADS + JOB_THREADS` |
| `SOLID_QUEUE_IN_PUMA` | roda o Solid Queue dentro do Puma, modo async (padrão da frota em produção) |
| `JOB_THREADS` / `JOB_POLLING_INTERVAL` | threads e polling (s) do Solid Queue (padrão `2`/`1`) |
| `PACK_MAX_BYTES` | tamanho máximo de um pack enviado (padrão 5 MiB) |
| `CORS_ORIGINS` | origens CORS, separadas por vírgula (padrão `*`) |
| `SECRET_KEY_BASE` | obrigatório em produção (sem `config/master.key` na imagem) |
| `SOLID_CABLE_POLLING_INTERVAL` | polling do Solid Cable em segundos (padrão `0.05`) |

## Endpoints

Erros: `{ "error": "<code>", "message": "..." }` — `401 invalid_token`, `403 forbidden`,
`404 not_found`, `402 premium_required`, `422 validation_failed`, `503 auth_unavailable`.

| Método | Caminho | Auth |
|---|---|---|
| GET | `/up` | — |
| GET / PATCH | `/api/v1/me` | Bearer |
| GET | `/api/v1/characters` | — (última versão aprovada de cada slug) |
| GET | `/api/v1/characters/:slug/pack` | Bearer premium/admin se o personagem for premium |
| POST | `/api/v1/characters` | Bearer (`{ pack }` → `201`, status `pending`) |
| GET | `/api/v1/admin/characters?status=pending` | admin |
| PATCH | `/api/v1/admin/characters/:slug` | admin (`{ status, premium?, reason? }`) |
| GET | `/api/v1/leaderboard` | — (top 100) |
| GET | `/api/v1/matches` | Bearer |
| POST | `/conexus/webhooks` | HMAC `X-Conexus-Signature` |
| WS | `/cable?token=<access_token>` | JWT (conexão recusada sem token válido) |

Canais: `MatchmakingChannel` (fila ranked ±200 de rating, +50 a cada 10 s; salas com código de 6
caracteres) e `MatchChannel` (relay de `input`/`checksum`, `ready` → `start`, `result` com Elo K=32,
`ping` → `pong`, `opponent_left` quando alguém sai). Detalhes em `docs/PROTOCOL.md`.

### Notas de implementação

- **Pack**: o servidor re-serializa o `pack` recebido (`JSON.generate`) e guarda esse texto em
  `characters.pack_body`; o `sha256` publicado é desse corpo, servido byte a byte em `/pack`
  (com `ETag`). Validação em `app/services/characters/pack_validator.rb` (`.def` lido por
  `DefParser`, INI case-insensitive com comentários `;`). `stcommon` é opcional (a engine do
  app tem o `common1.cns`).
- **Versões**: cada submissão é uma linha; o slug pertence a quem o enviou primeiro. Uma nova
  submissão marca `pending` anteriores do mesmo slug como `rejected` (`superseded`).
- **Matchmaking**: tickets em `matchmaking_tickets`, pareados com `FOR UPDATE SKIP LOCKED` (seguro
  entre pods). Cada assinatura re-tenta o pareamento a cada 3 s e mantém heartbeat; o job
  recorrente `MatchmakingCleanupJob` remove tickets órfãos e encerra partidas que ninguém iniciou.
- **Partidas**: inputs não tocam o banco; `ready`/`result`/abandono usam lock da linha da partida.
  Sair de partida `active` = derrota (Elo) para quem saiu.
- **E-mails**: `CharacterSubmittedNotificationJob` (um e-mail para o 1º de `ADMIN_NOTIFY_EMAILS`
  com cópia para os demais, chave `character-submitted-<id>`) e
  `CharacterReviewedNotificationJob` (chave `character-reviewed-<id>-<status>`). Sem
  `MESSAGING_PROVIDER=conexus` + `CONEXUS_API_WEBHOOK_SECRET`, são pulados com log.

## Deploy (platform-infra)

CI e deploy vêm do [`platform-infra`](https://github.com/conexus-systems/platform-infra)
(GHCR + Terraform LKE), layout `--layout web`. Os callers ficam em `.github/workflows/` na raiz
do repo e só passam inputs (`working-directory: web`, `dockerfile: web/Dockerfile`,
`build_context: web`); o Terraform fica em [`../deploy/terraform/linode`](../deploy/terraform/linode)
— nunca em `web/deploy`.

```bash
gh workflow run "Deploy — Production" --ref main                    # testes → GHCR → Terraform
gh workflow run "Deploy — Production" --ref main -f skip_build=true # só Terraform
```

- Imagem: `Dockerfile` deste diretório (Ruby 4.0.2). O módulo `rails-lke` sobe o pod com
  args `["web"]`; o `bin/docker-entrypoint` traduz para `./bin/rails server -b 0.0.0.0` e roda
  `db:prepare` antes.
- Um pod só (`mugen-arena-web`): Puma em single mode + Action Cable + Solid Queue dentro do Puma
  (`SOLID_QUEUE_IN_PUMA=true`, gravado pelo módulo). Readiness/liveness em `/up`.
- Secrets: o módulo grava DB, flags CONEXUS, `JOB_*` e `DATABASE_*_TIMEOUT`; o resto da tabela
  acima entra por `extra_app_secrets` (ver `deploy/terraform/linode/README.md`).

## Registro nos BFFs CONEXUS

1. **bff-auth — cliente OAuth público do app** (PKCE S256, sem secret), no mesmo molde da task
   `oauth_clients:multiminer` (ou num console de um pod `platform-auth-web`):

   ```ruby
   client = OAuthClient.find_or_initialize_by(client_id: "mugen-arena")
   client.update!(name: "MUGEN Arena", public_client: true, client_secret_digest: nil, active: true,
                  redirect_uris: [ "br.com.conexus.mugenarena://oauth/callback" ])
   ```

2. **bff-auth — webhooks `user.*`**: crie o `WebhookEndpoint` desse client apontando para
   `https://mugen-arena.conexus-systems.com.br/conexus/webhooks`, com o mesmo segredo de `CONEXUS_WEBHOOK_SECRET`:

   ```ruby
   client.webhook_endpoints.create!(url: "https://<host>/conexus/webhooks", secret: "<CONEXUS_WEBHOOK_SECRET>")
   ```

3. **Esta API**: `CONEXUS_AUTH_ALLOWED_AUDIENCES=mugen-arena` (o `client_id` acima).
4. **bff-payment**: adicione o `client_id` a `CONEXUS_AUTH_ALLOWED_AUDIENCES` (o app abre o
   checkout com o mesmo token) e inclua esta API em `APP_WEBHOOK_TARGETS`
   (`[..., {"url":"https://<host>/conexus/webhooks","secret":"<CONEXUS_WEBHOOK_SECRET>"}]`).
   O produto do catálogo precisa ter slug `mugen-arena` (`CONEXUS_PRODUCT_SLUG`).
5. **bff-api**: adicione o `client_id` a `CONEXUS_AUTH_ALLOWED_AUDIENCES` e mapeie-o em
   `CONEXUS_AUTH_AUDIENCE_APPS` (`...,mugen-arena:mugen-arena`, formato `client_id:source_app`).
   O segredo HMAC aceito para o `source_app` `mugen-arena` vai em `CONEXUS_API_WEBHOOK_SECRET` aqui.
6. **Admins**: o claim `groups` é por app no bff-auth; dê o grupo `mugen-arena-admin` (ou `admin`)
   aos moderadores nesse client para liberar `/api/v1/admin/*`.
