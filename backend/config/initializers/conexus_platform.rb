# frozen_string_literal: true

# CONEXUS Auth + Payments + API — defaults do consumidor (copiado do template
# conexus-bff-stack). Código novo nasce com as flags em `conexus`.
#
# Feature flags (ENV):
#   AUTH_PROVIDER=conexus|legacy
#   BILLING_PROVIDER=conexus|legacy
#   MESSAGING_PROVIDER=conexus|legacy

Rails.application.config.x.conexus = ActiveSupport::OrderedOptions.new
Rails.application.config.x.conexus.auth_provider =
  ENV.fetch("AUTH_PROVIDER", "conexus")
Rails.application.config.x.conexus.billing_provider =
  ENV.fetch("BILLING_PROVIDER", "conexus")
Rails.application.config.x.conexus.messaging_provider =
  ENV.fetch("MESSAGING_PROVIDER", "conexus")
Rails.application.config.x.conexus.auth_url =
  ENV.fetch("CONEXUS_AUTH_URL", "https://auth.conexus-systems.com.br")
Rails.application.config.x.conexus.payments_url =
  ENV.fetch("CONEXUS_PAYMENTS_URL", "https://payments.conexus-systems.com.br")
Rails.application.config.x.conexus.api_url =
  ENV.fetch("CONEXUS_API_URL", "https://api.conexus-systems.com.br")
Rails.application.config.x.conexus.auth_client_id =
  ENV.fetch("CONEXUS_AUTH_CLIENT_ID", "")
Rails.application.config.x.conexus.auth_client_secret =
  ENV.fetch("CONEXUS_AUTH_CLIENT_SECRET", "")
Rails.application.config.x.conexus.webhook_secret =
  ENV.fetch("CONEXUS_WEBHOOK_SECRET", "")
# Segredo compartilhado usado para assinar os dispatches ao API BFF.
Rails.application.config.x.conexus.api_webhook_secret =
  ENV.fetch("CONEXUS_API_WEBHOOK_SECRET", "")
Rails.application.config.x.conexus.product_slug =
  ENV.fetch("CONEXUS_PRODUCT_SLUG", "mugen-arena")

module ConexusPlatform
  module_function

  def auth_conexus?
    Rails.application.config.x.conexus.auth_provider.to_s == "conexus"
  end

  def billing_conexus?
    Rails.application.config.x.conexus.billing_provider.to_s == "conexus"
  end

  def messaging_conexus?
    Rails.application.config.x.conexus.messaging_provider.to_s == "conexus"
  end
end
