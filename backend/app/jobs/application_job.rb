# frozen_string_literal: true

class ApplicationJob < ActiveJob::Base
  # Registro sumiu antes do job rodar: nada a fazer.
  discard_on ActiveJob::DeserializationError
end
