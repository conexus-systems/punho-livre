# frozen_string_literal: true

module Matches
  # Um lado saiu (unsubscribe do MatchChannel) com a partida em aberto.
  # - `active`: vira `abandoned`, quem saiu perde (Elo como derrota);
  # - `waiting` (ninguém lutou ainda): vira `abandoned` sem mexer em rating.
  # Devolve true se a partida foi abandonada agora (→ broadcast opponent_left).
  module Abandon
    module_function

    def call(match_id:, leaver_side:)
      Match.transaction do
        match = Match.lock.find_by(id: match_id)
        return false unless match&.open?
        # Faxina (leaver_side nil) só encerra partidas que nem começaram.
        return false if leaver_side.nil? && match.active?
        # Quem sai depois de relatar o resultado não abandonou: o relato do
        # oponente (ou a faxina de relatos pendentes) encerra a partida.
        return false if match.active? && match.reports.key?(leaver_side.to_s)

        attrs = { status: "abandoned", abandoned_by_side: leaver_side, finished_at: Time.current }
        if match.active?
          winner = 1 - leaver_side
          Outcome.apply!(match, winner)
          attrs[:winner_side] = winner
        end
        match.update!(attrs)
        true
      end
    end
  end
end
