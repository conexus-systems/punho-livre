# frozen_string_literal: true

# Jogador = identidade do bff-auth (sub do JWT) + estado de jogo (rating, W/L).
class CreatePlayers < ActiveRecord::Migration[8.1]
  def change
    create_table :players do |t|
      t.uuid :conexus_user_id, null: false
      t.string :display_name, null: false
      # true depois de um PATCH /me: webhooks user.updated não sobrescrevem o apelido.
      t.boolean :display_name_customized, null: false, default: false
      t.string :email
      t.string :avatar_url
      t.integer :rating, null: false, default: 1000
      t.integer :wins, null: false, default: 0
      t.integer :losses, null: false, default: 0
      t.boolean :premium, null: false, default: false
      t.timestamps
    end

    add_index :players, :conexus_user_id, unique: true
    add_index :players, %i[rating wins]
  end
end
