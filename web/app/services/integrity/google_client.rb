# frozen_string_literal: true

module Integrity
  # Decodifica o token do Play Integrity na API do Google
  # (POST playintegrity.googleapis.com/v1/{pacote}:decodeIntegrityToken), com
  # uma conta de serviço do Google Cloud ligada ao app no Play Console.
  # Credencial em ENV["PLAY_INTEGRITY_SERVICE_ACCOUNT"] (JSON), nunca no Git.
  class GoogleClient
    SCOPE = "https://www.googleapis.com/auth/playintegrity"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    API = "https://playintegrity.googleapis.com/v1"

    class Error < StandardError; end
    class NotConfigured < Error; end

    def self.configured?
      ENV["PLAY_INTEGRITY_SERVICE_ACCOUNT"].present?
    end

    def initialize(credentials_json: ENV.fetch("PLAY_INTEGRITY_SERVICE_ACCOUNT", nil), http: Faraday.new)
      raise NotConfigured, "PLAY_INTEGRITY_SERVICE_ACCOUNT ausente" if credentials_json.blank?

      @credentials = JSON.parse(credentials_json)
      @http = http
    end

    # Devolve o `tokenPayloadExternal` (Hash) ou levanta Error.
    def decode(package_name, integrity_token)
      res = @http.post("#{API}/#{package_name}:decodeIntegrityToken") do |req|
        req.headers["Authorization"] = "Bearer #{access_token}"
        req.headers["Content-Type"] = "application/json"
        req.body = { integrity_token: integrity_token }.to_json
      end
      raise Error, "decodeIntegrityToken #{res.status}" unless res.status == 200

      JSON.parse(res.body).fetch("tokenPayloadExternal")
    rescue Faraday::Error, JSON::ParserError, KeyError => e
      raise Error, e.message
    end

    private

    def access_token
      now = Time.now.to_i
      assertion = JWT.encode(
        { iss: @credentials.fetch("client_email"), scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
        OpenSSL::PKey::RSA.new(@credentials.fetch("private_key")),
        "RS256"
      )
      res = @http.post(TOKEN_URL, URI.encode_www_form(grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: assertion),
                       "Content-Type" => "application/x-www-form-urlencoded")
      raise Error, "oauth #{res.status}" unless res.status == 200

      JSON.parse(res.body).fetch("access_token")
    end
  end
end
