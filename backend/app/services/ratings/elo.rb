# frozen_string_literal: true

module Ratings
  # Elo clássico com K = 32 (docs/PROTOCOL.md).
  module Elo
    K = 32

    module_function

    # Probabilidade esperada de A vencer B.
    def expected(rating_a, rating_b)
      1.0 / (1 + (10**((rating_b - rating_a) / 400.0)))
    end

    # score_a: 1 (A venceu), 0.5 (empate), 0 (A perdeu).
    # Devolve [delta_a, delta_b]; soma zero (o que A ganha, B perde).
    def deltas(rating_a, rating_b, score_a)
      delta = (K * (score_a - expected(rating_a, rating_b))).round
      [ delta, -delta ]
    end
  end
end
