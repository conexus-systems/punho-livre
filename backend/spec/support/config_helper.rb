# frozen_string_literal: true

# Troca temporariamente valores de Rails.application.config.x.<ns>.
module ConfigHelper
  def with_config(namespace, **values)
    cfg = Rails.application.config.x.public_send(namespace)
    saved = values.keys.index_with { |k| cfg[k] }
    values.each { |k, v| cfg[k] = v }
    yield
  ensure
    saved&.each { |k, v| cfg[k] = v }
  end
end

RSpec.configure { |config| config.include ConfigHelper }
