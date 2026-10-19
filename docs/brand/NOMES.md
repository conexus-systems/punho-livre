# Nome do jogo — candidatos

## Decisão: **BAMBA** (19/10/2026)

O dono do projeto escolheu **BAMBA**. O nome já foi trocado no app (nome na loja e na tela, `slug`,
pacote Android e bundle iOS `br.com.conexus.bamba`, esquema de deep link), na versão web, nos e-mails
e na documentação. **O registro no INPI ainda não foi feito** — a busca de anterioridade e o depósito
continuam pendentes (abaixo), e precisam acontecer antes de qualquer divulgação.

### O que mudou por fora do código (precisa de uma pessoa)

- **bff-auth:** registrar o redirect `br.com.conexus.bamba://oauth/callback` no cliente
  `mugen-arena-mobile`. Sem isso o login no app novo falha.
- **Play Console / App Store Connect:** criar o app com o pacote `br.com.conexus.bamba` (o antigo nunca foi
  publicado).
- **EAS:** o `slug` virou `bamba`; o projeto do EAS precisa ter o mesmo slug (`EAS_PROJECT_ID`).
- **Play Integrity:** `PLAY_INTEGRITY_PACKAGE` passou a `br.com.conexus.bamba` (padrão no servidor e no
  Terraform).

### O que ficou com o nome antigo de propósito (identificadores técnicos, invisíveis ao jogador)

Trocar estes quebraria dados ou integrações sem ganho para o jogador; mudam só se houver migração planejada:

| Identificador | Onde | Por que ficou |
|---|---|---|
| `mugen-arena.*` | chaves do AsyncStorage/localStorage | trocar apagaria ajustes, sessão e personagens instalados |
| `mugen-arena-pack/1` | formato dos packs (app, servidor, ferramentas) | contrato do docs/PROTOCOL.md; packs já enviados |
| `mugen-arena-mobile` | client_id no bff-auth | registrado na plataforma CONEXUS |
| `mugen-arena.conexus-systems.com.br` | domínio da API | DNS e certificado; troca é decisão de infra |
| `MugenArena`, `mugen_arena_*`, nomes no Terraform/k8s | módulo Rails, bancos, recursos de infra | renomear exige migração de banco e de cluster |
| `mugen-arena-admin` (`ADMIN_GROUPS`) | grupo de admin | configurado no bff-auth |

## Histórico da escolha

Status original: proposta do PO. **Nenhum nome foi registrado nem verificado juridicamente.**

> **A disponibilidade no INPI, no USPTO, nas lojas (Google Play e App Store), nas redes sociais e em
> domínios NÃO foi verificada.** A checagem abaixo é só uma busca preliminar na web por jogos com o mesmo
> nome. Antes de escolher, uma pessoa (de preferência o jurídico) precisa verificar marca nas classes 9
> (software, jogos baixáveis) e 41 (entretenimento, jogos online) no INPI, no USPTO e no EUIPO, nas lojas,
> nas redes e nos domínios.

## Por que trocar

"MUGEN" é o nome do software da Elecbyte, de uso não comercial. Usar o nome num jogo pago (o jogo será vendido
na Google Play) pode gerar confusão de marca e associa o jogo a coleções com personagens de terceiros. A troca precisa
acontecer **antes da primeira publicação em loja**, porque o identificador do app
(`br.com.conexus.mugenarena`) não muda depois de publicado.

## Critérios

- Curto (1 palavra, até 7 letras de preferência).
- Pronunciável e com sentido bom ou neutro em português, espanhol e inglês.
- Sem "MUGEN" e sem lembrar nomes de jogos de luta conhecidos.
- Com cara de luta e, se possível, de Brasil e América Latina.
- Fácil de buscar na loja (sem ser palavra tão comum que some nos resultados).

## Candidatos

