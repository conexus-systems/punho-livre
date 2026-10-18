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
