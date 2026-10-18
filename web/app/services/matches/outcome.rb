# frozen_string_literal: true

module Matches
  # Aplica o desfecho de uma partida aos jogadores (rating Elo + W/L).
  # Chamar dentro de uma transação com a partida já travada (FOR UPDATE).
  module Outcome
    module_function

    # winner_side: 0, 1 ou nil (empate). Partidas não ranqueadas (sala, sem
    # RATED_ROOM_MATCHES) só registram o vencedor.
    def apply!(match, winner_side)
      p1, p2 = lock_players(match)
      return [ p1, p2 ] unless match.rated?

      score_p1 = case winner_side
      when 0 then 1.0
      when 1 then 0.0
      else 0.5
      end
      d1, d2 = Ratings::Elo.deltas(p1.rating, p2.rating, score_p1)

      applied1 = apply_rating!(p1, d1, won: winner_side == 0, lost: winner_side == 1)
      applied2 = apply_rating!(p2, d2, won: winner_side == 1, lost: winner_side == 0)
      match.p1_rating_delta = applied1
      match.p2_rating_delta = applied2
      [ p1, p2 ]
    end

    # Trava os dois jogadores em ordem de id (evita deadlock entre partidas).
    def lock_players(match)
      locked = Player.where(id: [ match.player1_id, match.player2_id ]).order(:id).lock.index_by(&:id)
      [ locked.fetch(match.player1_id), locked.fetch(match.player2_id) ]
    end

    def apply_rating!(player, delta, won:, lost:)
      new_rating = [ player.rating + delta, 0 ].max
      applied = new_rating - player.rating
      player.rating = new_rating
      player.wins += 1 if won
      player.losses += 1 if lost
      player.save!
      applied
    end
  end
end
