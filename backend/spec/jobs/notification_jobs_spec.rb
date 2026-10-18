# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Character notification jobs" do
  let(:api_url) { "https://api.test.example" }
  let(:messages_url) { "#{api_url}/webhooks/messages" }
  let(:author) { create(:player, email: "autor@example.com") }
  let(:character) { create(:character, slug: "kaze", status: "pending", submitted_by: author) }

  around do |example|
    with_config(:conexus, messaging_provider: "conexus", api_url: api_url, api_webhook_secret: "api-secret",
                          product_slug: "mugen-arena") do
      with_config(:mugen, admin_notify_emails: %w[mod1@example.com mod2@example.com]) { example.run }
    end
  end

  before { stub_request(:post, messages_url).to_return(status: 202, body: { id: "msg_1" }.to_json) }

  it "emails the moderators through bff-api with a signed, idempotent dispatch" do
    CharacterSubmittedNotificationJob.perform_now(character.id)

    expect(a_request(:post, messages_url).with { |req|
      body = JSON.parse(req.body)
      ts = req.headers["X-Timestamp"]
      expected_sig = "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', 'api-secret', "#{ts}.#{req.body}")}"

      req.headers["X-Signature"] == expected_sig &&
        body["channel"] == "email" &&
        body["recipient"] == "mod1@example.com" &&
        body["cc"] == [ "mod2@example.com" ] &&
        body["event"] == "character.submitted" &&
        body["idempotency_key"] == "character-submitted-#{character.id}" &&
        body["source_app"] == "mugen-arena"
    }).to have_been_made.once
  end

  it "emails the author when reviewed" do
    CharacterReviewedNotificationJob.perform_now(character.id, "rejected")

    expect(a_request(:post, messages_url).with { |req|
      body = JSON.parse(req.body)
      body["recipient"] == "autor@example.com" && body["event"] == "character.rejected" &&
        body["idempotency_key"] == "character-reviewed-#{character.id}-rejected"
    }).to have_been_made.once
  end

  it "skips gracefully (logged) when messaging is not configured" do
    allow(Rails.logger).to receive(:warn)

    with_config(:conexus, api_webhook_secret: "") do
      expect { CharacterSubmittedNotificationJob.perform_now(character.id) }.not_to raise_error
    end

    expect(a_request(:post, messages_url)).not_to have_been_made
    expect(Rails.logger).to have_received(:warn).with(/messaging not configured/)
  end

  it "skips when MESSAGING_PROVIDER is not conexus" do
    with_config(:conexus, messaging_provider: "legacy") do
      CharacterReviewedNotificationJob.perform_now(character.id, "approved")
    end

    expect(a_request(:post, messages_url)).not_to have_been_made
  end

  it "retries on retryable bff-api failures" do
    stub_request(:post, messages_url).to_return(status: 503)

    expect {
      CharacterReviewedNotificationJob.perform_now(character.id, "approved")
    }.to have_enqueued_job(CharacterReviewedNotificationJob)
  end

  it "drops permanent rejections without retrying" do
    stub_request(:post, messages_url).to_return(status: 422, body: { error: "invalid" }.to_json)

    expect {
      CharacterReviewedNotificationJob.perform_now(character.id, "approved")
    }.not_to have_enqueued_job
  end
end
