# frozen_string_literal: true

# `CharacterSummary` do contrato (docs/PROTOCOL.md). `pack_url` é absoluto,
# montado a partir da base da requisição (https em produção via assume_ssl).
module CharacterSerializer
  module_function

  def call(character, base_url:)
    {
      slug: character.slug,
      name: character.name,
      author: character.author,
      version: character.version,
      sha256: character.sha256,
      size_bytes: character.size_bytes,
      premium: character.premium,
      status: character.status,
      pack_url: "#{base_url.to_s.chomp('/')}/api/v1/characters/#{character.slug}/pack",
      updated_at: character.updated_at.utc.iso8601
    }
  end

  # Visão de moderação: inclui quem enviou e o motivo de rejeição.
  def admin(character, base_url:)
    call(character, base_url: base_url).merge(
      id: character.id,
      reject_reason: character.reject_reason,
      submitted_by: character.submitted_by && {
        id: character.submitted_by.id,
        display_name: character.submitted_by.display_name,
        email: character.submitted_by.email
      },
      created_at: character.created_at.utc.iso8601
    )
  end
end
