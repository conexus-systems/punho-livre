# MUGEN Arena — contrato cliente ⇄ backend

Fonte da verdade entre `mobile/` (Expo) e `web/` (Rails 8 API). Mudou aqui, muda nos dois lados.

Identidade e mensagens **não** são implementadas aqui: vêm dos BFFs CONEXUS (`bff-auth`, `bff-api`).
Ver `CONEXUS.md`. O jogo é **pago** (compra única na Google Play): não há cobrança, anúncio nem compra no
app, e o app não usa mais o `bff-payment`. A licença do online é conferida pelo Play Integrity (§ Licença).

## Autenticação

- O app faz login no **bff-auth** via OAuth2 Authorization Code + PKCE (S256), cliente público.
  Redirect: `br.com.conexus.mugenarena://oauth/callback`.
- Todas as chamadas autenticadas ao backend usam `Authorization: Bearer <access_token do bff-auth>`
  (JWT RS256, `kid` em `<CONEXUS_AUTH_URL>/.well-known/jwks.json`, `aud` = client_id do app).
- O backend verifica o JWT (iss, aud ∈ `CONEXUS_AUTH_ALLOWED_AUDIENCES`, exp, `sub` UUID) e faz
  upsert do `Player` por `sub` (= `conexus_user_id`).
- Admin = claim `groups` contém algum valor de `ADMIN_GROUPS` (default `mugen-arena-admin,admin`).

Erros seguem `{ "error": "<code>", "message": "..." }`:
`401 invalid_token`, `403 forbidden`, `404 not_found`, `422 validation_failed`, `503 auth_unavailable`
(licença: `403 <motivo>` e `503 license_unavailable`, ver § Licença).

## REST — `/api/v1`

| Método | Caminho | Auth | Resposta |
|---|---|---|---|
| GET | `/up` | — | 200 |
| GET | `/api/v1/me` | sim | `{ player }` |
| PATCH | `/api/v1/me` | sim | body `{ display_name }` → `{ player }` |
| GET | `/api/v1/characters` | não | `{ characters: [CharacterSummary] }` (só `approved`) |
| GET | `/api/v1/characters/:slug/pack` | não | corpo = Pack JSON (bytes exatos usados no `sha256`); todo personagem aprovado é livre |
| POST | `/api/v1/characters` | sim | body `{ pack: Pack }` → `201 { character: CharacterSummary }` status `pending` |
| GET | `/api/v1/admin/characters?status=pending` | admin | `{ characters: [CharacterSummary] }` |
| PATCH | `/api/v1/admin/characters/:slug` | admin | body `{ status: "approved"\|"rejected", premium?: bool, reason?: string }` (`premium` é legado: não bloqueia mais nada) |
| GET | `/api/v1/leaderboard[?season=N]` | não | `{ season: Season, players: [{ display_name, rating, wins, losses, league }] }` (top 100 da temporada, só quem terminou a colocação; temporada inexistente → 404) |
| GET | `/api/v1/ranked` | sim | `RankedStanding` (temporada atual) |
| GET | `/api/v1/matches` | sim | `{ matches: [{ id, opponent, my_character, opponent_character, result: "win"\|"loss"\|"draw"\|"abandoned"\|"void", rating_delta, finished_at }] }` |
| GET | `/api/v1/matches/:id/replay` | participante ou admin | `{ replay: Replay }` (403 para os demais) |
| GET | `/api/v1/admin/match_reviews?status=open` | admin | `{ reviews: [MatchReview] }` (`open`\|`resolved`\|`dismissed`) |
| PATCH | `/api/v1/admin/match_reviews/:id` | admin | body `{ status: "resolved"\|"dismissed", note?: string }` → `{ review: MatchReview }` |
| POST | `/api/v1/license/challenge` | sim | `{ nonce, required }` — ver § Licença |
| POST | `/api/v1/license/verify` | sim | body `{ nonce, token }` → `{ licensed_until }` \| 403/503 — ver § Licença |
| POST | `/conexus/webhooks` | HMAC | webhooks do bff-auth (e, legado, do bff-payment) |
| POST | `/api/telemetry/batch` | não (anônimo, só com consentimento) | `202 { accepted, rejected }` — ver § Telemetria |

