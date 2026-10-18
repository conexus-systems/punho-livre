# frozen_string_literal: true

# Avisa os moderadores (ADMIN_NOTIFY_EMAILS) que há personagem para revisar.
# Um único e-mail (primeiro destinatário + cópia para os demais), para que a
# chave de idempotência `character-submitted-<id>` cubra todos.
class CharacterSubmittedNotificationJob < ApplicationJob
  queue_as :default
  retry_on Conexus::Messaging::DispatchError, wait: :polynomially_longer, attempts: 8

  def perform(character_id)
    character = Character.find_by(id: character_id)
    return unless character

    recipients = Rails.application.config.x.mugen.admin_notify_emails
    if recipients.empty?
      Rails.logger.info("[mugen] ADMIN_NOTIFY_EMAILS empty; skipping character.submitted id=#{character.id}")
      return
    end

    Notifications::ConexusMessenger.email!(
      to: recipients.first,
      cc: recipients.drop(1),
      event: "character.submitted",
      idempotency_key: "character-submitted-#{character.id}",
      subject: "[MUGEN Arena] Novo personagem para revisar: #{character.name}",
      body: <<~TEXT,
        #{character.submitted_by&.display_name || character.author} enviou o personagem "#{character.name}"
        (id #{character.slug}, versão #{character.version}, #{character.size_bytes} bytes).

        Revise em GET /api/v1/admin/characters?status=pending e aprove/rejeite com
        PATCH /api/v1/admin/characters/#{character.slug}.
      TEXT
      metadata: { character_id: character.id, slug: character.slug }
    )
  end
end
