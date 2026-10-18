# frozen_string_literal: true

require "rails_helper"

RSpec.describe MatchChannel, type: :channel do
  let(:p1) { create(:player, rating: 1000) }
  let(:p2) { create(:player, rating: 1000) }
  let(:match) { create(:match, player1: p1, player2: p2, status: "waiting") }

  def join_as(player)
    stub_connection current_player: player
    subscribe(match_id: match.id)
  end

  it "only lets the two participants subscribe" do
    join_as(create(:player))
    expect(subscription).to be_rejected

    join_as(p1)
    expect(subscription).to be_confirmed
    expect(subscription).to have_stream_for(match)
  end

  it "rejects finished matches" do
    match.update!(status: "finished")
    join_as(p1)

    expect(subscription).to be_rejected
  end

  it "broadcasts start once both sides are ready" do
    join_as(p1)
    expect { perform :ready }.not_to have_broadcasted_to(match)

    join_as(p2)
    freeze_time do
      expect { perform :ready }.to have_broadcasted_to(match)
        .with(type: "start", at: (Time.current.to_f * 1000).to_i + MatchChannel::START_DELAY_MS)
    end
    expect(match.reload).to have_attributes(status: "active", started_at: be_present)
  end

  it "relays inputs and checksums tagged with the sender side" do
    join_as(p2)

    expect { perform :input, frames: [ [ 10, 17 ], [ 11, 1024 ] ], ack: 8 }
      .to have_broadcasted_to(match).with(type: "input", side: 1, frames: [ [ 10, 17 ], [ 11, 1024 ] ], ack: 8)
    expect { perform :checksum, frame: 60, value: 123_456 }
      .to have_broadcasted_to(match).with(type: "checksum", side: 1, frame: 60, value: 123_456)
    expect { perform :input, frames: "junk" }.not_to have_broadcasted_to(match)
  end

  it "answers ping only to the sender" do
    join_as(p1)

    expect { perform :ping, t: 42 }.not_to have_broadcasted_to(match)
    expect(transmissions.last).to eq("type" => "pong", "t" => 42)
  end

  describe "result" do
    before { match.update!(status: "active", started_at: Time.current) }

    it "finishes the match when both reports agree and applies Elo (K=32)" do
      join_as(p1)
      expect { perform :result, winner_side: 0 }.not_to have_broadcasted_to(match)

      join_as(p2)
      expect { perform :result, winner_side: 0 }
        .to have_broadcasted_to(match).with(type: "finished", winner_side: 0, ratings: { "0" => 1016, "1" => 984 })

      expect(match.reload).to have_attributes(status: "finished", winner_side: 0, p1_rating_delta: 16,
                                              p2_rating_delta: -16, finished_at: be_present)
      expect(p1.reload).to have_attributes(rating: 1016, wins: 1, losses: 0)
      expect(p2.reload).to have_attributes(rating: 984, wins: 0, losses: 1)
    end

    it "uses expected scores for unequal ratings and supports draws" do
      p1.update!(rating: 1200)
      join_as(p1)
      perform :result, winner_side: nil
      join_as(p2)

      expect { perform :result, winner_side: nil }
        .to have_broadcasted_to(match).with(type: "finished", winner_side: nil, ratings: { "0" => 1192, "1" => 1008 })
      expect(p1.reload).to have_attributes(wins: 0, losses: 0)
    end

    it "marks the match disputed when the reports diverge" do
      join_as(p1)
      perform :result, winner_side: 0
      join_as(p2)

      expect { perform :result, winner_side: 1 }
        .to have_broadcasted_to(match).with(type: "finished", winner_side: nil, disputed: true)
      expect(match.reload.status).to eq("disputed")
      expect([ p1.reload.rating, p2.reload.rating ]).to eq([ 1000, 1000 ])
    end

    it "does not change ratings for unrated room matches" do
      match.update!(mode: "room")
      join_as(p1)
      perform :result, winner_side: 1
      join_as(p2)

      expect { perform :result, winner_side: 1 }
        .to have_broadcasted_to(match).with(type: "finished", winner_side: 1, ratings: { "0" => 1000, "1" => 1000 })
    end

    it "rates room matches when RATED_ROOM_MATCHES is on" do
      match.update!(mode: "room")
      with_config(:mugen, rated_room_matches: true) do
        join_as(p1)
        perform :result, winner_side: 1
        join_as(p2)
        perform :result, winner_side: 1
      end

      expect(p2.reload.rating).to eq(1016)
    end
  end

  describe "leaving" do
    it "abandons an active match: the leaver loses rating and the opponent is told" do
      match.update!(status: "active")
      join_as(p1)

      expect { unsubscribe }.to have_broadcasted_to(match).with(type: "opponent_left")

      expect(match.reload).to have_attributes(status: "abandoned", abandoned_by_side: 0, winner_side: 1)
      expect(p1.reload).to have_attributes(rating: 984, losses: 1)
      expect(p2.reload).to have_attributes(rating: 1016, wins: 1)
    end

    it "abandons a waiting match without rating changes" do
      join_as(p2)

      expect { unsubscribe }.to have_broadcasted_to(match).with(type: "opponent_left")
      expect(match.reload.status).to eq("abandoned")
      expect(p2.reload.rating).to eq(1000)
    end

    it "does nothing after the match finished" do
      match.update!(status: "active")
      join_as(p1)
      match.update!(status: "finished")

      expect { unsubscribe }.not_to have_broadcasted_to(match)
    end
  end
end
