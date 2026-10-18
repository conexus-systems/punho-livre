# frozen_string_literal: true

# Bloco contíguo das entradas de um lado (ação `input_log` do MatchChannel).
# A concatenação dos blocos de cada lado + seed + versão = replay da partida.
class MatchInputChunk < ApplicationRecord
  belongs_to :match

  validates :side, inclusion: { in: Match::SIDES }
  validates :from_frame, :to_frame, numericality: { only_integer: true, greater_than: 0 }
end
