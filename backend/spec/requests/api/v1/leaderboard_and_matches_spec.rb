# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Leaderboard and match history" do
  before { stub_jwks }

  it "returns the top players by rating (only players who have played)" do
    create(:player, display_name: "Novato", rating: 2000)
    create(:player, display_name: "Mestre", rating: 1300, wins: 10, losses: 2)
    create(:player, display_name: "Médio", rating: 1100, wins: 3, losses: 3)

    get "/api/v1/leaderboard"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["players"]).to eq([
      { "display_name" => "Mestre", "rating" => 1300, "wins" => 10, "losses" => 2 },
      { "display_name" => "Médio", "rating" => 1100, "wins" => 3, "losses" => 3 }
    ])
  end

  it "lists the caller's finished matches from their point of view" do
    me = create(:player)
    rival = create(:player, display_name: "Rival", rating: 1016)
    create(:match, player1: rival, player2: me, status: "finished", winner_side: 1, p1_character: "ryu",
                   p2_character: "kaze", p1_rating_delta: -16, p2_rating_delta: 16, finished_at: 2.minutes.ago)
    create(:match, player1: me, player2: rival, status: "abandoned", winner_side: 1, p1_rating_delta: -16,
                   finished_at: 1.minute.ago)
    create(:match, player1: me, player2: rival, status: "active")

    get "/api/v1/matches", headers: bearer_headers(token_for(me))

    expect(response).to have_http_status(:ok)
    matches = response.parsed_body["matches"]
    expect(matches.pluck("result", "rating_delta")).to eq([ [ "abandoned", -16 ], [ "win", 16 ] ])
    expect(matches.last).to include(
      "opponent" => { "display_name" => "Rival", "rating" => 1016 },
      "my_character" => "kaze", "opponent_character" => "ryu"
    )
  end
end
