# frozen_string_literal: true

module Api
  module V1
    # GET /api/v1/leaderboard[?season=<número>] — top 100 da temporada (padrão:
    # a atual), só quem já terminou as partidas de colocação.
    class LeaderboardController < BaseController
      LIMIT = 100

      def index
        season = params[:season].present? ? Season.find_by!(number: params[:season].to_i) : Season.current
        ratings = SeasonRating.placed.where(season: season).includes(:player)
                              .order(rating: :desc, wins: :desc, id: :asc).limit(LIMIT)
        render json: {
          season: season.summary,
          players: ratings.map { |r| RankedSerializer.leaderboard_entry(r) }
        }
      end
    end
  end
end
