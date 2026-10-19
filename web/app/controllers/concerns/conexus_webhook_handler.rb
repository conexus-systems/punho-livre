# frozen_string_literal: true

# Concern do Conexus::WebhooksController (copiado do template
# conexus-bff-stack, com os handlers preenchidos para o MUGEN Arena).
#
# - user.created / user.updated (bff-auth)  → upsert do Player (nome, e-mail, avatar)
# - user.deleted (bff-auth, LGPD)           → anonimiza o Player
# - entitlement.changed, subscription.activated, subscription.canceled
#   (bff-payment) com product_slug == CONEXUS_PRODUCT_SLUG
#                                           → Player#premium = (status == "active")
#
# Idempotência: tabela conexus_webhook_events (event_id único), gravada na
# mesma transação do handler — se o handler falhar, nada é marcado e o
# publisher reenvia.
module ConexusWebhookHandler
  extend ActiveSupport::Concern

  PREMIUM_EVENTS = %w[entitlement.changed subscription.activated subscription.canceled].freeze

  private

  def conexus_webhook_already_processed?(event_id)
    ConexusWebhookEvent.exists?(event_id: event_id)
  end

  def mark_conexus_webhook_processed!(event_id, event_type)
    ConexusWebhookEvent.create!(event_id: event_id, event_type: event_type, processed_at: Time.current)
  end

  def dispatch_conexus_webhook!(event_type, data)
    data = {} unless data.is_a?(Hash)

    case event_type
    when "user.created", "user.updated", "user.linked_provider"
      handle_conexus_user_event!(event_type, data)
    when "user.deleted"
      handle_conexus_user_deleted!(data)
    when "subscription.activated", "subscription.renewed",
         "subscription.past_due", "subscription.canceled",
         "entitlement.changed"
      handle_conexus_billing_event!(event_type, data)
    else
      Rails.logger.info("[Conexus] ignoring webhook type=#{event_type}")
    end
  end

  def handle_conexus_user_event!(event_type, data)
    return log_missing_user(event_type) unless valid_user_id?(data["conexus_user_id"])
    # user.linked_provider não traz perfil novo; só cria o jogador se faltar.
    return Player.upsert_from_conexus!(data.slice("conexus_user_id")) if event_type == "user.linked_provider"

    Player.upsert_from_conexus!(data)
  end

  def handle_conexus_user_deleted!(data)
    player = Player.find_by(conexus_user_id: data["conexus_user_id"].to_s)
    return unless player

    player.update!(
      display_name: "Jogador removido", display_name_customized: true,
      email: nil, avatar_url: nil, premium: false
    )
    MatchmakingTicket.where(player: player).delete_all
  end

  def handle_conexus_billing_event!(event_type, data)
    product_slug = Rails.application.config.x.conexus.product_slug
    unless data["product_slug"].to_s == product_slug
      Rails.logger.info("[Conexus] ignoring #{event_type} for product_slug=#{data['product_slug']}")
      return
    end

    # Só os eventos do contrato mudam premium; renewed/past_due chegam também
    # como entitlement.changed, que é a fonte do estado.
    unless PREMIUM_EVENTS.include?(event_type)
      Rails.logger.info("[Conexus] #{event_type} logged only (entitlement.changed drives premium)")
      return
    end
    return log_missing_user(event_type) unless valid_user_id?(data["conexus_user_id"])

    player = Player.upsert_from_conexus!(data.slice("conexus_user_id"))
    player.update!(premium: data["status"].to_s == "active")
  end

  def valid_user_id?(value)
    value.to_s.match?(Auth::VerifyAccessToken::UUID_FORMAT)
  end

  def log_missing_user(event_type)
    Rails.logger.warn("[Conexus] #{event_type} without a valid conexus_user_id; ignored")
  end
end
