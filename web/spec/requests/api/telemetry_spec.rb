# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Telemetry batch" do
  let(:session_id) { "3f2b8c1e-5d4a-4f6b-9c7e-1a2b3c4d5e6f" }
  let(:now) { Time.zone.parse("2026-10-18T12:00:00Z") }
  let(:app_info) { { "version" => "0.4.0", "platform" => "android", "os_version" => "14", "build" => "release", "screen_aspect" => 2.22 } }

  def event(name, props = {}, at: now - 1.minute)
    { "name" => name, "at" => at.iso8601, "props" => props }
  end

  def batch(events, **overrides)
    { "schema" => 1, "session_id" => session_id, "app" => app_info, "events" => events }.merge(overrides.stringify_keys)
  end

  def post_batch(body, headers: {})
    raw = body.is_a?(String) ? body : body.to_json
    post "/api/telemetry/batch", params: raw, headers: { "Content-Type" => "application/json" }.merge(headers)
  end

  around { |ex| travel_to(now) { ex.run } }

  it "accepts a valid batch without authentication and stores the events" do
    post_batch(batch([
      event("session_start"),
      event("fight_end", { "mode" => "arcade", "p1" => "kaze", "p2" => "brasa", "result" => "win", "duration_s" => 74 }),
      event("perf", { "mode" => "arcade", "frames" => 4400, "fps_avg" => 59.6, "fps_p5" => 55.2, "frame_ms_p95" => 18.1,
                      "sim_ms_p95" => 0.4, "draw_ms_p95" => 3.2, "rollbacks" => 0, "long_frames" => 3 })
    ]))

    expect(response).to have_http_status(:accepted)
    expect(response.parsed_body).to eq("accepted" => 3, "rejected" => 0)
    stored = TelemetryEvent.order(:id).last
    expect(stored).to have_attributes(name: "perf", session_id: session_id, platform: "android", app_version: "0.4.0")
    expect(stored.props).to include("fps_avg" => 59.6, "frames" => 4400)
  end

  it "drops events outside the schema and keeps the valid ones" do
    post_batch(batch([
      event("session_end", { "duration_s" => 300 }),
      event("session_end", { "duration_s" => 300, "email" => "x" }),            # chave desconhecida
      event("fight_end", { "result" => "hacked" }),                               # valor fora da lista
      event("crash", { "message" => "erro de ana@exemplo.com", "fatal" => true }), # PII
      event("crash", { "message" => "a" * 301 }),                                 # longo demais
      event("fight_start", { "difficulty" => "2" }),                              # tipo errado
      event("does_not_exist"),
      event("session_start", {}, at: now - 1.year),                               # data absurda
      "not an object"
    ]))

    expect(response).to have_http_status(:accepted)
    expect(response.parsed_body).to eq("accepted" => 1, "rejected" => 8)
    expect(TelemetryEvent.count).to eq(1)
  end

  it "never stores who sent it (no player, IP or auth header)" do
    post_batch(batch([ event("session_start") ]), headers: { "Authorization" => "Bearer abc", "X-Forwarded-For" => "203.0.113.9" })

    expect(response).to have_http_status(:accepted)
    columns = TelemetryEvent.column_names
    expect(columns).not_to include("player_id", "ip", "remote_ip", "user_agent")
    expect(TelemetryEvent.last.attributes.values.map(&:to_s).join).not_to include("203.0.113.9")
  end

  it "rejects an invalid envelope with 422 and details" do
    post_batch(batch([ event("session_start") ], session_id: "user-123", schema: 2))

    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body["error"]).to eq("validation_failed")
    expect(response.parsed_body["details"]).to include("schema must be 1", "session_id must be a random UUID")
    expect(TelemetryEvent.count).to eq(0)
  end

  it "rejects empty, oversized lists and non-JSON bodies" do
    post_batch(batch([]))
    expect(response).to have_http_status(:unprocessable_content)

    post_batch(batch(Array.new(101) { event("session_start") }))
    expect(response).to have_http_status(:unprocessable_content)

    post_batch("{not json")
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "rejects bodies over 64 KB with 413" do
    big = batch(Array.new(100) { event("crash", { "stack" => "s" * 1000 }) })

    post_batch(big)

    expect(response).to have_http_status(413)
    expect(response.parsed_body["error"]).to eq("payload_too_large")
  end

  it "purges events older than 90 days" do
    TelemetryEvent.create!(name: "session_start", session_id: session_id, platform: "ios", app_version: "0.4.0",
                           occurred_at: 100.days.ago, created_at: 100.days.ago)
    TelemetryEvent.create!(name: "session_start", session_id: session_id, platform: "ios", app_version: "0.4.0",
                           occurred_at: 1.day.ago, created_at: 1.day.ago)

    TelemetryPurgeJob.perform_now

    expect(TelemetryEvent.count).to eq(1)
  end
end
