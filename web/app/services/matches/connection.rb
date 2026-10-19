# frozen_string_literal: true

module Matches
  # Queda e volta de um lado no meio da luta (docs/ONLINE.md → Reconexão).
  #
  # Cada assinatura do MatchChannel registra um token de conexão por lado.
  # Queda (unsubscribe sem `leave`) com a partida `active` e vinda da conexão
  # mais recente: marca o lado como desconectado e agenda
  # MatchReconnectTimeoutJob para daqui a RECONNECT_GRACE_SECONDS. Se o lado
  # voltar antes (nova assinatura), a marca some e o job não faz nada. A queda
  # de uma conexão antiga, percebida pelo servidor só depois da reconexão,
  # é ignorada.
  module Connection
    module_function

    def grace
      Rails.application.config.x.mugen.reconnect_grace_seconds.seconds
    end

    # Nova assinatura do lado: vira a conexão vigente e limpa a marca de queda.
    # Devolve true se o lado estava marcado como desconectado.
    def connected!(match_id:, side:, token:)
      Match.transaction do
        match = Match.lock.find_by(id: match_id)
        return false unless match&.open?

        was_down = match.disconnected_at(side).present?
        match.update!(connection_column(side) => token, match.disconnected_column(side) => nil)
        was_down
      end
    end

    # Devolve o horário da queda (para o job conferir) ou nil se não se aplica.
    def disconnected!(match_id:, side:, token:)
      Match.transaction do
        match = Match.lock.find_by(id: match_id)
        return nil unless match&.active?
        return nil unless match.public_send(connection_column(side)) == token # já reconectou por outra conexão
        return nil if match.reports.key?(side.to_s) # já relatou: não é abandono

        at = Time.current
        match.update!(match.disconnected_column(side) => at)
        MatchReconnectTimeoutJob.set(wait: grace).perform_later(match.id, side, at.iso8601(6))
        at
      end
    end

    def connection_column(side)
      side.to_i.zero? ? :p1_connection : :p2_connection
    end
  end
end
