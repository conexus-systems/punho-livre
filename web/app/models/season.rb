# frozen_string_literal: true

# Temporada da ranqueada. Sem cadastro manual obrigatório: `Season.current`
# cria a próxima automaticamente quando a atual acaba (duração em
# SEASON_LENGTH_DAYS, padrão 56 dias). O rating é por temporada
# (SeasonRating), com reinício parcial em direção a 1500 na virada.
class Season < ApplicationRecord
  has_many :season_ratings, dependent: :delete_all
  has_many :matches, dependent: :nullify

  validates :number, numericality: { only_integer: true, greater_than: 0 }
  validates :name, :starts_at, :ends_at, presence: true
  validate :ends_after_start

  scope :covering, ->(time) { where(starts_at: ..time).where("ends_at > ?", time) }

  def self.current(now: Time.current)
    covering(now).order(number: :desc).first || open_next!(now)
  end

  # Cria a temporada que cobre `now`: emenda na anterior se ela acabou há
  # menos de uma temporada; senão (servidor parado muito tempo) começa agora.
  def self.open_next!(now)
    last = order(number: :desc).first
    starts = last && last.ends_at <= now && last.ends_at > now - length ? last.ends_at : now
    number = (last&.number || 0) + 1
    create!(number: number, name: "Temporada #{number}", starts_at: starts, ends_at: starts + length)
  rescue ActiveRecord::RecordNotUnique
    covering(now).order(number: :desc).first!
  end

  def self.length
    Rails.application.config.x.mugen.season_length_days.days
  end

  def previous
    Season.where(number: ...number).order(number: :desc).first
  end

  def summary
    { number: number, name: name, starts_at: starts_at.utc.iso8601, ends_at: ends_at.utc.iso8601 }
  end

  private

  def ends_after_start
    errors.add(:ends_at, "must be after starts_at") if starts_at && ends_at && ends_at <= starts_at
  end
end
