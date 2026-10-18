# frozen_string_literal: true

# Configuração específica do MUGEN Arena (ver docs/PROTOCOL.md na raiz do repo).
Rails.application.config.x.mugen = ActiveSupport::OrderedOptions.new

# Claim `groups` do JWT que dá acesso às rotas /api/v1/admin.
Rails.application.config.x.mugen.admin_groups =
  ENV.fetch("ADMIN_GROUPS", "mugen-arena-admin,admin").split(",").map(&:strip).reject(&:empty?)

# Quem recebe o e-mail de "personagem submetido" (via bff-api).
Rails.application.config.x.mugen.admin_notify_emails =
  ENV.fetch("ADMIN_NOTIFY_EMAILS", "").split(",").map(&:strip).reject(&:empty?)

# Partidas de sala privada (mode: "room") mexem no rating? Padrão: não, para
# evitar farm de Elo entre amigos. Ranked sempre conta.
Rails.application.config.x.mugen.rated_room_matches =
  ActiveModel::Type::Boolean.new.cast(ENV.fetch("RATED_ROOM_MATCHES", "false"))
