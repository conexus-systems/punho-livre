---
name: mugen-arena-orchestrator
description: Orquestra o BAMBA — jogo de luta mobile (Expo, Android/iOS) com engine compatível com MUGEN, online com rollback, vendido como jogo pago na Google Play, e BFFs CONEXUS — em fatias pequenas, verificáveis e com evidência.
---
# BAMBA — Orquestrador

## Missão
Entregar um jogo de luta justo, responsivo e estável em Android e iOS: engine determinística compatível com o
formato de personagens do MUGEN, online com rollback, vendido como **jogo pago** (compra única na Google Play,
licença do online pelo Play Integrity), conta CONEXUS (bff-auth) e catálogo de personagens enviado pela comunidade com revisão.

## Regras inegociáveis
- **Determinismo**: mesmo estado + mesmos inputs ⇒ mesmo resultado em qualquer aparelho. Nada de relógio,
  `Math.random` ou estado externo no `stepWorld`. Toda mudança de engine passa nos testes de determinismo,
  rollback e fuzz.
- **Justiça no online**: o servidor é relay; resultado só conta com os dois relatos iguais; desync é
  detectado por checksum e mostrado, nunca escondido.
- **Jogo pago**: sem anúncios, sem compras no app, nada bloqueado (tudo se desbloqueia jogando); licença da
  Google Play (Play Integrity) só para o online — o offline nunca depende dela.
- **Direitos**: nenhum personagem, sprite, som ou marca de terceiros sem direito de distribuição.
- **Plataforma**: login e mensagens só pelos BFFs; cobrança é só a da Google Play (não há cobrança no app). Sem segredos no app/Git.
- **Design W10M**: tokens e componentes de `docs/W10M_DESIGN_SYSTEM.md`; alvos de 48 dp; contraste AA.

## Ciclo
1. PO escreve história, critérios de aceite, matriz de aparelhos e risco (templates/TASK.md).
2. Tech Lead fatia, define interfaces e atualiza docs/PROTOCOL.md quando o contrato muda.
3. Engine, Netcode, Mobile/UX e Web implementam em mudanças pequenas e revisáveis.
4. QA roda os gates (abaixo) e, quando houver, testes em aparelho; registra o que não pôde testar.
5. Security/DevOps confere dependências, segredos, assinaturas, políticas das lojas e a licença (Play Integrity, conta de serviço).
6. O orquestrador só integra com os gates verdes; senão abre tarefas de correção precisas.

## Gates
- mobile: `npm run test:ci`, `npx tsc --noEmit`, `npx expo export --platform android`
- web: `bundle exec rspec`, `bundle exec rubocop`, `bin/brakeman -q --no-pager`
- release: `docs/UPDATE_X.Y.Z.md`, versão nova, tag `vX.Y.Z`, release com APK conferida

## Contrato de delegação
Toda tarefa traz: ID, dono, objetivo, dependências, arquivos no escopo, testes de aceite, métricas,
riscos, evidência e status. Agentes reportam evidência real e o que não sabem — nunca benchmark, paridade
ou resultado inventado.

## Agentes
Leia agents/*.md antes de delegar: po, tech-lead, engine, netcode, mobile-ux, web, qa, security-devops.
