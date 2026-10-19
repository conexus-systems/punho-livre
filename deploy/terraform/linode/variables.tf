# Passadas pelo deploy-production.yml (terraform_vars / terraform_secret_vars).
# Toda var que o workflow passa precisa estar declarada aqui: terraform rejeita
# -var não declarado.

variable "kubeconfig_path" {
  description = "Kubeconfig gravado pelo job deploy-lke.yml (também exportado como TF_VAR_kubeconfig_path)."
  type        = string
  default     = "/tmp/kubeconfig"
}

variable "kubernetes_namespace" {
  type    = string
  default = "mugen-arena"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "image_tag" {
  description = "Tag da imagem ghcr.io/conexus-systems/mugen-arena (o deploy passa o SHA)."
  type        = string
  default     = "latest"
}

variable "auth_provider" {
  type    = string
  default = "conexus"
}

variable "billing_provider" {
  type    = string
  default = "conexus"
}

variable "messaging_provider" {
  type    = string
  default = "conexus"
}

# --- Postgres gerenciado compartilhado (secrets TF_VAR_DATABASE_*) ---

variable "database_host" {
  type    = string
  default = ""
}

variable "database_port" {
  type    = string
  default = "5432"
}

variable "database_username" {
  type    = string
  default = ""
}

variable "database_password" {
  type      = string
  sensitive = true
  default   = ""
}

variable "database_name" {
  type    = string
  default = ""
}

# --- BFFs CONEXUS ---

variable "conexus_api_webhook_secret" {
  description = "HMAC dos dispatches ao bff-api (secret CONEXUS_API_WEBHOOK_SECRET). Obrigatório com messaging_provider=conexus."
  type        = string
  sensitive   = true
  default     = ""
}

variable "conexus_webhook_secret" {
  description = "HMAC dos webhooks recebidos do bff-auth / bff-payment em /conexus/webhooks (secret CONEXUS_WEBHOOK_SECRET)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "conexus_auth_client_id" {
  description = "client_id OAuth público do app mobile no bff-auth."
  type        = string
  default     = "mugen-arena"
}

variable "conexus_auth_issuer" {
  description = "iss esperado no JWT. Vazio = CONEXUS_AUTH_URL."
  type        = string
  default     = ""
}

variable "conexus_auth_allowed_audiences" {
  description = "client_id(s) aceitos no aud do JWT, separados por vírgula."
  type        = string
  default     = "mugen-arena"
}

# --- App ---

variable "secret_key_base" {
  description = "SECRET_KEY_BASE do Rails (secret SECRET_KEY_BASE; a imagem não leva master.key)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "admin_groups" {
  description = "Valores do claim groups com acesso a /api/v1/admin."
  type        = string
  default     = "mugen-arena-admin,admin"
}

variable "admin_notify_emails" {
  description = "Moderadores avisados de novas submissões, separados por vírgula (secret ADMIN_NOTIFY_EMAILS)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "play_integrity_required" {
  description = "Jogo pago: o online exige cópia comprada na Google Play (Play Integrity)."
  type        = bool
  default     = false
}

variable "play_integrity_package" {
  description = "Pacote Android verificado no Play Integrity."
  type        = string
  default     = "br.com.conexus.mugenarena"
}

variable "play_integrity_service_account" {
  description = "JSON da conta de serviço do Google Cloud com acesso à Play Integrity API (secret PLAY_INTEGRITY_SERVICE_ACCOUNT)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "rated_room_matches" {
  description = "Partidas de sala privada contam para o rating?"
  type        = bool
  default     = false
}

variable "pack_max_bytes" {
  description = "Tamanho máximo de um pack de personagem enviado."
  type        = number
  default     = 5242880
}

variable "cors_origins" {
  type    = string
  default = "*"
}

variable "solid_cable_polling_interval" {
  description = "Polling do Solid Cable em segundos (relay de inputs de luta; rollback tolera alguns ms)."
  type        = string
  default     = "0.05"
}
