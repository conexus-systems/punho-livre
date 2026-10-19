# frozen_string_literal: true

module Auth
  # Cache por processo das chaves de assinatura do bff-auth (só RSA), por kid.
  # Portado de bff-payment (app/services/auth/jwks_cache.rb).
  class JwksCache
    class Unavailable < StandardError; end

    DEFAULT_AUTH_URL = "https://auth.conexus-systems.com.br"
    TTL = 1.hour
    REFETCH_MIN_INTERVAL = 30.seconds
    FAILURE_BACKOFF = 10.seconds
    TIMEOUT_SECONDS = 5

    class << self
      def instance
        @instance ||= new
      end

      def key_for(kid)
        instance.key_for(kid)
      end

      def reset!
        instance.reset!
      end

      def auth_url
        ENV.fetch("CONEXUS_AUTH_URL", "").presence&.chomp("/") || DEFAULT_AUTH_URL
      end
    end

    def initialize
      @mutex = Mutex.new
      reset!
    end

    def reset!
      @keys = {}
      @fetched_at = nil
      @failed_at = nil
    end

    # Devolve a chave do kid, ou nil se o kid seguir desconhecido após um refetch.
    # Levanta Unavailable quando o JWKS não pode ser buscado — o token deve ser recusado.
    def key_for(kid)
      @mutex.synchronize do
        refresh! if stale?
        return @keys[kid] if @keys.key?(kid)
        return nil unless refetch_allowed?

        refresh!
        @keys[kid]
      end
    end

    private

    def stale?
      @fetched_at.nil? || Time.current - @fetched_at >= TTL
    end

    def refetch_allowed?
      @fetched_at.nil? || Time.current - @fetched_at >= REFETCH_MIN_INTERVAL
    end

    def refresh!
      raise Unavailable, "JWKS fetch backing off" if @failed_at && Time.current - @failed_at < FAILURE_BACKOFF

      @keys = fetch_keys
      @fetched_at = Time.current
      @failed_at = nil
    rescue Unavailable
      raise
    rescue StandardError => e
      @failed_at = Time.current
      Rails.logger.error("[auth] jwks_fetch_failed url=#{jwks_url} #{e.class}: #{e.message}")
      raise Unavailable, "JWKS unavailable"
    end

    def fetch_keys
      response = Faraday.get(jwks_url) do |req|
        req.options.timeout = TIMEOUT_SECONDS
        req.options.open_timeout = TIMEOUT_SECONDS
      end
      raise "unexpected status #{response.status}" unless response.status == 200

      keys = JSON.parse(response.body).fetch("keys")
      raise "keys must be an array" unless keys.is_a?(Array)

      keys.each_with_object({}) do |jwk, acc|
        next unless jwk.is_a?(Hash) && jwk["kty"] == "RSA" && jwk["kid"].present?
        next if jwk["use"].present? && jwk["use"] != "sig"

        acc[jwk["kid"]] = JWT::JWK.import(jwk).verify_key
      end
    end

    def jwks_url
      "#{self.class.auth_url}/.well-known/jwks.json"
    end
  end
end
