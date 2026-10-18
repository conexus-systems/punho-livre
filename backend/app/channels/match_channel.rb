# frozen_string_literal: true

# Relay de uma partida 1v1 (docs/PROTOCOL.md → MatchChannel).
#
# Só os dois participantes assinam; `stream_for match`. As mensagens de jogo
# (input/checksum) são relayadas sem tocar no banco; cada cliente ignora as
# que têm o próprio `side`.
class MatchChannel < ApplicationCable::Channel
  START_DELAY_MS = 1000

  def subscribed
    @match = Match.includes(:player1, :player2).find_by(id: params[:match_id])
    @side = @match&.side_of(current_player)
    return reject if @side.nil? || !@match.open?

    stream_for @match
  end

  # Quando os dois lados estão prontos: { type: "start", at: <epoch ms> }.
  def ready(_data = {})
    started = Match.transaction do
      match = Match.lock.find(@match.id)
      next false unless match.waiting?

      match.public_send(@side.zero? ? :p1_ready_at= : :p2_ready_at=, Time.current)
      if match.both_ready?
        match.status = "active"
        match.started_at = Time.current
      end
      match.save!
      match.active?
    end
    return unless started

    broadcast({ type: "start", at: (Time.current.to_f * 1000).to_i + START_DELAY_MS })
  end

  # { frames: [[frame, bits], ...], ack } → { type: "input", side, frames, ack }
  def input(data)
    frames = data["frames"]
    return unless frames.is_a?(Array) && frames.all? { |f| valid_frame?(f) }

    broadcast({ type: "input", side: @side, frames: frames, ack: integer_or_nil(data["ack"]) })
  end

  # { frame, value } → { type: "checksum", side, frame, value }
  def checksum(data)
    frame = integer_or_nil(data["frame"])
    return if frame.nil?

    broadcast({ type: "checksum", side: @side, frame: frame, value: data["value"] })
  end

  # { winner_side: 0|1|null } — ver Matches::ReportResult.
  def result(data)
    winner = data["winner_side"]
    payload = Matches::ReportResult.call(match_id: @match.id, side: @side, winner_side: winner)
    broadcast(payload) if payload
  rescue ArgumentError => e
    logger.info("[match] invalid result from side #{@side}: #{e.message}")
  end

  # { t } → só para o remetente: { type: "pong", t }
  def ping(data)
    transmit({ type: "pong", t: data["t"] })
  end

  # Saiu com a partida em aberto: abandoned (quem saiu perde) + opponent_left.
  def unsubscribed
    return unless @match && !@side.nil?

    broadcast({ type: "opponent_left" }) if Matches::Abandon.call(match_id: @match.id, leaver_side: @side)
  end

  private

  def broadcast(payload)
    MatchChannel.broadcast_to(@match, payload)
  end

  def valid_frame?(frame)
    frame.is_a?(Array) && frame.size == 2 && frame.all?(Integer)
  end

  def integer_or_nil(value)
    value.is_a?(Integer) ? value : nil
  end
end
