//! Controles de toque no celular: direcional de 8 direções, botões A/J/D e os botões de
//! golpe especial, que digitam a sequência inteira (defesa, direção, ataque/pulo) num toque.

use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{Element, HtmlElement, PointerEvent};

use crate::audio::sound;
use crate::core::input::{self, Key, KEY_ACTIONS};
use crate::engine::ai::SeqKey;
use crate::gfx::document;
use crate::ui::screens::Screen;
use crate::ui::select::specials_of;

struct Specials {
    active: bool,
    slot: i32,
    built_id: i32,
    dir: i32,
}

thread_local! {
    static SPECIALS: RefCell<Specials> = const { RefCell::new(Specials { active: false, slot: 0, built_id: -1, dir: 1 }) };
}

fn on<F: FnMut(PointerEvent) + 'static>(el: &Element, name: &str, f: F) {
    let cb = Closure::<dyn FnMut(PointerEvent)>::new(f);
    let _ = el.add_event_listener_with_callback(name, cb.as_ref().unchecked_ref());
    cb.forget();
}

fn capture(el: &Element, e: &PointerEvent) {
    let _ = el.set_pointer_capture(e.pointer_id());
}

pub fn setup() {
    let doc = document();
    let Some(touch) = doc.get_element_by_id("touch") else { return };
    // primeiro toque: mostra os controles e, no navegador do celular, entra em tela cheia
    {
        let touch = touch.clone();
        let cb = Closure::<dyn FnMut(web_sys::Event)>::once(move |_e: web_sys::Event| {
            let _ = touch.remove_attribute("hidden");
            if let Some(b) = document().body() {
                let _ = b.class_list().add_1("has-touch");
            }
            input::with(|i| i.touch_active = true);
            sound::init();
            let win = web_sys::window().unwrap();
            let is_app = js_sys::Reflect::get(&win, &"AndroidApp".into()).map(|v| !v.is_undefined()).unwrap_or(false);
            if !is_app {
                if let Some(root) = document().document_element() {
                    let f = js_sys::Reflect::get(&root, &"requestFullscreen".into()).ok();
                    if let Some(f) = f.and_then(|f| f.dyn_into::<js_sys::Function>().ok()) {
                        let _ = f.call0(&root);
                    }
                }
            }
        });
        let opts = web_sys::AddEventListenerOptions::new();
        opts.set_once(true);
        opts.set_passive(true);
        let _ = web_sys::window().unwrap().add_event_listener_with_callback_and_add_event_listener_options("touchstart", cb.as_ref().unchecked_ref(), &opts);
        cb.forget();
    }

    // direcional único: o ângulo do dedo vira até duas direções (8 sentidos)
    if let Ok(Some(pad)) = touch.query_selector(".dpad") {
        let knob = pad.query_selector(".knob").ok().flatten();
        let held = Rc::new(RefCell::new([false; 4])); // up, down, left, right
        let running = Rc::new(RefCell::new(false));
        const CODES: [&str; 4] = ["T_up", "T_down", "T_left", "T_right"];
        let set = {
            let held = held.clone();
            move |idx: usize, on: bool| {
                let mut h = held.borrow_mut();
                if h[idx] != on {
                    h[idx] = on;
                    input::with(|i| i.set_key(CODES[idx], on));
                }
            }
        };
        let update = {
            let pad = pad.clone();
            let knob = knob.clone();
            let set = set.clone();
            let running = running.clone();
            Rc::new(move |e: &PointerEvent| {
                let r = pad.get_bounding_client_rect();
                let dx = e.client_x() as f64 - (r.left() + r.width() / 2.0);
                let dy = e.client_y() as f64 - (r.top() + r.height() / 2.0);
                let dist = (dx * dx + dy * dy).sqrt();
                let dead = r.width() * 0.16;
                let (mut x, mut y) = (0i32, 0i32);
                if dist > dead {
                    let a = dy.atan2(dx);
                    let sector = (a / (std::f64::consts::PI / 4.0)).round() as i32;
                    x = [-1, -1, 0, 1, 1, 1, 0, -1, -1][(sector + 4) as usize];
                    y = [0, -1, -1, -1, 0, 1, 1, 1, 0][(sector + 4) as usize];
                }
                set(2, x < 0);
                set(3, x > 0);
                set(0, y < 0);
                set(1, y > 0);
                // dedo na borda do direcional = correr (o mesmo que tocar duas vezes na direção)
                let edge = x != 0 && dist > r.width() * 0.4;
                let mut run = running.borrow_mut();
                if edge && !*run {
                    let code = if x < 0 { "T_left" } else { "T_right" };
                    input::with(|i| {
                        i.set_key(code, false);
                        i.set_key(code, true);
                    });
                }
                *run = edge;
                if let Some(k) = &knob {
                    let kk = (dist / (r.width() / 2.0)).min(1.0) * r.width() * 0.28;
                    if let Some(h) = k.dyn_ref::<HtmlElement>() {
                        let _ = if dist > 1.0 {
                            h.style().set_property("transform", &format!("translate({}px, {}px)", dx / dist * kk, dy / dist * kk))
                        } else {
                            h.style().set_property("transform", "")
                        };
                    }
                }
            })
        };
        let release = {
            let pad = pad.clone();
            let knob = knob.clone();
            let set = set.clone();
            let running = running.clone();
            Rc::new(move || {
                for i in 0..4 {
                    set(i, false);
                }
                *running.borrow_mut() = false;
                if let Some(h) = knob.as_ref().and_then(|k| k.dyn_ref::<HtmlElement>()) {
                    let _ = h.style().set_property("transform", "");
                }
                let _ = pad.class_list().remove_1("on");
            })
        };
        {
            let (pad2, update) = (pad.clone(), update.clone());
            on(&pad, "pointerdown", move |e| {
                e.prevent_default();
                capture(&pad2, &e);
                let _ = pad2.class_list().add_1("on");
                sound::init();
                update(&e);
            });
        }
        {
            let (pad2, update) = (pad.clone(), update.clone());
            on(&pad, "pointermove", move |e| {
                if pad2.class_list().contains("on") {
                    update(&e);
                }
            });
        }
        for name in ["pointerup", "pointercancel", "lostpointercapture"] {
            let release = release.clone();
            on(&pad, name, move |_| release());
        }
    }

    // botões comuns (A, J, D, Esc, pausa)
    if let Ok(list) = touch.query_selector_all("[data-key]") {
        for i in 0..list.length() {
            let Some(btn) = list.item(i).and_then(|n| n.dyn_into::<Element>().ok()) else { continue };
            let code = btn.get_attribute("data-key").unwrap_or_default();
            {
                let (btn2, code) = (btn.clone(), code.clone());
                on(&btn, "pointerdown", move |e| {
                    e.prevent_default();
                    capture(&btn2, &e);
                    input::with(|i| i.set_key(&code, true));
                    let _ = btn2.class_list().add_1("on");
                    sound::init();
                });
            }
            for name in ["pointerup", "pointercancel", "lostpointercapture"] {
                let (btn2, code) = (btn.clone(), code.clone());
                on(&btn, name, move |e| {
                    e.prevent_default();
                    input::with(|i| i.set_key(&code, false));
                    let _ = btn2.class_list().remove_1("on");
                });
            }
        }
    }
}

