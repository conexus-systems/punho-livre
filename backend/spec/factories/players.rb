# frozen_string_literal: true

FactoryBot.define do
  factory :player do
    conexus_user_id { SecureRandom.uuid }
    sequence(:display_name) { |n| "Lutador #{n}" }
    sequence(:email) { |n| "lutador#{n}@example.com" }
    rating { 1000 }
  end
end
