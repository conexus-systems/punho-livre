# frozen_string_literal: true

module Ratings
  # Glicko-2 (Mark Glickman, "Example of the Glicko-2 system", 2013), aplicado
  # partida a partida (um "período de rating" por partida, como o Lichess).
  #
  # Por que Glicko-2 e não Elo com K variável (docs/ONLINE.md):
  # - a incerteza (deviation) é por jogador: quem é novo ou voltou de pausa
  #   anda rápido, quem já tem muitas partidas anda devagar — o K variável do
  #   Elo tenta imitar isso com faixas fixas;
  # - a volatilidade acompanha quem está melhorando de verdade;
  # - o ganho/perda leva em conta a incerteza do oponente (vencer um novato
  #   com deviation alta vale menos).
  #
  # Escala Glicko: rating 1500, deviation 350, volatilidade 0,06.
  module Glicko2
    BASE_RATING = 1500.0
    BASE_DEVIATION = 350.0
    BASE_VOLATILITY = 0.06
    MIN_DEVIATION = 45.0
    SCALE = 173.7178
    # τ: quanto a volatilidade pode mudar (0,3–1,2; menor = mais conservador).
    TAU = 0.5
    EPSILON = 0.000001
    # Inatividade: cada dia sem jogar conta como um período (a incerteza cresce).
    PERIOD = 1.day

    Rating = Data.define(:rating, :deviation, :volatility)

    module_function

    # Atualiza `player` (Rating) com os resultados [[opp Rating, score], ...]
    # (score 1 vitória, 0,5 empate, 0 derrota). `idle` = tempo sem jogar.
    def rate(player, results, idle: 0)
      mu = (player.rating - BASE_RATING) / SCALE
      phi = inflate(player.deviation, player.volatility, idle) / SCALE
      sigma = player.volatility
      return Rating.new(player.rating, phi * SCALE, sigma) if results.empty?

      v_inv = 0.0
      delta_sum = 0.0
      results.each do |opp, score|
        mu_j = (opp.rating - BASE_RATING) / SCALE
        g_j = g(opp.deviation / SCALE)
        e_j = expected(mu, mu_j, g_j)
        v_inv += g_j * g_j * e_j * (1 - e_j)
        delta_sum += g_j * (score - e_j)
      end
      v = 1.0 / v_inv
      delta = v * delta_sum

      sigma_new = new_volatility(phi, sigma, v, delta)
      phi_star = Math.sqrt((phi * phi) + (sigma_new * sigma_new))
      phi_new = 1.0 / Math.sqrt((1.0 / (phi_star * phi_star)) + (1.0 / v))
      mu_new = mu + (phi_new * phi_new * delta_sum)

      Rating.new(
        (mu_new * SCALE) + BASE_RATING,
        (phi_new * SCALE).clamp(MIN_DEVIATION, BASE_DEVIATION),
        sigma_new
      )
    end

    # Probabilidade esperada de `a` vencer `b` (para exibir/testes).
    def win_probability(a, b)
      g_b = g(Math.sqrt((a.deviation**2) + (b.deviation**2)) / SCALE)
      expected((a.rating - BASE_RATING) / SCALE, (b.rating - BASE_RATING) / SCALE, g_b)
    end

    def inflate(deviation, volatility, idle)
      periods = idle.to_f / PERIOD
      return deviation if periods <= 0

      phi = deviation / SCALE
      [ Math.sqrt((phi * phi) + (periods * volatility * volatility)) * SCALE, BASE_DEVIATION ].min
    end

    def g(phi)
      1.0 / Math.sqrt(1 + (3 * phi * phi / (Math::PI**2)))
    end

    def expected(mu, mu_j, g_j)
      1.0 / (1 + Math.exp(-g_j * (mu - mu_j)))
    end

    # Passo 5 do artigo (método de Illinois).
    def new_volatility(phi, sigma, v, delta)
      a = Math.log(sigma * sigma)
      f = lambda do |x|
        ex = Math.exp(x)
        num = ex * ((delta * delta) - (phi * phi) - v - ex)
        den = 2 * (((phi * phi) + v + ex)**2)
        (num / den) - ((x - a) / (TAU * TAU))
      end

      big_a = a
      if delta * delta > (phi * phi) + v
        big_b = Math.log((delta * delta) - (phi * phi) - v)
      else
        k = 1
        k += 1 while f.call(a - (k * TAU)) < 0
        big_b = a - (k * TAU)
      end

      f_a = f.call(big_a)
      f_b = f.call(big_b)
      100.times do
        break if (big_b - big_a).abs <= EPSILON

        big_c = big_a + ((big_a - big_b) * f_a / (f_b - f_a))
        f_c = f.call(big_c)
        if f_c * f_b <= 0
          big_a = big_b
          f_a = f_b
        else
          f_a /= 2.0
        end
        big_b = big_c
        f_b = f_c
      end
      Math.exp(big_a / 2)
    end
  end
end
