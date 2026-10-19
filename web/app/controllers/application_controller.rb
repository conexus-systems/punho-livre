# frozen_string_literal: true

# Base da API. Erros seguem `{ "error": "<code>", "message": "..." }`
# (docs/PROTOCOL.md).
class ApplicationController < ActionController::API
  include ErrorRendering
end
