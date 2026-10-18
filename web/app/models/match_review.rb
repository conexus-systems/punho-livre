# frozen_string_literal: true

# Partida anulada (checksum/entradas/replay divergentes) ou disputada
# (relatos de resultado diferentes), na fila de revisão humana.
class MatchReview < ApplicationRecord
  REASONS = %w[state_mismatch inputs_mismatch replay_mismatch result_mismatch].freeze
  STATUSES = %w[open resolved dismissed].freeze

  belongs_to :match
  belongs_to :resolved_by, class_name: "Player", optional: true

  validates :reason, inclusion: { in: REASONS }
  validates :status, inclusion: { in: STATUSES }

  scope :unresolved, -> { where(status: "open") }
end
