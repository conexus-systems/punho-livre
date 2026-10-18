# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Leaderboard and match history" do
  before { stub_jwks }

  it "returns the season top by rating (only players past placement), with league" do
    season = Season.current
    SeasonRating.create!(season: season, player: create(:player, display_name: "Novato"), rating: 2000, wins: 4)
    SeasonRating.create!(season: season, player: create(:player, display_name: "Mestre"), rating: 2010.4,
                         wins: 10, losses: 2)
    SeasonRating.create!(season: season, player: create(:player, display_name: "Médio"), rating: 1450, wins: 3,
                         losses: 3)

    get "/api/v1/leaderboard"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["season"]).to include("number" => 1, "name" => "Temporada 1")
    expect(response.parsed_body["players"]).to eq([
      { "display_name" => "Mestre", "rating" => 2010, "wins" => 10, "losses" => 2, "league" => "mestre" },
      { "display_name" => "Médio", "rating" => 1450, "wins" => 3, "losses" => 3, "league" => "prata" }
    ])
  end

  it "serves a past season by number and 404 for an unknown one" do
    first = travel_to(2.years.ago) { Season.current }
    SeasonRating.create!(season: first, player: create(:player, display_name: "Antigo"), rating: 1600, wins: 5)

    get "/api/v1/leaderboard", params: { season: 1 }
    expect(response.parsed_body["players"].pluck("display_name")).to eq([ "Antigo" ])

    get "/api/v1/leaderboard", params: { season: 99 }
    expect(response).to have_http_status(:not_found)
  end

  it "GET /api/v1/ranked returns the caller's season standing" do
    me = create(:player)
    season = Season.current
    SeasonRating.create!(season: season, player: create(:player), rating: 1900, wins: 6)
    SeasonRating.create!(season: season, player: me, rating: 1561.6, deviation: 120.2, peak_rating: 1600,
                         wins: 3, losses: 1, draws: 1)

    get "/api/v1/ranked", headers: bearer_headers(token_for(me))

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include(
      "rating" => 1562, "deviation" => 120, "peak_rating" => 1600, "placement_remaining" => 0, "rank" => 2,
      "wins" => 3, "losses" => 1, "draws" => 1,
      "league" => { "key" => "ouro", "name" => "Ouro", "min_rating" => 1550, "next_min_rating" => 1700 }
    )
    expect(response.parsed_body["season"]).to include("number" => season.number)
  end

  it "GET /api/v1/ranked starts a new player in placement" do
    me = create(:player)

    get "/api/v1/ranked", headers: bearer_headers(token_for(me))

    expect(response.parsed_body).to include("rating" => 1500, "placement_remaining" => 5, "rank" => nil)
    expect(response.parsed_body["league"]).to include("key" => "placement")
  end

  it "replay: participants and admins only" do
    me = create(:player)
    match = create(:match, player1: me, status: "finished", winner_side: 0, finished_at: 1.minute.ago)
    Matches::InputLog.append(match_id: match.id, side: 0, from: 1, bits: [ 0, 0, 16 ])
    Matches::InputLog.append(match_id: match.id, side: 1, from: 1, bits: [ 0, 0, 4, 4 ])
    MatchChecksum.create!(match: match, side: 0, frame: 3, value: 10, inputs_hash: 20, created_at: Time.current)

    get "/api/v1/matches/#{match.id}/replay", headers: bearer_headers(token_for(me))

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["replay"]).to include(
      "seed" => 12_345, "engine_version" => "0.4.0+net2", "characters" => %w[kaze ryu], "frames" => 3,
      "inputs" => [ [ 0, 0, 16 ], [ 0, 0, 4, 4 ] ], "checksums" => [ [ 3, 0, 10, 20 ] ]
    )

    get "/api/v1/matches/#{match.id}/replay", headers: bearer_headers(token_for(create(:player)))
    expect(response).to have_http_status(:forbidden)

    get "/api/v1/matches/#{match.id}/replay", headers: bearer_headers(token_for(create(:player), groups: [ "admin" ]))
    expect(response).to have_http_status(:ok)
  end

  it "admin review queue: list and resolve" do
    match = create(:match, status: "void", void_reason: "state_mismatch")
    review = MatchReview.create!(match: match, reason: "state_mismatch", details: { frame: 120 })
    admin = create(:player)

    get "/api/v1/admin/match_reviews", headers: bearer_headers(token_for(create(:player)))
    expect(response).to have_http_status(:forbidden)

    get "/api/v1/admin/match_reviews", headers: bearer_headers(token_for(admin, groups: [ "admin" ]))
    expect(response.parsed_body["reviews"].first).to include(
      "id" => review.id, "reason" => "state_mismatch", "status" => "open", "details" => { "frame" => 120 }
    )
    expect(response.parsed_body["reviews"].first["match"]).to include("status" => "void",
                                                                       "replay_url" => "/api/v1/matches/#{match.id}/replay")

    patch "/api/v1/admin/match_reviews/#{review.id}", params: { status: "resolved", note: "bug de rede" }.to_json,
                                                      headers: bearer_headers(token_for(admin, groups: [ "admin" ]))
    expect(response).to have_http_status(:ok)
    expect(review.reload).to have_attributes(status: "resolved", note: "bug de rede", resolved_by: admin)
  end

  it "lists the caller's finished matches from their point of view" do
    me = create(:player)
    rival = create(:player, display_name: "Rival", rating: 1016)
    create(:match, player1: rival, player2: me, status: "finished", winner_side: 1, p1_character: "ryu",
                   p2_character: "kaze", p1_rating_delta: -16, p2_rating_delta: 16, finished_at: 2.minutes.ago)
    create(:match, player1: me, player2: rival, status: "abandoned", winner_side: 1, p1_rating_delta: -16,
                   finished_at: 1.minute.ago)
    create(:match, player1: me, player2: rival, status: "active")
    create(:match, player1: me, player2: rival, status: "void", finished_at: 3.minutes.ago)

    get "/api/v1/matches", headers: bearer_headers(token_for(me))

    expect(response).to have_http_status(:ok)
    matches = response.parsed_body["matches"]
    expect(matches.pluck("result", "rating_delta")).to eq([ [ "abandoned", -16 ], [ "win", 16 ], [ "void", 0 ] ])
    expect(matches.second).to include(
      "opponent" => { "display_name" => "Rival", "rating" => 1016 },
      "my_character" => "kaze", "opponent_character" => "ryu"
    )
  end
end
