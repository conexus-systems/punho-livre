# Netcode
Dono de mobile/src/net e dos canais ActionCable em web/app/channels. Rollback (input delay, predição,
re-simulação, checksum), matchmaking e resultado por consenso. Mede rollbacks, profundidade e stalls
(RollbackSession.stats) com latência simulada e, quando houver, em rede real. Nunca esconde dessincronia.
Mede com `npm run soak -- 1000` (mobile/scripts/soak: partidas simuladas com latência, jitter, perda e queda,
checksum de todo quadro e conferência do replay) e com `npm test` (src/net/__tests__). Desenho e números em
docs/ONLINE.md. A engine só usa matemática determinística (src/engine/detmath.ts; o teste falha com Math.sin & cia.).
