# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Fila de revisão de partidas anuladas (anti-trapaça) e disputadas.
      class MatchReviewsController < BaseController
        before_action :authenticate_player!
        before_action :require_admin!

        # GET /api/v1/admin/match_reviews?status=open (padrão: open)
        def index
          status = params.fetch(:status, "open").to_s
          raise ArgumentError, "status must be one of #{MatchReview::STATUSES.join(', ')}" unless MatchReview::STATUSES.include?(status)

          reviews = MatchReview.where(status: status).includes(match: %i[player1 player2])
                               .order(created_at: :asc).limit(200)
          render json: { reviews: reviews.map { |r| serialize(r) } }
        end

        # PATCH /api/v1/admin/match_reviews/:id — body { status: "resolved"|"dismissed", note?: string }
        def update
          review = MatchReview.find(params[:id])
          status = params.require(:status).to_s
          raise ArgumentError, "status must be resolved or dismissed" unless %w[resolved dismissed].include?(status)

          review.update!(status: status, note: params[:note].is_a?(String) ? params[:note] : review.note,
                         resolved_by: current_player, resolved_at: Time.current)
          render json: { review: serialize(review) }
        end

        private

        def serialize(review)
          match = review.match
          {
            id: review.id,
            reason: review.reason,
            status: review.status,
            details: review.details,
            note: review.note,
            created_at: review.created_at.utc.iso8601,
            match: {
              id: match.id,
              status: match.status,
              mode: match.mode,
              engine_version: match.engine_version,
              players: [ match.player1, match.player2 ].map { |p| { id: p.id, display_name: p.display_name } },
              replay_url: "/api/v1/matches/#{match.id}/replay"
            }
          }
        end
      end
    end
  end
end
