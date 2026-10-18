# frozen_string_literal: true

module Characters
  # POST /api/v1/characters — cria uma nova versão `pending` do personagem.
  #
  # Regras (docs/PROTOCOL.md):
  # - o slug (= `id` do pack) pertence a quem o enviou primeiro; outro jogador
  #   não pode publicar versões dele (admins podem);
  # - re-submissão do mesmo autor cria nova linha `pending` e a versão aprovada
  #   continua servida até a nova ser aprovada;
  # - submissões `pending` anteriores do mesmo slug são marcadas como
  #   `rejected` ("superseded"), para a fila de moderação ter uma por slug.
  class Submit
    class NotOwner < StandardError; end

    SUPERSEDED = "superseded"

    def self.call(...)
      new(...).call
    end

    def initialize(player:, pack:, admin: false)
      @player = player
      @pack = pack
      @admin = admin
    end

    def call
      result = PackValidator.call(@pack)
      slug = result.pack["id"]

      character = Character.transaction do
        # Serializa submissões concorrentes do mesmo slug (entre processos).
        Character.connection.execute(
          Character.sanitize_sql_array([ "SELECT pg_advisory_xact_lock(hashtext(?))", "character:#{slug}" ])
        )
        ensure_owner!(slug)

        Character.pending.where(slug: slug).update_all(
          status: "rejected", reject_reason: SUPERSEDED, reviewed_at: Time.current, updated_at: Time.current
        )

        Character.create!(
          slug: slug,
          name: result.pack["name"].strip,
          author: result.pack["author"].presence&.strip || @player.display_name,
          version: result.pack["version"].strip,
          status: "pending",
          sha256: result.sha256,
          size_bytes: result.size_bytes,
          pack_body: result.body,
          submitted_by: @player
        )
      end

      CharacterSubmittedNotificationJob.perform_later(character.id)
      character
    end

    private

    def ensure_owner!(slug)
      return if @admin

      owner_id = Character.where(slug: slug).where.not(submitted_by_id: nil).order(:id).pick(:submitted_by_id)
      return if owner_id.nil? || owner_id == @player.id

      raise NotOwner, "character id #{slug.inspect} belongs to another author"
    end
  end
end
