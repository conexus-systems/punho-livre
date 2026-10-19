# frozen_string_literal: true

require "rails_helper"

RSpec.describe MatchmakingCleanupJob do
  it "removes stale tickets and abandons matches nobody started" do
    player = create(:player)
    MatchmakingTicket.create!(player: player, mode: "ranked", character: "kaze", rating: 1000,
                              token: "t1", created_at: 2.minutes.ago, heartbeat_at: 2.minutes.ago)
    old_match = create(:match, status: "waiting", created_at: 5.minutes.ago)
    fresh_match = create(:match, status: "waiting")

    expect { described_class.perform_now }.to have_broadcasted_to(MatchChannel.broadcasting_for(old_match))
      .with(type: "opponent_left")

    expect(MatchmakingTicket.count).to eq(0)
    expect(old_match.reload.status).to eq("abandoned")
    expect(fresh_match.reload.status).to eq("waiting")
  end
end

RSpec.describe MatchmakingCleanupJob, "online" do
  it "rede de segurança: lado desconectado além da tolerância perde por abandono" do
    match = create(:match, status: "active", p2_disconnected_at: 1.minute.ago)

    expect { described_class.perform_now }.to have_broadcasted_to(MatchChannel.broadcasting_for(match))
      .with(type: "opponent_left", side: 1)
    expect(match.reload).to have_attributes(status: "abandoned", abandoned_by_side: 1, winner_side: 0)
  end

  it "apaga replays antigos, mas guarda os que estão em revisão" do
    old = create(:match, status: "finished", finished_at: 40.days.ago)
    reviewed = create(:match, status: "void", finished_at: 40.days.ago)
    recent = create(:match, status: "finished", finished_at: 1.day.ago)
    MatchReview.create!(match: reviewed, reason: "state_mismatch")
    [ old, reviewed, recent ].each do |m|
      Matches::InputLog.append(match_id: m.id, side: 0, from: 1, bits: [ 1 ])
      MatchChecksum.create!(match: m, side: 0, frame: 60, value: 1, created_at: Time.current)
    end

    described_class.perform_now

    expect(MatchInputChunk.distinct.pluck(:match_id)).to contain_exactly(reviewed.id, recent.id)
    expect(MatchChecksum.distinct.pluck(:match_id)).to contain_exactly(reviewed.id, recent.id)
  end
end

RSpec.describe "relato único de resultado" do
  it "quem sai depois de relatar não perde por abandono" do
    match = create(:match, status: "active", reports: { "0" => 0 })
    expect(Matches::Abandon.call(match_id: match.id, leaver_side: 0)).to be(false)
    expect(match.reload.status).to eq("active")
  end

  it "a faxina encerra partidas com um relato antigo usando esse relato" do
    match = create(:match, status: "active", reports: { "1" => 1 })
    match.update_columns(updated_at: 5.minutes.ago)
    expect { MatchmakingCleanupJob.perform_now }.to have_broadcasted_to(MatchChannel.broadcasting_for(match))
      .with(hash_including(type: "finished", winner_side: 1))
    expect(match.reload.status).to eq("finished")
    expect(match.winner_side).to eq(1)
  end
end
