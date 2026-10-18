# frozen_string_literal: true

module Api
  module V1
    # Catálogo de personagens da comunidade.
    class CharactersController < BaseController
      # Limite do corpo da requisição (pack ≤ 5 MB + envelope JSON).
      MAX_REQUEST_BYTES = Characters::PackValidator::MAX_BYTES + 512.kilobytes

      before_action :authenticate_player!, only: :create

      # GET /api/v1/characters — só a última versão aprovada de cada slug.
      def index
        characters = Character.served.to_a
        render json: { characters: characters.map { |c| CharacterSerializer.call(c, base_url: request.base_url) } }
      end

      # GET /api/v1/characters/:slug/pack — corpo = bytes exatos do pack
      # (os mesmos do sha256). Premium exige token de jogador premium (ou admin).
      def pack
        character = Character.served_for(params[:slug])
        raise ActiveRecord::RecordNotFound unless character
        return unless authorize_pack!(character)

        etag = %("#{character.sha256}")
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = character.premium ? "private, max-age=0, must-revalidate" : "public, max-age=300"
        return head :not_modified if request.headers["If-None-Match"] == etag

        render body: character.pack_body, content_type: "application/json"
      end

      # POST /api/v1/characters — body `{ pack: Pack }` → 201 pending.
      def create
        if request.content_length.to_i > MAX_REQUEST_BYTES
          return render_error :unprocessable_content, "validation_failed", "pack body exceeds 5 MB"
        end

        pack = parse_pack!
        character = Characters::Submit.call(player: current_player, pack: pack, admin: current_admin?)
        render json: { character: CharacterSerializer.call(character, base_url: request.base_url) }, status: :created
      rescue Characters::PackValidator::Invalid => e
        render_error :unprocessable_content, "validation_failed", e.message, details: e.details
      rescue Characters::Submit::NotOwner => e
        render_error :forbidden, "forbidden", e.message
      end

      private

      def authorize_pack!(character)
        return true unless character.premium

        unless authenticate_bearer!
          render_invalid_token
          return false
        end
        return true if current_player.premium || current_admin?

        render_error :payment_required, "premium_required", "this character requires a premium subscription"
        false
      end

      # Lido do corpo cru (não de `params`) para preservar tipos e ordem das
      # chaves — o JSON re-serializado é o que vira pack_body/sha256.
      def parse_pack!
        body = JSON.parse(request.raw_post.presence || "{}")
        raise ArgumentError, "body must be { \"pack\": { ... } }" unless body.is_a?(Hash) && body.key?("pack")

        body["pack"]
      rescue JSON::ParserError
        raise ArgumentError, "body must be valid JSON"
      end
    end
  end
end
