# frozen_string_literal: true

require "rails_helper"

RSpec.describe MatchmakingChannel, type: :channel do
  let(:player) { create(:player) }
  let(:sha) { "c" * 64 }
  let(:ver) { "0.4.0+net2" }

  before { stub_connection current_player: player }

  def queue_ticket(owner, mode: "ranked", room_code: nil, created_at: Time.current, character: "ryu",
                   engine_version: "0.4.0+net2")
    MatchmakingTicket.create!(player: owner, mode: mode, room_code: room_code, character: character,
                              pack_sha256: "d" * 64, rating: owner.rating, token: SecureRandom.hex(8),
                              engine_version: engine_version, created_at: created_at, heartbeat_at: Time.current)
  end

  describe "jogo pago" do
    it "recusa a fila sem licença quando a exigência está ligada" do
      ENV["PLAY_INTEGRITY_REQUIRED"] = "1"
      begin
        subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)
      ensure
        ENV.delete("PLAY_INTEGRITY_REQUIRED")
      end

      expect(transmissions.last).to eq("type" => "error", "error" => "license_required")
      expect(MatchmakingTicket.where(player: player)).to be_empty
    end
  end

  describe "ranked" do
    it "queues when nobody is waiting" do
      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)

      expect(subscription).to be_confirmed
      expect(transmissions.last).to eq("type" => "queued", "rating" => 1500, "league" => "placement")
      expect(MatchmakingTicket.find_by(player: player)).to have_attributes(mode: "ranked", character: "kaze")
    end

    it "pairs with the oldest waiting player within the rating window (same engine version)" do
      older = queue_ticket(create(:player, rating: 1580), created_at: 5.seconds.ago)
      queue_ticket(create(:player, rating: 1510), created_at: 1.second.ago)
      queue_ticket(create(:player, rating: 1500), created_at: 9.seconds.ago, engine_version: "0.3.9+net1")

      expect {
        subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)
      }.to have_broadcasted_to("matchmaking:#{older.token}").with(a_hash_including("type" => "matched", "side" => 0))

      match = Match.last
      expect(match).to have_attributes(player1: older.player, player2: player, status: "waiting", mode: "ranked",
                                       p1_character: "ryu", p2_character: "kaze", p2_pack_sha256: sha,
                                       engine_version: ver, season: Season.current)
      expect(transmissions.last).to include(
        "type" => "matched", "match_id" => match.id, "side" => 1, "seed" => match.seed, "input_delay" => 2,
        "engine_version" => ver,
        "opponent" => { "display_name" => older.player.display_name, "rating" => 1580, "league" => "placement",
                        "character" => "ryu", "pack_sha256" => "d" * 64 }
      )
      expect(MatchmakingTicket.where(id: older.id)).to be_empty
      expect(MatchmakingTicket.where(player: player)).to be_empty
    end

    it "uses the season rating for the ticket" do
      SeasonRating.create!(player: player, season: Season.current, rating: 1712.4, wins: 9)

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)

      expect(transmissions.last).to eq("type" => "queued", "rating" => 1712, "league" => "platina")
      expect(MatchmakingTicket.find_by!(player: player).rating).to eq(1712)
    end

    it "widens the rating window with waiting time: ±100, +50 every 5 s, anyone after 30 s" do
      far = queue_ticket(create(:player, rating: 1660), created_at: Time.current)

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)
      expect(transmissions.last).to eq("type" => "queued", "rating" => 1500, "league" => "placement")
      mine = MatchmakingTicket.find_by!(player: player)

      far.update_columns(created_at: 6.seconds.ago) # janela 150 < 160
      expect(Matchmaking::Queue.new.try_pair!(mine.token)).to be_nil

      far.update_columns(created_at: 11.seconds.ago) # janela 200 ≥ 160
      result = Matchmaking::Queue.new.try_pair!(mine.token)

      expect(result.type).to eq(:matched)
      expect(result.match).to have_attributes(player1_id: far.player_id, player2_id: player.id)
      expect(result.notify).to eq([ far.token, mine.token ])
    end

    it "pairs any rating after 30 s, but never a different engine version" do
      queue_ticket(create(:player, rating: 2400), created_at: 31.seconds.ago, engine_version: "9.9.9")
      far = queue_ticket(create(:player, rating: 2400), created_at: 31.seconds.ago)

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)

      expect(transmissions.last).to include("type" => "matched", "side" => 1)
      expect(Match.last.player1_id).to eq(far.player_id)
    end

    it "window formula" do
      expect(Matchmaking::Queue.window_for(0)).to eq(100)
      expect(Matchmaking::Queue.window_for(4.9)).to eq(100)
      expect(Matchmaking::Queue.window_for(5)).to eq(150)
      expect(Matchmaking::Queue.window_for(29)).to eq(350)
      expect(Matchmaking::Queue.window_for(30)).to eq(Float::INFINITY)
    end

    it "ignores stale tickets" do
      stale = queue_ticket(create(:player))
      stale.update_columns(heartbeat_at: 1.minute.ago)

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)

      expect(transmissions.last).to eq("type" => "queued", "rating" => 1500, "league" => "placement")
    end

    it "returns already_queued for a second ticket of the same player" do
      queue_ticket(player)

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)

      expect(transmissions.last).to eq("type" => "error", "error" => "already_queued")
    end

    it "leaves the queue on cancel and on unsubscribe" do
      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)
      perform :cancel
      expect(MatchmakingTicket.where(player: player)).to be_empty

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha, engine_version: ver)
      expect(MatchmakingTicket.where(player: player)).to exist
      unsubscribe
      expect(MatchmakingTicket.where(player: player)).to be_empty
    end

    it "rejects malformed params" do
      subscribe(mode: "ranked", character: "Bad Slug!", pack_sha256: sha, engine_version: ver)
      expect(subscription).to be_rejected

      subscribe(mode: "ranked", character: "kaze", pack_sha256: sha)
      expect(subscription).to be_rejected
    end
  end

  it "não junta versões diferentes da engine numa sala" do
    queue_ticket(create(:player), mode: "room", room_code: "VERS22", engine_version: "0.3.0+net1")

    subscribe(mode: "room", room_code: "VERS22", character: "kaze", pack_sha256: sha, engine_version: ver)

    expect(transmissions.last).to eq("type" => "error", "error" => "version_mismatch")
  end

  describe "rooms" do
    it "creates a room with a code" do
      subscribe(mode: "room", character: "kaze", pack_sha256: sha, engine_version: ver)

      code = transmissions.last["room_code"]
      expect(transmissions.last["type"]).to eq("room_created")
      expect(code).to match(/\A[A-Z2-9]{6}\z/)
      expect(MatchmakingTicket.find_by(player: player).room_code).to eq(code)
    end

    it "joins an existing room" do
      host = queue_ticket(create(:player), mode: "room", room_code: "ABCD12")

      expect {
        subscribe(mode: "room", room_code: "abcd12", character: "kaze", pack_sha256: sha, engine_version: ver)
      }.to have_broadcasted_to("matchmaking:#{host.token}").with(a_hash_including("type" => "matched", "side" => 0))

      expect(transmissions.last).to include("type" => "matched", "side" => 1)
      expect(Match.last).to have_attributes(mode: "room", room_code: "ABCD12", player1: host.player)
    end

    it "returns room_not_found and room_full" do
      subscribe(mode: "room", room_code: "ZZZZ99", character: "kaze", pack_sha256: sha, engine_version: ver)
      expect(transmissions.last).to eq("type" => "error", "error" => "room_not_found")

      create(:match, room_code: "FULL22", mode: "room", status: "active")
      subscribe(mode: "room", room_code: "FULL22", character: "kaze", pack_sha256: sha, engine_version: ver)
      expect(transmissions.last).to eq("type" => "error", "error" => "room_full")
    end
  end
end
