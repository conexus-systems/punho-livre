# Roadmap — do protótipo 0.4.0 ao jogo comercial

Nome: **BAMBA** (escolhido em 19/10/2026; registro no INPI pendente — ver
[brand/NOMES.md](brand/NOMES.md)), porque "MUGEN" é ligado ao software da Elecbyte.

Documentos relacionados: [gdd/GDD.md](gdd/GDD.md), [gdd/ELENCO_LANCAMENTO.md](gdd/ELENCO_LANCAMENTO.md),
[art/BRIEF_TESTES_DE_ESTILO.md](art/BRIEF_TESTES_DE_ESTILO.md), [backlog/README.md](backlog/README.md).

## 1. Onde estamos (0.4.0)

- Engine própria, determinística, compatível com um subconjunto do formato MUGEN, com sistema estilo SNK
  (4 botões, MAX, rolamento, blowback, Just Defend, guard crush, equipes 3×3).
- Online com rollback (relay no Rails) e conta pelo bff-auth da CONEXUS.
- Desde a 0.5.0: **jogo pago** — AdMob, ATT e o Premium (bff-payment) saíram do app; o online exige cópia comprada
  na Google Play (licença pelo Play Integrity, [PROTOCOL.md](PROTOCOL.md) § Licença).
- 20 lutadores com arte vetorial gerada por código, 8 cenários procedurais, som sintetizado.
- **Nada foi testado em aparelho real.** Desempenho, toque e som só foram verificados em Node e no navegador.

O protótipo prova a engine e o sistema. A arte, o elenco e o balanceamento não estão no nível de um jogo
comercial.

## 2. Decisões aprovadas

