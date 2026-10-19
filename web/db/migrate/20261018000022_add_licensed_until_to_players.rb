# frozen_string_literal: true

# Jogo pago: a cópia do jogador foi comprovada como comprada na Google Play
# (Play Integrity, appLicensingVerdict = LICENSED) até esta data.
class AddLicensedUntilToPlayers < ActiveRecord::Migration[8.1]
  def change
    add_column :players, :licensed_until, :datetime
  end
end
