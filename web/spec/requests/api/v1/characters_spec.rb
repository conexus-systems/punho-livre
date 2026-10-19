# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Characters API" do
  before { stub_jwks }

  let(:author) { create(:player) }

  def submit(pack, player: author, **token_opts)
    post "/api/v1/characters", params: { pack: pack }.to_json, headers: bearer_headers(token_for(player, **token_opts))
  end

  describe "GET /api/v1/characters" do
    it "lists only the latest approved version of each slug" do
      create(:character, slug: "kaze", version: "1.0.0", status: "approved")
      newest = create(:character, slug: "kaze", version: "1.1.0", status: "approved")
      create(:character, slug: "kaze", version: "2.0.0", status: "pending")
      create(:character, slug: "ryu", status: "rejected")

      get "/api/v1/characters"

      expect(response).to have_http_status(:ok)
      characters = response.parsed_body["characters"]
      expect(characters.size).to eq(1)
      expect(characters.first).to include(
        "slug" => "kaze", "version" => "1.1.0", "status" => "approved", "sha256" => newest.sha256,
        "size_bytes" => newest.size_bytes, "premium" => false,
        "pack_url" => "http://www.example.com/api/v1/characters/kaze/pack"
      )
      expect(characters.first["updated_at"]).to match(/\A\d{4}-\d\d-\d\dT.*Z\z/)
    end
  end

  describe "POST /api/v1/characters" do
    it "requires authentication" do
      post "/api/v1/characters", params: { pack: build_pack }.to_json, headers: { "CONTENT_TYPE" => "application/json" }

      expect(response).to have_http_status(:unauthorized)
    end

    it "creates a pending version whose sha256 covers the exact stored body" do
      pack = build_pack

      expect { submit(pack) }.to change(Character, :count).by(1)
        .and have_enqueued_job(CharacterSubmittedNotificationJob)

      expect(response).to have_http_status(:created)
      body = response.parsed_body["character"]
      expect(body).to include("slug" => "kaze", "name" => "Kaze", "author" => "Fulano", "status" => "pending")

      character = Character.last
      expect(character.pack_body).to eq(JSON.generate(pack))
      expect(body["sha256"]).to eq(Digest::SHA256.hexdigest(character.pack_body))
      expect(character.submitted_by).to eq(author)
    end

    it "returns 422 validation_failed with details for an invalid pack" do
      pack = build_pack
      pack["files"].delete("kaze.cmd")

      submit(pack)

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body).to include("error" => "validation_failed")
      expect(response.parsed_body["details"]).to include("[Files] cmd = kaze.cmd is missing from files")
    end

    it "returns 422 for a body without pack" do
      post "/api/v1/characters", params: { nope: 1 }.to_json, headers: bearer_headers(token_for(author))

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "keeps the approved version served while a resubmission is pending" do
      approved = create(:character, slug: "kaze", status: "approved", submitted_by: author)

      submit(build_pack("version" => "1.1.0"))

      expect(response).to have_http_status(:created)
      expect(Character.where(slug: "kaze").pluck(:status)).to contain_exactly("approved", "pending")
      expect(Character.served_for("kaze")).to eq(approved)
    end

    it "supersedes an older pending submission of the same slug" do
      submit(build_pack("version" => "1.0.0"))
      submit(build_pack("version" => "1.0.1"))

      expect(Character.where(slug: "kaze").order(:id).pluck(:version, :status, :reject_reason)).to eq(
        [ [ "1.0.0", "rejected", "superseded" ], [ "1.0.1", "pending", nil ] ]
      )
    end

    it "forbids another player from publishing versions of a taken slug" do
      create(:character, slug: "kaze", submitted_by: author)

      submit(build_pack, player: create(:player))

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]).to eq("forbidden")
    end
  end

  describe "GET /api/v1/characters/:slug/pack" do
    it "serves the exact pack bytes of a free character without auth" do
      pack = build_pack
      character = create(:character, slug: "kaze", pack: pack)

      get "/api/v1/characters/kaze/pack"

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/json")
      expect(response.body).to eq(character.pack_body)
      expect(Digest::SHA256.hexdigest(response.body)).to eq(character.sha256)
      expect(response.headers["ETag"]).to eq(%("#{character.sha256}"))
    end

    it "returns 304 when the ETag matches" do
      character = create(:character, slug: "kaze")

      get "/api/v1/characters/kaze/pack", headers: { "If-None-Match" => %("#{character.sha256}") }

      expect(response).to have_http_status(:not_modified)
    end

    it "returns 404 for unknown or unapproved slugs" do
      create(:character, slug: "kaze", status: "pending")

      get "/api/v1/characters/kaze/pack"

      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body["error"]).to eq("not_found")
    end

    context "with a character flagged premium (legado)" do
      before { create(:character, slug: "akuma", premium: true) }

      it "serves it to everyone, without a token (jogo pago: nada bloqueado)" do
        get "/api/v1/characters/akuma/pack"

        expect(response).to have_http_status(:ok)
        expect(response.headers["Cache-Control"]).to include("public")
      end
    end
  end

  describe "admin moderation" do
    let(:admin_headers) { bearer_headers(token_for(create(:player), groups: [ "mugen-arena-admin" ])) }

    it "forbids non-admins" do
      get "/api/v1/admin/characters", headers: bearer_headers(token_for(author))

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]).to eq("forbidden")
    end

    it "lists pending characters" do
      create(:character, slug: "kaze", status: "pending")
      create(:character, slug: "ryu", status: "approved")

      get "/api/v1/admin/characters", params: { status: "pending" }, headers: admin_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["characters"].pluck("slug")).to eq([ "kaze" ])
    end

    it "approves the pending version (premium flag) and notifies the author" do
      submit(build_pack)

      expect {
        patch "/api/v1/admin/characters/kaze", params: { status: "approved", premium: true }.to_json,
                                               headers: admin_headers
      }.to have_enqueued_job(CharacterReviewedNotificationJob).with(Character.last.id, "approved")

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["character"]).to include("status" => "approved", "premium" => true)

      get "/api/v1/characters"
      expect(response.parsed_body["characters"].pluck("slug", "premium")).to eq([ [ "kaze", true ] ])
    end

    it "approving a new version replaces the served one and inherits premium" do
      create(:character, slug: "kaze", version: "1.0.0", premium: true, submitted_by: author)
      submit(build_pack("version" => "2.0.0"))

      patch "/api/v1/admin/characters/kaze", params: { status: "approved" }.to_json, headers: admin_headers

      served = Character.served_for("kaze")
      expect(served).to have_attributes(version: "2.0.0", premium: true)
    end

    it "rejects with a reason" do
      submit(build_pack)

      patch "/api/v1/admin/characters/kaze", params: { status: "rejected", reason: "sprites faltando" }.to_json,
                                             headers: admin_headers

      expect(response).to have_http_status(:ok)
      expect(Character.last).to have_attributes(status: "rejected", reject_reason: "sprites faltando")
      expect(CharacterReviewedNotificationJob).to have_been_enqueued.with(Character.last.id, "rejected")
    end

    it "validates the status and returns 404 for unknown slugs" do
      patch "/api/v1/admin/characters/nope", params: { status: "approved" }.to_json, headers: admin_headers
      expect(response).to have_http_status(:not_found)

      create(:character, slug: "kaze", status: "pending")
      patch "/api/v1/admin/characters/kaze", params: { status: "maybe" }.to_json, headers: admin_headers
      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
