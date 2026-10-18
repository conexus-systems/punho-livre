# frozen_string_literal: true

module ApplicationCable
  # wss://<host>/cable?token=<access_token do bff-auth>
  # Conexão recusada sem JWT válido (inclusive se o JWKS estiver indisponível).
  class Connection < ActionCable::Connection::Base
    identified_by :current_player

    def connect
      self.current_player = authenticate!
    end

    private

    def authenticate!
      claims = Auth::VerifyAccessToken.call(request.params[:token])
      Player.from_claims!(claims)
    rescue Auth::VerifyAccessToken::InvalidToken, Auth::VerifyAccessToken::AudienceNotAllowed,
           Auth::VerifyAccessToken::Unavailable => e
      logger.info("[cable] connection rejected: #{e.class.name.demodulize} #{e.message}")
      reject_unauthorized_connection
    end
  end
end
