# frozen_string_literal: true

# Entrada na fila de matchmaking (ranked) ou sala privada (room) aguardando
# oponente. Um ticket por jogador.
class MatchmakingTicket < ApplicationRecord
  MODES = %w[ranked room].freeze
  # Tickets sem heartbeat há mais que isso são considerados órfãos (processo caiu).
  STALE_AFTER = 30.seconds

  belongs_to :player

  validates :mode, inclusion: { in: MODES }
  validates :character, :token, :rating, presence: true

  scope :fresh, -> { where(heartbeat_at: STALE_AFTER.ago..) }
  scope :stale, -> { where(heartbeat_at: ...STALE_AFTER.ago) }

  def stream_name
    "matchmaking:#{token}"
  end
end