`player`:
```json
{ "id": 1, "conexus_user_id": "uuid", "display_name": "Ryo", "email": "a@b.c",
  "rating": 1500, "wins": 0, "losses": 0, "premium": false,
  "licensed_until": "2026-10-25T12:00:00Z", "license_required": true, "admin": false }
```
`rating` = rating exibido da temporada atual (Glicko-2, arredondado); `wins`/`losses` = vida toda.
`licensed_until` = até quando a licença do online vale (nulo se nunca verificou); `license_required` = o servidor
exige licença (`PLAY_INTEGRITY_REQUIRED=1`). `premium` é legado (da assinatura antiga) e o app o ignora.

`Season`: `{ "number": 1, "name": "Temporada 1", "starts_at": "<iso8601>", "ends_at": "<iso8601>" }`

`RankedStanding`:
```json
{ "season": Season, "rating": 1562, "deviation": 120, "peak_rating": 1600,
  "league": { "key": "ouro", "name": "Ouro", "min_rating": 1550, "next_min_rating": 1700 },
  "placement_remaining": 0, "rank": 2, "wins": 3, "losses": 1, "draws": 1 }
```
Ligas (`league.key`): `placement` (menos de 5 partidas na temporada; `min_rating`/`next_min_rating` nulos),
`bronze` (< 1400), `prata` (1400), `ouro` (1550), `platina` (1700), `diamante` (1850), `mestre` (2000, `next_min_rating` nulo).
`rank` é nulo em colocação. Desenho em `docs/ONLINE.md`.

`Replay` (entradas registradas pelo `input_log`; índice 0 = quadro 1):
```json
{ "match_id": 7, "status": "finished", "mode": "ranked", "seed": 12345, "engine_version": "0.4.0+net2",
  "characters": ["kaze", "ryu"], "pack_sha256": ["<hex>", "<hex>"], "winner_side": 0, "frames": 5400,
  "inputs": [[0, 0, 16], [0, 0, 4]], "checksums": [[60, 0, 123456, 987654]] }
```
`checksums` = `[frame, side, value, inputs_hash]`. Replays de partidas sem revisão aberta são apagados após
`REPLAY_RETENTION_DAYS` (30).

`MatchReview`: `{ id, reason: "state_mismatch"|"inputs_mismatch"|"replay_mismatch"|"result_mismatch", status, details, note,
created_at, match: { id, status, mode, engine_version, players: [{ id, display_name }], replay_url } }`

`CharacterSummary`:
```json
{ "slug": "kaze", "name": "Kaze", "author": "Fulano", "version": "1.0.0",
  "sha256": "<hex do corpo do pack>", "size_bytes": 12345, "premium": false,
  "status": "approved", "pack_url": "https://<host>/api/v1/characters/kaze/pack",
  "updated_at": "2026-10-18T00:00:00Z" }
```

### Pack (formato `mugen-arena-pack/1`)

Um personagem no formato de texto do MUGEN (`.def`, `.air`, `.cmd`, `.cns`) empacotado em JSON:
```json
{
  "format": "mugen-arena-pack/1",
  "id": "kaze",
  "name": "Kaze",
  "author": "Fulano",
  "version": "1.0.0",
  "def": "kaze.def",
  "files": { "kaze.def": "...", "kaze.air": "...", "kaze.cmd": "...", "kaze.cns": "..." },
  "sprites": null
}
```
`sprites` (opcional): `{ "atlas": "<https URL ou data:image/png;base64,...>", "frames": { "<grupo>,<índice>": [x, y, w, h, axisX, axisY] } }`.

Validação do servidor: `format` correto; `id` = `/\A[a-z0-9][a-z0-9_-]{1,31}\z/`; `def` presente em `files`;
`[Files]` declara `cmd`, `cns` e `anim` (ou `air`) e todos os arquivos referenciados (`cmd`, `cns`, `anim`, `st*`)
estão no pack; `stcommon` é opcional (a engine traz o próprio common1); corpo ≤ `PACK_MAX_BYTES` (padrão 5 MB).
Re-submeter o mesmo `id` pelo mesmo autor cria nova versão `pending` (a aprovada continua servida até a nova ser
aprovada; pendentes antigas do mesmo slug viram `rejected`). Submeter um `id` de outro autor → `403 forbidden`
(admins podem). Respostas 422 trazem `details` com a lista de erros. `GET .../pack` responde com `ETag`.

`sprites.scale` (opcional, padrão 1) = pixels do atlas por unidade do MUGEN; `sprites.atlas` pode ser uma lista de
páginas e cada frame pode ter um 7º número com o índice da página.

`sounds` (opcional, desde a 0.4.0): `{ "<grupo>,<índice>": "data:audio/wav;base64,..." }` com os sons do `.snd`
usados pelos estados (PlaySnd, hitsound, guardsound). Packs sem esse campo continuam válidos.

