# frozen_string_literal: true

# Ranqueada (docs/PROTOCOL.md → GET /api/v1/ranked e /leaderboard).
module RankedSerializer
  module_function

  def standing(record)
    {
      season: record.season.summary,
      rating: record.display_rating,
      deviation: record.deviation.round,
      peak_rating: record.peak_rating.round,
      league: Ranked::Leagues.summary(record.league),
      placement_remaining: [ Ranked::Leagues::PLACEMENT_MATCHES - record.matches, 0 ].max,
      rank: record.rank,
      wins: record.wins,
      losses: record.losses,
      draws: record.draws
    }
  end

  def leaderboard_entry(record)
    {
      display_name: record.player.display_name,
      rating: record.display_rating,
      wins: record.wins,
      losses: record.losses,
      league: record.league.key
    }
  end
end
