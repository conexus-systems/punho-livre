//! Controles de toque do app nativo, desenhados por cima da janela (o navegador usa botões HTML):
//! direcional de 8 direções, botões A/J/D, Esc e pausa, e os botões de golpe especial, que
//! digitam a sequência inteira num toque. As teclas são as mesmas do navegador (`T_up`, `T_att`...).

use std::cell::RefCell;
use std::collections::HashMap;

use crate::core::input::{self, Key};
use crate::engine::ai::SeqKey;
use crate::gfx::{Align, Ctx};
use crate::ui::screens::Screen;
use crate::ui::select::specials_of;

pub const GAME_W: f64 = 794.0;
pub const GAME_H: f64 = 470.0;

const LINE: &str = "rgba(233,235,255,0.35)";
const BTN: &str = "rgba(233,235,255,0.14)";
const BTN_ON: &str = "rgba(255,176,0,0.6)";
const AMBER: &str = "#ffb000";

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Rect {
    fn has(&self, x: f64, y: f64) -> bool {
        x >= self.x && x <= self.x + self.w && y >= self.y && y <= self.y + self.h
    }
}

/// onde cada coisa fica na janela
pub struct Layout {
    pub game: Rect,
    pub dpad: (f64, f64, f64),                                     // centro e raio
    pub buttons: Vec<(&'static str, &'static str, f64, f64, f64)>, // código, rótulo, centro, raio
    pub sys: Vec<(&'static str, &'static str, Rect)>,
    pub specials: Vec<Rect>,
}

