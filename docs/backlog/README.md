# Backlog — Fases 0 a 3

Dono: PO. Formato de cada tarefa: [templates/TASK.md](../../templates/TASK.md). Um arquivo por épico; as
tarefas usam o ID `F<fase>-<épico>.<n>`.

Prioridade (agents/po.md): estabilidade da luta e do online > justiça (jogo pago, nada à venda dentro do app) > personagens e
modos novos.

Base: [ROADMAP](../ROADMAP.md), [GDD](../gdd/GDD.md), [elenco](../gdd/ELENCO_LANCAMENTO.md),
[brief de arte](../art/BRIEF_TESTES_DE_ESTILO.md), [nomes](../brand/NOMES.md).

**Papéis:** po, tech-lead, engine, netcode, mobile-ux, web, qa, security-devops (agentes) e, humanos: dono do
projeto, diretor de arte, designer de combate, estúdio terceirizado, jurídico, áudio, consultoria cultural.

Status: TODO | IN_PROGRESS | REVIEW | BLOCKED | DONE | CANCELADO. Os épicos em IN_PROGRESS estão sendo feitos agora
por agentes; algumas tarefas dentro deles ainda são TODO.

## Índice

| Épico | Fase | Dono | Status |
|---|---|---|---|
| [F0-01 Marca e nome](F0-01-marca.md) | 0 | po + jurídico | TODO |
| [F0-02 Equipe e contratos](F0-02-equipe-e-contratos.md) | 0 | dono do projeto | TODO |
| [F0-03 Testes de estilo](F0-03-testes-de-estilo.md) | 0 | diretor de arte | TODO |
| [F0-04 Ferramentas (frame data, importador, hitbox)](F0-04-ferramentas.md) | 0 | tech-lead / engine | **IN_PROGRESS** |
| [F0-05 Telemetria, crash, desempenho, lab](F0-05-telemetria-crash-perf.md) | 0 | security-devops | **IN_PROGRESS** |
| [F0-06 Repositório e build em aparelho](F0-06-repositorio-e-build.md) | 0 | security-devops | TODO |
| [F0-07 Design e backlog](F0-07-design-e-backlog.md) | 0 | po | REVIEW |
| [F1-01 Game feel](F1-01-game-feel.md) | 1 | engine | **IN_PROGRESS** |
| [F1-02 Sistema de combate v1](F1-02-sistema-de-combate.md) | 1 | designer de combate | TODO |
| [F1-03 Controles touch](F1-03-controles-touch.md) | 1 | mobile-ux | **IN_PROGRESS** |
| [F1-04 Lutadores da fatia (Kaze, Brasa)](F1-04-lutadores-fatia.md) | 1 | diretor de arte + designer de combate | TODO |
| [F1-05 Cenário da fatia (Pelourinho)](F1-05-cenario-fatia.md) | 1 | diretor de arte | TODO |
| [F1-06 Áudio da fatia](F1-06-audio-fatia.md) | 1 | áudio | TODO |
| [F1-07 Tutorial e HUD](F1-07-tutorial-e-hud.md) | 1 | mobile-ux | TODO |
| [F1-08 Playtests e portão](F1-08-playtest-e-portao.md) | 1 | po | TODO |
| [F2-01 Produção dos 6 lutadores](F2-01-producao-elenco.md) | 2 | diretor de arte + designer de combate | TODO |
| [F2-02 Cenários](F2-02-cenarios.md) | 2 | diretor de arte | TODO |
| [F2-03 Arcade com história](F2-03-arcade-historia.md) | 2 | po | TODO |
| [F2-04 IA da CPU](F2-04-ia-cpu.md) | 2 | engine | TODO |
| [F2-05 Balanceamento](F2-05-balanceamento.md) | 2 | designer de combate | TODO |
| [F2-06 Modos offline](F2-06-modos-offline.md) | 2 | mobile-ux | TODO |
| [F2-07 Localização e acessibilidade](F2-07-localizacao-acessibilidade.md) | 2 | mobile-ux | TODO |
| [F2-08 Tamanho e desempenho](F2-08-tamanho-e-desempenho.md) | 2 | tech-lead | TODO |
| [F3-01 Online robusto](F3-01-online.md) | 3 | netcode | **IN_PROGRESS** |
| [F3-02 Licença e venda (jogo pago)](F3-02-licenca-e-venda.md) | 3 | po | **IN_PROGRESS** (licença no código: DONE) |
| [F3-03 Passe de temporada](F3-03-passe-de-temporada.md) | 3 | po | CANCELADO — jogo pago, sem passe |
| [F3-04 Anúncios só com recompensa](F3-04-anuncios-recompensados.md) | 3 | mobile-ux | CANCELADO — jogo pago, sem anúncios |
| [F3-05 Conta e progresso](F3-05-conta-e-progresso.md) | 3 | web | TODO |
| [F3-06 Privacidade e lojas](F3-06-privacidade-e-lojas.md) | 3 | security-devops | TODO |
| [F3-07 Missões e eventos](F3-07-missoes-e-eventos.md) | 3 | po | TODO |

