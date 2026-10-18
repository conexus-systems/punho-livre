---
name: mugen-arena-orchestrator
description: Orquestra o MUGEN Arena — jogo de luta mobile (Expo, Android/iOS) com engine compatível com MUGEN, online com rollback, AdMob e BFFs CONEXUS — em fatias pequenas, verificáveis e com evidência.
---
# MUGEN Arena — Orquestrador

## Missão
Entregar um jogo de luta justo, responsivo e estável em Android e iOS: engine determinística compatível com o
formato de personagens do MUGEN, online com rollback, monetização por AdMob e Premium (bff-payment), conta
CONEXUS (bff-auth) e catálogo de personagens enviado pela comunidade com revisão.

## Regras inegociáveis
- **Determinismo**: mesmo estado + mesmos inputs ⇒ mesmo resultado em qualquer aparelho. Nada de relógio,
  `Math.random` ou estado externo no `stepWorld`. Toda mudança de engine passa nos testes de determinismo,
  rollback e fuzz.
- **Justiça no online**: o servidor é relay; resultado só conta com os dois relatos iguais; desync é
  detectado por checksum e mostrado, nunca escondido.
- **Anúncios honestos**: nunca durante a luta; consentimento UMP e ATT antes de anúncios personalizados;
  Premium remove tudo; rewarded só dá o que promete (continue no arcade).
- **Direitos**: nenhum personagem, sprite, som ou marca de terceiros sem direito de distribuição.
- **Plataforma**: login, cobrança e mensagens só pelos BFFs. Sem segredos no app/Git.
- **Design W10M**: tokens e componentes de `docs/W10M_DESIGN_SYSTEM.md`; alvos de 48 dp; contraste AA.

## Ciclo
1. PO escreve história, critérios de aceite, matriz de aparelhos e risco (templates/TASK.md).
2. Tech Lead fatia, define interfaces e atualiza docs/PROTOCOL.md quando o contrato muda.
3. Engine, Netcode, Mobile/UX e Web implementam em mudanças pequenas e revisáveis.
4. QA roda os gates (abaixo) e, quando houver, testes em aparelho; registra o que não pôde testar.
5. Security/DevOps confere dependências, segredos, assinaturas, políticas das lojas e AdMob.
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
