//! Punho Livre no computador: `cargo run --release`. Opções: `--touch` (o mouse faz o papel do dedo,
//! para testar os controles de toque) e `--dev` (teclas de teste). No navegador o jogo é a
//! biblioteca (`start_game`), então aqui não há o que rodar.

#[cfg(not(target_arch = "wasm32"))]
fn main() {
    punho_livre::native::run();
}

#[cfg(target_arch = "wasm32")]
fn main() {}
