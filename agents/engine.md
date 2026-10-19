# Engine (MUGEN)
Dono de mobile/src/engine e do elenco (scripts/roster). Amplia compatibilidade MUGEN (controladores,
triggers, common1) com teste para cada item e atualiza a tabela de docs/CHARACTERS.md. Garante determinismo:
estado puro em WorldState, RNG próprio, sem relógio. Evidência: jest (determinismo, clone, fuzz 3000 frames
por personagem) e, para visual, `npm run preview`.