`CharacterSummary.premium` é legado: o download do pack não exige mais nada (jogo pago, nada bloqueado).

## Licença (jogo pago)

O MUGEN Arena é vendido na Google Play (compra única). O **online** (fila ranqueada e salas) só aceita cópias
compradas; o **modo offline nunca depende de licença**. A prova é o veredito do **Play Integrity**
(`@expo/app-integrity` no app, `web/app/services/integrity/*` no servidor).

Fluxo (`mobile/src/services/license.ts`, só Android, antes de entrar no online):
1. Se `player.license_required` é falso, ou `licensed_until` ainda vale por mais de 24 h, não faz nada.
2. `POST /api/v1/license/challenge` (Bearer) → `{ "nonce": "<string>", "required": true }`. O nonce é assinado com o
   `secret_key_base`, amarrado ao jogador e vale 5 min (sem tabela).
3. O app chama o Play Integrity (projeto do Google Cloud em `EXPO_PUBLIC_PLAY_CLOUD_PROJECT`) com
   `requestHash` = SHA-256(nonce) em hex.
4. `POST /api/v1/license/verify` (Bearer) body `{ "nonce": "...", "token": "<token do Play Integrity>" }`:
   - `200 { "licensed_until": "<iso8601>" }` — aprovado; o servidor grava `players.licensed_until` = agora + 7 dias.
   - `403 { "error": "<motivo>" }`, com motivo:
     `invalid_nonce` (nonce vencido ou de outro jogador), `wrong_request` (`requestHash`/pacote não batem),
     `stale_token` (token com mais de 10 min), `unrecognized_app` (não é `PLAY_RECOGNIZED`),
     `not_licensed` (não é `LICENSED`), `device_integrity` (sem `MEETS_DEVICE_INTEGRITY`).
   - `503 { "error": "license_unavailable" }` — conta de serviço não configurada ou API do Google fora.

O servidor decodifica o token no Google (`decodeIntegrityToken` do pacote `PLAY_INTEGRITY_PACKAGE`, padrão
`br.com.conexus.mugenarena`) com a conta de serviço em `PLAY_INTEGRITY_SERVICE_ACCOUNT` (JSON, nunca no Git) e
exige os três vereditos: `PLAY_RECOGNIZED` + `LICENSED` + `MEETS_DEVICE_INTEGRITY`.

Com `PLAY_INTEGRITY_REQUIRED=1` (produção), o `MatchmakingChannel` responde `{ type: "error", error:
"license_required" }` a quem não tem `licensed_until` no futuro. Desligado (dev, testes, versão web), todo jogador
conta como licenciado.

iOS: não há checagem — o App Attest prova que o app é genuíno, mas não prova compra.

## Telemetria — `POST /api/telemetry/batch`

Eventos anônimos do app, **só com consentimento** do jogador (diálogo da primeira abertura ou
Ajustes › Sobre › "Enviar dados de uso e falhas"; recusar apaga a fila local). Sem autenticação de
propósito: o lote não é ligado a conta. O app nunca manda `Authorization`, nome, e-mail, `sub`, IP,
ID de aparelho ou de anúncio; `session_id` é um UUID v4 aleatório por abertura do app. Textos
(mensagem/pilha de erro) passam por limpeza de e-mail, JWT, Bearer, UUID e query string no app.

Corpo (≤ 64 KB, 1–100 eventos; o app manda lotes de até 50):
```json
{
  "schema": 1,
  "session_id": "3f2b8c1e-5d4a-4f6b-9c7e-1a2b3c4d5e6f",
  "app": { "version": "0.4.0", "platform": "android", "os_version": "14", "build": "release", "screen_aspect": 2.22 },
  "events": [ { "name": "fight_end", "at": "2026-10-18T12:00:00Z", "props": { "mode": "arcade", "result": "win", "duration_s": 74 } } ]
}
```

Eventos e props (todas opcionais; chave fora da lista, tipo errado ou texto maior que o limite ⇒ evento descartado):

