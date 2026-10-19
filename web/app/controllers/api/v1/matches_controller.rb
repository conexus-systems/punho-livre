# frozen_string_literal: true

module Api
  module V1
    # GET /api/v1/matches — histórico do jogador (últimas 50 partidas encerradas).
    # GET /api/v1/matches/:id/replay — replay (seed + entradas + versão) para
    # disputas: só os dois participantes ou admin.
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

      def replay
        match = Match.find(params[:id])
        unless match.side_of(current_player) || current_admin?
          return render_error :forbidden, "forbidden", "only participants can fetch this replay"
        end

        render json: { replay: MatchSerializer.replay(match) }
      end
    end
  end
end
