# F3-02 — Licença e venda (jogo pago)

Fase: 3 — Online e venda. Status do épico: **IN_PROGRESS**.
Dono do épico: po. Executores: web, mobile-ux, security-devops. Humanos: dono do projeto (Play Console), jurídico.
Objetivo: vender o jogo por **R$ 49,99** na Google Play (compra única, [GDD § 5](../gdd/GDD.md#5-progressão-e-modelo-de-venda)),
sem anúncios e sem compras no app, e garantir que só cópias compradas entram no online. O offline nunca depende de
licença.

Substitui o antigo F3-02 "Economia e loja" (cancelado com F3-03 e F3-04 quando o dono do projeto decidiu pelo jogo
pago; histórico no Git).

---

## F3-02.1 — Licença do online pelo Play Integrity
Owner: web + mobile-ux
Objective: o app pede um desafio, chama o Play Integrity com SHA-256(nonce) e o servidor confere `PLAY_RECOGNIZED` + `LICENSED` + `MEETS_DEVICE_INTEGRITY`, gravando `players.licensed_until` = agora + 7 dias; a fila e as salas recusam `license_required` sem licença válida.
Dependencies: nenhuma
Files in scope: web/app/services/integrity/, web/app/controllers/api/v1/license_controller.rb, web/app/services/matchmaking/queue.rb, mobile/src/services/license.ts, mobile/src/net/online.ts, docs/PROTOCOL.md (§ Licença)
Acceptance criteria: contrato em docs/PROTOCOL.md; offline sem chamada de licença; `PLAY_INTEGRITY_REQUIRED` desligado = todos licenciados (dev, testes, web); mensagens claras para cada motivo de recusa.
Tests required: web/spec/services/integrity/license_spec.rb, web/spec/requests/api/v1/license_spec.rb, web/spec/channels/matchmaking_channel_spec.rb, mobile/src/services/__tests__/license.test.ts
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: licença — só o online; o token do Play Integrity não é guardado
Evidence (commands/logs/devices): specs e testes do app; falta teste em aparelho (F3-02.3)
Status: DONE (código); configuração e teste real em F3-02.2 e F3-02.3

## F3-02.2 — Configurar Play Integrity e servidor
Owner: security-devops + dono do projeto (humano, Play Console)
Objective: ativar a Play Integrity API no Play Console e ligar o projeto do Google Cloud; criar a conta de serviço com acesso à API; configurar `PLAY_INTEGRITY_SERVICE_ACCOUNT` (cofre), `PLAY_INTEGRITY_PACKAGE` e `PLAY_INTEGRITY_REQUIRED=1` no servidor e `EXPO_PUBLIC_PLAY_CLOUD_PROJECT` no build.
Dependencies: F3-02.1, F0-01.4 (pacote definitivo), F0-06.2
Files in scope: web/.env.example, mobile/.env.example, deploy/, web/README.md
Acceptance criteria: variáveis documentadas nos `.env.example` e no deploy (hoje ainda não estão); segredo só no cofre; `POST /api/v1/license/verify` responde 200 com um testador de licença.
Tests required: chamada real em staging
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: licença; segredo novo (chave da conta de serviço)
Evidence (commands/logs/devices): log do verify em staging
Status: TODO

## F3-02.3 — Teste em aparelho: faixa de teste interno e licenças de teste
Owner: qa + dono do projeto (humano)
Objective: publicar na faixa de teste interno e testar com contas de teste de licença do Play Console: cópia comprada entra no online; cópia instalada fora da Play recebe `unrecognized_app`/`not_licensed` só no online; offline funciona nos dois; renovação antes de vencer.
Dependencies: F3-02.2
Files in scope: docs/DEVICE_LAB.md
Acceptance criteria: os casos acima registrados no lab, com aparelho e versão; nenhuma trava no offline.
Tests required: roteiro manual no lab
Metrics/baseline: % de falhas de verificação (`license_unavailable`, `device_integrity`) em teste
Impacto em determinismo, justiça online, privacidade ou licença: licença
Evidence (commands/logs/devices): capturas e logs do lab
Status: TODO

## F3-02.4 — Preço, país e perfil de pagamentos
Owner: dono do projeto (humano) + po
Objective: perfil de pagamentos/comerciante ativo; app criado como **pago**; R$ 49,99 no Brasil; preço por país (revisar países da América Latina com poder de compra menor).
Dependencies: F0-01 (nome), F3-06
Files in scope: mobile/PLAY_LISTING.md
Acceptance criteria: preços cadastrados e revisados; decisão sobre preço de lançamento registrada.
Tests required: n/a
Metrics/baseline: vendas e conversão da página da loja (soft launch)
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): captura da tabela de preços
Status: TODO

## F3-02.5 — Página da loja
Owner: po + mobile-ux; diretor de arte para capturas e vídeo
Objective: ficha honesta para app pago: o que vem incluso, "sem anúncios e sem compras no app", capturas e vídeo do jogo real, Segurança dos dados e classificação.
Dependencies: F3-06.2, F3-06.3, arte final (F2)
Files in scope: mobile/PLAY_LISTING.md
Acceptance criteria: textos aprovados; vídeo de 30 s de luta real; feature graphic.
Tests required: n/a
Metrics/baseline: conversão da página da loja; taxa de reembolso ≤ 10% (meta)
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): ficha publicada no teste interno
Status: TODO

## F3-02.6 — iOS
Owner: security-devops + po
Objective: decidir como (e se) o online confere compra no iOS; hoje não há checagem (App Attest prova app genuíno, não compra).
Dependencies: decisão de lançar no iOS
Files in scope: mobile/src/services/license.ts, docs/PROTOCOL.md
Acceptance criteria: decisão escrita; se houver checagem, contrato novo no PROTOCOL.
Tests required: conforme a decisão
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: licença
Evidence (commands/logs/devices): decisão registrada
Status: TODO
