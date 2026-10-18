require_relative "boot"

require "rails"
# Frameworks usados por um backend API-only com Action Cable.
# Sem Action Mailer: e-mails saem pelo bff-api (gem conexus-platform).
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_view/railtie"
require "action_cable/engine"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module MugenArena
  class Application < Rails::Application
    config.load_defaults 8.1

    config.autoload_lib(ignore: %w[assets tasks])

    config.time_zone = "UTC"

    # API-only: sem sessão/cookies/views.
    config.api_only = true

    # Jobs no Solid Queue (Postgres primário — ADR 0001, sem Redis/Sidekiq).
    config.active_job.queue_adapter = :solid_queue

    # Action Cable em /cable. A autenticação é o JWT do bff-auth em ?token=
    # (ApplicationCable::Connection); o app mobile não manda Origin confiável,
    # então a checagem de origem (proteção CSRF de cookies) não se aplica.
    config.action_cable.mount_path = "/cable"
    config.action_cable.disable_request_forgery_protection = true
  end
end
