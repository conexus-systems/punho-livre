# frozen_string_literal: true

module Matches
  # Ação `result` do MatchChannel. Cada lado relata `winner_side`; quando os
  # dois relatos chegam:
  # - iguais → confere o replay (VerifyReplay); se bater, partida `finished`,
  #   Glicko-2 aplicado, payload `finished` com ratings; se não, `void`;
  # - diferentes → partida `disputed` (fila de revisão), payload `finished`
  #   com disputed: true.
  # Devolve o payload para broadcast, ou nil enquanto falta um relato.
  class ReportResult
    def self.call(...)
      new(...).call
    end

    def initialize(match_id:, side:, winner_side:)
      @match_id = match_id
      @side = side
      @winner_side = winner_side
    end

    def call
      unless @winner_side.nil? || Match::SIDES.include?(@winner_side)
        raise ArgumentError, "winner_side must be 0, 1 or null"
      end

      Match.transaction do
        match = Match.lock.find(@match_id)
        return nil unless match.active?

        match.reports = match.reports.merge(@side.to_s => @winner_side)
        unless match.reports.key?("0") && match.reports.key?("1")
          match.save!
          return nil
        end

        if match.reports["0"] == match.reports["1"]
          conclude!(match, match.reports["0"])
        else
          match.update!(status: "disputed", winner_side: nil, finished_at: Time.current)
          MatchReview.create!(match: match, reason: "result_mismatch", details: { reports: match.reports })
          { type: "finished", winner_side: nil, disputed: true }
        end
      end
    end

    # Faxina: partida `active` com só um relato há tempo demais (o outro lado
    # sumiu sem relatar). Vale o relato existente. Devolve o payload ou nil.
    def self.finalize_single_report(match_id)
      Match.transaction do
        match = Match.lock.find_by(id: match_id)
        return nil unless match&.active? && match.reports.size == 1

        new(match_id: match.id, side: nil, winner_side: nil).send(:conclude!, match, match.reports.values.first)
      end
    end

    private

    def conclude!(match, winner_side)
      mismatch = VerifyReplay.call(match)
      if mismatch
        match.save!
        return Void.call(match_id: match.id, reason: "replay_mismatch", details: mismatch)
      end

      p1, p2 = Outcome.apply!(match, winner_side)
      match.update!(status: "finished", winner_side: winner_side, finished_at: Time.current)
      { type: "finished", winner_side: winner_side, ratings: { "0" => p1.rating, "1" => p2.rating } }
    end
  end
end
