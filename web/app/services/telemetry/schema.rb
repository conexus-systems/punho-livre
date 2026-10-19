# frozen_string_literal: true

module Telemetry
  # Esquema dos eventos de telemetria — espelho de
  # mobile/src/services/telemetrySchema.ts (docs/PROTOCOL.md § Telemetria).
  # Mudou lá, muda aqui no mesmo PR.
  module Schema
    VERSION = 1

    FIGHT_MODES = %w[arcade versus training team online bench].freeze

    def self.str(max, values = nil) = { type: :string, max: max, values: values }.freeze
    NUM = { type: :number }.freeze
    INT = { type: :integer }.freeze
    BOOL = { type: :boolean }.freeze

    PERF = {
      "mode" => str(16, FIGHT_MODES), "frames" => INT, "fps_avg" => NUM, "fps_p5" => NUM,
      "frame_ms_p95" => NUM, "frame_ms_max" => NUM, "sim_ms_p95" => NUM, "draw_ms_p95" => NUM,
      "rollbacks" => INT, "long_frames" => INT
    }.freeze

    EVENTS = {
      # produto
      "session_start" => {},
      "session_end" => { "duration_s" => INT },
      "tutorial" => { "step" => str(32), "completed" => BOOL },
      "fight_start" => {
        "mode" => str(16, FIGHT_MODES), "p1" => str(32), "p2" => str(32), "stage" => str(32), "difficulty" => INT
      },
      "fight_end" => {
        "mode" => str(16, FIGHT_MODES), "p1" => str(32), "p2" => str(32),
        "result" => str(16, %w[win loss draw abandoned quit]), "duration_s" => INT
      },
      "online_queue" => {
        "mode" => str(8, %w[ranked room]), "outcome" => str(16, %w[matched canceled error]),
        "wait_s" => INT, "error" => str(64)
      },
      # técnicos
      "perf" => PERF,
      "crash" => {
        "message" => str(300), "stack" => str(2000), "fatal" => BOOL,
        "source" => str(16, %w[global boundary promise]), "screen" => str(64), "previous_session" => BOOL
      }
    }.freeze

    APP = {
      "version" => str(32), "platform" => str(16, %w[android ios web]), "os_version" => str(32),
      "build" => str(16, %w[dev release]), "screen_aspect" => NUM
    }.freeze
  end
end
