# Play Console — ficha pt-BR (colar na Console)

Pacote: `br.com.conexus.bamba` · Versão: a de `mobile/app.config.ts`
Modelo: **jogo pago, compra única** — preço **R$ 49,99** (faixa de R$ 50). **Sem anúncios e sem compras no app.**
O preço é configurado no Play Console, não no código.
Categoria: Jogos › Luta. Requisitos: Android 7.0 ou mais novo (`minSdkVersion` 24 em `mobile/app.config.ts`).

> WAIT_HUMAN: criar o app na Play Console como **pago** (um app publicado como gratuito não pode virar pago
> depois — conferir antes do primeiro envio), com o perfil de pagamentos ativo.
> WAIT_HUMAN: políticas `/privacidade` e `/termos` no host público `mugen-arena.conexus-systems.com.br`
> (mencionar telemetria opcional, conta CONEXUS, verificação de compra pela Google Play e envio de personagens;
> **não** há mais anúncio nem identificador de publicidade).

## Título (máx. 30)

```
BAMBA
```

## Descrição curta (máx. 80)

```
Luta 2D completa, sem anúncios: arcade, versus, treino e online com rollback.
```

## Descrição completa (máx. 4000)

```
BAMBA é um jogo de luta 2D feito para celular. Compra única: sem anúncios, sem compras no app e
nada bloqueado atrás de pagamento.

• 6 lutadores originais, cada um com especiais e super
• Arcade, versus contra a CPU e treino com caixas de colisão
• Online ranqueado e salas com código para jogar com amigos — netcode com rollback, sem travar a luta
• Controles na tela com especiais em um toque (opcional)
• Personagens da comunidade no formato MUGEN, revisados antes de publicar — todos livres
• Visual inspirado no Windows 10 Mobile, com tema escuro/claro e cor de destaque
• Atualizações de balanceamento gratuitas

Tudo o que é desbloqueável se desbloqueia jogando. O modo offline funciona sem conta e sem internet.
A conta CONEXUS é necessária só para o online e o ranking; o online confere pela Google Play que a cópia foi
comprada.
```

## O que vem incluso pelo preço

- Elenco completo do lançamento e todos os modos offline (arcade, versus CPU, treino, e os que vierem).
- Online (ranqueada e salas) com a conta CONEXUS, enquanto o serviço existir.
- Personagens aprovados do catálogo da comunidade, sem custo.
- Atualizações gratuitas de balanceamento e correções.

Conteúdo pago futuro (DLC) **não** está prometido: é decisão em aberto (ver `docs/gdd/GDD.md` § 5).

## Segurança dos dados (formulário da Play)

| Pergunta | Resposta |
|---|---|
| Coleta ou compartilha dados? | Coleta; **não compartilha** com terceiros para publicidade (não há anúncios). |
| Identificador de publicidade | Não usa. A permissão `com.google.android.gms.permission.AD_ID` é bloqueada no manifesto. |
| Diagnóstico e uso do app | **Opcional**, só com consentimento (primeira abertura ou Ajustes › Sobre): eventos anônimos de uso, falhas e desempenho, sem ligação com conta, sem ID de aparelho (`docs/PROTOCOL.md` § Telemetria). Apagados em 90 dias. |
| Informações pessoais (nome, e-mail) | Só para quem cria/entra na conta CONEXUS, e só para o online, ranking e envio de personagens. |
| Atividade no app (partidas, rating, replays) | Ligada à conta, só para quem joga online (ranking, revisão de partida; replays sem revisão apagados em 30 dias). |
| Criptografia em trânsito | Sim (HTTPS/WSS). |
| Pedido de exclusão | Pela conta CONEXUS (WAIT_HUMAN: confirmar o caminho de exclusão no bff-auth e citar na política). |
| Verificação de compra | O token do Play Integrity vai ao nosso servidor e à API do Google só para conferir a licença do online; não é guardado. |

## Classificação etária (questionário IARC)

Violência de luta entre personagens desenhados, **sem sangue** e sem violência realista. Sem compras no app, sem
anúncios, sem apostas. Interação online entre usuários: só partidas (sem chat) — nomes de exibição são públicos no
ranking. Personagens da comunidade passam por revisão antes de publicar.

## Reembolso

A Google Play reembolsa **automaticamente** quem pedir em até **48 h** após a compra (e o jogador pode pedir pelo
próprio Play em outros casos). Consequência de produto: a **primeira sessão precisa convencer** — abrir rápido,
tutorial curto, chegar logo à primeira luta, sem crash e sem tela vazia. A taxa de reembolso é métrica de
lançamento (meta ≤ 10%, ver `docs/ROADMAP.md`).

## Recursos gráficos

| Item | Fonte |
|---|---|
| Ícone 512 | marca do app (`AppMark` em `src/ui/glyphs.tsx`) — exportar em 512×512 |
| Capturas (paisagem) | `docs/screenshots/w10m-*.png`, `luta`/`soco`/`projetil` |
| Feature graphic 1024×500 | pendente |
| Vídeo (recomendado para app pago) | pendente — 30 s de luta real, sem cortes enganosos |

## Play Console — o que configurar (WAIT_HUMAN)

1. **Perfil de pagamentos / conta de comerciante** ativo (dados fiscais e bancários) — sem isso não dá para
   publicar app pago.
2. **Preço**: R$ 49,99 no Brasil; preço por país (usar a conversão da Play como base e revisar países com poder
   de compra menor). Preço inclui impostos conforme a Play.
3. **Integridade do app → Play Integrity API**: ativar e **ligar o projeto do Google Cloud** ao app. O número do
   projeto vai em `EXPO_PUBLIC_PLAY_CLOUD_PROJECT` (build do app).
4. No Google Cloud: ativar a Play Integrity API e criar uma **conta de serviço** com acesso a ela; o JSON da chave
   vai em `PLAY_INTEGRITY_SERVICE_ACCOUNT` no servidor (segredo, nunca no Git). `PLAY_INTEGRITY_PACKAGE` =
   `br.com.conexus.bamba` e `PLAY_INTEGRITY_REQUIRED=1` em produção (`docs/PROTOCOL.md` § Licença).
5. **Teste**: faixa de **teste interno** + **testadores de licença** (Configuração › Teste de licença) para
   comprar sem cobrança e conferir `LICENSED`; testar também uma cópia instalada fora da Play (deve dar
   `unrecognized_app`/`not_licensed` só no online, com o offline funcionando).
6. Ficha da loja (textos acima), Segurança dos dados, classificação IARC, público-alvo e política de privacidade.
