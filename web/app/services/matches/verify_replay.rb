# frozen_string_literal: true

module Matches
  # Confere o replay guardado contra o que os dois lados relataram: o hash das
  # entradas registradas (input_log) até o último quadro com checksum dos dois
  # lados tem de bater com o `inputs_hash` relatado. Se um cliente mandou ao
  # relay entradas diferentes das que registrou (ou o registro foi
  # adulterado), não bate.
  #
  # Devolve nil (ok ou sem dados suficientes para conferir) ou os detalhes
  # da divergência.
  module VerifyReplay
    module_function

    def call(match)
      p1 = InputLog.frames_from(match.id, 0, 1)
      p2 = InputLog.frames_from(match.id, 1, 1)
      covered = [ p1.size, p2.size ].min
      return nil if covered.zero?

      check = MatchChecksum.where(match_id: match.id, frame: ..covered).where.not(inputs_hash: nil)
                           .group(:frame).having("COUNT(*) = 2").order(frame: :desc).limit(1).pluck(:frame).first
      return nil unless check

      expected = InputsHash.call(p1, p2, check)
      reported = MatchChecksum.where(match_id: match.id, frame: check).order(:side).pluck(:inputs_hash)
      return nil if reported.all?(expected)

      { frame: check, expected: expected, reported: reported }
    end
  end
end
