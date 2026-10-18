# frozen_string_literal: true

# Telemetria anônima do app (POST /api/telemetry/batch). Sem player_id, IP ou
# identificador de aparelho; session_id é aleatório por abertura do app.
class CreateTelemetryEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :telemetry_events do |t|
      t.string :name, null: false
      t.string :session_id, null: false
      t.string :platform, null: false
      t.string :app_version, null: false
      t.string :os_version
      t.string :build
      t.decimal :screen_aspect, precision: 5, scale: 2
      t.jsonb :props, null: false, default: {}
      t.datetime :occurred_at, null: false
      t.datetime :created_at, null: false
    end

    add_index :telemetry_events, %i[name occurred_at]
    add_index :telemetry_events, :session_id
    add_index :telemetry_events, :created_at
  end
end
