# syntax=docker/dockerfile:1
# Imagem do jogo: compila o Rust para WebAssembly e roda o servidor Node (salas em rede + arquivos do jogo).
# Porta 8080. Rota /health responde ok.

ARG RUST_VERSION=1
FROM docker.io/library/rust:$RUST_VERSION-slim AS wasm

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y python3 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
RUN rustup target add wasm32-unknown-unknown && \
    cargo install wasm-bindgen-cli --version 0.2.129 --locked

WORKDIR /src
COPY rust rust
COPY tools tools
COPY web web
RUN tools/build-wasm.sh release

FROM docker.io/library/node:22-slim

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080

COPY server/package.json server/package-lock.json server/
RUN npm ci --prefix server --omit=dev

COPY server server
COPY web web
COPY --from=wasm /src/web/pkg web/pkg

USER node
EXPOSE 8080
CMD ["node", "server/server.js"]
