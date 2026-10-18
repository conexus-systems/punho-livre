# frozen_string_literal: true

module Matchmaking
  # Fila de matchmaking (ranked) e salas privadas (room), no Postgres.
  #
  # Concorrência: todo pareamento acontece numa transação que trava os tickets
  # envolvidos com `FOR UPDATE SKIP LOCKED` — dois processos nunca pegam o
  # mesmo ticket, e ninguém espera lock de outro (sem deadlock). Um par que
  # "se cruza" (ambos entram ao mesmo tempo) é resolvido no próximo
  # `try_pair!` periódico do canal.
  #
  # Ranked: pareia o ticket mais antigo cujo rating esteja dentro da janela
  # (±200, +50 a cada 10 s de espera; vale a maior janela dos dois).
  class Queue
    BASE_WINDOW = 200
    WINDOW_STEP = 50
    STEP_SECONDS = 10
    INPUT_DELAY = 2
    ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars.freeze
    ROOM_CODE_LENGTH = 6
    SHA256_FORMAT = /\A\h{64}\z/

    class InvalidParams < StandardError; end

    # type: :queued | :room_created | :matched | :error
    # notify: tokens (streams) de outros jogadores que precisam receber `matched`.
    Result = Data.define(:type, :ticket, :match, :side, :error, :room_code, :notify) do
      def self.build(type, ticket: nil, match: nil, side: nil, error: nil, room_code: nil, notify: [])
        new(type:, ticket:, match:, side:, error:, room_code:, notify:)
      end
    end

    class << self
      def window_for(waited_seconds)
        BASE_WINDOW + (WINDOW_STEP * (waited_seconds.to_f / STEP_SECONDS).floor)
      end

      def matched_payload(match, side)
        other = 1 - side
        opponent = match.player_on(other)
        {
          type: "matched",
          match_id: match.id,
          side: side,
          seed: match.seed,
          input_delay: INPUT_DELAY,
          opponent: {
            display_name: opponent.display_name,
            rating: opponent.rating,
            character: match.character_on(other),
            pack_sha256: other.zero? ? match.p1_pack_sha256 : match.p2_pack_sha256
          }
        }
      end
    end

    # Entrada pelo subscribe do MatchmakingChannel. `token` é o stream do canal.
    def join(player:, token:, mode:, character:, pack_sha256:, room_code: nil)
      validate!(mode, character, pack_sha256)
      MatchmakingTicket.stale.where(player: player).delete_all
      return Result.build(:error, error: "already_queued") if MatchmakingTicket.exists?(player: player)

      entry = { player: player, token: token, character: character, pack_sha256: pack_sha256 }
      if mode == "ranked"
        join_ranked(**entry)
      elsif room_code.present?
        join_room(room_code: room_code.to_s.strip.upcase, **entry)
      else
        create_room(**entry)
      end
    rescue ActiveRecord::RecordNotUnique
      Result.build(:error, error: "already_queued")
    end

    # Chamado periodicamente pelo canal de quem está na fila ranked: renova o
    # heartbeat e tenta parear com a janela já ampliada.
    def try_pair!(token)
      MatchmakingTicket.transaction do
        me = MatchmakingTicket.where(token: token).lock("FOR UPDATE SKIP LOCKED").first
        return nil unless me

        me.update_columns(heartbeat_at: Time.current)
        return nil unless me.mode == "ranked"

        candidate = ranked_candidate(player_id: me.player_id, rating: me.rating, since: me.created_at,
                                     exclude_id: me.id)
        return nil unless candidate

        first, second = [ me, candidate ].sort_by { |t| [ t.created_at, t.id ] }
        match = create_match(first, second, mode: "ranked")
        MatchmakingTicket.where(id: [ me.id, candidate.id ]).delete_all
        Result.build(:matched, match: match, notify: [ first.token, second.token ])
      end
    end

    def heartbeat!(token)
      MatchmakingTicket.where(token: token).update_all(heartbeat_at: Time.current)
    end

    def cancel(token)
      MatchmakingTicket.where(token: token).delete_all
    end

    private

    def validate!(mode, character, pack_sha256)
      raise InvalidParams, "mode must be ranked or room" unless MatchmakingTicket::MODES.include?(mode)
      raise InvalidParams, "character must be a slug" unless character.is_a?(String) && character.match?(Character::SLUG_FORMAT)
      raise InvalidParams, "pack_sha256 must be hex sha256" unless pack_sha256.is_a?(String) && pack_sha256.match?(SHA256_FORMAT)
    end

    def join_ranked(player:, token:, character:, pack_sha256:)
      MatchmakingTicket.transaction do
        now = Time.current
        candidate = ranked_candidate(player_id: player.id, rating: player.rating, since: now)
        if candidate
          match = create_match(candidate, new_ticket(player, token, "ranked", character, pack_sha256, now), mode: "ranked")
          candidate.delete
          return Result.build(:matched, match: match, side: 1, notify: [ candidate.token ])
        end

        ticket = new_ticket(player, token, "ranked", character, pack_sha256, now)
        ticket.save!
        Result.build(:queued, ticket: ticket)
      end
    end

    def create_room(player:, token:, character:, pack_sha256:)
      attempts = 0
      begin
        attempts += 1
        ticket = new_ticket(player, token, "room", character, pack_sha256, Time.current)
        ticket.room_code = generate_room_code
        ticket.save!
        Result.build(:room_created, ticket: ticket, room_code: ticket.room_code)
      rescue ActiveRecord::RecordNotUnique
        # Colisão de código (raro): tenta outro. Se for o ticket do jogador, já está na fila.
        raise if attempts >= 5 || MatchmakingTicket.exists?(player: player)

        retry
      end
    end

    def join_room(room_code:, player:, token:, character:, pack_sha256:)
      MatchmakingTicket.transaction do
        host = MatchmakingTicket.where(mode: "room", room_code: room_code).fresh
                                .lock("FOR UPDATE SKIP LOCKED").first
        return Result.build(:error, error: room_missing_error(room_code)) unless host
        return Result.build(:error, error: "already_queued") if host.player_id == player.id

        joiner = new_ticket(player, token, "room", character, pack_sha256, Time.current)
        match = create_match(host, joiner, mode: "room", room_code: room_code)
        host.delete
        Result.build(:matched, match: match, side: 1, notify: [ host.token ])
      end
    end

    # Sem ticket livre: se a sala existe (travada por outro) ou já virou
    # partida em andamento → room_full; senão → room_not_found.
    def room_missing_error(room_code)
      taken = MatchmakingTicket.where(room_code: room_code).fresh.exists? ||
              Match.in_progress.where(room_code: room_code).exists?
      taken ? "room_full" : "room_not_found"
    end

    def ranked_candidate(player_id:, rating:, since:, exclude_id: nil)
      now = Time.current
      # Janela = a maior entre a do candidato (tempo dele na fila) e a minha.
      waited = "GREATEST(EXTRACT(EPOCH FROM (CAST(:now AS timestamp) - created_at)), :mine)"
      condition = "ABS(rating - :rating) <= :base + :step * FLOOR(#{waited} / :every)"

      scope = MatchmakingTicket.fresh.where(mode: "ranked").where.not(player_id: player_id)
      scope = scope.where.not(id: exclude_id) if exclude_id
      scope.where(condition, now: now, mine: (now - since).to_f, rating: rating, base: BASE_WINDOW,
                             step: WINDOW_STEP, every: STEP_SECONDS)
           .order(:created_at, :id)
           .lock("FOR UPDATE SKIP LOCKED")
           .first
    end

    def new_ticket(player, token, mode, character, pack_sha256, now)
      MatchmakingTicket.new(player: player, token: token, mode: mode, character: character,
                            pack_sha256: pack_sha256, rating: player.rating, created_at: now, heartbeat_at: now)
    end

    # O ticket mais antigo (quem esperava / dono da sala) é o lado 0.
    def create_match(side0, side1, mode:, room_code: nil)
      Match.create!(
        status: "waiting",
        mode: mode,
        room_code: room_code,
        player1_id: side0.player_id,
        player2_id: side1.player_id,
        p1_character: side0.character,
        p2_character: side1.character,
        p1_pack_sha256: side0.pack_sha256,
        p2_pack_sha256: side1.pack_sha256,
        seed: SecureRandom.random_number(2**31)
      )
    end

    def generate_room_code
      Array.new(ROOM_CODE_LENGTH) { ROOM_CODE_ALPHABET[SecureRandom.random_number(ROOM_CODE_ALPHABET.size)] }.join
    end
  end
end
