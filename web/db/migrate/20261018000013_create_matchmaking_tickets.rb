# frozen_string_literal: true

# Fila de matchmaking no Postgres (sem Redis). O pareamento trava linhas com
# SELECT ... FOR UPDATE SKIP LOCKED, então é seguro entre processos/pods.
class CreateMatchmakingTickets < ActiveRecord::Migration[8.1]
  def change
    create_table :matchmaking_tickets do |t|
      t.references :player, null: false, foreign_key: true, index: { unique: true }
      t.string :mode, null: false
      t.string :room_code
      t.string :character, null: false
      t.string :pack_sha256
      t.integer :rating, null: false
      # Nome do stream Action Cable de quem está esperando (avisado no "matched").
      t.string :token, null: false
      # Atualizado periodicamente pelo canal; tickets sem heartbeat são lixo.
      t.datetime :heartbeat_at, null: false
      t.datetime :created_at, null: false
    end

    add_index :matchmaking_tickets, :room_code, unique: true, where: "room_code IS NOT NULL"
    add_index :matchmaking_tickets, :token, unique: true
    add_index :matchmaking_tickets, %i[mode created_at]
  end
end
