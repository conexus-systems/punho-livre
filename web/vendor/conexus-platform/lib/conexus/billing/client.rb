# frozen_string_literal: true

require "faraday"
require "json"

module Conexus
  module Billing
    class Client
      DEFAULT_BASE_URL = "https://payments.conexus-systems.com.br"

      def initialize(base_url: nil, connection: nil, service_api_key: nil)
        @base_url = (base_url || ENV.fetch("CONEXUS_PAYMENTS_URL", DEFAULT_BASE_URL)).to_s.chomp("/")
        @service_api_key = resolve_service_api_key(service_api_key)
        @connection = connection || Faraday.new(url: @base_url) do |f|
          f.request :json
          f.adapter Faraday.default_adapter
        end
      end

      def create_checkout(conexus_user_id:, plan_id:, return_url:, provider: nil, metadata: nil, cancel_url: nil)
        payload = {
          conexus_user_id: conexus_user_id,
          plan_id: plan_id,
          return_url: return_url
        }
        payload[:provider] = provider unless provider.nil?
        payload[:metadata] = metadata unless metadata.nil?
        payload[:cancel_url] = cancel_url unless cancel_url.nil?

        response = @connection.post("/v1/checkouts") do |req|
          req.headers["Content-Type"] = "application/json"
          apply_service_key!(req)
          req.body = payload
        end

        parse_json(response)
      end

      private

      def resolve_service_api_key(explicit)
        candidates = [explicit, ENV["CONEXUS_SERVICE_API_KEY"], ENV["SERVICE_API_KEY"]]
        candidates.each do |value|
          next if value.nil?

          key = value.to_s.strip
          return key unless key.empty?
        end
        nil
      end

      def apply_service_key!(req)
        return if @service_api_key.nil? || @service_api_key.empty?

        req.headers["X-Conexus-Service-Key"] = @service_api_key
      end

      def parse_json(response)
        body = response.body.to_s
        return {} if body.empty?

        JSON.parse(body)
      end
    end
  end
end
