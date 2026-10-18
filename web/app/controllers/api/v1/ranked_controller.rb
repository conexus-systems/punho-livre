# frozen_string_literal: true

module Api
  module V1
    # GET /api/v1/ranked — rating, liga e posição do jogador na temporada atual.
    class RankedController < BaseController
      before_action :authenticate_player!

      def show
        season = Season.current
        render json: RankedSerializer.standing(SeasonRating.for!(current_player, season))
      end
    end
  end
end
