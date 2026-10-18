# MUGEN Arena — orientação para continuidade

Leia HANDOFF.md, docs/UPDATE_0.1.0.md, docs/W10M_DESIGN_SYSTEM.md, docs/PROTOCOL.md, docs/CHARACTERS.md e
CONEXUS.md antes de alterar comportamento. O fluxo de trabalho com agentes está em SKILL.md (+ agents/*.md,
templates/TASK.md).

- Stack: app **Expo/React Native** em `mobile/` (Android e iOS), Rails 8 API em `web/`, Terraform LKE em
  `deploy/terraform/linode`, CI/deploy pelos workflows reutilizáveis do `conexus-systems/platform-infra`.
  Visual = **design system W10M** (mesmo do conexus-launcher e do multi-miner), portado para RN em
  `mobile/src/ui/` (tokens) e `mobile/components/metro/` (componentes). Nenhuma tela define cor, tamanho de
  fonte, raio ou duração própria: usa os tokens. Plano e quadrado; sem cápsulas, cantos arredondados,
  sombras ou gradientes nos menus (o canvas da luta é exceção: é o jogo).
- Engine: `mobile/src/engine/` é **determinística** (rollback online depende disso). Nada de `Math.random`,
  relógio ou estado fora de `WorldState` dentro do `stepWorld`. Toda mudança de engine roda
  `npm test` (inclui determinismo, clone/rollback e 3000 frames de fuzz por personagem).
- Elenco nativo: gerado por `npm run roster` (scripts/roster, pintado com Skia em `paint.mjs`); cenários por `npm run stages` (scripts/stages). Nunca edite `mobile/characters/*`, `mobile/assets/stages/*`, `builtin.generated.ts` ou `stages.generated.ts` à mão; o `test:ci` falha se o elenco estiver desatualizado.
- Contrato app ⇄ web: `docs/PROTOCOL.md`. Mudou lá, muda nos dois lados no mesmo PR.
- BFFs: identidade (bff-auth), cobrança (bff-payment) e mensagens (bff-api) **não** são implementadas aqui.
  Sem Devise/OmniAuth, SDK de pagamento, Resend/Twilio. Sem segredos no app ou no Git.
- Não invente endpoints, resultados de teste, paridade com o MUGEN ou métricas de aparelho. Diferencie
  implementado, verificado por teste e pendente (teste em aparelho ainda pendente).
- Personagens de terceiros: só os que o autor tem direito de distribuir. O app não traz personagens com IP alheio.
- Comandos de verificação:
  - mobile: `npm run test:ci` (jest + ferramentas + elenco atualizado), `npx tsc --noEmit`,
    `npx expo export --platform android` (o mesmo do `ci-mobile.yml@v1`).
  - web: `bundle exec rspec`, `bundle exec rubocop`, `bin/brakeman -q --no-pager`.
- Toda entrega termina com versão nova em `mobile/app.config.ts` + `mobile/package.json`,
  `docs/UPDATE_X.Y.Z.md`, tag `vX.Y.Z` e a release gerada pelo workflow `github-release.yml` (APK via EAS).
  Confira a release antes de avisar.
