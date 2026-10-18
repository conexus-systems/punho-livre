# frozen_string_literal: true

require "rails/railtie"

module Conexus
  module Platform
    # Registers the :conexus_api delivery method and, when the app opted in,
    # selects it. Cutting an app over is then purely environmental:
    #
    #   MESSAGING_PROVIDER=conexus
    #   CONEXUS_API_WEBHOOK_SECRET=...
    #
    # No initializer and no mailer changes in the consumer app — which is the
    # point, since the fleet has 40+ apps with mailers.
    #
    # Selection is deliberately conservative: without the opt-in flag, or with
    # the flag but no secret, the app's existing delivery is left untouched.
    class Railtie < ::Rails::Railtie
      initializer "conexus.platform.action_mailer" do
        # on_load defers until ActionMailer::Base is actually loaded, so the
        # gem stays usable in apps without ActionMailer.
        ActiveSupport.on_load(:action_mailer) do
          require "conexus/messaging"

          Conexus::Messaging.install_delivery_method!(self, logger: ::Rails.logger)
        end
      end
    end
  end
end
