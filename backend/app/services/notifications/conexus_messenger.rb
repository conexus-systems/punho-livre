# frozen_string_literal: true

module Notifications
  # Envio de mensagens pelo bff-api (POST /webhooks/messages, HMAC) usando a
  # gem conexus-platform. Nunca Resend/Twilio/mailer direto no app.
  module ConexusMessenger
    module_function

    # Precisa de MESSAGING_PROVIDER=conexus e CONEXUS_API_WEBHOOK_SECRET.
    def enabled?
      ConexusPlatform.messaging_conexus? && client.configured?
    end

    def client
      cfg = Rails.application.config.x.conexus
      Conexus::Messaging::Client.new(
        base_url: cfg.api_url,
        webhook_secret: cfg.api_webhook_secret,
        source_app: cfg.product_slug
      )
    end

    # Envia um e-mail; erros retentáveis (rede, 429, 5xx) sobem para o job
    # reprocessar, rejeições permanentes (4xx) são logadas e descartadas.
    def email!(to:, event:, idempotency_key:, subject:, body:, cc: nil, metadata: nil)
      unless enabled?
        Rails.logger.warn(
          "[Conexus] messaging not configured (MESSAGING_PROVIDER/CONEXUS_API_WEBHOOK_SECRET); " \
          "skipping #{event} idempotency_key=#{idempotency_key}"
        )
        return :skipped
      end

      client.dispatch(
        channel: "email", recipient: to, event: event, idempotency_key: idempotency_key,
        subject: subject, body: body, cc: cc.presence, metadata: metadata
      )
      :sent
    rescue Conexus::Messaging::DispatchError => e
      raise if e.retryable?

      Rails.logger.error("[Conexus] dispatch rejected event=#{event} status=#{e.status} body=#{e.body.inspect}")
      :rejected
    end
  end
end
