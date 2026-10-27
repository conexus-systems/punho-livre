//! Trilha sonora: `web_music` (Web Audio) no navegador e `mixer` no app nativo.

#[cfg(not(target_arch = "wasm32"))]
pub use super::mixer::{music_play as play, music_set_duck as set_duck};
#[cfg(target_arch = "wasm32")]
pub use super::web_music::*;