#[derive(Clone)]
struct SpecialBtn {
    cmd: String,
    kind: String,
    cost: f64,
    seq: [SeqKey; 3],
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Target {
    Dpad,
    Key(&'static str),
    Special(usize),
}

struct State {
    active: bool,
    win: (f64, f64),
    pointers: HashMap<u64, Target>,
    held: [bool; 4], // cima, baixo, esquerda, direita
    running: bool,
    knob: (f64, f64),
    specials_on: bool,
    slot: i32,
    built_id: i32,
    dir: i32,
    list: Vec<SpecialBtn>,
    mp: f64,
}

thread_local! {
    static ST: RefCell<State> = RefCell::new(State {
        active: false, win: (GAME_W, GAME_H), pointers: HashMap::new(), held: [false; 4], running: false, knob: (0.0, 0.0),
        specials_on: false, slot: 0, built_id: -1, dir: 1, list: vec![], mp: 0.0,
    });
}

const CODES: [&str; 4] = ["T_up", "T_down", "T_left", "T_right"];

pub fn setup() {
    #[cfg(target_os = "android")]
    set_active(true);
}

pub fn is_active() -> bool {
    ST.with(|s| s.borrow().active)
}

/// mostra os controles (primeiro toque, ou sempre no celular)
pub fn set_active(on: bool) {
    ST.with(|s| s.borrow_mut().active = on);
    if on {
        input::with(|i| i.touch_active = true);
        crate::audio::sound::init();
    }
}

fn touch_scale() -> f64 {
    0.7 + (crate::core::save::settings().touch_scale as f64 / 10.0) * 0.3
}
fn touch_opacity() -> f64 {
    0.25 + (crate::core::save::settings().touch_opacity as f64 / 10.0) * 0.75
}

/// posição do jogo e dos controles numa janela de `w` x `h` pixels. Com os controles ativos e a
/// tela em pé, o jogo fica em cima e os controles embaixo; deitada, o jogo ocupa o meio e os
/// controles ficam nos cantos.
pub fn layout(w: f64, h: f64, controls: bool) -> Layout {
    let portrait = controls && w / h < 1.25;
    let (gx, gy, gw, gh) = if portrait {
        let s = w / GAME_W;
        (0.0, h * 0.02, w, GAME_H * s)
    } else {
        let s = (w / GAME_W).min(h / GAME_H);
        (((w - GAME_W * s) / 2.0).floor(), ((h - GAME_H * s) / 2.0).floor(), GAME_W * s, GAME_H * s)
    };
    let game = Rect { x: gx, y: gy, w: gw, h: gh };
    // região onde ficam os botões
    let (rx, ry, rw, rh) = if portrait { (0.0, gy + gh, w, h - gy - gh) } else { (0.0, 0.0, w, h) };
    let sc = touch_scale();
    let u = if portrait { (rw * 0.11).min(rh * 0.2) } else { h * 0.105 } * sc; // raio de um botão
    let pad = u * 0.45;
    let dr = u * 1.9;
    let dpad = (rx + pad + dr, ry + rh - pad - dr, dr);
    // A no canto, J à esquerda, D acima
    let a = (rx + rw - pad - u * 1.15, ry + rh - pad - u * 1.15, u * 1.15);
    let j = (a.0 - u * 2.5, a.1, u);
    let d = (a.0, a.1 - u * 2.5, u);
    let buttons = vec![("T_att", "A", a.0, a.1, a.2), ("T_jump", "J", j.0, j.1, j.2), ("T_def", "D", d.0, d.1, d.2)];
    let sw = u * 1.8;
    let sh = u * 0.95;
    let sys = vec![("Escape", "Esc", Rect { x: rx + pad, y: ry + pad, w: sw, h: sh * 0.8 }), ("F1", "II", Rect { x: rx + pad * 2.0 + sw, y: ry + pad, w: sw, h: sh * 0.8 })];
    let (bw, bh) = (u * 2.2, u * 1.05);
    let specials = (0..4)
        .map(|i| {
            let (col, row) = ((i % 2) as f64, (i / 2) as f64);
            Rect { x: rx + rw - pad - bw * 2.0 - 6.0 + col * (bw + 6.0), y: ry + pad + row * (bh + 6.0), w: bw, h: bh }
        })
        .collect();
    Layout { game, dpad, buttons, sys, specials }
}

fn current_layout() -> Layout {
    let (w, h) = ST.with(|s| s.borrow().win);
    layout(w, h, is_active())
}

/// o tamanho da janela mudou
pub fn resize(w: f64, h: f64) {
    ST.with(|s| s.borrow_mut().win = (w, h));
}

fn set_dir(idx: usize, on: bool) {
    let changed = ST.with(|s| {
        let mut s = s.borrow_mut();
        if s.held[idx] != on {
            s.held[idx] = on;
            true
        } else {
            false
        }
    });
    if changed {
        input::with(|i| i.set_key(CODES[idx], on));
    }
}

fn dpad_move(x: f64, y: f64, l: &Layout) {
    let (cx, cy, r) = l.dpad;
    let (dx, dy) = (x - cx, y - cy);
    let dist = (dx * dx + dy * dy).sqrt();
    let (mut sx, mut sy) = (0i32, 0i32);
    if dist > r * 0.16 {
        let a = dy.atan2(dx);
        let sector = (a / (std::f64::consts::PI / 4.0)).round() as i32;
        sx = [-1, -1, 0, 1, 1, 1, 0, -1, -1][(sector + 4) as usize];
        sy = [0, -1, -1, -1, 0, 1, 1, 1, 0][(sector + 4) as usize];
    }
    set_dir(2, sx < 0);
    set_dir(3, sx > 0);
    set_dir(0, sy < 0);
    set_dir(1, sy > 0);
    // dedo na borda do direcional = correr (o mesmo que tocar duas vezes na direção)
    let edge = sx != 0 && dist > r * 0.8;
    let was = ST.with(|s| std::mem::replace(&mut s.borrow_mut().running, edge));
    if edge && !was {
        let code = if sx < 0 { "T_left" } else { "T_right" };
        input::with(|i| {
            i.set_key(code, false);
            i.set_key(code, true);
        });
    }
    let kk = (dist / r).min(1.0) * r * 0.5;
    ST.with(|s| s.borrow_mut().knob = if dist > 1.0 { (dx / dist * kk, dy / dist * kk) } else { (0.0, 0.0) });
}

fn dpad_release() {
    for i in 0..4 {
        set_dir(i, false);
    }
    ST.with(|s| {
        let mut s = s.borrow_mut();
        s.running = false;
        s.knob = (0.0, 0.0);
    });
}

/// Um dedo tocou (`phase` 0), mexeu (1) ou saiu (2) em (`x`, `y`) da janela. O mouse conta como o dedo 0.
pub fn pointer(id: u64, phase: u8, x: f64, y: f64) {
    if phase == 0 && !is_active() {
        set_active(true);
    }
    let l = current_layout();
    match phase {
        0 => {
            let (cx, cy, r) = l.dpad;
            let target = if (x - cx).hypot(y - cy) <= r * 1.15 {
                Some(Target::Dpad)
            } else if let Some(b) = l.buttons.iter().find(|b| (x - b.2).hypot(y - b.3) <= b.4 * 1.2) {
                Some(Target::Key(b.0))
            } else if let Some(b) = l.sys.iter().find(|b| b.2.has(x, y)) {
                Some(Target::Key(b.0))
            } else {
                l.specials.iter().position(|r| r.has(x, y)).filter(|&i| ST.with(|s| s.borrow().list.len() > i)).map(Target::Special)
            };
            let Some(t) = target else { return };
            ST.with(|s| s.borrow_mut().pointers.insert(id, t));
            crate::audio::sound::init();
            match t {
                Target::Dpad => dpad_move(x, y, &l),
                Target::Key(code) => input::with(|i| i.set_key(code, true)),
                Target::Special(i) => fire(i),
            }
        }
        1 => {
            if ST.with(|s| s.borrow().pointers.get(&id).copied()) == Some(Target::Dpad) {
                dpad_move(x, y, &l);
            }
        }
        _ => {
            let t = ST.with(|s| s.borrow_mut().pointers.remove(&id));
            match t {
                Some(Target::Dpad) => dpad_release(),
                Some(Target::Key(code)) => input::with(|i| i.set_key(code, false)),
                _ => {}
            }
        }
    }
}

/// solta tudo (o app foi para segundo plano)
pub fn release_all() {
    let ids: Vec<u64> = ST.with(|s| s.borrow().pointers.keys().copied().collect());
    for id in ids {
        pointer(id, 2, 0.0, 0.0);
    }
}

// ---- golpes especiais ----

/// chamado ao trocar de tela
pub fn specials_update(screen: &Screen) {
    let (on, slot) = match screen {
        Screen::Match(s) if !s.m.demo => (true, 0),
        Screen::NetMatch(s) => (true, s.slot),
        _ => (false, 0),
    };
    ST.with(|s| {
        let mut s = s.borrow_mut();
        s.specials_on = on;
        s.slot = slot;
        s.built_id = -1;
        s.list.clear();
    });
}

/// chamado a cada quadro durante a partida: refaz os botões se o lutador mudou e guarda o MP
pub fn specials_poll(screen: &Screen) {
    let Some(m) = screen.match_ref() else { return };
    let (on, slot, built) = ST.with(|s| {
        let s = s.borrow();
        (s.specials_on, s.slot, s.built_id)
    });
    if !on {
        return;
    }
    let Some(&ch) = m.characters().iter().find(|&&c| m.objs[c].ch().player == slot) else { return };
    let (id, mp, dir) = (m.objs[ch].id, m.objs[ch].health.mp, m.objs[ch].ps.dir);
    ST.with(|s| {
        let mut s = s.borrow_mut();
        s.mp = mp;
        s.dir = dir;
        if built != id {
            s.built_id = id;
            s.list = specials_of(id).iter().take(4).map(|sp| SpecialBtn { cmd: sp.cmd.replace(' ', ""), kind: sp.kind.to_string(), cost: sp.cost, seq: sp.seq }).collect();
        }
    });
}

fn fire(i: usize) {
    let (seq, dir) = ST.with(|s| {
        let s = s.borrow();
        (s.list.get(i).map(|b| b.seq), s.dir)
    });
    let Some(seq) = seq else { return };
    let keys: Vec<Key> = seq
        .iter()
        .map(|k| match k {
            SeqKey::K(k) => *k,
            SeqKey::F => {
                if dir == -1 {
                    Key::Left
                } else {
                    Key::Right
                }
            }
        })
        .collect();
    input::with(|i| {
        let held: Vec<Key> = input::KEY_ACTIONS.iter().copied().filter(|a| i.down.contains(a.touch_code()) || i.down.contains(&i.keys[0][a.idx()])).collect();
        let con = &mut i.controllers[0];
        for k in &keys {
            if held.contains(k) {
                con.key(*k, false);
            }
            con.key(*k, true);
            con.key(*k, false);
        }
        // devolve as teclas que o jogador continua segurando
        for k in &keys {
            if held.contains(k) {
                con.key(*k, true);
            }
        }
    });
}

// ---- desenho ----

pub fn draw(ctx: &Ctx) {
    if !is_active() {
        return;
    }
    let l = current_layout();
    let opacity = touch_opacity();
    let (down, knob, specials_on, list, mp) = ST.with(|s| {
        let s = s.borrow();
        (s.pointers.values().copied().collect::<Vec<_>>(), s.knob, s.specials_on, s.list.clone(), s.mp)
    });
    ctx.save();
    ctx.alpha(opacity);
    // direcional
    let (cx, cy, r) = l.dpad;
    let on = down.contains(&Target::Dpad);
    ctx.fill_style(BTN);
    ctx.stroke_style(LINE);
    ctx.line_width(2.0);
    ctx.circle(cx, cy, r);
    ctx.fill();
    ctx.stroke();
    ctx.fill_style("rgba(255,255,255,0.55)");
    ctx.font(&format!("{}px Arial", r * 0.2));
    ctx.text_align(Align::Center);
    ctx.baseline("middle");
    for (ch, ax, ay) in [("▲", 0.0, -0.72), ("▼", 0.0, 0.72), ("◀", -0.72, 0.0), ("▶", 0.72, 0.0)] {
        ctx.fill_text(ch, cx + ax * r, cy + ay * r);
    }
    ctx.fill_style(if on { BTN_ON } else { "rgba(255,255,255,0.22)" });
    ctx.stroke_style(if on { AMBER } else { LINE });
    ctx.circle(cx + knob.0, cy + knob.1, r * 0.36);
    ctx.fill();
    ctx.stroke();
    // A, J, D
    for (code, label, bx, by, br) in &l.buttons {
        let pressed = down.contains(&Target::Key(code));
        ctx.fill_style(if pressed { BTN_ON } else { BTN });
        ctx.stroke_style(if pressed || *code == "T_att" { AMBER } else { LINE });
        ctx.circle(*bx, *by, *br);
        ctx.fill();
        ctx.stroke();
        ctx.fill_style("#ffffff");
        ctx.font(&format!("{}px \"Bangers\", Arial", br * 1.05));
        ctx.fill_text(label, *bx, *by);
    }
    // Esc e pausa
    for (code, label, rc) in &l.sys {
        let pressed = down.contains(&Target::Key(code));
        ctx.fill_style(if pressed { BTN_ON } else { BTN });
        ctx.stroke_style(if pressed { AMBER } else { LINE });
        ctx.begin();
        ctx.rect(rc.x, rc.y, rc.w, rc.h);
        ctx.fill();
        ctx.stroke();
        ctx.fill_style("#ffffff");
        ctx.font(&format!("{}px \"Bangers\", Arial", rc.h * 0.62));
        ctx.fill_text(label, rc.x + rc.w / 2.0, rc.y + rc.h / 2.0);
    }
    // golpes especiais
    if specials_on {
        for (i, b) in list.iter().enumerate() {
            let Some(rc) = l.specials.get(i) else { break };
            let low = mp < b.cost;
            ctx.alpha(if low { opacity * 0.4 } else { opacity });
            ctx.fill_style(if down.contains(&Target::Special(i)) { BTN_ON } else { BTN });
            ctx.stroke_style("rgba(255,176,0,0.55)");
            ctx.begin();
            ctx.rect(rc.x, rc.y, rc.w, rc.h);
            ctx.fill();
            ctx.stroke();
            ctx.font(&format!("bold {}px Arial", rc.h * 0.3));
            ctx.fill_style(AMBER);
            ctx.fill_text(&b.cmd, rc.x + rc.w / 2.0, rc.y + rc.h * 0.3);
            ctx.fill_style("#ffffff");
            ctx.fill_text(&b.kind, rc.x + rc.w / 2.0, rc.y + rc.h * 0.7);
        }
    }
    ctx.restore();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn game_is_centered_in_a_wide_window_and_on_top_in_portrait() {
        let l = layout(2400.0, 1080.0, true);
        assert!((l.game.h - 1080.0).abs() < 1.0 && l.game.x > 200.0);
        let p = layout(1080.0, 2400.0, true);
        assert!((p.game.w - 1080.0).abs() < 1.0 && p.game.y < 100.0);
        assert!(p.dpad.1 > p.game.y + p.game.h, "o direcional fica abaixo do jogo");
    }

    #[test]
    fn dpad_sectors_press_directions() {
        input::with(|i| i.down.clear());
        let l = layout(2400.0, 1080.0, true);
        let (cx, cy, r) = l.dpad;
        dpad_move(cx + r * 0.7, cy, &l);
        assert!(input::with(|i| i.is_down("T_right")) && !input::with(|i| i.is_down("T_up")));
        dpad_move(cx - r * 0.5, cy - r * 0.5, &l);
        assert!(input::with(|i| i.is_down("T_left")) && input::with(|i| i.is_down("T_up")));
        dpad_release();
        assert!(!input::with(|i| i.is_down("T_left")));
    }
}