| Evento | Props |
|---|---|
| `session_start` | — |
| `session_end` | `duration_s` int (tempo em primeiro plano; enviado a cada ida para segundo plano, vale o maior por `session_id`) |
| `tutorial` | `step` str(32), `completed` bool — reservado, o jogo ainda não tem tutorial |
| `fight_start` | `mode` (`arcade`\|`versus`\|`training`\|`team`\|`online`\|`bench`), `p1`, `p2`, `stage` str(32), `difficulty` int |
| `fight_end` | `mode`, `p1`, `p2`, `result` (`win`\|`loss`\|`draw`\|`abandoned`\|`quit`), `duration_s` int |
| `online_queue` | `mode` (`ranked`\|`room`), `outcome` (`matched`\|`canceled`\|`error`), `wait_s` int, `error` str(64) |
| `perf` | `mode`, `frames`, `fps_avg`, `fps_p5`, `frame_ms_p95`, `frame_ms_max`, `sim_ms_p95`, `draw_ms_p95`, `rollbacks`, `long_frames` (resumo da luta inteira) |
| `crash` | `message` str(300), `stack` str(2000), `fatal` bool, `source` (`global`\|`boundary`\|`promise`), `screen` str(64), `previous_session` bool |

Esquema único nos dois lados: `mobile/src/services/telemetrySchema.ts` ⇄ `web/app/services/telemetry/schema.rb`.

Respostas:
- `202 { "accepted": n, "rejected": m }` — os válidos são gravados, os inválidos descartados (o app não reenvia).
- `413 payload_too_large` — corpo > 64 KB.
- `422 validation_failed` + `details` — envelope inválido (`schema` ≠ 1, `session_id` não é UUID, `app` sem
  `version`/`platform`, `events` vazio ou > 100, JSON inválido). O app descarta o lote.
- `429 rate_limited` — mais de 30 lotes/min por IP (o IP só é chave do limite no cache, não é gravado).
  O app guarda a fila e tenta de novo com espera crescente (30 s … 5 min), como em erro de rede/5xx.

Servidor também descarta evento com `at` fora de [agora − 90 dias, agora + 1 dia] ou texto com cara de
e-mail. Guarda em `telemetry_events` (sem `player_id`) por 90 dias (`TelemetryPurgeJob`, diário).

## Online — ActionCable

URL: `wss://<host>/cable?token=<access_token>` (conexão recusada sem JWT válido).

### `MatchmakingChannel`
Params de subscribe: `{ mode: "ranked" | "room", room_code?: string, character: slug, pack_sha256: hex, engine_version: string }`

`engine_version` (obrigatório, `/\A[0-9A-Za-z.+_-]{1,40}\z/`) = `<versão do app>+net<protocolo>` (`mobile/src/net/version.ts`).
O servidor só junta a mesma `engine_version`: versões diferentes da engine dessincronizam. Sem ela → assinatura recusada.

Servidor → cliente (`transmit`):
- `{ type: "queued", rating, league }` — entrou na fila ranked (rating/liga da temporada atual).
- `{ type: "room_created", room_code: "ABCD12" }` — `mode: "room"` sem código.
- `{ type: "matched", match_id, side: 0|1, seed: <int32>, input_delay: 2, engine_version,
     opponent: { display_name, rating, league, character, pack_sha256 } }`
- `{ type: "error", error: "room_not_found" | "room_full" | "already_queued" | "version_mismatch" | "license_required" }`
  (`license_required` só com `PLAY_INTEGRITY_REQUIRED=1`, ver § Licença)

Ação cliente: `cancel` (sai da fila / fecha sala). Unsubscribe também sai.
Ranked pareia o mais antigo da fila (mesma `engine_version`) com rating da temporada dentro da janela, que alarga com
a espera (vale a maior dos dois): ±100, +50 a cada 5 s, e qualquer rating a partir de 30 s.

### `MatchChannel`
Params: `{ match_id, resume?: true, from?: <primeiro quadro remoto que falta> }` — só os dois participantes, partida
`waiting` ou `active`. Servidor faz `stream_for match`. Cada assinatura vira a conexão vigente daquele lado.

Ações cliente → servidor (relay para os dois; cada cliente ignora mensagens com o próprio `side`):
- `ready` → quando ambos: broadcast `{ type: "start", at: <epoch ms> }`
- `input { frames: [[frame, bits], ...], ack: <último frame remoto contíguo recebido> }` → broadcast
  `{ type: "input", side, frames, ack }`. O cliente reenvia tudo desde `ack + 1` do oponente (mensagens podem se
  perder ou chegar fora de ordem; repetidas são ignoradas).
