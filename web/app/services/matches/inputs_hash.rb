# frozen_string_literal: true

module Matches
  # Hash das entradas dos dois lados, igual ao do app (mobile/src/net/hash.ts,
  # `InputsHash`): FNV-1a 32 bits sobre os quadros 1..N, cada quadro = bits
  # do lado 0 e do lado 1 em 16 bits little endian.
  module InputsHash
    OFFSET = 0x811c9dc5
    PRIME = 0x01000193
    MASK = 0xffffffff

    module_function

    # p1_bits/p2_bits: arrays (índice 0 = quadro 1). Devolve o hash até `frames`.
    def call(p1_bits, p2_bits, frames)
      raise ArgumentError, "inputs end before frame #{frames}" if p1_bits.size < frames || p2_bits.size < frames

      h = OFFSET
      frames.times do |i|
        a = p1_bits[i]
        b = p2_bits[i]
        h = step(h, a & 0xff)
        h = step(h, (a >> 8) & 0xff)
        h = step(h, b & 0xff)
        h = step(h, (b >> 8) & 0xff)
      end
      h
    end

    def step(hash, byte)
      ((hash ^ byte) * PRIME) & MASK
    end
  end
end
