# frozen_string_literal: true

module Ranked
  # Ligas por faixa de rating da temporada. Até completar PLACEMENT_MATCHES
  # partidas na temporada o jogador está "em colocação" (sem liga).
  module Leagues
    PLACEMENT_MATCHES = 5

    League = Data.define(:key, :name, :min_rating, :next_min_rating)

    TABLE = [
      [ "bronze", "Bronze", 0 ],
      [ "prata", "Prata", 1400 ],
      [ "ouro", "Ouro", 1550 ],
      [ "platina", "Platina", 1700 ],
      [ "diamante", "Diamante", 1850 ],
      [ "mestre", "Mestre", 2000 ]
    ].freeze

    PLACEMENT = League.new(key: "placement", name: "Em colocação", min_rating: nil, next_min_rating: nil)

    module_function

    def for(rating:, matches: PLACEMENT_MATCHES)
      return PLACEMENT if matches < PLACEMENT_MATCHES

      index = TABLE.rindex { |(_, _, min)| rating.round >= min } || 0
      key, name, min = TABLE[index]
      League.new(key: key, name: name, min_rating: min, next_min_rating: TABLE[index + 1]&.last)
    end

    def keys
      TABLE.map(&:first)
    end

    def summary(league)
      { key: league.key, name: league.name, min_rating: league.min_rating, next_min_rating: league.next_min_rating }
    end
  end
end