- `checksum { frame, value, inputs_hash }` → broadcast `{ type: "checksum", side, frame, value, inputs_hash }` e
  grava. A cada 60 quadros confirmados: `value` = hash FNV-1a 32 bits do estado (bits exatos dos números,
  `mobile/src/net/hash.ts`), `inputs_hash` = FNV-1a 32 das entradas dos dois lados nos quadros 1..frame (bits do
  lado 0 e do lado 1, 16 bits little endian cada). Os dois lados com valores diferentes no mesmo quadro → partida
  `void` (anulada), revisão aberta e broadcast `{ type: "voided", reason: "state_mismatch" | "inputs_mismatch" }`.
- `input_log { from, bits: [...] }` — registro das próprias entradas (blocos contíguos a partir do quadro 1, ≤ 600
  por bloco, cada `bits` 0..2047; o app manda ~1 bloco/s). Repetição/sobreposição é aparada. Bloco depois de um
  buraco não é gravado: `transmit` só ao remetente `{ type: "input_log_gap", next }` e o cliente reenvia desde `next`.
- `result { winner_side: 0|1|null }` (o app manda o último `input_log` antes) → quando os dois relatos batem:
  confere o replay (hash das entradas registradas até o último quadro com checksum dos dois lados = `inputs_hash`
  relatado); se bater, grava resultado e aplica Glicko-2 da temporada (salas privadas só contam se
  `RATED_ROOM_MATCHES=true`) e broadcast `{ type: "finished", winner_side, ratings: { "0": n, "1": n } }`; se não
  bater, `void` + `{ type: "voided", reason: "replay_mismatch" }`. Relatos divergentes: status `disputed`, revisão
  aberta, broadcast `{ type: "finished", winner_side: null, disputed: true }`.
- `ping { t }` → `transmit` só ao remetente `{ type: "pong", t }` (o app pinga a cada 1 s na luta)
- `leave` → desistência: partida `active` vira `abandoned` na hora (quem saiu perde), broadcast
  `{ type: "opponent_left", side }`.

Queda e reconexão (desenho em `docs/ONLINE.md`):
- Unsubscribe sem `leave` com a partida `active` (e vindo da conexão vigente daquele lado): o lado fica
  desconectado e broadcast `{ type: "opponent_disconnected", side, grace_ms: 10000 }`
  (`RECONNECT_GRACE_SECONDS`). Se não voltar no prazo: `abandoned`, quem caiu perde, broadcast
  `{ type: "opponent_left", side }`. Se os dois estiverem fora no fim do prazo: `abandoned` sem vencedor e sem rating.
- Nova assinatura com `resume: true, from` (ou qualquer assinatura de um lado marcado como desconectado):
  `transmit` `{ type: "resume", status, from, frames: [bits...], log_next }` — `frames` = entradas registradas do
  oponente a partir de `from` (índice 0 = `from`), `log_next` = próximo quadro que o servidor espera no
  `input_log` deste lado — e broadcast `{ type: "resync", side, from }`: o oponente reenvia as próprias entradas
  desde `from`. A queda de uma conexão antiga percebida depois da reconexão é ignorada.
- Unsubscribe com a partida `waiting`: `abandoned` sem rating + `{ type: "opponent_left", side }`.
- Quem sai **depois de relatar** o resultado não conta como queda nem abandono; se o outro lado nunca relatar, a
  faxina encerra a partida com o relato existente após 2 min. O cliente espera o `finished` (até 4 s) antes de sair.

Em `/api/v1/matches`, `opponent` = `{ display_name, rating }`, partida `disputed` aparece como `draw` e `void` como `void`.

`bits` de input (inteiro): `U=1 D=2 L=4 R=8 a=16 b=32 c=64 x=128 y=256 z=512 s=1024`.

## Webhooks recebidos (`POST /conexus/webhooks`, header `X-Conexus-Signature: sha256=<hmac>`)

- `user.created`, `user.updated` (bff-auth) → upsert `Player` (nome, email, avatar).
- Legado: `entitlement.changed`, `subscription.activated`, `subscription.canceled` (bff-payment) com
  `product_slug == CONEXUS_PRODUCT_SLUG` ainda atualizam `Player#premium`, mas isso não libera nem bloqueia nada
  (jogo pago; o app não usa mais o bff-payment).
- Idempotência por `id` do evento (tabela `conexus_webhook_events`).

## Mensagens enviadas (bff-api, via gem `conexus-platform`, sempre em job Solid Queue)

- `character.submitted` → email para `ADMIN_NOTIFY_EMAILS` (idempotency `character-submitted-<id>`)
- `character.approved` / `character.rejected` → email para o autor (idempotency `character-reviewed-<id>-<status>`)
