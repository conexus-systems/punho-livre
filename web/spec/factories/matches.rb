# frozen_string_literal: true

FactoryBot.define do
  factory :match do
    player1 factory: :player
    player2 factory: :player
    status { "waiting" }
    mode { "ranked" }
    p1_character { "kaze" }
    p2_character { "ryu" }
    p1_pack_sha256 { "a" * 64 }
    p2_pack_sha256 { "b" * 64 }
    seed { 12_345 }
    engine_version { "0.4.0+net2" }
  end
end
