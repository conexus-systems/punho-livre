# frozen_string_literal: true

# Partida online 1v1. Lado 0 = player1, lado 1 = player2.
class Match < ApplicationRecord
  STATUSES = %w[waiting active finished abandoned disputed].freeze
  MODES = %w[ranked room].freeze
  OPEN_STATUSES = %w[waiting active].freeze
  SIDES = [ 0, 1 ].freeze

  belongs_to :player1, class_name: "Player"
  belongs_to :player2, class_name: "Player"

  validates :status, inclusion: { in: STATUSES }
  validates :mode, inclusion: { in: MODES }
  validates :p1_character, :p2_character, :seed, presence: true

  scope :involving, ->(player) { where(player1: player).or(where(player2: player)) }
  scope :in_progress, -> { where(status: OPEN_STATUSES) }
  scope :closed, -> { where(status: %w[finished abandoned disputed]) }

  def open? = OPEN_STATUSES.include?(status)
  def active? = status == "active"
  def waiting? = status == "waiting"

  def side_of(player)
    return 0 if player1_id == player.id
    return 1 if player2_id == player.id

    nil
  end

  def player_on(side)
    side.to_i.zero? ? player1 : player2
  end

  def character_on(side)
    side.to_i.zero? ? p1_character : p2_character
  end

  def rating_delta_on(side)
    side.to_i.zero? ? p1_rating_delta : p2_rating_delta
  end

  # Partida conta para rating/W-L? Ranked sempre; sala só com RATED_ROOM_MATCHES.
  def rated?
    mode == "ranked" || Rails.application.config.x.mugen.rated_room_matches
  end

  def ready_on?(side)
    (side.to_i.zero? ? p1_ready_at : p2_ready_at).present?
  end

  def both_ready?
    p1_ready_at.present? && p2_ready_at.present?
  end
end