| Tema | Decisão |
|---|---|
| Elenco | Lançar com **8 lutadores** no padrão final. Os 20 atuais viram rascunho de design. |
| Arte | Recomendação: **3D cel-shaded pré-renderizado em sprites 2D**. Alternativa: **pixel art HD**. Decisão final depois dos testes de estilo. |
| Risco de produção | **Fatia vertical** (2 lutadores + 1 cenário finais) antes da produção do elenco. |
| Combate | Um **designer de combate** humano é dono do frame data e do balanceamento. |
| Plataforma | **Celular primeiro**: modo de controle **simples** e **clássico**. |
| Modelo de venda | **Jogo pago, compra única de R$ 49,99** na Google Play (decisão de out/2026). Sem anúncios, sem compras no app, sem moedas nem passe; tudo desbloqueável jogando. DLC opcional só se a comunidade aceitar (decisão em aberto). Ver [GDD § 5](gdd/GDD.md#5-progressão-e-modelo-de-venda). |
| Tecnologia | **Manter a engine** (TypeScript, Expo, Skia, rollback). |
| Marca | Trocar o nome antes de divulgar. |

## 3. Fases

| Fase | Período | Objetivo |
|---|---|---|
| 0 — Fundação | nov/2026 | Nome, equipe, testes de estilo, ferramentas, telemetria e lab de aparelhos |
| 1 — Fatia vertical | dez/2026 – fev/2027 | 2 lutadores + 1 cenário no padrão final, controles touch e game feel |
| 2 — Elenco | mar – ago/2027 | Os outros 6 lutadores, cenários, arcade com história, IA, balanceamento |
| 3 — Online e venda | mai – ago/2027 (em paralelo à 2) | Online robusto, ranqueada, licença do jogo pago (Play Integrity), preço e página da loja |
| 4 — Soft launch | set – nov/2027 | Brasil e América Latina; medir vendas, reembolso, estabilidade e retenção |
| 5 — Lançamento global | dez/2027 – jan/2028 | Todas as lojas, inglês e espanhol, marketing |
| 6 — Live ops | a partir de fev/2028 | Temporadas, novos lutadores, eventos, balanceamento contínuo |

### Fase 0 — Fundação (nov/2026)

- Escolher o nome e iniciar a checagem de marca (INPI, USPTO, lojas, domínios) com o jurídico.
- Trocar o nome e os identificadores do app **antes** da primeira publicação em loja
  (`br.com.conexus.bamba` não pode mudar depois de publicado).
- Contratar diretor de arte e designer de combate; contratar os 3 testes de estilo.
- Ferramentas: visualizador de frame data, importador de sprites (PNG + manifest), editor de hitbox.
- Telemetria, relatório de crash, medição de desempenho e um lab com aparelhos de referência.
- Repositório definitivo em `conexus-systems/mugen-arena` e build de desenvolvimento rodando em aparelho.

**Portão de saída:**
- estilo de arte escolhido, com custo por personagem estimado a partir de cotações reais;
- nome escolhido com checagem preliminar sem conflito impeditivo;
- ferramentas aceitas pelo designer de combate e pelo estúdio;
- build rodando no aparelho Android de referência com telemetria e crash chegando.

### Fase 1 — Fatia vertical (dez/2026 – fev/2027)

- Kaze e Brasa com arte, animação, frame data, som e voz finais; cenário Pelourinho final.
- Game feel: hitstop, câmera, efeitos, buffer de comandos.
- Controles touch: modo simples e clássico, editor de layout.
- Tutorial curto e HUD final da luta.
- Playtests com jogadores de fora da equipe.

**Portão de saída (go/no-go da produção):**
- 60 fps estáveis no Android intermediário de referência;
- conclusão do tutorial ≥ 70% no playtest;
- os dois lutadores aprovados pelo diretor de arte e pelo designer de combate;
- custo e prazo **medidos** de um lutador completo, usados para replanejar a Fase 2;
- tamanho medido por lutador compatível com a meta de download.

### Fase 2 — Elenco (mar – ago/2027)

- Os outros 6 lutadores (ver [ELENCO_LANCAMENTO.md](gdd/ELENCO_LANCAMENTO.md)).
- Cenários finais (proposta: 5 no lançamento).
- Arcade com história curta, IA por lutador e por dificuldade.
- Balanceamento contínuo com dados de partidas internas.
- Localização (PT-BR, ES-LatAm, EN) e acessibilidade.

**Portão de saída:** 8 lutadores completos; nenhum lutador fora da faixa de 45–55% de vitória nas partidas
de teste (com amostra mínima definida pelo designer de combate); download dentro da meta.

### Fase 3 — Online e venda (mai – ago/2027, em paralelo)

- Determinismo comprovado entre aparelhos diferentes (Android × iOS, ARM de fabricantes diferentes).
- Soak test, reconexão, ranqueada com temporadas, anti-trapaça.
- Licença do online pelo Play Integrity (código pronto), preço por país e página da loja do app pago; progressão
  salva na conta.
- Privacidade, políticas das lojas e classificação etária.

**Portão de saída:** taxa de dessincronia e de queda de partida dentro do limite definido pelo netcode;
licença testada na faixa de teste interno com licenças de teste do Play Console; ficha da loja e Segurança dos
dados aprovadas; revisão de privacidade concluída.

### Fase 4 — Soft launch BR/LatAm (set – nov/2027)

Lançar em Brasil e alguns países da América Latina, com orçamento pequeno de aquisição, para medir.

**Portão de saída:** metas da seção 4 atingidas ou com plano de correção aprovado.

### Fase 5 — Lançamento global (dez/2027 – jan/2028)

Abrir para todos os países, com inglês e espanhol, ficha de loja final, imprensa e criadores de conteúdo.

### Fase 6 — Live ops (fev/2028 em diante)

Temporadas do ranqueado, eventos e ajustes de balanceamento por dados, como atualizações gratuitas. Lutadores
novos (do banco de rascunhos) entram de graça ou, só se a comunidade aceitar, como DLC opcional — decisão em
aberto.

## 4. Metas

Todas são **metas**, não medições. Nenhuma delas foi medida até hoje.

| Área | Meta | Como medir |
|---|---|---|
| Desempenho | 60 fps na luta em Android intermediário | Telemetria de tempo de frame no lab e em campo |
| Estabilidade | Crash-free ≥ 99,5% (usuários) | Relatório de crash |
| Tamanho | Download inicial ≤ 150 MB | Tamanho do pacote nas lojas |
| Retenção | D1 ≥ 40%, D7 ≥ 15%, D30 ≥ 6% (de quem comprou e consentiu a telemetria) | Telemetria por coorte, a partir do soft launch |
| Onboarding | Conclusão do tutorial ≥ 70% | Funil do tutorial |
| Satisfação | Nota nas lojas ≥ 4,5 | Lojas |
| Vendas | Conversão da página da loja (visitas → compras) acompanhada desde o soft launch; meta definida com os primeiros dados | Play Console (aquisição da ficha) |
| Reembolso | Taxa de reembolso ≤ 10% | Play Console (pedidos e reembolsos) |
| Balanceamento | Taxa de vitória de cada lutador entre 45% e 55% | Partidas online, por faixa de habilidade |

O "Android intermediário" de referência precisa ser escolhido na Fase 0 (tarefa F0-05). Proposta: um
aparelho de 4 GB de RAM de linha intermediária, com Android 12 ou mais novo.

## 5. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Custo da arte acima do previsto | Elenco menor ou atraso | Testes de estilo com cotação; fatia vertical mede o custo real antes da produção |
| 6 lutadores em 6 meses (Fase 2) | Atraso do soft launch | Reaproveitar animações de sistema (golpe recebido, queda) entre lutadores; estúdio com mais de um animador; cortar para 6 lutadores no soft launch se preciso |
| Download acima de 150 MB com sprites HD | Perda de instalações | Medir na fatia vertical; WebP com perda para 3D, paleta indexada para pixel art; baixar cenários e lutadores sob demanda |
| Memória de textura em aparelhos de 3 GB | Crash | Atlas por lutador carregados só na luta; teste no lab com o aparelho mais fraco da matriz |
| Determinismo entre aparelhos (Hermes/JSC, ARM) | Dessincronia no online | Teste cruzado Android × iOS; evitar funções matemáticas sem garantia de resultado igual no `stepWorld` |
| Pouca gente na fila no soft launch | Esperas longas, ranqueada vazia | Busca com faixa que se abre com o tempo; casual com CPU sinalizada como CPU; janela de horários |
| Nome com conflito de marca | Troca tardia, custo de rebrand | Checagem por advogado na Fase 0, antes de publicar |
| Preço alto para celular no Brasil (R$ 50 contra jogos gratuitos) | Poucas vendas, reembolsos | Conteúdo fechado e polido no dia 1; primeira sessão forte (reembolso automático em 48 h); ficha honesta com vídeo do jogo real; preço por país; acompanhar conversão e reembolso no soft launch |
| Pirataria do APK | Venda perdida, online invadido | Online exige licença da Play (Play Integrity: cópia comprada, app reconhecido, aparelho íntegro). Offline pirateável é **aceito** — não vale o custo nem a fricção para quem pagou |
| Play Integrity fora do ar ou aparelho reprovado (root, ROM custom) | Comprador sem online | Licença vale 7 dias e renova com 1 dia de folga; `license_unavailable` com mensagem clara; offline nunca depende disso |
| Personagens lembrarem IP de terceiros | Notificação, remoção | Revisão de IP em cada lutador (checklist no [ELENCO_LANCAMENTO.md](gdd/ELENCO_LANCAMENTO.md)) |
| Representação cultural (folclore, povos indígenas, nordeste) | Rejeição do público | Consultoria cultural para Iara e revisão de todos os textos de história |
| Dependência de estúdio terceirizado | Atraso, qualidade irregular | Contrato com marcos, guia de estilo, direitos cedidos por escrito |
