# frozen_string_literal: true

# Fase 3 do online (docs/ONLINE.md):
# - ranqueada com Glicko-2 por temporada (seasons + season_ratings) e ligas;
# - reconexão (marca de desconexão por lado, com tolerância);
# - anti-trapaça básica: checksums dos dois lados, registro das entradas
#   (replay = seed + entradas + versão) e fila de revisão.
class CreateRankedSeasonsAndReplays < ActiveRecord::Migration[8.1]
  def up
    create_table :seasons do |t|
      t.integer :number, null: false
      t.string :name, null: false
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.timestamps
    end
    add_index :seasons, :number, unique: true
    add_index :seasons, %i[starts_at ends_at]

    create_table :season_ratings do |t|
      t.references :season, null: false, foreign_key: true, index: false
      t.references :player, null: false, foreign_key: true
      # Glicko-2 na escala "Glicko" (1500 / 350 / 0,06).
      t.float :rating, null: false, default: 1500.0
      t.float :deviation, null: false, default: 350.0
      t.float :volatility, null: false, default: 0.06
      t.float :peak_rating, null: false, default: 1500.0
      t.integer :wins, null: false, default: 0
      t.integer :losses, null: false, default: 0
      t.integer :draws, null: false, default: 0
      t.datetime :last_match_at
      t.timestamps
    end
    add_index :season_ratings, %i[season_id player_id], unique: true
    add_index :season_ratings, %i[season_id rating]

    # Rating exibido (= o da temporada atual); Glicko-2 começa em 1500.
    change_column_default :players, :rating, from: 1000, to: 1500
    execute "UPDATE players SET rating = 1500 WHERE wins = 0 AND losses = 0"

    change_table :matches, bulk: true do |t|
      t.references :season, foreign_key: true
      t.string :engine_version
      t.datetime :p1_disconnected_at
      t.datetime :p2_disconnected_at
      # Assinatura mais recente de cada lado: a queda de uma conexão antiga
      # (detectada depois da reconexão) não marca o lado como desconectado.
      t.string :p1_connection
      t.string :p2_connection
      t.string :void_reason
    end

    add_column :matchmaking_tickets, :engine_version, :string, null: false, default: ""

    # Registro das entradas de cada lado, em blocos contíguos (input_log).
    create_table :match_input_chunks do |t|
      t.references :match, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer :side, null: false
      t.integer :from_frame, null: false
      t.integer :to_frame, null: false
      t.jsonb :bits, null: false, default: []
      t.datetime :created_at, null: false
    end
    add_index :match_input_chunks, %i[match_id side from_frame], unique: true

    # Checksums relatados (hash do estado + hash das entradas) por lado e quadro.
    create_table :match_checksums do |t|
      t.references :match, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer :side, null: false
      t.integer :frame, null: false
      t.bigint :value, null: false
      t.bigint :inputs_hash
      t.datetime :created_at, null: false
    end
    add_index :match_checksums, %i[match_id frame side], unique: true

    # Partidas anuladas/disputadas aguardando revisão humana.
    create_table :match_reviews do |t|
      t.references :match, null: false, foreign_key: true
      t.string :reason, null: false
      t.jsonb :details, null: false, default: {}
      t.string :status, null: false, default: "open"
      t.text :note
      t.references :resolved_by, foreign_key: { to_table: :players }
      t.datetime :resolved_at
      t.timestamps
    end
    add_index :match_reviews, %i[status created_at]
  end

  def down
    drop_table :match_reviews
    drop_table :match_checksums
    drop_table :match_input_chunks
    remove_column :matchmaking_tickets, :engine_version
    change_table :matches, bulk: true do |t|
      t.remove_references :season, foreign_key: true
      t.remove :engine_version, :p1_disconnected_at, :p2_disconnected_at, :p1_connection, :p2_connection,
               :void_reason
    end
    change_column_default :players, :rating, from: 1500, to: 1000
    drop_table :season_ratings
    drop_table :seasons
  end
end
