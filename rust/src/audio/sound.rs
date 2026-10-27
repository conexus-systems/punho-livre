//! Efeitos sonoros: `web_sound` (Web Audio) no navegador e `mixer` no app nativo.

#[cfg(not(target_arch = "wasm32"))]
pub use super::mixer::{init, play, resume, set_volumes, suspend, toggle_mute};
#[cfg(target_arch = "wasm32")]
pub use super::web_sound::*;
