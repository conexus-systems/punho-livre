# server/

Servidor Node do Punho Livre: salas de jogo em rede por WebSocket (`/ws`) e entrega dos arquivos
do jogo (`../web`, ou a pasta de `GAME_ROOT`).

```bash
npm install
PORT=8080 npm start
```

Rota `/health` responde `ok`. O servidor só repassa as teclas dos jogadores; a simulação roda em
cada aparelho (veja [../docs/ARQUITETURA.md](../docs/ARQUITETURA.md)).
