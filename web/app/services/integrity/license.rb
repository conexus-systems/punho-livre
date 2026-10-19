# frozen_string_literal: true

module Integrity
  # Licença do jogo pago: o online (fila e salas) só aceita cópias compradas
  # na Google Play. O modo offline nunca depende disto.
  #
  # Ligado por ENV["PLAY_INTEGRITY_REQUIRED"] = "1" (produção). Desligado,
  # todo jogador conta como licenciado (dev, testes, versão web).
  module License
    VALID_FOR = 7.days
    MAX_TOKEN_AGE = 10.minutes

    Result = Data.define(:ok, :error, :licensed_until)

    module_function

    def required?
      ENV["PLAY_INTEGRITY_REQUIRED"] == "1"
    end

    def package_name
      ENV.fetch("PLAY_INTEGRITY_PACKAGE", "br.com.conexus.mugenarena")
    end

    def licensed?(player)
      return true unless required?

      player.licensed_until.present? && player.licensed_until.future?
    end

    # Confere o veredito do Google e, se aprovado, renova a licença do jogador.
    def verify!(player:, nonce:, token:, client: GoogleClient.new, now: Time.current)
      return fail("invalid_nonce") unless Challenge.valid?(nonce, player)

      payload = client.decode(package_name, token)
      error = verdict_error(payload, Challenge.request_hash(nonce), now)
      return fail(error) if error

      until_at = now + VALID_FOR
      player.update!(licensed_until: until_at)
      Result.new(ok: true, error: nil, licensed_until: until_at)
    end

    # nil se o veredito comprova cópia comprada, num aparelho íntegro, para este pedido.
    def verdict_error(payload, request_hash, now)
      req = payload["requestDetails"] || {}
      app = payload["appIntegrity"] || {}
      device = payload["deviceIntegrity"] || {}
      account = payload["accountDetails"] || {}

      return "wrong_request" unless req["requestHash"] == request_hash && req["requestPackageName"] == package_name
      return "stale_token" if (now.to_f * 1000 - req["timestampMillis"].to_f) > MAX_TOKEN_AGE.in_milliseconds
      return "unrecognized_app" unless app["appRecognitionVerdict"] == "PLAY_RECOGNIZED"
      return "not_licensed" unless account["appLicensingVerdict"] == "LICENSED"
      return "device_integrity" unless Array(device["deviceRecognitionVerdict"]).include?("MEETS_DEVICE_INTEGRITY")

      nil
    end

    def fail(error)
      Result.new(ok: false, error: error, licensed_until: nil)
    end
  end
end
