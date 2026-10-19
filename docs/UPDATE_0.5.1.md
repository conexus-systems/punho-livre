# BAMBA 0.5.1 — o jogo ganha nome

O jogo deixa de se chamar "MUGEN Arena" e passa a se chamar **BAMBA** — no Brasil, quem é mestre no que
faz (o bamba da roda) e também o valentão. "MUGEN" é o nome do software da Elecbyte, de uso não comercial;
um jogo pago na Google Play não pode carregar essa marca. A compatibilidade com personagens no formato do
MUGEN continua (é descrição de formato, não nome do produto).

## O que mudou

- **App:** nome na loja e na tela inicial, `slug` (`bamba`), pacote Android e bundle iOS
  `br.com.conexus.bamba`, esquema de deep link e redirect do login (`br.com.conexus.bamba://oauth/callback`).
- **Versão web, editor de hitbox, e-mails do servidor, cabeçalhos dos personagens gerados** e a documentação
  atual (as notas das versões anteriores ficam como eram).
- **Licença da Play:** `PLAY_INTEGRITY_PACKAGE` padrão passa a `br.com.conexus.bamba` (servidor e Terraform).
- Identificadores técnicos invisíveis ao jogador (chaves de armazenamento, formato `mugen-arena-pack/1`,
  domínio da API, client_id do login, nomes de banco e de infra) **não mudaram** — a lista e o motivo estão em
  `docs/brand/NOMES.md`.

## Precisa de uma pessoa

1. **INPI:** busca de anterioridade (classes 9 e 41) e depósito do pedido de BAMBA antes de divulgar.
2. **bff-auth:** registrar o redirect novo no cliente `mugen-arena-mobile` — sem isso o login falha.
3. **Play Console / App Store Connect:** criar o app com o pacote novo; **EAS:** projeto com slug `bamba`.

## Verificação

- `npm run test:ci` (242 testes jest, ferramentas, elenco atualizado), `npx tsc --noEmit`.
- Web: `bundle exec rspec` 158 exemplos sem falha, `rubocop` limpo.
