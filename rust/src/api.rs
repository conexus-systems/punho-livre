//! Funções exportadas para o JavaScript: o `index.html` (botão voltar do Android) e os
//! testes automáticos usam estas chamadas. `window.PUNHO` aponta para este módulo.

use wasm_bindgen::prelude::*;

use crate::core::{input, save};
use crate::game::{self, with_game};
use crate::ui::screens;

/// nome da tela atual ("TitleScreen", "MatchScreen"...)
#[wasm_bindgen]
pub fn punho_screen() -> String {
    with_game(|g| g.screen.name().to_string()).unwrap_or_else(|| "none".into())
}

#[wasm_bindgen]
pub fn punho_set_screen(name: &str) {
    with_game(|g| screens::set_screen_by_name(g, name));
}

/// roda n TU da lógica (sem esperar o relógio)
#[wasm_bindgen]
pub fn punho_step(n: u32) {
    for _ in 0..n {
        game::update();
    }
}

#[wasm_bindgen]
pub fn punho_key(code: &str, down: bool) {
    input::with(|i| i.set_key(code, down));
}

/// tecla de uma ação do jogador 0 (para montar sequências nos testes)
#[wasm_bindgen]
pub fn punho_key_of(player: usize, action: &str) -> String {
    input::with(|i| i.keys[player][input::Key::from_name(action).map(|k| k.idx()).unwrap_or(0)].clone())
}

/// começa uma partida a partir de uma descrição em JSON (ver `screens::start_match_json`)
#[wasm_bindgen]
pub fn punho_start_match(json: &str) -> Result<(), JsValue> {
    with_game(|g| screens::start_match_json(g, json)).unwrap_or(Ok(())).map_err(|e| JsValue::from_str(&e))
}

/// estado resumido da partida atual em JSON (tela, modo, lutadores...)
#[wasm_bindgen]
pub fn punho_state() -> JsValue {
    let s = with_game(|g| screens::state_json(g)).unwrap_or_else(|| "{}".into());
    js_sys::JSON::parse(&s).unwrap_or(JsValue::NULL)
}

/// altera um campo de um lutador da partida (hp, mp, hpBound) ou da partida (paused)
#[wasm_bindgen]
pub fn punho_poke(what: &str, index: usize, value: f64) {
    with_game(|g| screens::poke(g, what, index, value));
}

#[wasm_bindgen]
pub fn punho_setting(key: &str, value: i32) {
    save::edit_settings(|s| match key {
        "sfx" => s.sfx = value,
        "music" => s.music = value,
        "touchScale" => s.touch_scale = value,
        "touchOpacity" => s.touch_opacity = value,
        "difficulty" => s.difficulty = value,
        "vibrate" => s.vibrate = value,
        "shake" => s.shake = value,
        "hitNumbers" => s.hit_numbers = value,
        "rounds" => s.rounds = value,
        "timeLimit" => s.time_limit = value,
        _ => {}
    });
    save::save();
    save::apply();
}

