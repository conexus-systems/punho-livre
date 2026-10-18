# frozen_string_literal: true

FactoryBot.define do
  factory :character do
    transient do
      pack { nil }
    end

    sequence(:slug) { |n| "char#{n}" }
    name { slug.capitalize }
    author { "Fulano" }
    version { "1.0.0" }
    status { "approved" }
    premium { false }
    submitted_by factory: :player

    after(:build) do |character, ctx|
      body = JSON.generate(ctx.pack || { "format" => "mugen-arena-pack/1", "id" => character.slug })
      character.pack_body = body
      character.sha256 = Digest::SHA256.hexdigest(body)
      character.size_bytes = body.bytesize
    end
  end
end