| # | Nome | Sentido | Racional | Checagem preliminar (web, 18/10/2026) |
|---|---|---|---|---|
| 1 | **BAMBA** | No Brasil, "bamba" é quem é mestre no que faz (bamba do samba, da roda) e também o valentão | Curto, sonoro, brasileiro, fácil de dizer em ES e EN; combina com "o melhor da quebrada" | Nenhum jogo de luta com esse nome encontrado. Atenção (conhecimento geral, não veio da busca): "Bamba" é marca de salgadinho em Israel (outra classe, mas checar) |
| 2 | **EMBATE** | "Confronto" em PT e em ES | Mesmo sentido nas duas línguas do soft launch; pronunciável em EN | Nenhum jogo com esse nome encontrado |
| 3 | **GINGA** | Movimento base da capoeira; "jeito, malandragem" | Identidade forte, liga ao Brasa e ao Brasil | Há um jogo de game jam "Ginga" (HTML5, itch.io) e páginas de apostas com o nome; "Ginga" também é o middleware da TV digital brasileira (conhecimento geral). Risco médio de busca poluída |
| 4 | **GARRA** | "Garra" (raça, determinação) em PT e ES; "garra" = unha de felino | Forte e curto | Nenhum jogo encontrado, mas o som lembra o título de um jogo de luta da SNK. Risco de associação — avaliar |
| 5 | **BRAVA** | "Brava": corajosa, feroz (PT, ES, IT) | Sonoro, fácil em EN | Nenhum jogo com o nome; existe "Bravada" (RPG) e um jogo de luta brasileiro com "Bravery" no nome; "Brava" é personagem de um jogo de tiro. Risco de confusão |
| 6 | **BRIO** | Garra, ânimo (PT, ES) | Curto, positivo | Nenhum jogo de luta; "BRIO" é marca conhecida de brinquedos (trens de madeira) com apps infantis. Risco alto na classe 9 |
| 7 | **RODA** | A roda de capoeira | Liga ao tema; curto | Existe "Roda de Capoeira" (jogo de ritmo, itch.io). Em ES, "roda" é verbo ("rola"); sentido fraco fora do Brasil |
| 8 | **CHOQUE** | "Choque" em PT e ES; "shock" | Ideia de impacto, igual em PT/ES | Nenhum jogo encontrado; palavra muito comum, busca na loja difícil |
| 9 | **TORMENTA** | Tempestade (PT, ES) | Épico, pronunciável em EN | "Tormenta" é uma franquia brasileira de RPG de mesa conhecida, com jogos digitais; existem "Tormenture" e "Tormentis" no Steam. Risco alto |
| 10 | **TRETA** | Gíria brasileira para briga | Muito brasileiro, divertido | "TRETA Championship" é uma organização brasileira de torneios de jogos de luta. Risco altíssimo de confusão no mesmo nicho — **não recomendado** |

### Favoritos do PO

1. **BAMBA** — o melhor equilíbrio entre identidade brasileira, som em três línguas e ausência de conflito
   óbvio na busca preliminar.
2. **EMBATE** — significado claro em PT e ES, neutro e sério; menos personalidade que BAMBA.
3. **GINGA** — a identidade mais forte, mas com busca poluída; só se a checagem jurídica for limpa.

Sugestão de subtítulo para a loja (não faz parte da marca): "Luta de rua latina" / "Lucha callejera latina" /
"Latin street fighting" — *atenção*: evitar "Street Fighter" em qualquer forma.

## Próximos passos (pessoa responsável: jurídico + dono do projeto)

1. Busca de anterioridade no INPI (classes 9 e 41) para os 3 favoritos.
2. Busca no USPTO (TESS) e no EUIPO (eSearch) para o lançamento global.
3. Busca nas lojas e nas redes sociais (nome exato e variações).
4. Domínios (.com, .com.br, .gg) e @ nas redes.
5. Teste rápido de pronúncia e lembrança com 10–20 pessoas de BR, MX/AR e EUA.
6. Depósito do pedido de registro do escolhido antes de qualquer divulgação.

## Fontes da checagem preliminar

Buscas feitas em 18/10/2026 com busca na web. Resultados listados como encontrados; ausência de resultado
**não** significa que o nome está livre.

- Roda de Capoeira (itch.io): https://hidasineto.itch.io/roda-de-capoeira
- Ginga (game jam, itch.io): https://theuzfz.itch.io/ginga
- Bravada (Steam): https://gg.deals/game/bravada/
- Pocket Bravery: https://store.playsum.live/product/fb198fa6-c57f-4882-b548-9a6a0be15bf2/pocket-bravery
- Brava (Rainbow Six Siege): https://esports.gg/news/rainbow-six-siege/brava-rainbow-six-siege
- BRIO World - Railway (app): https://appshunter.io/ios/app/1064517589
- Tormenta: O desafio dos deuses (itch.io): https://jogosdigitaisfeevale.itch.io/tormenta-o-desafio-dos-deuses
- Tormenture (Steam): https://steambase.io/games/tormenture/info
- TRETA Championship 2026: https://www.einerd.com/treta-championship-2026-torneio-jogos-luta-gratis/
- Garou: Mark of the Wolves no celular (som parecido com "Garra"): https://toucharcade.com/2024/07/30/garou-mark-of-the-wolves-aca-neogeo-mobile-download-android-iphone-controller-support
- Bamba (nome): https://en.wikipedia.org/wiki/Bamba_(name)
