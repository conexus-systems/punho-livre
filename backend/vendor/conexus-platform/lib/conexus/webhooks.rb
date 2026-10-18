# frozen_string_literal: true

require "openssl"

module Conexus
  module Webhooks
    class InvalidSignature < StandardError; end

    module_function

    # Verifies an HMAC-SHA256 webhook signature.
    #
    # @param body_string [String] raw request body
    # @param signature_header [String] either "sha256=<hex>" or full
    #   "X-Conexus-Signature: sha256=<hex>"
    # @param secret [String] shared webhook secret
    # @return [true]
    # @raise [InvalidSignature]
    def verify!(body_string, signature_header, secret)
      expected = OpenSSL::HMAC.hexdigest("SHA256", secret.to_s, body_string.to_s)
      provided = extract_hex(signature_header)

      unless provided && secure_compare(expected, provided)
        raise InvalidSignature, "webhook signature mismatch"
      end

      true
    end

    def extract_hex(signature_header)
      return nil if signature_header.nil? || signature_header.empty?

      value = signature_header.to_s.strip
      value = value.sub(/\AX-Conexus-Signature:\s*/i, "")
      match = value.match(/\Asha256=([0-9a-fA-F]+)\z/)
      match && match[1].downcase
    end
    private_class_method :extract_hex

    def secure_compare(a, b)
      return false if a.bytesize != b.bytesize

      OpenSSL.secure_compare(a, b)
    end
    private_class_method :secure_compare
  end
end
