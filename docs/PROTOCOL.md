# MUGEN Arena — contrato cliente ⇄ backend

Fonte da verdade entre `mobile/` (Expo) e `web/` (Rails 8 API). Mudou aqui, muda nos dois lados.

Identidade, cobrança e mensagens **não** são implementadas aqui: vêm dos BFFs CONEXUS
(`bff-auth`, `bff-payment`, `bff-api`). Ver `CONEXUS.md`.

## Autenticação

- O app faz login no **bff-auth** via OAuth2 Authorization Code + PKCE (S256), cliente público.
  Redirect: `br.com.conexus.mugenarena://oauth/callback`.
- Todas as chamadas autenticadas ao backend usam `Authorization: Bearer <access_token do bff-auth>`
  (JWT RS256, `kid` em `<CONEXUS_AUTH_URL>/.well-known/jwks.json`, `aud` = client_id do app).
- O backend verifica o JWT (iss, aud ∈ `CONEXUS_AUTH_ALLOWED_AUDIENCES`, exp, `sub` UUID) e faz
  upsert do `Player` por `sub` (= `conexus_user_id`).
- Admin = claim `groups` contém algum valor de `ADMIN_GROUPS` (default `mugen-arena-admin,admin`).

Erros seguem `{ "error": "<code>", "message": "..." }`:
`401 invalid_token`, `403 forbidden`, `404 not_found`, `402 premium_required`, `422 validation_failed`, `503 auth_unavailable`.

## REST — `/api/v1`

| Método | Caminho | Auth | Resposta |
|---|---|---|---|
| GET | `/up` | — | 200 |
| GET | `/api/v1/me` | sim | `{ player }` |
| PATCH | `/api/v1/me` | sim | body `{ display_name }` → `{ player }` |
| GET | `/api/v1/characters` | não | `{ characters: [CharacterSummary] }` (só `approved`) |
| GET | `/api/v1/characters/:slug/pack` | só se premium | corpo = Pack JSON (bytes exatos usados no `sha256`) |
| POST | `/api/v1/characters` | sim | body `{ pack: Pack }` → `201 { character: CharacterSummary }` status `pending` |
| GET | `/api/v1/admin/characters?status=pending` | admin | `{ characters: [CharacterSummary] }` |
| PATCH | `/api/v1/admin/characters/:slug` | admin | body `{ status: "approved"\|"rejected", premium?: bool, reason?: string }` |
| GET | `/api/v1/leaderboard` | não | `{ players: [{ display_name, rating, wins, losses }] }` (top 100) |
| GET | `/api/v1/matches` | sim | `{ matches: [{ id, opponent, my_character, opponent_character, result: "win"\|"loss"\|"draw"\|"abandoned", rating_delta, finished_at }] }` |
| POST | `/conexus/webhooks` | HMAC | webhooks do bff-auth e bff-payment |

`player`:
```json
{ "id": 1, "conexus_user_id": "uuid", "display_name": "Ryo", "email": "a@b.c",
  "rating": 1000, "wins": 0, "losses": 0, "premium": false, "admin": false }
```

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

## Online — ActionCable

URL: `wss://<host>/cable?token=<access_token>` (conexão recusada sem JWT válido).

### `MatchmakingChannel`
Params de subscribe: `{ mode: "ranked" | "room", room_code?: string, character: slug, pack_sha256: hex }`

Servidor → cliente (`transmit`):
- `{ type: "queued" }` — entrou na fila ranked.
- `{ type: "room_created", room_code: "ABCD12" }` — `mode: "room"` sem código.
- `{ type: "matched", match_id, side: 0|1, seed: <int32>, input_delay: 2,
     opponent: { display_name, rating, character, pack_sha256 } }`
- `{ type: "error", error: "room_not_found" | "room_full" | "already_queued" }`

Ação cliente: `cancel` (sai da fila / fecha sala). Unsubscribe também sai.
Ranked pareia o mais antigo da fila com rating mais próximo (janela ±200, abre +50 a cada 10 s).

### `MatchChannel`
Params: `{ match_id }` — só os dois participantes. Servidor faz `stream_for match`.

Ações cliente → servidor (relay para os dois; cada cliente ignora mensagens com o próprio `side`):
- `ready` → quando ambos: broadcast `{ type: "start", at: <epoch ms> }`
- `input { frames: [[frame, bits], ...], ack: <último frame remoto recebido> }` → broadcast `{ type: "input", side, frames, ack }`
- `checksum { frame, value }` → broadcast `{ type: "checksum", side, frame, value }`
- `result { winner_side: 0|1|null }` → quando os dois relatos batem: grava resultado, Elo (K=32; salas privadas
  só contam se `RATED_ROOM_MATCHES=true`),
  broadcast `{ type: "finished", winner_side, ratings: { "0": n, "1": n } }`; se divergirem: status `disputed`,
  broadcast `{ type: "finished", winner_side: null, disputed: true }`
- `ping { t }` → `transmit` só ao remetente `{ type: "pong", t }`

Servidor → clientes: `{ type: "opponent_left" }` quando o outro desconecta com a partida ativa
(partida vira `abandoned`, quem saiu perde rating). Quem sai **depois de relatar** o resultado não conta como
abandono; se o outro lado nunca relatar, a faxina encerra a partida com o relato existente após 2 min.
O cliente espera o `finished` (até 4 s) antes de sair do canal.

Em `/api/v1/matches`, `opponent` = `{ display_name, rating }` e partida `disputed` aparece como `draw`.

`bits` de input (inteiro): `U=1 D=2 L=4 R=8 a=16 b=32 c=64 x=128 y=256 z=512 s=1024`.

## Webhooks recebidos (`POST /conexus/webhooks`, header `X-Conexus-Signature: sha256=<hmac>`)

- `user.created`, `user.updated` (bff-auth) → upsert `Player` (nome, email, avatar).
- `entitlement.changed`, `subscription.activated`, `subscription.canceled` (bff-payment) com
  `product_slug == CONEXUS_PRODUCT_SLUG` → `Player#premium` = `status == "active"`.
- Idempotência por `id` do evento (tabela `conexus_webhook_events`).

## Mensagens enviadas (bff-api, via gem `conexus-platform`, sempre em job Solid Queue)

- `character.submitted` → email para `ADMIN_NOTIFY_EMAILS` (idempotency `character-submitted-<id>`)
- `character.approved` / `character.rejected` → email para o autor (idempotency `character-reviewed-<id>-<status>`)
