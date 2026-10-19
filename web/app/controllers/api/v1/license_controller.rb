# frozen_string_literal: true

module Api
  module V1
    # Licença do jogo pago (Play Integrity) — docs/PROTOCOL.md → Licença.
    #
    # POST /api/v1/license/challenge → { nonce, required }
    # POST /api/v1/license/verify { nonce, token } → { licensed_until } | 403 { error }
    class LicenseController < BaseController
      before_action :authenticate_player!

      def challenge
        render json: { nonce: Integrity::Challenge.issue(current_player), required: Integrity::License.required? }
      end

      def verify
        result = Integrity::License.verify!(player: current_player, nonce: params.require(:nonce), token: params.require(:token))
        if result.ok
          render json: { licensed_until: result.licensed_until.iso8601 }
        else
          render_error :forbidden, result.error, "license check failed"
        end
      rescue Integrity::GoogleClient::NotConfigured
        render_error :service_unavailable, "license_unavailable", "license verification is not configured"
      rescue Integrity::GoogleClient::Error
        render_error :service_unavailable, "license_unavailable", "license verification is temporarily unavailable"
      end
    end
  end
end
