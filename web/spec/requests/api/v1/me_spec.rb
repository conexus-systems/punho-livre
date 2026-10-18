# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GET/PATCH /api/v1/me" do
  before { stub_jwks }

  it "returns 401 invalid_token without a bearer token" do
    get "/api/v1/me"

    expect(response).to have_http_status(:unauthorized)
    expect(response.parsed_body).to include("error" => "invalid_token")
  end

  it "returns 401 for a token minted for another app" do
    get "/api/v1/me", headers: bearer_headers(auth_token(aud: "unknown-app"))

    expect(response).to have_http_status(:unauthorized)
  end

  it "returns 503 auth_unavailable when the JWKS is down" do
    stub_request(:get, AuthTokenHelper::JWKS_URL).to_return(status: 500)

    get "/api/v1/me", headers: bearer_headers(auth_token)

    expect(response).to have_http_status(:service_unavailable)
    expect(response.parsed_body["error"]).to eq("auth_unavailable")
  end

  it "upserts the player by sub and returns it" do
    sub = SecureRandom.uuid

    expect {
      get "/api/v1/me", headers: bearer_headers(auth_token(sub: sub, groups: [ "admin" ]))
    }.to change(Player, :count).by(1)

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["player"]).to include(
      "conexus_user_id" => sub, "display_name" => "Ryo Sakazaki", "rating" => 1500,
      "wins" => 0, "losses" => 0, "premium" => false, "admin" => true
    )

    expect { get "/api/v1/me", headers: bearer_headers(auth_token(sub: sub)) }.not_to change(Player, :count)
    expect(response.parsed_body.dig("player", "admin")).to be(false)
  end

  it "updates the display name" do
    player = create(:player)

    patch "/api/v1/me", params: { display_name: "  Terry  B " }.to_json, headers: bearer_headers(token_for(player))

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig("player", "display_name")).to eq("Terry B")
    expect(player.reload).to have_attributes(display_name: "Terry B", display_name_customized: true)
  end

  it "rejects an invalid display name with 422 validation_failed" do
    player = create(:player)

    patch "/api/v1/me", params: { display_name: "x" * 40 }.to_json, headers: bearer_headers(token_for(player))

    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body["error"]).to eq("validation_failed")
  end
end
