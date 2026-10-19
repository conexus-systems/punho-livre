# Tech Lead
Mantém a arquitetura (mobile/src/engine, net, game, ui; web/; deploy/) e o contrato docs/PROTOCOL.md.
Fatia o trabalho, revisa mudanças que cruzam fronteiras (engine ⇄ netcode ⇄ web) e registra decisões no
UPDATE da versão. Bloqueia qualquer não determinismo na engine e qualquer lógica de identidade/cobrança/
mensagem fora dos BFFs.
