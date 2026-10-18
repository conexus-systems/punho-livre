# F0-04 — Ferramentas de produção (frame data, importador de sprites, editor de hitbox)

Fase: 0 — Fundação. Status do épico: **IN_PROGRESS** (agentes trabalhando agora).
Dono do épico: tech-lead. Executores: engine, mobile-ux. Usuários: designer de combate, estúdio de arte.
Objetivo: o designer de combate e o estúdio conseguem colocar arte nova e ajustar frame data e caixas sem
editar `.air`/`.cns` à mão e sem passar pelo gerador procedural.

---

## F0-04.1 — Visualizador e editor de frame data
Owner: engine
Objective: ver e ajustar, por golpe, inicialização, quadros ativos, recuperação, vantagem no acerto e na defesa, dano, atordoamento, tipo (alto/baixo/médio), cancelamentos.
Dependencies: nenhuma
Files in scope: mobile/scripts/ (ferramenta), mobile/src/engine/ (leitura, sem mudar o `stepWorld`), docs/
Acceptance criteria:
- Tabela de frame data gerada a partir dos dados do lutador, igual ao que a engine executa (teste compara).
- Alterar um valor e ver o efeito no treino sem regerar o elenco inteiro.
- Exporta a tabela (CSV ou JSON) para o designer de combate.
Tests required: teste que mede inicialização/ativos/recuperação rodando a engine e compara com a tabela; `npm run test:ci`
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: a ferramenta não pode alterar a simulação; dados de frame data mudam a luta online (versão de conteúdo precisa casar entre jogadores)
Evidence (commands/logs/devices): saída do teste; exemplo de tabela exportada
Status: IN_PROGRESS

## F0-04.2 — Importador de sprites (PNG + manifest.json)
Owner: engine
Objective: importar a pasta de PNGs + `manifest.json` (`id`, `name`, `pixelsPerUnit`, `anims` com `loop`, `loopStart`, `frames` com `file`, `ticks`, `axis`, `flipH`, `clsn1`, `clsn2`) para o formato do jogo, gerando atlas.
Dependencies: nenhuma
Files in scope: mobile/scripts/, mobile/src/game/atlas.ts, docs/SPRITE_PIPELINE.md (novo)
Acceptance criteria:
- `docs/SPRITE_PIPELINE.md` documenta o formato, as unidades das caixas e os nomes de ação.
- Pacote de exemplo importado e jogável no treino.
- Erros claros: arquivo faltando, eixo fora da imagem, ação obrigatória ausente.
Tests required: testes do importador (válido, inválido, atlas gerado); `npm run test:ci`
Metrics/baseline: tamanho do atlas por pacote
Impacto em determinismo, justiça online, privacidade ou licença: caixas entram na simulação; o pacote precisa ter hash conferido no online
Evidence (commands/logs/devices): teste e captura do pacote de exemplo
Status: IN_PROGRESS

## F0-04.3 — Editor de hitbox
Owner: engine (com mobile-ux para a interface)
Objective: desenhar e ajustar `clsn1`/`clsn2` por quadro, ver o eixo, avançar quadro a quadro e salvar no manifest.
Dependencies: F0-04.2
Files in scope: ferramenta (web local ou tela de desenvolvimento), manifest dos pacotes
Acceptance criteria:
- Abre um pacote, mostra caixas sobre o sprite, cria/move/redimensiona/apaga, copia caixas do quadro anterior.
- Salva no manifest sem perder outros campos.
Tests required: teste de ida e volta (abrir → salvar → abrir igual)
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: caixas mudam a luta online (versão de conteúdo)
Evidence (commands/logs/devices): vídeo curto do fluxo
Status: IN_PROGRESS

## F0-04.4 — Aceite das ferramentas pelo designer de combate e pelo estúdio
Owner: designer de combate (humano) + diretor de arte (humano)
Objective: as ferramentas resolvem o trabalho real.
Dependencies: F0-04.1, F0-04.2, F0-04.3, F0-02.2
Files in scope: n/a
Acceptance criteria: o designer ajusta um golpe da Kaze de rascunho do começo ao fim sem ajuda de agente; lista de melhorias registrada.
Tests required: sessão de uso
Metrics/baseline: tempo para ajustar um golpe
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): lista de melhorias
Status: TODO
