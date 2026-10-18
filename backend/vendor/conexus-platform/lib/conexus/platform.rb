# frozen_string_literal: true

require_relative "platform/version"
require_relative "webhooks"
require_relative "auth/client"
require_relative "billing/client"
require_relative "messaging"

# Registers the ActionMailer delivery method. Guarded so the gem also loads in
# plain Ruby scripts and non-Rails services.
#
# Checks ::Rails and not ::Rails::Railtie on purpose: depending on Bundler.require
# order the gem can load before railtie.rb is in, and the stricter guard would
# silently skip registration — leaving the app to fail on an "invalid delivery
# method" at the first send. railtie.rb requires what it needs.
require_relative "platform/railtie" if defined?(::Rails)
