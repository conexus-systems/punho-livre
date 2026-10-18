# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ratings::Glicko2 do
  def rating(r, rd, vol = 0.06) = described_class::Rating.new(r, rd, vol)

  it "reproduz o exemplo do artigo do Glickman (2013)" do
    player = rating(1500, 200)
    results = [ [ rating(1400, 30), 1.0 ], [ rating(1550, 100), 0.0 ], [ rating(1700, 300), 0.0 ] ]

    updated = described_class.rate(player, results)

    expect(updated.rating).to be_within(0.01).of(1464.06)
    expect(updated.deviation).to be_within(0.01).of(151.52)
    expect(updated.volatility).to be_within(0.00001).of(0.05999)
  end

  it "jogador novo anda muito mais que veterano com o mesmo resultado (incerteza por jogador)" do
    opponent = rating(1500, 100)
    novice = described_class.rate(rating(1500, 350), [ [ opponent, 1.0 ] ])
    veteran = described_class.rate(rating(1500, 60), [ [ opponent, 1.0 ] ])

    expect(novice.rating - 1500).to be > 4 * (veteran.rating - 1500)
    expect(novice.deviation).to be < 350
  end

  it "vencer quem tem rating maior vale mais; empate entre iguais não muda o rating" do
    me = rating(1500, 100)
    up = described_class.rate(me, [ [ rating(1800, 100), 1.0 ] ])
    down = described_class.rate(me, [ [ rating(1200, 100), 1.0 ] ])
    draw = described_class.rate(me, [ [ rating(1500, 100), 0.5 ] ])

    expect(up.rating - 1500).to be > (down.rating - 1500)
    expect(draw.rating).to be_within(0.001).of(1500)
  end

  it "a incerteza cresce com a inatividade (até 350)" do
    expect(described_class.inflate(60.0, 0.06, 0)).to eq(60.0)
    expect(described_class.inflate(60.0, 0.06, 30.days)).to be > 60.0
    expect(described_class.inflate(60.0, 0.06, 100_000.days)).to eq(350.0)
  end

  it "probabilidade de vitória é simétrica" do
    a = rating(1700, 80)
    b = rating(1500, 120)

    expect(described_class.win_probability(a, b) + described_class.win_probability(b, a)).to be_within(1e-9).of(1.0)
    expect(described_class.win_probability(a, b)).to be > 0.7
  end
end
