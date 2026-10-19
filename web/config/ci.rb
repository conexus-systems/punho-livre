# Gates locais (bin/ci). Em CI/deploy quem roda é o platform-infra
# (ci-rails.yml@v1), com os mesmos comandos.

CI.run do
  step "Setup", "bin/setup --skip-server"

  step "Style: Ruby", "bin/rubocop --parallel --format progress"

  step "Tests: RSpec", "bundle exec rspec"

  step "Security: Gem audit", "bin/bundler-audit"
  step "Security: Brakeman code analysis", "bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error"
end
