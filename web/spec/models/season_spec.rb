# frozen_string_literal: true

require "rails_helper"

RSpec.describe Season do
  it "cria a primeira temporada sob demanda e reaproveita enquanto vale" do
    freeze_time do
      season = described_class.current

      expect(season).to have_attributes(number: 1, name: "Temporada 1", starts_at: Time.current,
                                        ends_at: Time.current + 56.days)
      expect(described_class.current).to eq(season)
    end
  end

  it "abre a próxima temporada emendada na anterior quando ela acaba" do
    first = travel_to(Time.zone.parse("2026-01-01 12:00")) { described_class.current }

    travel_to(first.ends_at + 1.hour) do
      second = described_class.current
      expect(second).to have_attributes(number: 2, starts_at: first.ends_at)
      expect(second.previous).to eq(first)
    end
  end

  it "começa do zero se o servidor ficou parado mais de uma temporada" do
    first = travel_to(Time.zone.parse("2026-01-01 12:00")) { described_class.current }

    travel_to(first.ends_at + 100.days) do
      expect(described_class.current.starts_at).to eq(Time.current)
    end
  end

  describe SeasonRating do
    let(:player) { create(:player) }

    it "começa em 1500/350 e sincroniza o rating exibido do jogador" do
      player.update_columns(rating: 999)
      record = described_class.for!(player)

      expect(record).to have_attributes(rating: 1500.0, deviation: 350.0, volatility: 0.06)
      expect(player.reload.rating).to eq(1500)
    end

    it "na virada carrega metade da distância até 1500 e reabre a incerteza" do
      first = travel_to(Time.zone.parse("2026-01-01 12:00")) { Season.current }
      described_class.create!(player: player, season: first, rating: 1900.0, deviation: 60.0, volatility: 0.05,
                              wins: 30, losses: 10)

      travel_to(first.ends_at + 1.minute) do
        record = described_class.for!(player)
        expect(record.season.number).to eq(2)
        expect(record).to have_attributes(rating: 1700.0, deviation: 250.0, volatility: 0.05, wins: 0)
        expect(player.reload.rating).to eq(1700)
      end
    end

    it "posição só para quem saiu da colocação" do
      season = Season.current
      top = described_class.create!(player: create(:player), season: season, rating: 1800, wins: 5)
      mine = described_class.create!(player: player, season: season, rating: 1600, wins: 3, losses: 2)
      described_class.create!(player: create(:player), season: season, rating: 1700, wins: 1)

      expect(top.rank).to eq(1)
      expect(mine.rank).to eq(2)
      expect(mine.league.key).to eq("ouro")
    end
  end
end