#[wasm_bindgen]
pub fn punho_settings() -> JsValue {
    js_sys::JSON::parse(&serde_json::to_string(&save::settings()).unwrap_or_default()).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn punho_progress() -> JsValue {
    js_sys::JSON::parse(&serde_json::to_string(&save::progress()).unwrap_or_default()).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn punho_save_reload() {
    save::save();
    save::load();
}

#[wasm_bindgen]
pub fn punho_reset_progress() {
    save::reset_progress();
}

/// números dos dados gerados (lutadores, cenários, folhas de sprites, sons)
#[wasm_bindgen]
pub fn punho_assets_info() -> JsValue {
    let s = if game::assets_ready() { crate::engine::data::assets_info_json() } else { "{}".into() };
    js_sys::JSON::parse(&s).unwrap_or(JsValue::NULL)
}

/// estado do jogo em rede (sala, vaga, hashes) para os testes
#[wasm_bindgen]
pub fn punho_net() -> JsValue {
    let s = with_game(|g| crate::net::state_json(g)).unwrap_or_else(|| "{}".into());
    js_sys::JSON::parse(&s).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn punho_net_action(action: &str) {
    with_game(|g| crate::net::action(g, action));
}

/// Botão voltar do app Android: fecha na tela inicial, senão age como Esc.
#[wasm_bindgen]
pub fn punho_android_back() -> bool {
    let at_title = with_game(|g| matches!(g.screen, screens::Screen::Title(_))).unwrap_or(true);
    if at_title {
        return true;
    }
    input::with(|i| {
        i.set_key("Escape", true);
        i.set_key("Escape", false);
    });
    false
}

/// quadro inicial de cada golpe especial de um lutador, por etiqueta (hit_Fa, hit_Ua...)
#[wasm_bindgen]
pub fn punho_special_frames(id: i32) -> JsValue {
    let a = game::assets();
    let mut out = vec![];
    if let Some(o) = a.obj(id) {
        for (tag, _) in crate::engine::ai::SPECIAL_KEYS {
            if let Some(f) = o.frame(0).and_then(|f| f.tag(tag)) {
                out.push(format!("\"{}\":{}", tag.name(), f));
            }
        }
    }
    js_sys::JSON::parse(&format!("{{{}}}", out.join(","))).unwrap_or(JsValue::NULL)
}

/// ids dos lutadores na ordem do elenco
#[wasm_bindgen]
pub fn punho_fighters() -> Vec<i32> {
    game::assets().character_list()
}

/// arte da ficha da loja como data URL PNG: "icon" (512x512) ou "feature" (1024x500)
#[wasm_bindgen]
pub fn punho_store_art(kind: &str) -> String {
    use crate::content::moves::{attacks, poses};
    use crate::content::painter::draw_pose_cell;
    use crate::content::roster::roster;
    use crate::gfx::*;
    use crate::ui::logo::{draw_burst, draw_logo};
    let tau = std::f64::consts::TAU;
    let _ = tau;
    if kind == "icon" {
        let c = make_canvas(512.0, 512.0);
        let g = ctx_of(&c);
        let bg = g.linear(0.0, 0.0, 0.0, 512.0, &[(0.0, "#141b4a"), (1.0, "#2a1240")]);
        g.fill_grad(&bg);
        g.fill_rect(0.0, 0.0, 512.0, 512.0);
        draw_burst(&g, 256.0, 262.0, 230.0, 13, "#c4281c", 0.1);
        draw_burst(&g, 256.0, 262.0, 186.0, 13, "#f28a1a", 0.3);
        g.save();
        g.translate(256.0, 300.0);
        g.rotate(-0.08);
        g.text_align(Align::Center);
        g.baseline("alphabetic");
        g.line_join("round");
        g.font(&display_font(250.0));
        g.line_width(26.0);
        g.stroke_style("#120a1e");
        g.stroke_text("PL", 0.0, 70.0);
        let gr = g.linear(0.0, -110.0, 0.0, 70.0, &[(0.0, "#fff3a6"), (0.5, "#ffc21c"), (1.0, "#ff6a00")]);
        g.fill_grad(&gr);
        g.fill_text("PL", 0.0, 70.0);
        g.restore();
        return c.to_data_url().unwrap_or_default();
    }
    let c = make_canvas(1024.0, 500.0);
    let g = ctx_of(&c);
    let bg = g.linear(0.0, 0.0, 1024.0, 500.0, &[(0.0, "#0b1030"), (1.0, "#3a1646")]);
    g.fill_grad(&bg);
    g.fill_rect(0.0, 0.0, 1024.0, 500.0);
    g.alpha(0.12);
    g.fill_style("#ffb000");
    for i in -4..14 {
        let x = i as f64 * 90.0;
        g.poly(&[[x, 0.0], [x + 40.0, 0.0], [x - 160.0, 500.0], [x - 200.0, 500.0]]);
        g.fill();
    }
    g.alpha(1.0);
    draw_logo(&g, 270.0, 200.0, 1.05, 0.0);
    g.baseline("alphabetic");
    g.text_align(Align::Center);
    g.font("bold 30px Arial, sans-serif");
    g.fill_style("#e9ebff");
    g.fill_text("Luta 2.5D para até 4 jogadores", 270.0, 400.0);
    g.font("22px Arial, sans-serif");
    g.fill_style("#9aa3d8");
    g.fill_text("8 lutadores · 6 cenários · sobrevivência · online", 270.0, 436.0);
    let po = poses();
    let at = attacks(&po);
    let list = [po.guard[0].clone(), at.jab_a[1].clone(), at.jump_kick[3].clone(), po.guard[2].clone()];
    let cast = roster();
    let spots = [(560.0, 300.0), (690.0, 330.0), (810.0, 290.0), (930.0, 330.0)];
    for (i, who) in [0usize, 1, 3, 2].iter().enumerate() {
        let mut look = cast[*who].look.clone();
        look.scale *= 2.3;
        draw_pose_cell(&g, &look, &list[i], spots[i].0 - 120.0, spots[i].1 - 200.0, 240.0, 200.0);
    }
    c.to_data_url().unwrap_or_default()
}
