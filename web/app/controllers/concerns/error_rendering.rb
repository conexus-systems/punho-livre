# frozen_string_literal: true

# Formato único de erro da API: `{ "error": "<code>", "message": "..." }`.
module ErrorRendering
  extend ActiveSupport::Concern

  included do
    rescue_from ActiveRecord::RecordNotFound do
      render_error :not_found, "not_found", "resource not found"
    end

    rescue_from ActiveRecord::RecordInvalid do |error|
      render_error :unprocessable_content, "validation_failed", error.record.errors.full_messages.to_sentence
    end

    rescue_from ActionController::ParameterMissing, ArgumentError do |error|
      render_error :unprocessable_content, "validation_failed", error.message
    end
  end

  private

  def render_error(status, error, message, **extra)
    render json: { error: error, message: message, **extra }, status: status
  end
end
