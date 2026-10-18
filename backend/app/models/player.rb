# frozen_string_literal: true

# Jogador. A identidade vem do bff-auth (`sub` do JWT = conexus_user_id);
# aqui ficam apelido, rating Elo, vitórias/derrotas e o flag premium
# (mantido pelos webhooks do bff-payment).
class Player < ApplicationRecord
  DEFAULT_RATING = 1000
  DISPLAY_NAME_RANGE = (2..24)

  has_many :submitted_characters, class_name: "Character", foreign_key: :submitted_by_id,
                                  inverse_of: :submitted_by, dependent: :nullify
  has_one :matchmaking_ticket, dependent: :delete

  # Unicidade garantida pelo índice único (create_or_find_by! depende disso).
  validates :conexus_user_id, presence: true
  validates :display_name, presence: true, length: { in: DISPLAY_NAME_RANGE }
  validates :rating, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :ranked, -> { where("wins + losses > 0").order(rating: :desc, wins: :desc, id: :asc) }

  # Upsert a partir dos claims de um access token verificado. Concorrência:
  # create_or_find_by se apoia no índice único de conexus_user_id.
  def self.from_claims!(claims)
    player = create_or_find_by!(conexus_user_id: claims.sub) do |p|
      p.display_name = default_display_name(claims.name, claims.sub)
      p.email = claims.email
    end
    player.update!(email: claims.email) if claims.email.present? && player.email != claims.email
    player
  end

  # Upsert a partir de um webhook user.created / user.updated do bff-auth.
  def self.upsert_from_conexus!(data)
    user_id = data["conexus_user_id"].to_s
    player = create_or_find_by!(conexus_user_id: user_id) do |p|
      p.display_name = default_display_name(data["name"], user_id)
    end

    attrs = {}
    attrs[:email] = data["email"] if data.key?("email")
    attrs[:avatar_url] = data["avatar_url"] if data.key?("avatar_url")
    if data["name"].present? && !player.display_name_customized?
      attrs[:display_name] = default_display_name(data["name"], user_id)
    end
    player.update!(attrs) if attrs.any?
    player
  end

  def self.default_display_name(name, conexus_user_id)
    candidate = name.to_s.strip.squish.first(DISPLAY_NAME_RANGE.max)
    candidate.length >= DISPLAY_NAME_RANGE.min ? candidate : "Jogador-#{conexus_user_id.to_s.first(4)}"
  end
end
