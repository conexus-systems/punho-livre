# frozen_string_literal: true

# Gera uma chave RSA, publica o JWKS (WebMock) e assina tokens como o bff-auth.
module AuthTokenHelper
  AUTH_URL = "https://auth.test.example"
  JWKS_URL = "#{AUTH_URL}/.well-known/jwks.json".freeze
  AUDIENCE = "mugen-arena-mobile"

  def self.signing_key
    @signing_key ||= OpenSSL::PKey::RSA.generate(2048)
  end

  def auth_signing_key
    AuthTokenHelper.signing_key
  end

  def auth_jwk(key = auth_signing_key, kid: "test-kid")
    JWT::JWK.new(key, kid: kid)
  end

  def stub_jwks(*jwks)
    keys = (jwks.presence || [ auth_jwk ]).map { |jwk| jwk.export.merge(use: "sig", alg: "RS256") }
    stub_request(:get, JWKS_URL).to_return(
      status: 200, body: { keys: keys }.to_json, headers: { "Content-Type" => "application/json" }
    )
  end

  def auth_token(sub: SecureRandom.uuid, jwk: auth_jwk, **overrides)
    payload = {
      sub: sub,
      email: "#{sub[0, 8]}@example.com",
      name: "Ryo Sakazaki",
      iss: AUTH_URL,
      aud: AUDIENCE,
      iat: Time.current.to_i,
      exp: 1.hour.from_now.to_i
    }.merge(overrides).compact
    JWT.encode(payload, jwk.signing_key, "RS256", kid: jwk.kid)
  end

  def token_for(player, **overrides)
    auth_token(sub: player.conexus_user_id, email: player.email, **overrides)
  end

  def bearer_headers(token)
    { "CONTENT_TYPE" => "application/json", "Authorization" => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthTokenHelper

  config.around(:each) do |example|
    keys = %w[CONEXUS_AUTH_URL CONEXUS_AUTH_ISSUER CONEXUS_AUTH_ALLOWED_AUDIENCES]
    saved = keys.index_with { |k| ENV[k] }
    ENV["CONEXUS_AUTH_URL"] = AuthTokenHelper::AUTH_URL
    ENV.delete("CONEXUS_AUTH_ISSUER")
    ENV["CONEXUS_AUTH_ALLOWED_AUDIENCES"] = "other-app, #{AuthTokenHelper::AUDIENCE}"
    Auth::JwksCache.reset!
    example.run
  ensure
    saved.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
    Auth::JwksCache.reset!
  end
end
