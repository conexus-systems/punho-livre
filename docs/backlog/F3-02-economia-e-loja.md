# F3-02 — Economia e loja

Fase: 3 — Online e economia. Status do épico: **TODO**.
Dono do épico: po. Executores: web, mobile-ux, security-devops. Humanos: jurídico, dono do projeto.
Objetivo: loja justa ([GDD seção 5](../gdd/GDD.md#5-progressão-e-economia)): vende lutador, skin, cor e passe;
nada que dê vantagem.

---

## F3-02.1 — Modelo de economia
Owner: po; aprovado pelo dono do projeto
Objective: quanto se ganha de Moedas por partida/missão/nível, preço em Moedas de cada item, tempo para liberar um lutador novo sem pagar (proposta: 10–15 h de jogo normal, a validar).
Dependencies: F0-07.1
Files in scope: docs/gdd/ECONOMIA.md (novo)
Acceptance criteria: planilha com simulação de jogador casual, médio e intenso; decisão sobre moeda premium (recomendação: não ter).
Tests required: n/a
Metrics/baseline: n/a (validar no soft launch)
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum item com efeito na luta
Evidence (commands/logs/devices): planilha
Status: TODO

## F3-02.2 — Cobrança pela loja e política de compras digitais
Owner: security-devops + jurídico (humano)
Objective: confirmar como compras de itens digitais passam pelo sistema de cobrança das lojas (Google Play Billing, App Store) integrado ao bff-payment, e o que muda no checkout web atual.
Dependencies: nenhuma
Files in scope: mobile/src/services/payments.ts, web/ (webhook entitlement.changed), docs/PROTOCOL.md
Acceptance criteria: parecer escrito; se o bff-payment não suportar cobrança das lojas, tarefa aberta para a equipe da plataforma CONEXUS (fora deste repositório).
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: risco de rejeição nas lojas
Evidence (commands/logs/devices): parecer
Status: TODO

## F3-02.3 — Inventário e direitos na conta
Owner: web
Objective: o que o jogador tem (lutadores, cores, skins, passe) fica na conta, vindo dos entitlements do bff-payment e das Moedas do backend.
Dependencies: F3-02.1, F3-02.2, F3-05.1
Files in scope: web/, docs/PROTOCOL.md
Acceptance criteria: Moedas só mudam no servidor; histórico de transações; restaurar compras.
Tests required: specs (crédito, débito, idempotência, restaurar)
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: o oponente online vê a skin do outro, mas a skin não muda a simulação
Evidence (commands/logs/devices): specs
Status: TODO

## F3-02.4 — Tela da loja
Owner: mobile-ux
Objective: loja W10M com preço claro (moeda local ou Moedas), prévia do item em luta, confirmação de compra.
Dependencies: F3-02.3
Files in scope: mobile/app/ (substitui ou incorpora `paywall.tsx`)
Acceptance criteria: sem contador falso, sem "oferta" que não acaba; prévia de skin na luta; controle parental respeitado.
Tests required: testes de tela; compra de teste nas duas lojas
Metrics/baseline: conversão (soft launch)
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): capturas; compra de teste
Status: TODO
