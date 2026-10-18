# frozen_string_literal: true

require "rails_helper"

RSpec.describe MatchmakingChannel, type: :channel do
  let(:player) { create(:player, rating: 1000) }
  let(:sha) { "c" * 64 }

  before { stub_connection current_player: player }

  def queue_ticket(owner, mode: "ranked", room_code: nil, created_at: Time.current, character: "ryu")
    MatchmakingTicket.create!(player: owner, mode: mode, room_code: room_code, character: character,
                              pack_sha256: "d" * 64, rating: owner.rating, token: SecureRandom.hex(8),
                              created_at: created_at, heartbeat_at: Time.current)
  end

  describe "ranked" do
    it "queues when nobody is waiting" do
      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha)

      expect(subscription).to be_confirmed
      expect(transmissions.last).to eq("type" => "queued")
      expect(MatchmakingTicket.find_by(player: player)).to have_attributes(mode: "ranked", character: "kaze")
    end

    it "pairs with the oldest waiting player within the rating window" do
      older = queue_ticket(create(:player, rating: 1150), created_at: 5.seconds.ago)
      queue_ticket(create(:player, rating: 1010), created_at: 1.second.ago)

      expect {
        subscribe(mode: "ranked", character: "kaze", pack_sha256: sha)
      }.to have_broadcasted_to("matchmaking:#{older.token}").with(a_hash_including("type" => "matched", "side" => 0))

      match = Match.last
      expect(match).to have_attributes(player1: older.player, player2: player, status: "waiting", mode: "ranked",
                                       p1_character: "ryu", p2_character: "kaze", p2_pack_sha256: sha)
      expect(transmissions.last).to include(
        "type" => "matched", "match_id" => match.id, "side" => 1, "seed" => match.seed, "input_delay" => 2,
        "opponent" => { "display_name" => older.player.display_name, "rating" => 1150, "character" => "ryu",
                        "pack_sha256" => "d" * 64 }
      )
      expect(MatchmakingTicket.where(id: older.id)).to be_empty
      expect(MatchmakingTicket.where(player: player)).to be_empty
    end

    it "does not pair outside the ±200 window, but the window opens +50 every 10 s" do
      far = queue_ticket(create(:player, rating: 1240), created_at: Time.current)

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha)
      expect(transmissions.last).to eq("type" => "queued")

      far.update_columns(created_at: 11.seconds.ago)
      mine = MatchmakingTicket.find_by!(player: player)
      result = Matchmaking::Queue.new.try_pair!(mine.token)

      expect(result.type).to eq(:matched)
      expect(result.match).to have_attributes(player1_id: far.player_id, player2_id: player.id)
      expect(result.notify).to eq([ far.token, mine.token ])
    end

    it "ignores stale tickets" do
      stale = queue_ticket(create(:player))
      stale.update_columns(heartbeat_at: 1.minute.ago)

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha)

      expect(transmissions.last).to eq("type" => "queued")
    end

    it "returns already_queued for a second ticket of the same player" do
      queue_ticket(player)

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha)

      expect(transmissions.last).to eq("type" => "error", "error" => "already_queued")
    end

    it "leaves the queue on cancel and on unsubscribe" do
      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha)
      perform :cancel
      expect(MatchmakingTicket.where(player: player)).to be_empty

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha)
      expect(MatchmakingTicket.where(player: player)).to exist
      unsubscribe
      expect(MatchmakingTicket.where(player: player)).to be_empty
    end

    it "rejects malformed params" do
      subscribe(mode: "ranked", character: "Bad Slug!", pack_sha256: sha)

      expect(subscription).to be_rejected
    end
  end

  describe "rooms" do
    it "creates a room with a code" do
      subscribe(mode: "room", character: "kaze", pack_sha256: sha)

      code = transmissions.last["room_code"]
      expect(transmissions.last["type"]).to eq("room_created")
      expect(code).to match(/\A[A-Z2-9]{6}\z/)
      expect(MatchmakingTicket.find_by(player: player).room_code).to eq(code)
    end

    it "joins an existing room" do
      host = queue_ticket(create(:player), mode: "room", room_code: "ABCD12")

      expect {
        subscribe(mode: "room", room_code: "abcd12", character: "kaze", pack_sha256: sha)
      }.to have_broadcasted_to("matchmaking:#{host.token}").with(a_hash_including("type" => "matched", "side" => 0))

      expect(transmissions.last).to include("type" => "matched", "side" => 1)
      expect(Match.last).to have_attributes(mode: "room", room_code: "ABCD12", player1: host.player)
    end

    it "returns room_not_found and room_full" do
      subscribe(mode: "room", room_code: "ZZZZ99", character: "kaze", pack_sha256: sha)
      expect(transmissions.last).to eq("type" => "error", "error" => "room_not_found")

      create(:match, room_code: "FULL22", mode: "room", status: "active")
      subscribe(mode: "room", room_code: "FULL22", character: "kaze", pack_sha256: sha)
      expect(transmissions.last).to eq("type" => "error", "error" => "room_full")
    end
  end
end
