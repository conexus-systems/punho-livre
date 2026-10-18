# frozen_string_literal: true

module Api
  module V1
    # GET /api/v1/leaderboard — top 100 por rating (só quem já jogou ranqueada).
    class LeaderboardController < BaseController
      LIMIT = 100

      def index
        players = Player.ranked.limit(LIMIT)
        render json: { players: players.map { |p| PlayerSerializer.leaderboard_entry(p) } }
      end
    end
  end
end
