# frozen_string_literal: true

module Auth
  # Verifica um access token do bff-auth (JWT RS256) para rotas de usuário final
  # e para a conexão Action Cable. Portado de bff-payment, com o claim `groups`
  # exposto para a checagem de admin (ADMIN_GROUPS).
  class VerifyAccessToken
    class InvalidToken < StandardError; end
    class AudienceNotAllowed < StandardError; end

    Unavailable = JwksCache::Unavailable

    Claims = Data.define(:sub, :email, :name, :aud, :groups) do
      # Admin = algum valor de `groups` está em ADMIN_GROUPS.
      def admin?(admin_groups = Rails.application.config.x.mugen.admin_groups)
        groups.intersect?(Array(admin_groups))
      end
    end

    ALGORITHM = "RS256"
    DEFAULT_LEEWAY_SECONDS = 30
    UUID_FORMAT = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

    def self.call(token)
      new(token).call
    end

    def initialize(token)
      @token = token.to_s
    end

    def call
      raise InvalidToken, "missing bearer token" if token.blank?

      header = decode_header
      raise InvalidToken, "unsupported alg" unless header["alg"] == ALGORITHM

      kid = header["kid"]
      raise InvalidToken, "missing kid" unless kid.is_a?(String) && kid.present?

      key = JwksCache.key_for(kid)
      raise InvalidToken, "unknown signing key" if key.nil?

      payload = decode_payload(key)
      check_audience!(payload["aud"])
      build_claims(payload)
    end

    private

    attr_reader :token

    def decode_header
      _payload, header = JWT.decode(token, nil, false)
      raise InvalidToken, "malformed header" unless header.is_a?(Hash)

      header
    rescue JWT::DecodeError
      raise InvalidToken, "malformed token"
    end

    def decode_payload(key)
      payload, = JWT.decode(
        token, key, true,
        algorithm: ALGORITHM,
        iss: issuer,
        verify_iss: true,
        verify_aud: false,
        verify_expiration: true,
        verify_not_before: true,
        leeway: leeway,
        required_claims: %w[sub iss aud exp]
      )
      payload
    rescue JWT::DecodeError => e
      raise InvalidToken, e.message
    end

    def check_audience!(aud)
      allowed = allowed_audiences
      provided = Array(aud).map(&:to_s)
      return if allowed.any? && provided.intersect?(allowed)

      raise AudienceNotAllowed, "audience not allowed"
    end

    def build_claims(payload)
      sub = payload["sub"].to_s
      raise InvalidToken, "sub must be a UUID" unless sub.match?(UUID_FORMAT)

      Claims.new(
        sub: sub,
        email: payload["email"].is_a?(String) ? payload["email"] : nil,
        name: payload["name"].is_a?(String) ? payload["name"] : nil,
        aud: payload["aud"],
        groups: Array(payload["groups"]).grep(String)
      )
    end

    def issuer
      ENV.fetch("CONEXUS_AUTH_ISSUER", "").presence || JwksCache.auth_url
    end

    def allowed_audiences
      ENV.fetch("CONEXUS_AUTH_ALLOWED_AUDIENCES", "").split(",").map(&:strip).compact_blank
    end

    def leeway
      Integer(ENV.fetch("CONEXUS_AUTH_LEEWAY_SECONDS", DEFAULT_LEEWAY_SECONDS.to_s), 10)
    rescue ArgumentError
      DEFAULT_LEEWAY_SECONDS
    end
  end
end
