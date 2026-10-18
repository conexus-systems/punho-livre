# frozen_string_literal: true

# Partida online 1v1. Os inputs não passam pelo banco (relay via Action Cable);
# aqui ficam só o pareamento, o "ready" de cada lado e o resultado.
class CreateMatches < ActiveRecord::Migration[8.1]
  def change
    create_table :matches do |t|
      t.string :status, null: false, default: "waiting"
      t.string :mode, null: false, default: "ranked"
      t.references :player1, null: false, foreign_key: { to_table: :players }
      t.references :player2, null: false, foreign_key: { to_table: :players }
      t.string :p1_character, null: false
      t.string :p2_character, null: false
      t.string :p1_pack_sha256
      t.string :p2_pack_sha256
      t.bigint :seed, null: false
      t.string :room_code
      t.integer :winner_side
      # { "0" => winner_side relatado pelo lado 0, "1" => ... } (valor pode ser null = empate)
      t.jsonb :reports, null: false, default: {}
      t.integer :p1_rating_delta, null: false, default: 0
      t.integer :p2_rating_delta, null: false, default: 0
      t.integer :abandoned_by_side
      t.datetime :p1_ready_at
      t.datetime :p2_ready_at
      t.datetime :started_at
      t.datetime :finished_at
      t.timestamps
    end

    add_index :matches, %i[status created_at]
    add_index :matches, %i[room_code created_at]
  end
end
