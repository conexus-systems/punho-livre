# frozen_string_literal: true

# Checksum relatado por um lado: hash do estado e hash das entradas no quadro.
class MatchChecksum < ApplicationRecord
  belongs_to :match

  validates :side, inclusion: { in: Match::SIDES }
  validates :frame, numericality: { only_integer: true, greater_than: 0 }
end
