//! Punho Livre: jogo de luta 2.5D em Rust.
//! No navegador compila para WebAssembly e o ponto de entrada é `start_game()`, chamado pelo
//! `index.html`. No celular e no computador é um app nativo (`native/`), sem WebView.

// Escolhas de estilo de um motor de jogo portado de outra linguagem: muitos argumentos, nomes que lembram traits...
#![allow(
    clippy::too_many_arguments,
    clippy::large_enum_variant,
    clippy::new_without_default,
    clippy::should_implement_trait,
    clippy::needless_range_loop,
    clippy::collapsible_else_if
)]

pub mod gfx;
pub mod platform;
pub mod core {
    pub mod consts;
    pub mod input;
    pub mod save;
}
pub mod audio {
    #[cfg(not(target_arch = "wasm32"))]
    mod mixer;
    pub mod music;
    pub mod sound;
    pub mod synth;
    #[cfg(target_arch = "wasm32")]
    mod web_music;
    #[cfg(target_arch = "wasm32")]
    mod web_sound;
}
pub mod content {
    pub mod build;
    pub mod moves;
    pub mod painter;
    pub mod roster;
    pub mod scenes;
}
pub mod engine {
    pub mod ai;
    pub mod background;
    pub mod ball;
    pub mod character;
    pub mod data;
    pub mod effects;
    pub mod r#match;
    pub mod object;
    pub mod stage;
    pub mod survival;
    pub mod weapon;
}
pub mod ui {
    pub mod ads;
    pub mod hud;
    pub mod logo;
    pub mod screens;
    pub mod select;
    pub mod settings;
    pub mod touch;
}
#[cfg(target_arch = "wasm32")]
pub mod api;
pub mod game;
#[cfg(not(target_arch = "wasm32"))]
pub mod native;
pub mod net;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn start_game() {
    std::panic::set_hook(Box::new(|info| {
        web_sys::console::error_1(&format!("Punho Livre: {}", info).into());
    }));
    game::boot();
}

/// ponto de entrada do app Android (`MainActivity` é uma `NativeActivity`)
#[cfg(target_os = "android")]
#[no_mangle]
fn android_main(app: winit::platform::android::activity::AndroidApp) {
    native::run_android(app);
}
