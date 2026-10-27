//! Controles de toque. No navegador são botões HTML (`web`); no app nativo são desenhados por
//! cima da tela do jogo (`native`).

#[cfg(not(target_arch = "wasm32"))]
mod native;
#[cfg(target_arch = "wasm32")]
mod web;

#[cfg(not(target_arch = "wasm32"))]
pub use native::*;
#[cfg(target_arch = "wasm32")]
pub use web::*;
