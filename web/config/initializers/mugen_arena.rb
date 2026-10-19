# frozen_string_literal: true

# Configuração específica do BAMBA (ver docs/PROTOCOL.md na raiz do repo).
Rails.application.config.x.mugen = ActiveSupport::OrderedOptions.new

# Claim `groups` do JWT que dá acesso às rotas /api/v1/admin.
Rails.application.config.x.mugen.admin_groups =
  ENV.fetch("ADMIN_GROUPS", "mugen-arena-admin,admin").split(",").map(&:strip).reject(&:empty?)

# Quem recebe o e-mail de "personagem submetido" (via bff-api).
Rails.application.config.x.mugen.admin_notify_emails =
  ENV.fetch("ADMIN_NOTIFY_EMAILS", "").split(",").map(&:strip).reject(&:empty?)

# Partidas de sala privada (mode: "room") mexem no rating? Padrão: não, para
# evitar farm de rating entre amigos. Ranked sempre conta.
Rails.application.config.x.mugen.rated_room_matches =
  ActiveModel::Type::Boolean.new.cast(ENV.fetch("RATED_ROOM_MATCHES", "false"))

# Ranqueada: duração de cada temporada (a próxima abre sozinha quando a atual acaba).
Rails.application.config.x.mugen.season_length_days = ENV.fetch("SEASON_LENGTH_DAYS", "56").to_i

# Online: quanto tempo um lado pode ficar desconectado no meio da luta antes de
# perder por abandono (docs/ONLINE.md → Reconexão).
Rails.application.config.x.mugen.reconnect_grace_seconds = ENV.fetch("RECONNECT_GRACE_SECONDS", "10").to_i

# Replays (entradas + checksums) de partidas sem revisão aberta são apagados depois disso.
Rails.application.config.x.mugen.replay_retention_days = ENV.fetch("REPLAY_RETENTION_DAYS", "30").to_i
