# frozen_string_literal: true

# Rating Glicko-2 de um jogador numa temporada (docs/ONLINE.md → Ranqueada).
class SeasonRating < ApplicationRecord
  # Na virada de temporada o rating anda metade do caminho até 1500 e a
  # incerteza volta a pelo menos 250 (as primeiras partidas mexem mais).
  CARRY_OVER = 0.5
  RESET_MIN_DEVIATION = 250.0

  belongs_to :season
  belongs_to :player

  validates :rating, :deviation, :volatility, numericality: true

  scope :placed, -> { where("wins + losses + draws >= ?", Ranked::Leagues::PLACEMENT_MATCHES) }

  # Rating do jogador na temporada, criando (com reinício parcial a partir da
  # temporada anterior) se ainda não existir. Mantém `players.rating` igual
  # ao rating exibido da temporada atual.
  def self.for!(player, season = Season.current)
    record = find_by(player: player, season: season) || create_for!(player, season)
    sync_player!(player, record) if season.id == Season.current.id
    record
  end

  def self.create_for!(player, season)
    prev_season = season.previous
    prev = prev_season && find_by(player: player, season: prev_season)
    attrs = {}
    if prev
      rating = Ratings::Glicko2::BASE_RATING + ((prev.rating - Ratings::Glicko2::BASE_RATING) * CARRY_OVER)
      attrs = { rating: rating, peak_rating: rating, deviation: [ prev.deviation, RESET_MIN_DEVIATION ].max,
                volatility: prev.volatility }
    end
    create_or_find_by!(player: player, season: season) { |r| r.assign_attributes(attrs) }
  end

  def self.sync_player!(player, record)
    player.update_columns(rating: record.display_rating) if player.rating != record.display_rating
  end

  def display_rating = rating.round
  def matches = wins + losses + draws

  def league
    Ranked::Leagues.for(rating: rating, matches: matches)
  end

  # Posição na temporada entre quem já terminou a colocação (1 = topo).
  def rank
    return nil if matches < Ranked::Leagues::PLACEMENT_MATCHES

    SeasonRating.placed.where(season_id: season_id).where("rating > ?", rating).count + 1
  end
end
