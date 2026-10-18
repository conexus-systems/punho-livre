# frozen_string_literal: true

module Integrity
  # Desafio de uso único (sem tabela): nonce assinado com o secret_key_base,
  # amarrado ao jogador e com validade curta. O app manda SHA-256(nonce) como
  # requestHash do Play Integrity; o servidor confere o mesmo hash no veredito.
  module Challenge
    TTL = 5.minutes

    module_function

    def issue(player)
      verifier.generate({ "p" => player.id, "r" => SecureRandom.hex(16) }, expires_in: TTL, purpose: :play_integrity)
    end

    # true se o nonce foi emitido para este jogador e ainda vale.
    def valid?(nonce, player)
      data = verifier.verified(nonce.to_s, purpose: :play_integrity)
      data.is_a?(Hash) && data["p"] == player.id
    end

    def request_hash(nonce)
      Digest::SHA256.hexdigest(nonce.to_s)
    end

    def verifier
      Rails.application.message_verifier(:play_integrity)
    end
  end
end
