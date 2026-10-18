# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Moderação de personagens (claim `groups` ∩ ADMIN_GROUPS).
      class CharactersController < BaseController
        before_action :authenticate_player!
        before_action :require_admin!

        # GET /api/v1/admin/characters?status=pending (padrão: pending)
        def index
          status = params.fetch(:status, "pending").to_s
          raise ArgumentError, "status must be one of #{Character::STATUSES.join(', ')}" unless Character::STATUSES.include?(status)

          characters = Character.where(status: status).includes(:submitted_by).order(created_at: :asc).limit(500)
          render json: { characters: characters.map { |c| CharacterSerializer.admin(c, base_url: request.base_url) } }
        end

        # PATCH /api/v1/admin/characters/:slug
        # body { status: "approved"|"rejected", premium?: bool, reason?: string }
        def update
          character = Characters::Review.call(
            slug: params[:slug],
            status: params.require(:status),
            premium: params.key?(:premium) ? params[:premium] : nil,
            reason: params[:reason].is_a?(String) ? params[:reason] : nil
          )
          render json: { character: CharacterSerializer.admin(character, base_url: request.base_url) }
        end
      end
    end
  end
end
