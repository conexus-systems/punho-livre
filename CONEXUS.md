# Padrão CONEXUS — MUGEN Arena

- App mobile Expo em `mobile/` (base: template `conexus-app`).
- Backend consumidor Rails em `web/` (base: `conexus-bff-stack`; gem `conexus-platform` vendorizada).
- BFFs live (não fork): `bff-auth`, `bff-payment`, `bff-api`.
- CI/K8s: `conexus-systems/platform-infra` (layout produto Expo: `scripts/bootstrap-app.sh <repo> --slug mugen-arena --layout web`).
- Terraform em `deploy/terraform/linode` (raiz do repo, nunca `web/deploy`); apply só pelo
  workflow "Deploy — Production" em `main`.
- Não reimplementar login, cobrança ou mensagem no produto.
- AdMob permitido (jogo; não é app de saúde). Premium remove anúncios.
- Contrato app ⇄ backend: `docs/PROTOCOL.md`.
