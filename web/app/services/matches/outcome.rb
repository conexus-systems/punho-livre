# frozen_string_literal: true

module Matches
  # Aplica o desfecho de uma partida aos jogadores: Glicko-2 da temporada da
  # partida (SeasonRating), W/L da temporada e da vida toda, e o rating
  # exibido em `players.rating`.
  # Chamar dentro de uma transação com a partida já travada (FOR UPDATE).
  module Outcome
    module_function

    # winner_side: 0, 1 ou nil (empate). Partidas não ranqueadas (sala, sem
    # RATED_ROOM_MATCHES) só registram o vencedor.
    def apply!(match, winner_side)
      p1, p2 = lock_players(match)
      return [ p1, p2 ] unless match.rated?

      season = match.season || Season.current
      r1, r2 = lock_ratings(season, p1, p2)
      now = Time.current
      score1 = case winner_side
      when 0 then 1.0
      when 1 then 0.0
      else 0.5
      end

      new1 = Ratings::Glicko2.rate(glicko(r1), [ [ glicko(r2), score1 ] ], idle: idle(r1, now))
      new2 = Ratings::Glicko2.rate(glicko(r2), [ [ glicko(r1), 1.0 - score1 ] ], idle: idle(r2, now))

      match.p1_rating_delta = store!(r1, new1, score1, now)
      match.p2_rating_delta = store!(r2, new2, 1.0 - score1, now)
      current = season.id == Season.current.id
      update_player!(p1, r1, won: winner_side == 0, lost: winner_side == 1, current: current)
      update_player!(p2, r2, won: winner_side == 1, lost: winner_side == 0, current: current)
      [ p1, p2 ]
    end

    # Trava os dois jogadores em ordem de id (evita deadlock entre partidas).
    def lock_players(match)
      locked = Player.where(id: [ match.player1_id, match.player2_id ]).order(:id).lock.index_by(&:id)
      [ locked.fetch(match.player1_id), locked.fetch(match.player2_id) ]
    end

    def lock_ratings(season, p1, p2)
      SeasonRating.for!(p1, season)
      SeasonRating.for!(p2, season)
      locked = SeasonRating.where(season: season, player_id: [ p1.id, p2.id ]).order(:player_id).lock
                           .index_by(&:player_id)
      [ locked.fetch(p1.id), locked.fetch(p2.id) ]
    end

    def glicko(record)
      Ratings::Glicko2::Rating.new(record.rating, record.deviation, record.volatility)
    end

    def idle(record, now)
      record.last_match_at ? now - record.last_match_at : 0
    end

    # Grava o novo rating; devolve a variação do rating exibido (inteiro).
    def store!(record, new_rating, score, now)
      before = record.display_rating
      record.rating = new_rating.rating
      record.deviation = new_rating.deviation
      record.volatility = new_rating.volatility
      record.peak_rating = [ record.peak_rating, record.rating ].max
      if score == 1.0 then record.wins += 1
      elsif score.zero? then record.losses += 1
      else record.draws += 1
      end
      record.last_match_at = now
      record.save!
      record.display_rating - before
    end

    def update_player!(player, record, won:, lost:, current:)
      player.rating = record.display_rating if current
      player.wins += 1 if won
      player.losses += 1 if lost
      player.save!
    end
  end
end
