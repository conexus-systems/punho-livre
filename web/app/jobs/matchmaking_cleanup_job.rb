# frozen_string_literal: true

# Faxina periódica (config/recurring.yml):
# - tickets de matchmaking sem heartbeat (processo/pod caiu sem unsubscribe);
# - partidas `waiting` em que ninguém deu `ready` a tempo → `abandoned`
#   (sem mexer em rating) e aviso `opponent_left` a quem ainda estiver lá;
# - partidas `active` com um lado desconectado além da tolerância (rede de
#   segurança caso o MatchReconnectTimeoutJob tenha se perdido);
# - partidas `active` com um único relato de resultado há mais de 2 min →
#   encerradas com esse relato;
# - replays (entradas + checksums) mais velhos que REPLAY_RETENTION_DAYS,
#   exceto de partidas com revisão aberta.
class MatchmakingCleanupJob < ApplicationJob
  queue_as :default

  WAITING_TIMEOUT = 2.minutes
  REPORT_TIMEOUT = 2.minutes

  def perform
    MatchmakingTicket.stale.delete_all

    Match.where(status: "waiting").where(created_at: ...WAITING_TIMEOUT.ago).find_each do |match|
      next unless Matches::Abandon.call(match_id: match.id, leaver_side: nil)

      MatchChannel.broadcast_to(match, { type: "opponent_left" })
    end

    expire_disconnected

    # partidas em que só um lado relatou o resultado e o outro sumiu
    Match.where(status: "active").where(updated_at: ...REPORT_TIMEOUT.ago).find_each do |match|
      payload = Matches::ReportResult.finalize_single_report(match.id)
      MatchChannel.broadcast_to(match, payload) if payload
    end

    purge_old_replays
  end

  private

  def expire_disconnected
    limit = (Matches::Connection.grace + 5.seconds).ago
    Match.where(status: "active")
         .where("p1_disconnected_at < :t OR p2_disconnected_at < :t", t: limit).find_each do |match|
      side = match.p1_disconnected_at && match.p1_disconnected_at < limit ? 0 : 1
      MatchReconnectTimeoutJob.perform_now(match.id, side, match.disconnected_at(side).iso8601(6))
    end
  end

  def purge_old_replays
    days = Rails.application.config.x.mugen.replay_retention_days
    old = Match.closed.where(finished_at: ...days.days.ago)
               .where.not(id: MatchReview.unresolved.select(:match_id))
    MatchInputChunk.where(match_id: old.select(:id)).delete_all
    MatchChecksum.where(match_id: old.select(:id)).delete_all
  end
end
