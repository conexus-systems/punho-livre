# frozen_string_literal: true

# Faxina periódica (config/recurring.yml):
# - tickets de matchmaking sem heartbeat (processo/pod caiu sem unsubscribe);
# - partidas `waiting` em que ninguém deu `ready` a tempo → `abandoned`
#   (sem mexer em rating) e aviso `opponent_left` a quem ainda estiver lá;
# - partidas `active` com um único relato de resultado há mais de 2 min →
#   encerradas com esse relato.
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

    # partidas em que só um lado relatou o resultado e o outro sumiu
    Match.where(status: "active").where(updated_at: ...REPORT_TIMEOUT.ago).find_each do |match|
      payload = Matches::ReportResult.finalize_single_report(match.id)
      MatchChannel.broadcast_to(match, payload) if payload
    end
  end
end
