# frozen_string_literal: true

require_relative "lib/conexus/platform/version"

Gem::Specification.new do |spec|
  spec.name = "conexus-platform"
  spec.version = Conexus::Platform::VERSION
  spec.authors = ["CONEXUS Systems"]
  spec.email = ["dev@conexus-systems.com.br"]

  spec.summary = "CONEXUS platform SDK — Auth/Billing/Messaging clients and webhook HMAC verify"
  spec.description = "Ruby SDK for the CONEXUS Auth, Payments and API BFFs: OAuth helpers, checkout client, " \
                     "signed message dispatch, and HMAC webhook verification."
  spec.homepage = "https://conexus-systems.com.br"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.2.0"

  spec.files = Dir.chdir(__dir__) do
    Dir["{lib,docs}/**/*", "README.md", "LICENSE*", "*.gemspec"].select { |f| File.file?(f) }
  end
  spec.require_paths = ["lib"]

  spec.add_dependency "base64", ">= 0.2"
  spec.add_dependency "faraday", ">= 2.0"
  spec.add_dependency "jwt", ">= 2.0"

  # `mail` and `railties` stay development-only: the delivery method duck-types
  # the mail object and the Railtie is loaded only when Rails is present, so a
  # non-Rails consumer must not be forced to install either.
  spec.add_development_dependency "mail", ">= 2.8"
  spec.add_development_dependency "actionmailer", ">= 7.0"
  spec.add_development_dependency "railties", ">= 7.0"
  spec.add_development_dependency "rspec", "~> 3.13"
end
