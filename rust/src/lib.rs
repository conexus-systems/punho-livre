//! Punho Livre: jogo de luta 2.5D em Rust compilado para WebAssembly.
//! O ponto de entrada é `start_game()`, chamado pelo `index.html` depois de carregar o módulo.

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
pub mod core {
    pub mod consts;
    pub mod input;
    pub mod save;
}
pub mod audio {
    pub mod music;
    pub mod sound;
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
    pub mod hud;
    pub mod logo;
    pub mod screens;
    pub mod select;
    pub mod settings;
    pub mod touch;
}
pub mod api;
pub mod game;
pub mod net;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn start_game() {
    std::panic::set_hook(Box::new(|info| {
        web_sys::console::error_1(&format!("Punho Livre: {}", info).into());
    }));
    game::boot();
}
