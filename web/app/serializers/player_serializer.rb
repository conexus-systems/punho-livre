# frozen_string_literal: true

# `player` do contrato (docs/PROTOCOL.md). `admin` vem do claim `groups` do
# token atual, não do banco.
module PlayerSerializer
  module_function

  def call(player, admin: false)
    {
      id: player.id,
      conexus_user_id: player.conexus_user_id,
      display_name: player.display_name,
      email: player.email,
      avatar_url: player.avatar_url,
      rating: player.rating,
      wins: player.wins,
      losses: player.losses,
      premium: player.premium,
      licensed_until: player.licensed_until&.iso8601,
      license_required: Integrity::License.required?,
      admin: admin
    }
  end
end
