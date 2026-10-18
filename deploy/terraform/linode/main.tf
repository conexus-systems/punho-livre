# MUGEN Arena — produção no LKE via módulo compartilhado do platform-infra.
# Um pod web (Puma single mode + Action Cable + Solid Queue no Puma), Service e
# Ingress em mugen-arena.conexus-systems.com.br. Sem Redis/Sidekiq (ADR 0001).

locals {
  app_slug = "mugen-arena"
}

module "app" {
  source = "git::https://github.com/conexus-systems/platform-infra.git//modules/rails-lke?ref=v1"

  app_slug             = local.app_slug
  kubernetes_namespace = var.kubernetes_namespace
  image_name           = local.app_slug
  image_tag            = var.image_tag
  environment          = var.environment
  app_host             = "mugen-arena.conexus-systems.com.br"
  conexus_product_slug = "mugen-arena"

  # O deploy-lke.yml já cria/atualiza o pull secret ghcr-secret via kubectl;
  # sem ghcr_pull_token o módulo não o gerencia (evita conflito).
  readiness_path = "/up"

  # Solid Queue dentro do Puma (jobs leves: e-mails, limpeza de matchmaking).
  solid_queue_in_puma        = true
  solid_queue_worker_enabled = false

  auth_provider      = var.auth_provider
  billing_provider   = var.billing_provider
  messaging_provider = var.messaging_provider

  database_host     = var.database_host
  database_port     = var.database_port
  database_username = var.database_username
  database_password = var.database_password
  database_name     = var.database_name

  conexus_api_webhook_secret = var.conexus_api_webhook_secret

  # Variáveis que o app lê além do que o módulo já grava (ver web/.env.example).
  extra_app_secrets = {
    SECRET_KEY_BASE                = var.secret_key_base
    CONEXUS_AUTH_CLIENT_ID         = var.conexus_auth_client_id
    CONEXUS_AUTH_ISSUER            = var.conexus_auth_issuer
    CONEXUS_AUTH_ALLOWED_AUDIENCES = var.conexus_auth_allowed_audiences
    CONEXUS_WEBHOOK_SECRET         = var.conexus_webhook_secret
    ADMIN_GROUPS                   = var.admin_groups
    ADMIN_NOTIFY_EMAILS            = var.admin_notify_emails
    RATED_ROOM_MATCHES             = tostring(var.rated_room_matches)
    PACK_MAX_BYTES                 = tostring(var.pack_max_bytes)
    CORS_ORIGINS                   = var.cors_origins
    # Inputs de luta são relayados pelo Solid Cable: polling curto (s).
    SOLID_CABLE_POLLING_INTERVAL = var.solid_cable_polling_interval
  }
}
