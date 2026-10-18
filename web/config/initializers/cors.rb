# frozen_string_literal: true

# CORS: a API usa Bearer token (sem cookies), então liberar origens é seguro.
# Restrinja com CORS_ORIGINS="https://a.com,https://b.com" se necessário.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ENV.fetch("CORS_ORIGINS", "*").split(",").map(&:strip))

    resource "/api/*",
      headers: :any,
      methods: %i[get post patch put delete options head],
      expose: %w[ETag]
  end
end
