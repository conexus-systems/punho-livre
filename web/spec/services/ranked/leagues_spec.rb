# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ranked::Leagues do
  it "fica em colocação até completar as partidas de colocação" do
    expect(described_class.for(rating: 2100, matches: 4).key).to eq("placement")
    expect(described_class.for(rating: 2100, matches: 5).key).to eq("mestre")
  end

  it "mapeia faixas de rating de Bronze a Mestre, com o piso da próxima liga" do
    expect(described_class.for(rating: 1100).to_h).to include(key: "bronze", min_rating: 0, next_min_rating: 1400)
    expect(described_class.for(rating: 1399.4).key).to eq("bronze")
    expect(described_class.for(rating: 1399.5).key).to eq("prata")
    expect(described_class.for(rating: 1550).key).to eq("ouro")
    expect(described_class.for(rating: 1700).key).to eq("platina")
    expect(described_class.for(rating: 1999).key).to eq("diamante")
    expect(described_class.for(rating: 2400).to_h).to include(key: "mestre", next_min_rating: nil)
    expect(described_class.keys).to eq(%w[bronze prata ouro platina diamante mestre])
  end
end
