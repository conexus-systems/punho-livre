# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  before { stub_jwks }

  it "connects with a valid token and identifies the player" do
    sub = SecureRandom.uuid

    connect "/cable", params: { token: auth_token(sub: sub) }

    expect(connection.current_player.conexus_user_id).to eq(sub)
  end

  it "rejects a missing token" do
    expect { connect "/cable" }.to have_rejected_connection
  end

  it "rejects an invalid token" do
    expect { connect "/cable", params: { token: auth_token(aud: "unknown-app") } }.to have_rejected_connection
  end

  it "rejects when the JWKS is unavailable" do
    stub_request(:get, AuthTokenHelper::JWKS_URL).to_return(status: 503)

    expect { connect "/cable", params: { token: auth_token } }.to have_rejected_connection
  end
end
