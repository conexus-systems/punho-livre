# frozen_string_literal: true

# Personagem da comunidade (pack `mugen-arena-pack/1`). Cada submissão é uma
# versão (linha). Ver docs/PROTOCOL.md.
class Character < ApplicationRecord
  STATUSES = %w[pending approved rejected].freeze
  SLUG_FORMAT = /\A[a-z0-9][a-z0-9_-]{1,31}\z/

  belongs_to :submitted_by, class_name: "Player", optional: true, inverse_of: :submitted_characters

  validates :slug, presence: true, format: { with: SLUG_FORMAT }
  validates :name, :author, :version, :pack_body, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :sha256, format: { with: /\A\h{64}\z/ }

  scope :approved, -> { where(status: "approved") }
  scope :pending, -> { where(status: "pending") }

  # Última versão aprovada de cada slug (o que o app enxerga).
  scope :served, lambda {
    where(id: approved.select("DISTINCT ON (slug) id").order(:slug, id: :desc)).order(:slug)
  }

  def self.served_for(slug)
    approved.where(slug: slug).order(id: :desc).first
  end

  def pending? = status == "pending"
  def approved? = status == "approved"
  def rejected? = status == "rejected"
end
