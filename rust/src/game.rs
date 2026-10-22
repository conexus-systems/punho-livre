//! Laço principal: a lógica roda a 30 TU por segundo e o desenho acompanha a tela.
//! `Game` guarda a tela atual; as telas estão em `ui::screens`.

use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use crate::audio::{music, sound};
use crate::content::build::Builder;
use crate::core::consts::*;
use crate::core::{input, save};
use crate::engine::data::Assets;
use crate::gfx::{self, Ctx};
use crate::ui::screens::{self, Screen};

pub struct Game {
    pub ctx: Ctx,
    pub screen: Screen,
    pub builder: Option<Builder>,
    pub load_error: Option<String>,
}

thread_local! {
    pub static GAME: RefCell<Option<Game>> = const { RefCell::new(None) };
    pub static ASSETS: RefCell<Option<std::rc::Rc<Assets>>> = const { RefCell::new(None) };
}

/// dados do jogo (lutadores, armas, cenários), prontos depois do carregamento
pub fn assets() -> std::rc::Rc<Assets> {
    ASSETS.with(|a| a.borrow().as_ref().expect("assets ainda não carregados").clone())
}
pub fn assets_ready() -> bool {
    ASSETS.with(|a| a.borrow().is_some())
}

pub fn with_game<R>(f: impl FnOnce(&mut Game) -> R) -> Option<R> {
    GAME.with(|g| g.try_borrow_mut().ok().and_then(|mut g| g.as_mut().map(f)))
}

pub fn boot() {
    let doc = gfx::document();
    let canvas: web_sys::HtmlCanvasElement = doc.get_element_by_id("game").unwrap().dyn_into().unwrap();
    let ctx = gfx::ctx_of(&canvas);
    ctx.smoothing(false);
    save::load();
    save::apply();
    input::init();
    crate::ui::touch::setup();
    let on_pointer = Closure::<dyn FnMut(web_sys::Event)>::new(move |_e: web_sys::Event| sound::init());
    let _ = canvas.add_event_listener_with_callback("pointerdown", on_pointer.as_ref().unchecked_ref());
    on_pointer.forget();

    GAME.with(|g| {
        *g.borrow_mut() = Some(Game { ctx, screen: Screen::Loading { p: 0.0 }, builder: Some(Builder::new()), load_error: None });
    });

    // ao sair do app a luta pausa sozinha e o som para
    let on_vis = Closure::<dyn FnMut(web_sys::Event)>::new(move |_e: web_sys::Event| {
        let hidden = gfx::document().hidden();
        if hidden {
            with_game(screens::auto_pause);
            sound::suspend();
        } else {
            sound::resume();
        }
    });
    let _ = doc.add_event_listener_with_callback("visibilitychange", on_vis.as_ref().unchecked_ref());
    on_vis.forget();

    // laço de animação
    let f = std::rc::Rc::new(RefCell::new(None::<Closure<dyn FnMut(f64)>>));
    let g = f.clone();
    let step_ms = 1000.0 / FPS as f64;
    let mut last = web_sys::window().unwrap().performance().unwrap().now();
    let mut acc = 0.0;
    *g.borrow_mut() = Some(Closure::new(move |now: f64| {
        acc += (now - last).min(250.0);
        last = now;
        let mut n = 0;
        while acc >= step_ms && n < 4 {
            update();
            acc -= step_ms;
            n += 1;
        }
        draw();
        request_frame(f.borrow().as_ref().unwrap());
    }));
    request_frame(g.borrow().as_ref().unwrap());
}

fn request_frame(f: &Closure<dyn FnMut(f64)>) {
    let _ = web_sys::window().unwrap().request_animation_frame(f.as_ref().unchecked_ref());
}

/// um TU: carregamento, teclas e a tela atual
pub fn update() {
    GAME.with(|g| {
        let mut g = g.borrow_mut();
        let Some(game) = g.as_mut() else { return };
        if let Some(b) = game.builder.as_mut() {
            match b.step() {
                Ok(Some(p)) => {
                    game.screen = Screen::Loading { p };
                }
                Ok(None) => {
                    let assets = game.builder.take().unwrap().finish();
                    ASSETS.with(|a| *a.borrow_mut() = Some(std::rc::Rc::new(assets)));
                    screens::set_screen(game, Screen::title());
                }
                Err(e) => {
                    game.load_error = Some(e);
                    game.builder = None;
                }
            }
            return;
        }
        input::with(|i| i.poll_pads());
        screens::update(game);
        input::with(|i| i.end_frame());
    });
}

pub fn draw() {
    GAME.with(|g| {
        let mut g = g.borrow_mut();
        let Some(game) = g.as_mut() else { return };
        screens::draw(game);
    });
}

/// faixa de cada tela: menus tocam o tema calmo; lutas alternam por cenário
pub fn play_music_for(screen: &Screen) {
    music::play(Some(screens::track_for(screen)));
}
