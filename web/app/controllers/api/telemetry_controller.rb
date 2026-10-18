# frozen_string_literal: true

module Api
  # POST /api/telemetry/batch — eventos anônimos do app, enviados só com
  # consentimento do jogador (docs/PROTOCOL.md § Telemetria). Sem autenticação
  # de propósito: o lote não é ligado a conta nenhuma.
  class TelemetryController < ApplicationController
    MAX_BODY_BYTES = 64.kilobytes

    # O IP só serve de chave do limite (cache, 1 min); não é gravado com os eventos.
    rate_limit to: 30, within: 1.minute,
               with: -> { render_error :too_many_requests, "rate_limited", "too many telemetry batches" }

    def batch
      if request.content_length.to_i > MAX_BODY_BYTES || request.raw_post.bytesize > MAX_BODY_BYTES
        return render_error 413, "payload_too_large", "telemetry batch exceeds #{MAX_BODY_BYTES / 1024} KB"
      end

      result = Telemetry::Ingest.call(parse_body!)
      render json: result, status: :accepted
    rescue Telemetry::Ingest::Invalid => e
      render_error :unprocessable_content, "validation_failed", e.message, details: e.details
    end

    private

    def parse_body!
      JSON.parse(request.raw_post.presence || "null")
    rescue JSON::ParserError
      raise ArgumentError, "body must be valid JSON"
    end
  end
end
