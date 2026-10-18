# Contrato completo em docs/PROTOCOL.md (raiz do repositório).
Rails.application.routes.draw do
  # Health check (probe do K8s / platform-infra).
  get "up" => "rails/health#show", as: :rails_health_check

  # Webhooks CONEXUS (bff-auth + bff-payment), assinados com HMAC.
  post "/conexus/webhooks", to: "conexus/webhooks#create"

  slug = /[a-z0-9][a-z0-9_-]{1,31}/

  namespace :api do
    # Telemetria anônima com consentimento (fora do /v1: o esquema tem versão própria no corpo).
    post "telemetry/batch", to: "telemetry#batch"

    namespace :v1 do
      resource :me, only: %i[show update], controller: "me"

      resources :characters, only: %i[index create], param: :slug, constraints: { slug: slug } do
        get :pack, on: :member
      end

      get "leaderboard", to: "leaderboard#index"
      resources :matches, only: :index

      namespace :admin do
        resources :characters, only: %i[index update], param: :slug, constraints: { slug: slug }
      end
    end
  end

  # Action Cable fica em /cable (config.action_cable.mount_path).
end
