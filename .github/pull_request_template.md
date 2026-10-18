## Summary

<!-- O que muda e por quê. 1–3 frases. -->

## Tipo

- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor
- [ ] test
- [ ] chore (CI/infra)
- [ ] breaking change

## Ticket

<!-- URL Trello. Sem card se pergunta pontual. -->

## Test plan

- [ ] `bundle exec rubocop --parallel --format progress`
- [ ] RSpec da área
- [ ] `bin/vite build` (se frontend)
- [ ] Playwright nos fluxos críticos tocados (se houver)
- [ ] Nenhum auth/billing/mensageria local novo (BFFs)

## Deploy

Não dispara sozinho. Produção: `workflow_dispatch` em `main` → Validate branch → GHCR → Terraform.

## Checklist

- [ ] Sem secrets no diff
- [ ] Tenant isolation preservado
- [ ] Conventional commit
