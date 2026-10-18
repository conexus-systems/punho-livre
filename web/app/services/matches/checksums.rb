# frozen_string_literal: true

module Matches
  # Ação `checksum`: guarda o hash do estado e o hash das entradas de um lado
  # num quadro e compara com o do outro lado no mesmo quadro. Divergência →
  # partida anulada (Matches::Void). Devolve o payload `voided` ou nil.
  module Checksums
    UINT32 = (0..0xffffffff)

    module_function

    def record(match_id:, side:, frame:, value:, inputs_hash: nil)
      raise ArgumentError, "frame must be a positive integer" unless frame.is_a?(Integer) && frame.positive?
      raise ArgumentError, "value must be uint32" unless value.is_a?(Integer) && UINT32.cover?(value)
      inputs_hash = nil unless inputs_hash.is_a?(Integer) && UINT32.cover?(inputs_hash)

      MatchChecksum.insert({ match_id: match_id, side: side, frame: frame, value: value, inputs_hash: inputs_hash,
                             created_at: Time.current }, unique_by: %i[match_id frame side])
      other = MatchChecksum.find_by(match_id: match_id, frame: frame, side: 1 - side)
      return nil unless other

      mine = MatchChecksum.find_by!(match_id: match_id, frame: frame, side: side)
      reason = mismatch_reason(mine, other)
      return nil unless reason

      sides = side.zero? ? [ mine, other ] : [ other, mine ]
      Void.call(match_id: match_id, reason: reason, details: {
        frame: frame,
        values: sides.map(&:value),
        inputs_hashes: sides.map(&:inputs_hash)
      })
    end

    # Entradas diferentes pesam mais (alguém viu entradas que o outro não mandou).
    def mismatch_reason(a, b)
      return "inputs_mismatch" if a.inputs_hash && b.inputs_hash && a.inputs_hash != b.inputs_hash
      return "state_mismatch" if a.value != b.value

      nil
    end
  end
end