## Quadros por fase

### Fase 0 — Fundação (nov/2026)

| TODO | IN_PROGRESS | REVIEW | DONE |
|---|---|---|---|
| F0-01 Marca e nome | F0-04 Ferramentas | F0-07 Design e backlog | — |
| F0-02 Equipe e contratos | F0-05 Telemetria, crash, desempenho, lab | | |
| F0-03 Testes de estilo | | | |
| F0-06 Repositório e build | | | |

Caminho crítico: F0-02 (diretor de arte, designer de combate, estúdios) → F0-03 (testes) → decisão de estilo →
F1-04. Sem as contratações humanas, a Fase 1 não começa em dezembro.

### Fase 1 — Fatia vertical (dez/2026 – fev/2027)

| TODO | IN_PROGRESS | REVIEW | DONE |
|---|---|---|---|
| F1-02 Sistema de combate v1 | F1-01 Game feel | — | — |
| F1-04 Kaze e Brasa | F1-03 Controles touch | | |
| F1-05 Pelourinho | | | |
| F1-06 Áudio | | | |
| F1-07 Tutorial e HUD | | | |
| F1-08 Playtests e portão | | | |

Caminho crítico: F0-03.4 → F1-04.1 → F1-04.2 (estúdio) → F1-04.3 (designer de combate) → F1-08.

### Fase 2 — Elenco (mar – ago/2027)

| TODO | IN_PROGRESS | REVIEW | DONE |
|---|---|---|---|
| F2-01 Produção dos 6 lutadores | — | — | — |
| F2-02 Cenários | | | |
| F2-03 Arcade com história | | | |
| F2-04 IA da CPU | | | |
| F2-05 Balanceamento | | | |
| F2-06 Modos offline | | | |
| F2-07 Localização e acessibilidade | | | |
| F2-08 Tamanho e desempenho | | | |

Caminho crítico: F1-08.2 (go) → F2-01 (6 lutadores em 6 meses: o maior risco do roadmap).

### Fase 3 — Online e venda (mai – ago/2027, em paralelo à Fase 2)

| TODO | IN_PROGRESS | REVIEW | DONE | CANCELADO |
|---|---|---|---|---|
| F3-05 Conta e progresso | F3-01 Online robusto | — | F3-02.1 Licença Play Integrity (código) | F3-03 Passe de temporada |
| F3-06 Privacidade e lojas | F3-02 Licença e venda | | | F3-04 Anúncios só com recompensa |
| F3-07 Missões e eventos | | | | |

Caminho crítico: F3-02.2 (Play Integrity e conta de serviço configurados) → F3-02.3 (teste interno com licenças
de teste) → F3-02.4/F3-02.5 (preço e página da loja) → soft launch. O F3-01 começou cedo de propósito:
determinismo entre aparelhos é risco técnico alto.

O jogo é pago (compra única de R$ 49,99 na Google Play): sem loja, moedas, passe, anúncios ou compras no app.
F3-03 e F3-04 foram cancelados e o antigo F3-02 "Economia e loja" virou "Licença e venda".

## Decisões humanas pendentes que travam o backlog

| Decisão | Quem | Trava |
|---|---|---|
| Nome do jogo | dono do projeto + jurídico | F0-01.4 (identificadores do app), F0-01.5 |
| Estilo de arte | diretor de arte + designer de combate + dono do projeto | F1-04, F1-05, F1-07.3 |
| Elenco de 8 e fatia (Kaze + Brasa) | dono do projeto | F1-04, F2-01 |
| ~~Modelo de venda~~ — **decidido (out/2026):** jogo pago, R$ 49,99, sem anúncios nem compras no app | dono do projeto | — |
| DLC opcional de personagens/cenários depois do lançamento (só se a comunidade aceitar) | dono do projeto | nada agora |
| Checagem de compra no iOS | dono do projeto + security-devops | F3-02.6 |
| Catálogo de personagens da comunidade na versão comercial | dono do projeto | escopo da Fase 3 |
| Contratações | dono do projeto | quase tudo da Fase 1 |
