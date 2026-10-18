# Padrão CONEXUS — MUGEN Arena

- App mobile Expo em `mobile/` (base: template `conexus-app`).
- Backend consumidor Rails em `backend/` (base: `conexus-bff-stack`; gem `conexus-platform` vendorizada).
- BFFs live (não fork): `bff-auth`, `bff-payment`, `bff-api`.
- CI/K8s: `conexus-systems/platform-infra` (`scripts/bootstrap-app.sh mugen-arena --slug mugen-arena`).
- Não reimplementar login, cobrança ou mensagem no produto.
- AdMob permitido (jogo; não é app de saúde). Premium remove anúncios.
- Contrato app ⇄ backend: `docs/PROTOCOL.md`.
