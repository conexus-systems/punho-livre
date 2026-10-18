# frozen_string_literal: true

module Api
  module V1
    # GET/PATCH /api/v1/me
    class MeController < BaseController
      before_action :authenticate_player!

      def show
        render json: { player: PlayerSerializer.call(current_player, admin: current_admin?) }
      end

      def update
        name = params.require(:display_name)
        raise ArgumentError, "display_name must be a string" unless name.is_a?(String)

        current_player.update!(display_name: name.squish, display_name_customized: true)
        render json: { player: PlayerSerializer.call(current_player, admin: current_admin?) }
      end
    end
  end
end
