# frozen_string_literal: true

# Personagens enviados pela comunidade. Cada submissão é uma linha (versão);
# o servido em /characters é a última linha `approved` de cada slug.
class CreateCharacters < ActiveRecord::Migration[8.1]
  def change
    create_table :characters do |t|
      t.string :slug, null: false
      t.string :name, null: false
      t.string :author, null: false
      t.string :version, null: false
      t.string :status, null: false, default: "pending"
      t.boolean :premium, null: false, default: false
      t.string :sha256, null: false, limit: 64
      t.integer :size_bytes, null: false
      # Bytes exatos servidos em GET /characters/:slug/pack (base do sha256).
      t.text :pack_body, null: false
      t.references :submitted_by, foreign_key: { to_table: :players }, null: true
      t.text :reject_reason
      t.datetime :reviewed_at
      t.timestamps
    end

    add_index :characters, %i[slug status id]
    add_index :characters, %i[status created_at]
  end
end
