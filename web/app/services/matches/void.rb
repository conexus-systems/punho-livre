# frozen_string_literal: true

module Matches
  # Anula a partida (anti-trapaça): status `void`, nada de rating/W-L, e
  # registro na fila de revisão. Devolve o payload `voided` para broadcast,
  # ou nil se a partida já estava encerrada.
  module Void
    module_function

    def call(match_id:, reason:, details: {})
      Match.transaction do
        match = Match.lock.find_by(id: match_id)
        return nil unless match&.open?

        match.update!(status: "void", void_reason: reason, winner_side: nil, finished_at: Time.current)
        MatchReview.create!(match: match, reason: reason, details: details)
        Rails.logger.warn("[match] voided match_id=#{match.id} reason=#{reason} details=#{details.to_json}")
        { type: "voided", reason: reason }
      end
    end
  end
end
