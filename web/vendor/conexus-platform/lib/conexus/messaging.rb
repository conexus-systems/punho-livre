# frozen_string_literal: true

require_relative "messaging/client"

module Conexus
  module Messaging
    PROVIDER_ENV = "MESSAGING_PROVIDER"
    SECRET_ENV = "CONEXUS_API_WEBHOOK_SECRET"
    CONEXUS_PROVIDER = "conexus"

    module_function

    # True only when the app opted in *and* can actually sign a request.
    #
    # Both conditions matter: with the flag on but no secret, every send would
    # fail at the BFF with 401 and the app would look broken. In that case the
    # legacy delivery stays in place and #misconfigured? reports it.
    def conexus_provider?
      provider_selected? && secret_present?
    end

    def provider_selected?
      ENV[PROVIDER_ENV].to_s.strip.downcase == CONEXUS_PROVIDER
    end

    def secret_present?
      !ENV[SECRET_ENV].to_s.strip.empty?
    end

    # Flag on, secret missing — worth warning about at boot, since the intent
    # was to cut over and the app is silently still on the old path.
    def misconfigured?
      provider_selected? && !secret_present?
    end

    # Registers :conexus_api on an ActionMailer base and selects it when the
    # app opted in. Lives here rather than inline in the Railtie so the
    # decision that changes where a fleet's email goes is directly testable.
    #
    # Returns the delivery method in effect afterwards.
    def install_delivery_method!(mailer_base, logger: nil)
      require_relative "messaging/delivery_method"

      previous = mailer_base.delivery_method

      mailer_base.add_delivery_method(
        :conexus_api,
        DeliveryMethod,
        logger: logger,
        fallback: legacy_fallback(mailer_base, previous, logger: logger)
      )

      if conexus_provider?
        mailer_base.delivery_method = :conexus_api
      elsif misconfigured?
        logger&.warn(
          "[Conexus] #{PROVIDER_ENV}=#{CONEXUS_PROVIDER} but #{SECRET_ENV} is missing — " \
          "keeping the previous delivery method."
        )
      end

      mailer_base.delivery_method
    end

    # Delivers through whatever the app used before the cutover, so an
    # unreachable BFF degrades to the old path instead of dropping the mail.
    # Returns nil when there is nothing sane to fall back to.
    def legacy_fallback(mailer_base, previous, logger: nil)
      return nil if previous.nil? || previous == :conexus_api

      lambda do |mail|
        klass = mailer_base.delivery_methods[previous]
        raise DeliveryMethod::FallbackUnavailable, "no delivery method #{previous.inspect}" unless klass

        klass.new(fallback_settings(mailer_base, previous)).deliver!(mail)
      rescue StandardError => e
        logger&.error("[Conexus] fallback delivery through #{previous.inspect} failed: #{e.message}")
        raise
      end
    end

    def fallback_settings(mailer_base, previous)
      reader = "#{previous}_settings"
      mailer_base.respond_to?(reader) ? mailer_base.public_send(reader) : {}
    end
  end
end
