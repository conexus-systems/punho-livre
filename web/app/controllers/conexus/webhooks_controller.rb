# frozen_string_literal: true

# Webhooks de entrada CONEXUS (bff-auth + bff-payment).
# Rota: POST /conexus/webhooks → Conexus::WebhooksController#create
#
# Verificação com a gem conexus-platform:
#   Conexus::Webhooks.verify!(raw_body, signature_header, secret)
#
# Envelope: { "id", "type", "created_at", "data" }
# Header:   X-Conexus-Signature: sha256=<hmac_hex>
#
# (ActionController::API não tem proteção CSRF, então não há
# skip_forgery_protection aqui, ao contrário do template.)
module Conexus
  class WebhooksController < ApplicationController
    include ConexusWebhookHandler

    def create
      raw = request.raw_post
      signature = request.headers["X-Conexus-Signature"].to_s
      secret = Rails.application.config.x.conexus.webhook_secret

      if secret.blank?
        Rails.logger.error("[Conexus] CONEXUS_WEBHOOK_SECRET missing; rejecting webhook")
        return head :unauthorized
      end

      Conexus::Webhooks.verify!(raw, signature, secret)

      payload = JSON.parse(raw)
      return head :bad_request unless payload.is_a?(Hash)

      event_id = payload["id"].to_s
      event_type = payload["type"].to_s

      return head :ok if event_id.blank?
      return head :ok if conexus_webhook_already_processed?(event_id)

      ConexusWebhookEvent.transaction do
        mark_conexus_webhook_processed!(event_id, event_type)
        dispatch_conexus_webhook!(event_type, payload.fetch("data", {}))
      end

      head :ok
    rescue Conexus::Webhooks::InvalidSignature
      head :unauthorized
    rescue JSON::ParserError
      head :bad_request
    rescue ActiveRecord::RecordNotUnique
      # Mesmo evento processado em paralelo por outra réplica.
      head :ok
    end
  end
end
