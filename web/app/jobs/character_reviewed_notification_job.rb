# frozen_string_literal: true

# Avisa o autor que o personagem foi aprovado ou rejeitado.
# Idempotência: `character-reviewed-<id>-<status>`.
class CharacterReviewedNotificationJob < ApplicationJob
  queue_as :default
  retry_on Conexus::Messaging::DispatchError, wait: :polynomially_longer, attempts: 8

  def perform(character_id, status)
    character = Character.find_by(id: character_id)
    return unless character

    email = character.submitted_by&.email
    if email.blank?
      Rails.logger.info("[mugen] character #{character.id} has no author email; skipping character.#{status}")
      return
    end

    Notifications::ConexusMessenger.email!(
      to: email,
      event: "character.#{status}",
      idempotency_key: "character-reviewed-#{character.id}-#{status}",
      subject: subject_for(character, status),
      body: body_for(character, status),
      metadata: { character_id: character.id, slug: character.slug, status: status }
    )
  end

  private

  def subject_for(character, status)
    if status == "approved"
      "[MUGEN Arena] #{character.name} foi aprovado!"
    else
      "[MUGEN Arena] #{character.name} não foi aprovado"
    end
  end

  def body_for(character, status)
    if status == "approved"
      "Seu personagem \"#{character.name}\" (versão #{character.version}) foi aprovado e já aparece no jogo."
    else
      reason = character.reject_reason.presence || "sem motivo informado"
      "Seu personagem \"#{character.name}\" (versão #{character.version}) foi rejeitado: #{reason}.\n" \
        "Corrija e envie uma nova versão com o mesmo id."
    end
  end
end
