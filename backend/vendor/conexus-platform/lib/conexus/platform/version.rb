# frozen_string_literal: true

module Conexus
  module Platform
    # 0.2.0 added the ActionMailer delivery method (:conexus_api) and the
    # Railtie that registers it. 0.3.0 also *selects* it when the app sets
    # MESSAGING_PROVIDER=conexus, which makes cutting an app over purely
    # environmental — no code change in any consumer. 0.4.0 falls back to the
    # app's previous delivery method when the BFF is unreachable. 0.5.0 adds the
    # central identity account endpoints to Conexus::Auth::Client and an
    # optional redirect_uri on #exchange_code.
    #
    # Kept honest on purpose: every vendored copy used to read 0.1.0 while
    # their contents already differed, so the version told you nothing.
    VERSION = "0.5.0"
  end
end
