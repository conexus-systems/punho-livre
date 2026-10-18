# frozen_string_literal: true

# Fim da tolerância de reconexão de um lado (Matches::Connection). Se o lado
# continua desconectado desde a mesma queda: derrota por abandono e aviso
# `opponent_left`; se os dois estão fora, a partida é encerrada sem rating.
class MatchReconnectTimeoutJob < ApplicationJob
  queue_as :default

  def perform(match_id, side, disconnected_at)
    match = Match.find_by(id: match_id)
    return unless match&.active?

    since = match.disconnected_at(side)
    return unless since && since.iso8601(6) == disconnected_at

    if match.disconnected_at(1 - side)
      # o outro também está fora: ninguém é punido (provável falha de rede/servidor)
      return unless Matches::Abandon.both_gone(match_id: match.id)
    else
      return unless Matches::Abandon.call(match_id: match.id, leaver_side: side)
    end
    MatchChannel.broadcast_to(match, { type: "opponent_left", side: side })
  end
end
