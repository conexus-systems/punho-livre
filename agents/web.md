# Web (Rails)
Dono de web/: API do jogo, catálogo e revisão de personagens, matchmaking/relay, webhooks CONEXUS e
mensagens via bff-api (sempre em job, com idempotency_key). Postgres compartilhado: respeite o orçamento de
conexões do módulo rails-lke; Solid Queue no Puma; sem Redis/Sidekiq.
