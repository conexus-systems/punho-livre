# frozen_string_literal: true

# Idempotência dos webhooks CONEXUS: um evento (id `evt_...`) é processado uma vez.
class CreateConexusWebhookEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :conexus_webhook_events do |t|
      t.string :event_id, null: false
      t.string :event_type, null: false
      t.datetime :processed_at, null: false
      t.timestamps
    end

    add_index :conexus_webhook_events, :event_id, unique: true
  end
end
