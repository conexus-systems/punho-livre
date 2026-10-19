# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Licença do jogo pago (Play Integrity)" do
  let(:player) { create(:player) }
  let(:headers) { bearer_headers(token_for(player)).merge("Content-Type" => "application/json") }

  before { stub_jwks }

  it "emite um desafio para o jogador logado" do
    post "/api/v1/license/challenge", headers: headers

    expect(response).to have_http_status(:ok)
    expect(Integrity::Challenge.valid?(response.parsed_body["nonce"], player)).to be(true)
    expect(response.parsed_body["required"]).to be(false)
  end

  it "exige login" do
    post "/api/v1/license/challenge"

    expect(response).to have_http_status(:unauthorized)
  end

  it "responde 503 license_unavailable sem a conta de serviço configurada" do
    nonce = Integrity::Challenge.issue(player)
    post "/api/v1/license/verify", params: { nonce: nonce, token: "tok" }.to_json, headers: headers

    expect(response).to have_http_status(:service_unavailable)
    expect(response.parsed_body["error"]).to eq("license_unavailable")
  end

  it "decodifica no Google e licencia a cópia comprada" do
    key = OpenSSL::PKey::RSA.generate(2048)
    nonce = Integrity::Challenge.issue(player)
    stub_request(:post, "https://oauth2.googleapis.com/token").to_return(status: 200, body: { access_token: "g" }.to_json)
    stub_request(:post, "https://playintegrity.googleapis.com/v1/br.com.conexus.mugenarena:decodeIntegrityToken")
      .with(headers: { "Authorization" => "Bearer g" }, body: { integrity_token: "tok" }.to_json)
      .to_return(status: 200, body: { tokenPayloadExternal: {
        requestDetails: { requestPackageName: "br.com.conexus.mugenarena", requestHash: Digest::SHA256.hexdigest(nonce),
                          timestampMillis: (Time.current.to_f * 1000).to_i.to_s },
        appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED" },
        deviceIntegrity: { deviceRecognitionVerdict: [ "MEETS_DEVICE_INTEGRITY" ] },
        accountDetails: { appLicensingVerdict: "LICENSED" }
      } }.to_json)

    ENV["PLAY_INTEGRITY_SERVICE_ACCOUNT"] = { client_email: "sa@x.iam.gserviceaccount.com", private_key: key.to_pem }.to_json
    begin
      post "/api/v1/license/verify", params: { nonce: nonce, token: "tok" }.to_json, headers: headers
    ensure
      ENV.delete("PLAY_INTEGRITY_SERVICE_ACCOUNT")
    end

    expect(response).to have_http_status(:ok)
    expect(player.reload.licensed_until).to be > 6.days.from_now
  end
end
