# frozen_string_literal: true

# Fila ranked e salas privadas (docs/PROTOCOL.md → MatchmakingChannel).
#
# subscribe { mode: "ranked"|"room", room_code?, character, pack_sha256, engine_version }
#   → { type: "queued", rating, league } | { type: "room_created", room_code } |
#     { type: "matched", match_id, side, seed, input_delay, opponent } |
#     { type: "error", error: "room_not_found"|"room_full"|"already_queued"|"version_mismatch" }
# ação `cancel` (ou unsubscribe) → sai da fila / fecha a sala.
#
# Cada assinatura escuta um stream próprio ("matchmaking:<token>"): quem
# pareia avisa o outro por broadcast, mesmo se ele estiver em outro processo.
class MatchmakingChannel < ApplicationCable::Channel
  # Reavalia o pareamento (janela de rating cresce com o tempo) e renova o
  # heartbeat do ticket.
  periodically :retry_pairing, every: 3.seconds

  def subscribed
    @token = SecureRandom.urlsafe_base64(18)
    stream_from stream_for_token(@token)

    result = queue.join(
      player: current_player,
      token: @token,
      mode: params[:mode].to_s,
      character: params[:character],
      pack_sha256: params[:pack_sha256],
      engine_version: params[:engine_version],
      room_code: params[:room_code]
    )
    handle(result)
  rescue Matchmaking::Queue::InvalidParams => e
    logger.info("[matchmaking] rejected subscription: #{e.message}")
    reject
  end

  def cancel(_data = {})
    queue.cancel(@token) if @token
  end

  def unsubscribed
    queue.cancel(@token) if @token
  end

  private

  def retry_pairing
    return unless @token

    result = queue.try_pair!(@token)
    handle(result) if result
  end

  def handle(result)
    case result.type
    when :queued
      standing = SeasonRating.for!(current_player)
      transmit({ type: "queued", rating: standing.display_rating, league: standing.league.key })
    when :room_created
      transmit({ type: "room_created", room_code: result.room_code })
    when :error
      transmit({ type: "error", error: result.error })
    when :matched
      announce_match(result)
    end
  end

  # `side` presente: quem entrou agora recebe por transmit e o outro por
  # broadcast. Sem `side` (pareamento periódico): broadcast para os dois.
  def announce_match(result)
    match = result.match
    if result.side
      transmit(Matchmaking::Queue.matched_payload(match, result.side))
      result.notify.each do |token|
        ActionCable.server.broadcast(stream_for_token(token), Matchmaking::Queue.matched_payload(match, 1 - result.side))
      end
    else
      result.notify.each_with_index do |token, side|
        ActionCable.server.broadcast(stream_for_token(token), Matchmaking::Queue.matched_payload(match, side))
      end
    end
  end

  def stream_for_token(token)
    "matchmaking:#{token}"
  end

  def queue
    @queue ||= Matchmaking::Queue.new
  end
end
