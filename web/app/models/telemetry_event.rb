# frozen_string_literal: true

# Evento anônimo de telemetria (Telemetry::Ingest). Sem ligação com Player:
# `session_id` é aleatório por abertura do app. Guardado por 90 dias
# (TelemetryPurgeJob).
class TelemetryEvent < ApplicationRecord
  scope :expired, -> { where(created_at: ...Telemetry::Ingest::RETENTION.ago) }
end
