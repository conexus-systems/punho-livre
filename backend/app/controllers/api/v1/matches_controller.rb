# frozen_string_literal: true

module Api
  module V1
    # GET /api/v1/matches — histórico do jogador (últimas 50 partidas encerradas).
    class MatchesController < BaseController
      LIMIT = 50

      before_action :authenticate_player!

      def index
        matches = Match.closed.involving(current_player)
                       .includes(:player1, :player2)
                       .order(finished_at: :desc, id: :desc)
                       .limit(LIMIT)
        render json: { matches: matches.map { |m| MatchSerializer.call(m, current_player) } }
      end
    end
  end
end
