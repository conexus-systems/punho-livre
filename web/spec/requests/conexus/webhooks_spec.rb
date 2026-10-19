# frozen_string_literal: true

require "rails_helper"

RSpec.describe "POST /conexus/webhooks" do
  let(:secret) { "whsec_test" }
  let(:user_id) { SecureRandom.uuid }

  around do |example|
    with_config(:conexus, webhook_secret: secret, product_slug: "mugen-arena") { example.run }
  end

  def deliver(type:, data:, id: "evt_#{SecureRandom.uuid}", signature: nil)
    body = { id: id, type: type, created_at: Time.current.iso8601, data: data }.to_json
    signature ||= "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', secret, body)}"
    post "/conexus/webhooks", params: body,
                              headers: { "CONTENT_TYPE" => "application/json", "X-Conexus-Signature" => signature }
  end

  it "rejects an invalid signature" do
    deliver(type: "user.created", data: { conexus_user_id: user_id }, signature: "sha256=#{'0' * 64}")

    expect(response).to have_http_status(:unauthorized)
    expect(Player.count).to eq(0)
  end

  it "rejects everything when the secret is not configured" do
    with_config(:conexus, webhook_secret: "") do
      deliver(type: "user.created", data: { conexus_user_id: user_id })
    end

    expect(response).to have_http_status(:unauthorized)
  end

  it "upserts the player on user.created / user.updated" do
    deliver(type: "user.created",
            data: { conexus_user_id: user_id, email: "ada@example.com", name: "Ada Lovelace",
                    avatar_url: "https://img.example/a.png" })

    expect(response).to have_http_status(:ok)
    expect(Player.find_by!(conexus_user_id: user_id)).to have_attributes(
      display_name: "Ada Lovelace", email: "ada@example.com", avatar_url: "https://img.example/a.png"
    )

    deliver(type: "user.updated", data: { conexus_user_id: user_id, email: "ada@new.example", name: "Ada L." })
    expect(Player.find_by!(conexus_user_id: user_id)).to have_attributes(display_name: "Ada L.", email: "ada@new.example")
  end

  it "keeps a display name the player customized" do
    create(:player, conexus_user_id: user_id, display_name: "Kyo", display_name_customized: true)

    deliver(type: "user.updated", data: { conexus_user_id: user_id, name: "Kyo Kusanagi", email: "k@example.com" })

    expect(Player.find_by!(conexus_user_id: user_id)).to have_attributes(display_name: "Kyo", email: "k@example.com")
  end

  it "is idempotent by event id" do
    id = "evt_#{SecureRandom.uuid}"
    deliver(id: id, type: "user.created", data: { conexus_user_id: user_id, name: "Primeiro" })
    deliver(id: id, type: "user.updated", data: { conexus_user_id: user_id, name: "Segundo" })

    expect(response).to have_http_status(:ok)
    expect(ConexusWebhookEvent.where(event_id: id).count).to eq(1)
    expect(Player.find_by!(conexus_user_id: user_id).display_name).to eq("Primeiro")
  end

  it "flips premium from entitlement and subscription events of this product" do
    player = create(:player, conexus_user_id: user_id)

    deliver(type: "entitlement.changed", data: { conexus_user_id: user_id, product_slug: "mugen-arena", status: "active" })
    expect(player.reload.premium).to be(true)

    deliver(type: "subscription.canceled", data: { conexus_user_id: user_id, product_slug: "mugen-arena", status: "canceled" })
    expect(player.reload.premium).to be(false)

    deliver(type: "subscription.activated", data: { conexus_user_id: user_id, product_slug: "mugen-arena", status: "active" })
    expect(player.reload.premium).to be(true)
  end

  it "ignores billing events of other products" do
    player = create(:player, conexus_user_id: user_id)

    deliver(type: "entitlement.changed", data: { conexus_user_id: user_id, product_slug: "outro-app", status: "active" })

    expect(response).to have_http_status(:ok)
    expect(player.reload.premium).to be(false)
  end

  it "creates the player when the entitlement arrives before the first login" do
    deliver(type: "entitlement.changed", data: { conexus_user_id: user_id, product_slug: "mugen-arena", status: "active" })

    expect(Player.find_by!(conexus_user_id: user_id).premium).to be(true)
  end

  it "returns 400 for a malformed body with a valid signature" do
    body = "not json"
    post "/conexus/webhooks", params: body, headers: {
      "CONTENT_TYPE" => "application/json",
      "X-Conexus-Signature" => "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', secret, body)}"
    }

    expect(response).to have_http_status(:bad_request)
  end
end
