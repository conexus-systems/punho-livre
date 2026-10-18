# frozen_string_literal: true

require "rails_helper"

RSpec.describe Matches::InputsHash do
  it "é o mesmo FNV-1a do app (vetor de mobile/src/net/__tests__/simnet.test.ts)" do
    expect(described_class.call([ 0, 16, 0x7ff ], [ 0, 1024, 3 ], 3)).to eq(1_965_842_172)
  end

  it "só cobre os quadros pedidos e exige entradas suficientes" do
    expect(described_class.call([ 1, 2, 3 ], [ 4, 5, 6 ], 2)).to eq(described_class.call([ 1, 2 ], [ 4, 5 ], 2))
    expect(described_class.call([], [], 0)).to eq(described_class::OFFSET)
    expect { described_class.call([ 1 ], [ 1 ], 2) }.to raise_error(ArgumentError)
  end
end

RSpec.describe Matches::InputLog do
  let(:match) { create(:match, status: "active") }

  it "grava blocos contíguos, apara repetição e acusa buraco sem gravar" do
    expect(described_class.append(match_id: match.id, side: 0, from: 1, bits: [ 1, 2, 3 ])).to eq(ok: true, next: 4)
    expect(described_class.append(match_id: match.id, side: 0, from: 2, bits: [ 2, 3, 4 ])).to eq(ok: true, next: 5)
    expect(described_class.append(match_id: match.id, side: 0, from: 1, bits: [ 1 ])).to eq(ok: true, next: 5)
    expect(described_class.append(match_id: match.id, side: 0, from: 9, bits: [ 9 ])).to eq(ok: false, next: 5)

    expect(described_class.frames_from(match.id, 0, 1)).to eq([ 1, 2, 3, 4 ])
    expect(described_class.frames_from(match.id, 0, 3)).to eq([ 3, 4 ])
    expect(described_class.frames_from(match.id, 1, 1)).to eq([])
  end

  it "valida o formato" do
    expect { described_class.append(match_id: match.id, side: 0, from: 0, bits: [ 1 ]) }
      .to raise_error(described_class::Invalid)
    expect { described_class.append(match_id: match.id, side: 0, from: 1, bits: [ -1 ]) }
      .to raise_error(described_class::Invalid)
    expect { described_class.append(match_id: match.id, side: 0, from: 1, bits: Array.new(601, 0)) }
      .to raise_error(described_class::Invalid)
  end
end
