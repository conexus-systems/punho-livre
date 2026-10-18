# frozen_string_literal: true

require "rails_helper"

RSpec.describe MatchChannel, type: :channel do
  let(:p1) { create(:player) }
  let(:p2) { create(:player) }
  let(:match) { create(:match, player1: p1, player2: p2, status: "waiting", season: Season.current) }

  def join_as(player, **params)
    stub_connection current_player: player
    subscribe(match_id: match.id, **params)
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
    expect { perform :checksum, frame: 60, value: 123_456, inputs_hash: 99 }
      .to have_broadcasted_to(match).with(type: "checksum", side: 1, frame: 60, value: 123_456, inputs_hash: 99)
    expect { perform :input, frames: "junk" }.not_to have_broadcasted_to(match)
    expect(MatchChecksum.find_by(match: match, side: 1, frame: 60)).to have_attributes(value: 123_456, inputs_hash: 99)
  end

  it "answers ping only to the sender" do
    join_as(p1)

    expect { perform :ping, t: 42 }.not_to have_broadcasted_to(match)
    expect(transmissions.last).to eq("type" => "pong", "t" => 42)
  end

  describe "result (consenso dos dois relatos)" do
    before { match.update!(status: "active", started_at: Time.current) }

    it "finishes the match when both reports agree and applies Glicko-2 to the season" do
      join_as(p1)
      expect { perform :result, winner_side: 0 }.not_to have_broadcasted_to(match)

      join_as(p2)
      expect { perform :result, winner_side: 0 }
        .to have_broadcasted_to(match).with(type: "finished", winner_side: 0, ratings: { "0" => 1662, "1" => 1338 })

      expect(match.reload).to have_attributes(status: "finished", winner_side: 0, p1_rating_delta: 162,
                                              p2_rating_delta: -162, finished_at: be_present)
      expect(p1.reload).to have_attributes(rating: 1662, wins: 1, losses: 0)
      expect(p2.reload).to have_attributes(rating: 1338, wins: 0, losses: 1)
      season_rating = SeasonRating.find_by!(player: p1, season: match.season)
      expect(season_rating).to have_attributes(wins: 1, losses: 0, last_match_at: be_present)
      expect(season_rating.deviation).to be < 350
    end

    it "supports draws (no W/L, ratings move towards each other)" do
      SeasonRating.create!(player: p1, season: match.season, rating: 1700.0, deviation: 80.0)
      SeasonRating.create!(player: p2, season: match.season, rating: 1500.0, deviation: 80.0)
      join_as(p1)
      perform :result, winner_side: nil
      join_as(p2)
      perform :result, winner_side: nil

      expect(match.reload.p1_rating_delta).to be < 0
      expect(match.p2_rating_delta).to be > 0
      expect(p1.reload).to have_attributes(wins: 0, losses: 0)
      expect(SeasonRating.find_by!(player: p1).draws).to eq(1)
    end

    it "marks the match disputed when the reports diverge and queues it for review" do
      join_as(p1)
      perform :result, winner_side: 0
      join_as(p2)

      expect { perform :result, winner_side: 1 }
        .to have_broadcasted_to(match).with(type: "finished", winner_side: nil, disputed: true)
      expect(match.reload.status).to eq("disputed")
      expect([ p1.reload.rating, p2.reload.rating ]).to eq([ 1500, 1500 ])
      expect(MatchReview.find_by!(match: match)).to have_attributes(reason: "result_mismatch", status: "open")
    end

    it "does not change ratings for unrated room matches" do
      match.update!(mode: "room")
      join_as(p1)
      perform :result, winner_side: 1
      join_as(p2)

      expect { perform :result, winner_side: 1 }
        .to have_broadcasted_to(match).with(type: "finished", winner_side: 1, ratings: { "0" => 1500, "1" => 1500 })
    end

    it "rates room matches when RATED_ROOM_MATCHES is on" do
      match.update!(mode: "room")
      with_config(:mugen, rated_room_matches: true) do
        join_as(p1)
        perform :result, winner_side: 1
        join_as(p2)
        perform :result, winner_side: 1
      end

      expect(p2.reload.rating).to eq(1662)
    end
  end

  describe "anti-trapaça" do
    before { match.update!(status: "active", started_at: Time.current) }

    it "anula a partida quando o hash do estado diverge no mesmo quadro" do
      join_as(p1)
      perform :checksum, frame: 120, value: 111, inputs_hash: 7
      join_as(p2)

      expect { perform :checksum, frame: 120, value: 222, inputs_hash: 7 }
        .to have_broadcasted_to(match).with(type: "voided", reason: "state_mismatch")
      expect(match.reload).to have_attributes(status: "void", void_reason: "state_mismatch")
      review = MatchReview.find_by!(match: match)
      expect(review.details).to include("frame" => 120, "values" => [ 111, 222 ])
      expect([ p1.reload.rating, p2.reload.rating ]).to eq([ 1500, 1500 ])
    end

    it "anula quando o hash das entradas diverge (alguém viu entradas diferentes)" do
      join_as(p2)
      perform :checksum, frame: 60, value: 5, inputs_hash: 1
      join_as(p1)

      expect { perform :checksum, frame: 60, value: 5, inputs_hash: 2 }
        .to have_broadcasted_to(match).with(type: "voided", reason: "inputs_mismatch")
    end

    it "checksums iguais não fazem nada; resultado depois de anulada é ignorado" do
      join_as(p1)
      perform :checksum, frame: 60, value: 5, inputs_hash: 1
      join_as(p2)
      expect { perform :checksum, frame: 60, value: 5, inputs_hash: 1 }
        .not_to have_broadcasted_to(match).with(hash_including(type: "voided"))
      expect(match.reload.status).to eq("active")

      Matches::Void.call(match_id: match.id, reason: "state_mismatch")
      expect { perform :result, winner_side: 0 }.not_to have_broadcasted_to(match)
    end

    it "registra as entradas em blocos e avisa buraco só ao remetente" do
      join_as(p1)
      perform :input_log, from: 1, bits: [ 0, 0, 16, 16 ]
      perform :input_log, from: 3, bits: [ 16, 16, 32 ] # sobreposição é aparada
      expect(Matches::InputLog.frames_from(match.id, 0, 1)).to eq([ 0, 0, 16, 16, 32 ])

      expect { perform :input_log, from: 50, bits: [ 1 ] }.not_to have_broadcasted_to(match)
      expect(transmissions.last).to eq("type" => "input_log_gap", "next" => 6)
      perform :input_log, from: 6, bits: [ 99_999 ] # inválido: ignorado
      expect(Matches::InputLog.next_frame(match.id, 0)).to eq(6)
    end

    it "anula no resultado se o replay registrado não bate com o hash relatado pelos dois lados" do
      p1_bits = [ 0, 0, 16, 16 ]
      p2_bits = [ 0, 0, 4, 4 ]
      honest = Matches::InputsHash.call(p1_bits, p2_bits, 4)
      join_as(p1)
      perform :input_log, from: 1, bits: [ 0, 0, 64, 64 ] # registra entradas diferentes das que jogou
      perform :checksum, frame: 4, value: 1, inputs_hash: honest
      perform :result, winner_side: 0
      join_as(p2)
      perform :input_log, from: 1, bits: p2_bits
      perform :checksum, frame: 4, value: 1, inputs_hash: honest

      expect { perform :result, winner_side: 0 }
        .to have_broadcasted_to(match).with(type: "voided", reason: "replay_mismatch")
      expect(match.reload.status).to eq("void")
      expect(p1.reload.rating).to eq(1500)
    end

    it "replay que bate não atrapalha o resultado" do
      p1_bits = [ 0, 0, 16, 16 ]
      p2_bits = [ 0, 0, 4, 4 ]
      honest = Matches::InputsHash.call(p1_bits, p2_bits, 4)
      join_as(p1)
      perform :input_log, from: 1, bits: p1_bits
      perform :checksum, frame: 4, value: 1, inputs_hash: honest
      perform :result, winner_side: 1
      join_as(p2)
      perform :input_log, from: 1, bits: p2_bits
      perform :checksum, frame: 4, value: 1, inputs_hash: honest

      expect { perform :result, winner_side: 1 }
        .to have_broadcasted_to(match).with(hash_including(type: "finished", winner_side: 1))
    end
  end

  describe "queda e reconexão" do
    before { match.update!(status: "active", started_at: Time.current) }

    it "queda no meio da luta abre a tolerância em vez de abandonar" do
      join_as(p1)

      expect { unsubscribe }.to have_broadcasted_to(match)
        .with(type: "opponent_disconnected", side: 0, grace_ms: 10_000)
      expect(match.reload).to have_attributes(status: "active", p1_disconnected_at: be_present)
      expect(MatchReconnectTimeoutJob).to have_been_enqueued.with(match.id, 0, match.p1_disconnected_at.iso8601(6))
    end

    it "volta dentro da tolerância: recebe as entradas do oponente registradas e o oponente reenvia o resto" do
      Matches::InputLog.append(match_id: match.id, side: 1, from: 1, bits: [ 0, 0, 8, 8, 8, 9 ])
      Matches::InputLog.append(match_id: match.id, side: 0, from: 1, bits: [ 0, 0, 1 ])
      join_as(p1)
      unsubscribe

      expect { join_as(p1, resume: true, from: 4) }
        .to have_broadcasted_to(match).with(type: "resync", side: 0, from: 4)
      expect(transmissions.last).to eq("type" => "resume", "status" => "active", "from" => 4,
                                        "frames" => [ 8, 8, 9 ], "log_next" => 4)
      expect(match.reload.p1_disconnected_at).to be_nil

      # o job da queda antiga não faz nada
      perform_enqueued_jobs(only: MatchReconnectTimeoutJob)
      expect(match.reload.status).to eq("active")
    end

    it "não volta a tempo: derrota por abandono e aviso ao oponente" do
      join_as(p1)
      unsubscribe

      travel(11.seconds) do
        expect { perform_enqueued_jobs(only: MatchReconnectTimeoutJob) }
          .to have_broadcasted_to(match).with(type: "opponent_left", side: 0)
      end
      expect(match.reload).to have_attributes(status: "abandoned", abandoned_by_side: 0, winner_side: 1)
      expect(p1.reload).to have_attributes(losses: 1)
      expect(p1.rating).to be < 1500
      expect(p2.reload).to have_attributes(wins: 1)
    end

    it "queda de uma conexão antiga, percebida depois da reconexão, é ignorada" do
      stub_connection current_player: p1
      old = subscribe(match_id: match.id)
      old_channel = subscription
      join_as(p1, resume: true, from: 1) # nova conexão assume o lado

      expect { old_channel.unsubscribe_from_channel }.not_to have_broadcasted_to(match)
      expect(old).to be_truthy
      expect(match.reload.p1_disconnected_at).to be_nil
    end

    it "os dois caíram e ninguém voltou: encerra sem vencedor e sem rating" do
      join_as(p1)
      unsubscribe
      join_as(p2)
      unsubscribe

      travel(11.seconds) { perform_enqueued_jobs(only: MatchReconnectTimeoutJob) }
      expect(match.reload).to have_attributes(status: "abandoned", winner_side: nil, abandoned_by_side: nil)
      expect([ p1.reload.rating, p2.reload.rating ]).to eq([ 1500, 1500 ])
    end

    it "`leave` (desistência) abandona na hora" do
      join_as(p2)

      expect { perform :leave }.to have_broadcasted_to(match).with(type: "opponent_left", side: 1)
      expect(match.reload).to have_attributes(status: "abandoned", abandoned_by_side: 1, winner_side: 0)
      expect { unsubscribe }.not_to have_broadcasted_to(match)
    end

    it "partida que nem começou é abandonada sem rating ao sair" do
      match.update!(status: "waiting")
      join_as(p2)

      expect { unsubscribe }.to have_broadcasted_to(match).with(type: "opponent_left", side: 1)
      expect(match.reload.status).to eq("abandoned")
      expect(p2.reload.rating).to eq(1500)
    end

    it "quem sai depois de relatar o resultado não fica marcado" do
      join_as(p1)
      perform :result, winner_side: 0

      expect { unsubscribe }.not_to have_broadcasted_to(match)
      expect(match.reload.p1_disconnected_at).to be_nil
    end
  end
end
