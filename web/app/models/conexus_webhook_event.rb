# frozen_string_literal: true

# Registro de idempotência dos webhooks CONEXUS (chave: `id` do envelope).
class ConexusWebhookEvent < ApplicationRecord
  validates :event_id, presence: true, uniqueness: true
  validates :event_type, presence: true
end
