# frozen_string_literal: true

module Matches
  # Registro das entradas de cada lado (ação `input_log`): blocos contíguos a
  # partir do quadro 1. Serve para a reconexão (o relay devolve as entradas do
  # oponente) e como replay (seed + entradas + versão) para disputas.
  module InputLog
    MAX_BITS = 0x7ff
    MAX_CHUNK = 600

    class Invalid < ArgumentError; end

    module_function

    # Próximo quadro esperado do lado (1 = nada registrado ainda).
    def next_frame(match_id, side)
      (MatchInputChunk.where(match_id: match_id, side: side).maximum(:to_frame) || 0) + 1
    end

    # Grava o bloco. Devolve { ok: true, next: n } ou, se houver buraco
    # (o cliente perdeu um bloco na queda), { ok: false, next: n } sem gravar.
    # Blocos repetidos/sobrepostos são aparados.
    def append(match_id:, side:, from:, bits:)
      validate!(from, bits)
      expected = next_frame(match_id, side)
      return { ok: false, next: expected } if from > expected

      bits = bits.drop(expected - from)
      return { ok: true, next: expected } if bits.empty?

      MatchInputChunk.create!(match_id: match_id, side: side, from_frame: expected,
                              to_frame: expected + bits.size - 1, bits: bits, created_at: Time.current)
      { ok: true, next: expected + bits.size }
    rescue ActiveRecord::RecordNotUnique
      # dois blocos iguais ao mesmo tempo (reenvio): o outro já gravou
      { ok: true, next: next_frame(match_id, side) }
    end

    # Entradas registradas de um lado a partir de `from` (array, índice 0 = from).
    def frames_from(match_id, side, from)
      out = []
      MatchInputChunk.where(match_id: match_id, side: side).where("to_frame >= ?", from)
                     .order(:from_frame).pluck(:from_frame, :bits).each do |start, bits|
        break if start > from + out.size

        skip = from + out.size - start
        out.concat(bits.drop(skip)) if skip < bits.size
      end
      out
    end

    def validate!(from, bits)
      raise Invalid, "from must be a positive integer" unless from.is_a?(Integer) && from.positive?
      unless bits.is_a?(Array) && bits.size <= MAX_CHUNK && bits.all? { |b| b.is_a?(Integer) && b.between?(0, MAX_BITS) }
        raise Invalid, "bits must be up to #{MAX_CHUNK} integers in 0..#{MAX_BITS}"
      end
    end
  end
end
