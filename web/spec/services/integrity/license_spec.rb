# frozen_string_literal: true

require "rails_helper"

RSpec.describe Integrity::License do
  let(:player) { create(:player) }
  let(:now) { Time.zone.parse("2026-10-18 12:00") }
  let(:nonce) { Integrity::Challenge.issue(player) }
  let(:fake_client) { Struct.new(:payload) { def decode(_pkg, _token) = payload } }

  def verdict(hash: Integrity::Challenge.request_hash(nonce), package: "br.com.conexus.bamba", at: now,
              app: "PLAY_RECOGNIZED", license: "LICENSED", device: [ "MEETS_DEVICE_INTEGRITY" ])
    {
      "requestDetails" => { "requestPackageName" => package, "requestHash" => hash, "timestampMillis" => (at.to_f * 1000).to_i.to_s },
      "appIntegrity" => { "appRecognitionVerdict" => app, "packageName" => package },
      "deviceIntegrity" => { "deviceRecognitionVerdict" => device },
      "accountDetails" => { "appLicensingVerdict" => license }
    }
  end

  def verify(payload, nonce_value = nonce)
    described_class.verify!(player: player, nonce: nonce_value, token: "tok", client: fake_client.new(payload), now: now)
  end

  it "licencia por 7 dias uma cópia comprada, reconhecida pela Play, num aparelho íntegro" do
    result = verify(verdict)

    expect(result.ok).to be(true)
    expect(player.reload.licensed_until).to eq(now + 7.days)
  end

  it "recusa cópia não comprada, app não reconhecido, aparelho adulterado e pedido de outro hash" do
    expect(verify(verdict(license: "UNLICENSED")).error).to eq("not_licensed")
    expect(verify(verdict(app: "UNRECOGNIZED_VERSION")).error).to eq("unrecognized_app")
    expect(verify(verdict(device: [])).error).to eq("device_integrity")
    expect(verify(verdict(hash: "0" * 64)).error).to eq("wrong_request")
    expect(verify(verdict(package: "com.pirata")).error).to eq("wrong_request")
    expect(verify(verdict(at: now - 11.minutes)).error).to eq("stale_token")
    expect(player.reload.licensed_until).to be_nil
  end

  it "recusa nonce de outro jogador ou adulterado" do
    other = Integrity::Challenge.issue(create(:player))

    expect(verify(verdict(hash: Integrity::Challenge.request_hash(other)), other).error).to eq("invalid_nonce")
    expect(verify(verdict, "lixo").error).to eq("invalid_nonce")
  end

  describe ".licensed?" do
    it "libera todo mundo quando a exigência está desligada (dev, testes, web)" do
      expect(described_class.licensed?(player)).to be(true)
    end

    it "com PLAY_INTEGRITY_REQUIRED=1 exige licença válida" do
      ENV["PLAY_INTEGRITY_REQUIRED"] = "1"
      begin
        expect(described_class.licensed?(player)).to be(false)
        player.update!(licensed_until: 1.day.from_now)
        expect(described_class.licensed?(player)).to be(true)
        player.update!(licensed_until: 1.minute.ago)
        expect(described_class.licensed?(player)).to be(false)
      ensure
        ENV.delete("PLAY_INTEGRITY_REQUIRED")
      end
    end
  end
end
