# frozen_string_literal: true

require "faraday"
require "json"
require "uri"
require "base64"

module Conexus
  module Auth
    class AccountError < StandardError
      attr_reader :status, :code

      def initialize(status:, code:)
        @status = status
        @code = code
        super("Auth account request failed (#{code})")
      end

      def retryable?
        status.nil? || status == 429 || status >= 500
      end
    end

    class Client
      DEFAULT_BASE_URL = "https://auth.conexus-systems.com.br"

      def initialize(base_url: nil, connection: nil, client_id: nil, client_secret: nil)
        @client_id = client_id || ENV["CONEXUS_AUTH_CLIENT_ID"]
        @client_secret = client_secret || ENV["CONEXUS_AUTH_CLIENT_SECRET"]
        @base_url = (base_url || ENV.fetch("CONEXUS_AUTH_URL", DEFAULT_BASE_URL)).to_s.chomp("/")
        @connection = connection || Faraday.new(url: @base_url) do |f|
          f.options.open_timeout = 5
          f.options.timeout = 15
          f.request :url_encoded
          f.adapter Faraday.default_adapter
        end
      end

      def authorize_url(client_id:, redirect_uri:, state:)
        query = URI.encode_www_form(
          client_id: client_id,
          redirect_uri: redirect_uri,
          response_type: "code",
          state: state
        )
        "#{@base_url}/oauth/authorize?#{query}"
      end

      def exchange_code(code:, client_id:, client_secret:, redirect_uri: nil)
        body = {
          grant_type: "authorization_code",
          code: code,
          client_id: client_id,
          client_secret: client_secret
        }
        body[:redirect_uri] = redirect_uri if redirect_uri.to_s.strip != ""

        response = @connection.post("/oauth/token") do |req|
          req.headers["Content-Type"] = "application/x-www-form-urlencoded"
          req.body = body
        end

        parse_json(response)
      end

      def import_account(identity:, dry_run: true)
        account_request("import", identity: identity, dry_run: dry_run)
      end

      def authenticate_account(email:, password:)
        account_request("authenticate", email: email, password: password)
      end

      def register_account(email:, name:, password:)
        account_request("register", email: email, name: name, password: password)
      end

      def google_account(id_token:)
        account_request("google", id_token: id_token)
      end

      def confirm_account(token:)
        account_request("confirm", token: token)
      end

      def recover_account(email:, purpose:)
        account_request("recovery", email: email, purpose: purpose)
      end

      def reset_account(token:, password:)
        account_request("reset", token: token, password: password)
      end

      def jwks_url
        "#{@base_url}/.well-known/jwks.json"
      end

      private

      def account_request(action, payload)
        if @client_id.to_s.empty? || @client_secret.to_s.empty?
          raise AccountError.new(status: 401, code: "missing_client_credentials")
        end

        response = @connection.post("/api/v1/accounts/#{action}") do |req|
          req.headers["Content-Type"] = "application/json"
          req.headers["Accept"] = "application/json"
          req.headers["Authorization"] = "Basic #{Base64.strict_encode64("#{@client_id}:#{@client_secret}")}"
          req.body = JSON.generate(payload)
        end
        status = response.status.to_i
        unless (200..299).cover?(status)
          raise AccountError.new(status: status, code: account_error_code(response.body, status))
        end

        body = JSON.parse(response.body.to_s)
        raise AccountError.new(status: status, code: "invalid_response") unless body.is_a?(Hash)

        body
      rescue JSON::ParserError
        raise AccountError.new(status: response&.status, code: "invalid_response"), cause: nil
      rescue Faraday::Error
        raise AccountError.new(status: nil, code: "unavailable"), cause: nil
      end

      def account_error_code(body, status)
        parsed = JSON.parse(body.to_s)
        code = parsed.is_a?(Hash) && parsed["error"]
        allowed = %w[invalid_credentials invalid_client invalid_token invalid_google_token
                     invalid_identity invalid_request email_taken email_unverified account_inactive
                     identity_conflict missing_credentials unauthorized forbidden validation_failed]
        allowed.include?(code) ? code : "http_#{status}"
      rescue JSON::ParserError
        "http_#{status}"
      end

      def parse_json(response)
        body = response.body.to_s
        return {} if body.empty?

        JSON.parse(body)
      end
    end
  end
end
