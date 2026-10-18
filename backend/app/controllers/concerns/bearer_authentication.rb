# frozen_string_literal: true

# Autenticação por `Authorization: Bearer <access_token do bff-auth>`.
#
#   before_action :authenticate_player!   # obrigatório (401/503)
#   before_action :require_admin!         # claim `groups` ∩ ADMIN_GROUPS (403)
#
# Token válido → upsert do Player por `sub` (= conexus_user_id).
module BearerAuthentication
  extend ActiveSupport::Concern

  private

  attr_reader :current_claims, :current_player

  def authenticate_player!
    authenticate_bearer! || render_invalid_token
  end

  def require_admin!
    return if performed?
    return if current_admin?

    render_error :forbidden, "forbidden", "admin access required"
  end

  def current_admin?
    current_claims.present? && current_claims.admin?
  end

  # Tenta autenticar; devolve true/false. Renderiza 503 se o JWKS estiver fora.
  def authenticate_bearer!
    return true if current_player

    @current_claims = Auth::VerifyAccessToken.call(bearer_token)
    @current_player = Player.from_claims!(@current_claims)
    true
  rescue Auth::VerifyAccessToken::InvalidToken, Auth::VerifyAccessToken::AudienceNotAllowed => e
    Rails.logger.info("[auth] token_rejected reason=#{e.message}")
    false
  rescue Auth::VerifyAccessToken::Unavailable
    render_error :service_unavailable, "auth_unavailable", "token verification is temporarily unavailable"
    false
  end

  def render_invalid_token
    return if performed?

    response.headers["WWW-Authenticate"] = 'Bearer error="invalid_token"'
    render_error :unauthorized, "invalid_token", "access token is missing, invalid or expired"
  end

  def bearer_token
    scheme, token = request.authorization.to_s.split(" ", 2)
    token.to_s.strip if scheme.to_s.casecmp?("Bearer")
  end
end
