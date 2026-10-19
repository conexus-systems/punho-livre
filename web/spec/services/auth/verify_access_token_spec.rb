# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::VerifyAccessToken do
  let(:user_id) { SecureRandom.uuid }

  before { stub_jwks }

  it "returns the claims of a valid token" do
    claims = described_class.call(auth_token(sub: user_id))

    expect(claims).to have_attributes(sub: user_id, name: "Ryo Sakazaki", aud: AuthTokenHelper::AUDIENCE, groups: [])
    expect(claims.email).to eq("#{user_id[0, 8]}@example.com")
  end

  it "exposes the groups claim and the admin check" do
    claims = described_class.call(auth_token(groups: [ "players", "mugen-arena-admin" ]))

    expect(claims.groups).to eq(%w[players mugen-arena-admin])
    expect(claims.admin?).to be(true)
    expect(described_class.call(auth_token(groups: [ "players" ])).admin?).to be(false)
  end

  it "honours ADMIN_GROUPS" do
    claims = described_class.call(auth_token(groups: [ "staff" ]))

    expect(claims.admin?(%w[staff])).to be(true)
    expect(claims.admin?(%w[admin])).to be(false)
  end

  it "accepts an audience array containing an allowed client" do
    expect(described_class.call(auth_token(aud: [ "x", AuthTokenHelper::AUDIENCE ])).sub).to be_present
  end

  it "rejects a token signed by another key" do
    forged = auth_token(jwk: auth_jwk(OpenSSL::PKey::RSA.generate(2048)))

    expect { described_class.call(forged) }.to raise_error(described_class::InvalidToken)
  end

  it "rejects a wrong issuer" do
    expect { described_class.call(auth_token(iss: "https://evil.example")) }
      .to raise_error(described_class::InvalidToken)
  end

  it "honours CONEXUS_AUTH_ISSUER over the auth URL" do
    ENV["CONEXUS_AUTH_ISSUER"] = "https://issuer.example"

    expect { described_class.call(auth_token) }.to raise_error(described_class::InvalidToken)
    expect(described_class.call(auth_token(iss: "https://issuer.example")).sub).to be_present
  end

  it "rejects an audience not in the allow-list" do
    expect { described_class.call(auth_token(aud: "unknown-app")) }
      .to raise_error(described_class::AudienceNotAllowed)
  end

  it "rejects every audience when the allow-list is empty" do
    ENV["CONEXUS_AUTH_ALLOWED_AUDIENCES"] = ""

    expect { described_class.call(auth_token) }.to raise_error(described_class::AudienceNotAllowed)
  end

  it "rejects an expired token beyond the leeway" do
    expect { described_class.call(auth_token(exp: 2.minutes.ago.to_i)) }
      .to raise_error(described_class::InvalidToken)
  end

  it "accepts a token expired within the leeway" do
    expect(described_class.call(auth_token(exp: 10.seconds.ago.to_i)).sub).to be_present
  end

  it "rejects HS256 tokens even when signed with the public key material" do
    token = JWT.encode({ sub: user_id, iss: AuthTokenHelper::AUTH_URL, aud: AuthTokenHelper::AUDIENCE,
                         exp: 1.hour.from_now.to_i },
                       auth_signing_key.public_key.to_pem, "HS256", kid: "test-kid")

    expect { described_class.call(token) }.to raise_error(described_class::InvalidToken)
  end

  it "rejects a non-UUID sub" do
    expect { described_class.call(auth_token(sub: "not-a-uuid-at-all")) }
      .to raise_error(described_class::InvalidToken)
  end

  it "rejects garbage and missing tokens" do
    expect { described_class.call("abc.def") }.to raise_error(described_class::InvalidToken)
    expect { described_class.call(nil) }.to raise_error(described_class::InvalidToken)
  end

  describe "key rotation" do
    let(:rotated) { auth_jwk(OpenSSL::PKey::RSA.generate(2048), kid: "rotated-kid") }

    it "refetches the JWKS once when the kid is unknown" do
      described_class.call(auth_token)
      stub_jwks(auth_jwk, rotated)

      travel Auth::JwksCache::REFETCH_MIN_INTERVAL + 1.second do
        expect(described_class.call(auth_token(jwk: rotated)).sub).to be_present
      end
      expect(a_request(:get, AuthTokenHelper::JWKS_URL)).to have_been_made.twice
    end

    it "rejects an unknown kid without hammering the auth server" do
      described_class.call(auth_token)

      expect { described_class.call(auth_token(jwk: rotated)) }.to raise_error(described_class::InvalidToken)
      expect(a_request(:get, AuthTokenHelper::JWKS_URL)).to have_been_made.once
    end

    it "caches the JWKS for an hour" do
      2.times { described_class.call(auth_token) }
      travel 61.minutes do
        described_class.call(auth_token)
      end

      expect(a_request(:get, AuthTokenHelper::JWKS_URL)).to have_been_made.twice
    end
  end

  describe "JWKS unavailable" do
    it "raises Unavailable when the endpoint errors" do
      stub_request(:get, AuthTokenHelper::JWKS_URL).to_return(status: 500)

      expect { described_class.call(auth_token) }.to raise_error(described_class::Unavailable)
    end

    it "raises Unavailable on timeouts" do
      stub_request(:get, AuthTokenHelper::JWKS_URL).to_timeout

      expect { described_class.call(auth_token) }.to raise_error(described_class::Unavailable)
    end

    it "never falls back to stale keys" do
      described_class.call(auth_token)
      stub_request(:get, AuthTokenHelper::JWKS_URL).to_return(status: 503)

      travel 61.minutes do
        expect { described_class.call(auth_token) }.to raise_error(described_class::Unavailable)
      end
    end
  end
end
