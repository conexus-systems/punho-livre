# frozen_string_literal: true

# Relay de uma partida 1v1 (docs/PROTOCOL.md → MatchChannel).
#
# Só os dois participantes assinam; `stream_for match`. As entradas (`input`)
# são relayadas sem tocar no banco; cada cliente ignora as mensagens com o
# próprio `side`. O banco recebe só o registro de entradas em blocos
# (`input_log`, ~1/s por lado) e os checksums (~1/s por lado), usados na
# reconexão, no anti-trapaça e como replay.
class MatchChannel < ApplicationCable::Channel
  START_DELAY_MS = 1000
  # Teto de quadros devolvidos no `resume` (≈ 10 min de luta).
  MAX_RESUME_FRAMES = 36_000

  # params: { match_id, resume?: true, from?: <primeiro quadro remoto que falta> }
  def subscribed
    @match = Match.includes(:player1, :player2).find_by(id: params[:match_id])
    @side = @match&.side_of(current_player)
    return reject if @side.nil? || !@match.open?

    stream_for @match
    @connection_token = SecureRandom.hex(8)
    was_down = Matches::Connection.connected!(match_id: @match.id, side: @side, token: @connection_token)
    resume! if params[:resume] || was_down
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

  # { frame, value, inputs_hash } → relay { type: "checksum", side, frame, value, inputs_hash };
  # divergência com o outro lado → { type: "voided", reason } (Matches::Checksums).
  def checksum(data)
    frame = integer_or_nil(data["frame"])
    return if frame.nil?

    broadcast({ type: "checksum", side: @side, frame: frame, value: data["value"], inputs_hash: data["inputs_hash"] })
    payload = Matches::Checksums.record(match_id: @match.id, side: @side, frame: frame, value: data["value"],
                                        inputs_hash: data["inputs_hash"])
    broadcast(payload) if payload
  rescue ArgumentError => e
    logger.info("[match] invalid checksum from side #{@side}: #{e.message}")
  end

  # { from, bits: [...] } — registro das entradas deste lado (Matches::InputLog).
  # Buraco (bloco perdido na queda) → só para o remetente { type: "input_log_gap", next }.
  def input_log(data)
    result = Matches::InputLog.append(match_id: @match.id, side: @side, from: data["from"], bits: data["bits"])
    transmit({ type: "input_log_gap", next: result[:next] }) unless result[:ok]
  rescue Matches::InputLog::Invalid => e
    logger.info("[match] invalid input_log from side #{@side}: #{e.message}")
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

  # Saída voluntária (desistiu): abandono imediato, sem tolerância.
  def leave(_data = {})
    @left = true
    broadcast({ type: "opponent_left", side: @side }) if Matches::Abandon.call(match_id: @match.id, leaver_side: @side)
  end

  # Caiu sem `leave`:
  # - luta em andamento → tolerância de reconexão ({ type: "opponent_disconnected", side, grace_ms });
  # - partida que nem começou → abandonada sem rating + opponent_left.
  def unsubscribed
    return if @match.nil? || @side.nil? || @left

    if Match.where(id: @match.id).pick(:status) == "active"
      if Matches::Connection.disconnected!(match_id: @match.id, side: @side, token: @connection_token)
        broadcast({ type: "opponent_disconnected", side: @side, grace_ms: Matches::Connection.grace.in_milliseconds.to_i })
      end
    elsif Matches::Abandon.call(match_id: @match.id, leaver_side: @side)
      broadcast({ type: "opponent_left", side: @side })
    end
  end

  private

  # Reconexão: devolve ao cliente as entradas do oponente registradas desde
  # `from` e de onde continuar o próprio registro; avisa o oponente para
  # reenviar o resto (`resync`).
  def resume!
    from = params[:from].is_a?(Integer) && params[:from].positive? ? params[:from] : 1
    frames = Matches::InputLog.frames_from(@match.id, 1 - @side, from).first(MAX_RESUME_FRAMES)
    transmit({
      type: "resume",
      status: @match.reload.status,
      from: from,
      frames: frames,
      log_next: Matches::InputLog.next_frame(@match.id, @side)
    })
    broadcast({ type: "resync", side: @side, from: from })
  end

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