// ---- botões de golpes especiais ----

fn specials_el() -> Option<Element> {
    document().query_selector("#touch .specials").ok().flatten()
}

fn clear_specials() {
    if let Some(el) = specials_el() {
        el.set_inner_html("");
        let _ = el.set_attribute("hidden", "");
    }
}

/// chamado ao trocar de tela
pub fn specials_update(screen: &Screen) {
    let (active, slot) = match screen {
        Screen::Match(s) if !s.m.demo => (true, 0),
        Screen::NetMatch(s) => (true, s.slot),
        _ => (false, 0),
    };
    SPECIALS.with(|s| {
        let mut s = s.borrow_mut();
        s.active = active;
        s.slot = slot;
        s.built_id = -1;
    });
    clear_specials();
}

/// chamado a cada quadro durante a partida: refaz os botões se o lutador mudou e apaga os sem MP
pub fn specials_poll(screen: &Screen) {
    let Some(m) = screen.match_ref() else { return };
    let (active, slot, built) = SPECIALS.with(|s| {
        let s = s.borrow();
        (s.active, s.slot, s.built_id)
    });
    if !active {
        return;
    }
    let Some(&ch) = m.characters().iter().find(|&&c| m.objs[c].ch().player == slot) else { return };
    let (id, mp, dir) = (m.objs[ch].id, m.objs[ch].health.mp, m.objs[ch].ps.dir);
    SPECIALS.with(|s| s.borrow_mut().dir = dir);
    let Some(el) = specials_el() else { return };
    if built != id {
        SPECIALS.with(|s| s.borrow_mut().built_id = id);
        el.set_inner_html("");
        let list = specials_of(id);
        for sp in list.iter().take(4) {
            let Ok(b) = document().create_element("button") else { continue };
            let _ = b.set_attribute("type", "button");
            let _ = b.set_attribute("data-cost", &sp.cost.to_string());
            let _ = b.set_attribute("aria-label", &format!("{} ({})", sp.kind, sp.cmd));
            b.set_inner_html(&format!("<small>{}</small>{}", sp.cmd.replace(' ', ""), sp.kind));
            let seq = sp.seq;
            on(&b, "pointerdown", move |e| {
                e.prevent_default();
                fire(&seq);
            });
            let _ = el.append_child(&b);
        }
        if list.is_empty() {
            let _ = el.set_attribute("hidden", "");
        } else {
            let _ = el.remove_attribute("hidden");
        }
    }
    let kids = el.children();
    for i in 0..kids.length() {
        if let Some(b) = kids.item(i) {
            let cost: f64 = b.get_attribute("data-cost").and_then(|c| c.parse().ok()).unwrap_or(0.0);
            let _ = b.class_list().toggle_with_force("low", mp < cost);
        }
    }
}

fn fire(seq: &[SeqKey; 3]) {
    sound::init();
    let dir = SPECIALS.with(|s| s.borrow().dir);
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
        let held: Vec<Key> = KEY_ACTIONS.iter().copied().filter(|a| i.down.contains(a.touch_code()) || i.down.contains(&i.keys[0][a.idx()])).collect();
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
