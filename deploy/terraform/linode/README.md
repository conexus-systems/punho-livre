# Terraform — BAMBA (Linode LKE)

Raiz do Terraform de produção. Fica em `deploy/terraform/linode` **na raiz do repo** (nunca em
`web/deploy`), como o layout "produto Expo" do
[`platform-infra`](https://github.com/conexus-systems/platform-infra) exige.

Usa o módulo compartilhado
`git::https://github.com/conexus-systems/platform-infra.git//modules/rails-lke?ref=v1`:
namespace `mugen-arena`, secret `mugen-arena-production-secrets`, Deployment
`mugen-arena-web` (Puma single mode + Action Cable + Solid Queue no Puma), Service e Ingress
em `mugen-arena.conexus-systems.com.br`. Sem worker separado, sem Redis/Sidekiq.

## Apply

**Só** pelo GitHub Actions — proibido `terraform apply` na máquina do operador ou do agente:

```bash
gh workflow run "Deploy — Production" --ref main                    # testes → GHCR → apply
gh workflow run "Deploy — Production" --ref main -f skip_build=true # só apply
gh workflow run "Terraform — plan" --ref main                       # plan
```

O job `deploy-lke.yml@v1`:

1. grava o kubeconfig em `/tmp/kubeconfig` (lido pelo provider em `versions.tf`);
2. faz `terraform init` com o backend S3 parcial (`TF_STATE_*`);
3. roda `import.sh` (importa namespace/recursos que já existem no cluster);
4. `plan` + `apply` com `terraform_vars` e `terraform_secret_vars` do
   `.github/workflows/deploy-production.yml`.

## Variáveis e secrets

| Var Terraform | Origem | Vai para |
|---|---|---|
| `kubernetes_namespace`, `environment`, `image_tag` | `terraform_vars` (`$NS`, `$ENVIRONMENT`, `$IMAGE_TAG`) | módulo |
| `auth_provider` / `billing_provider` / `messaging_provider` | `terraform_vars` (`conexus`) | `AUTH_PROVIDER`… |
| `database_host/port/username/password/name` | secrets `TF_VAR_DATABASE_HOST` … `TF_VAR_DATABASE_NAME` | `DATABASE_*` |
| `conexus_api_webhook_secret` | secret `CONEXUS_API_WEBHOOK_SECRET` | `CONEXUS_API_WEBHOOK_SECRET` |
| `conexus_webhook_secret` | secret `CONEXUS_WEBHOOK_SECRET` | `CONEXUS_WEBHOOK_SECRET` |
| `secret_key_base` | secret `SECRET_KEY_BASE` | `SECRET_KEY_BASE` |
| `admin_notify_emails` | secret `ADMIN_NOTIFY_EMAILS` | `ADMIN_NOTIFY_EMAILS` |
| `conexus_auth_client_id`, `conexus_auth_allowed_audiences` | default `mugen-arena` | `CONEXUS_AUTH_*` |
| `conexus_auth_issuer` | default vazio (= `CONEXUS_AUTH_URL`) | `CONEXUS_AUTH_ISSUER` |
| `admin_groups`, `rated_room_matches`, `pack_max_bytes`, `cors_origins`, `solid_cable_polling_interval` | defaults em `variables.tf` | `ADMIN_GROUPS`, `RATED_ROOM_MATCHES`, `PACK_MAX_BYTES`, `CORS_ORIGINS`, `SOLID_CABLE_POLLING_INTERVAL` |

O módulo grava sozinho `SOLID_QUEUE_IN_PUMA=true`, `JOB_THREADS`, `JOB_POLLING_INTERVAL`,
`DATABASE_IDLE_TIMEOUT`, `DATABASE_REAPING_FREQUENCY`, `PGSSLMODE=require`, URLs dos BFFs e
`CONEXUS_PRODUCT_SLUG=mugen-arena`.

Secrets de org/repo que o reusable também usa: `KUBE_CONFIG_B64`, `GHCR_USERNAME`,
`GHCR_PULL_TOKEN`, `TF_STATE_BUCKET`, `TF_STATE_ENDPOINT`, `TF_STATE_ACCESS_KEY`,
`TF_STATE_SECRET_KEY` (state em `mugen-arena/linode/terraform.tfstate`).

Mudou uma var não-secreta? Edite o default aqui ou acrescente `chave=valor` em
`terraform_vars` — toda var passada pelo workflow precisa estar declarada em `variables.tf`.

## Checagem local (sem apply)

```bash
terraform fmt -check -recursive
terraform init -backend=false && terraform validate
```
