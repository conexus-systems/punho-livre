# frozen_string_literal: true

require "faraday"
require "json"
require "openssl"

module Conexus
  module Messaging
    class Error < StandardError; end

    # Raised before any network call when the shared secret is missing.
    class ConfigurationError < Error; end

    # Raised when the API BFF refuses or fails a dispatch. Carries the HTTP
    # status and the parsed body so callers can tell a permanent rejection
    # (422 payload, 401 signature) from something worth retrying.
    class DispatchError < Error
      attr_reader :status, :body

      def initialize(message, status: nil, body: nil)
        @status = status
        @body = body
        super(message)
      end

      def retryable?
        return true if status.nil?

        status == 429 || status >= 500
      end
    end

    # Service-to-service client for the CONEXUS API BFF (messaging hub).
    #
    # Uses POST /webhooks/messages, which authenticates with HMAC-SHA256 over
    # "<timestamp>.<raw body>" instead of an end-user token. The body is
    # serialized once and that exact string is both signed and sent — the
    # server recomputes the digest over the raw body it received.
    class Client
      DEFAULT_BASE_URL = "https://api.conexus-systems.com.br"
      WEBHOOK_PATH = "/webhooks/messages"
      DEFAULT_TIMEOUT = 10
      BULK_LIMIT = 500

      CHANNELS = %w[email sms discord].freeze

      # Mirrors MessageDispatchParams::SCALAR_FIELDS on the server; anything
      # else is dropped so a typo never silently becomes part of the payload.
      CONTENT_FIELDS = %i[
        sender reply_to subject body html_body template template_vars
        payload metadata cc bcc priority provider scheduled_at max_attempts
      ].freeze

      def initialize(base_url: nil, connection: nil, webhook_secret: nil, source_app: nil, timeout: DEFAULT_TIMEOUT)
        @base_url = (base_url || ENV.fetch("CONEXUS_API_URL", DEFAULT_BASE_URL)).to_s.chomp("/")
        @webhook_secret = (webhook_secret || ENV["CONEXUS_API_WEBHOOK_SECRET"]).to_s
        @source_app = (source_app || ENV["CONEXUS_PRODUCT_SLUG"]).to_s
        @timeout = timeout
        @connection = connection || build_connection
      end

      def dispatch(channel:, recipient:, event:, idempotency_key:, **content)
        post_signed(
          message_payload(
            channel: channel,
            recipient: recipient,
            event: event,
            idempotency_key: idempotency_key,
            **content
          )
        )
      end

      # Accepts an array of hashes shaped like #dispatch keyword arguments.
      def dispatch_bulk(messages)
        list = Array(messages)
        raise ArgumentError, "no messages to dispatch" if list.empty?
        raise ArgumentError, "bulk limit is #{BULK_LIMIT} messages" if list.size > BULK_LIMIT

        payloads = list.map { |message| message_payload(**symbolize(message)) }
        post_signed(messages: payloads)
      end

      def configured?
        !@webhook_secret.empty?
      end

      private

      def build_connection
        Faraday.new(url: @base_url) do |f|
          f.options.timeout = @timeout
          f.options.open_timeout = @timeout
          f.adapter Faraday.default_adapter
        end
      end

      def message_payload(channel:, recipient:, event:, idempotency_key:, **content)
        payload = {
          channel: normalize_channel(channel),
          recipient: recipient,
          event: event,
          idempotency_key: idempotency_key,
          source_app: content.delete(:source_app) || presence(@source_app)
        }

        CONTENT_FIELDS.each do |field|
          value = content[field]
          payload[field] = value unless value.nil?
        end

        payload.compact
      end

      def normalize_channel(channel)
        value = channel.to_s.downcase
        raise ArgumentError, "unknown channel: #{channel.inspect}" unless CHANNELS.include?(value)

        value
      end

      def post_signed(payload)
        raise ConfigurationError, "CONEXUS_API_WEBHOOK_SECRET is not set" unless configured?

        body = JSON.generate(payload)
        timestamp = Time.now.to_i.to_s

        response = @connection.post(WEBHOOK_PATH) do |req|
          req.headers["Content-Type"] = "application/json"
          req.headers["X-Timestamp"] = timestamp
          req.headers["X-Signature"] = signature(timestamp, body)
          req.headers["X-Source-App"] = @source_app unless @source_app.empty?
          req.body = body
        end

        handle(response)
      rescue Faraday::Error => e
        raise DispatchError.new("API BFF unreachable: #{e.message}")
      end

      def signature(timestamp, body)
        "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', @webhook_secret, "#{timestamp}.#{body}")}"
      end

      def handle(response)
        parsed = parse_json(response)
        return parsed if response.status.between?(200, 299)

        raise DispatchError.new(
          "API BFF rejected dispatch (HTTP #{response.status})",
          status: response.status,
          body: parsed
        )
      end

      def parse_json(response)
        body = response.body.to_s
        return {} if body.empty?

        JSON.parse(body)
      rescue JSON::ParserError
        { "raw" => body }
      end

      def symbolize(hash)
        hash.to_h { |key, value| [key.to_sym, value] }
      end

      def presence(value)
        value.to_s.empty? ? nil : value
      end
    end
  end
end
