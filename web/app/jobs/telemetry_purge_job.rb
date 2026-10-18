# frozen_string_literal: true

# Apaga eventos de telemetria com mais de 90 dias (config/recurring.yml).
class TelemetryPurgeJob < ApplicationJob
  queue_as :default

  def perform
    TelemetryEvent.expired.in_batches(of: 5_000).delete_all
  end
end
