//! Teclado, controles por jogador, controle bluetooth e detector de combos.

use std::cell::RefCell;
use std::collections::HashSet;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use crate::audio::sound;
use crate::core::consts::*;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum Key {
    Up,
    Down,
    Left,
    Right,
    Att,
    Jump,
    Def,
}

pub const KEY_ACTIONS: [Key; 7] = [Key::Up, Key::Down, Key::Left, Key::Right, Key::Att, Key::Jump, Key::Def];

impl Key {
    pub fn idx(self) -> usize {
        match self {
            Key::Up => 0,
            Key::Down => 1,
            Key::Left => 2,
            Key::Right => 3,
            Key::Att => 4,
            Key::Jump => 5,
            Key::Def => 6,
        }
    }
    pub fn name(self) -> &'static str {
        ["up", "down", "left", "right", "att", "jump", "def"][self.idx()]
    }
    pub fn label(self) -> &'static str {
        ["Cima", "Baixo", "Esquerda", "Direita", "Ataque", "Pulo", "Defesa"][self.idx()]
    }
    pub fn from_name(s: &str) -> Option<Key> {
        KEY_ACTIONS.iter().copied().find(|k| k.name() == s)
    }
    /// código "T_up"... dos botões de toque (só o 1P)
    pub fn touch_code(self) -> &'static str {
        ["T_up", "T_down", "T_left", "T_right", "T_att", "T_jump", "T_def"][self.idx()]
    }
}

pub type KeyMap = [String; 7];

// Padrões: o 1P usa W X A D para mover, S ataca, Q pula e Z defende.
pub fn default_keys() -> Vec<KeyMap> {
    let k = |a: [&str; 7]| -> KeyMap { a.map(|s| s.to_string()) };
    vec![
        k(["KeyW", "KeyX", "KeyA", "KeyD", "KeyS", "KeyQ", "KeyZ"]),
        k(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "ShiftRight", "ControlRight"]),
        k(["KeyI", "Comma", "KeyJ", "KeyL", "KeyK", "KeyU", "KeyM"]),
        k(["Numpad8", "Numpad2", "Numpad4", "Numpad6", "Numpad5", "Numpad9", "Numpad0"]),
    ]
}

pub fn key_name(code: &str) -> String {
    if code.is_empty() {
        return "—".into();
    }
    let mut s = code.to_string();
    for (a, b) in [("Key", ""), ("Digit", "")] {
        if let Some(r) = s.strip_prefix(a) {
            s = format!("{}{}", b, r);
        }
    }
    let reps = [
        ("ArrowUp", "↑"),
        ("ArrowDown", "↓"),
        ("ArrowLeft", "←"),
        ("ArrowRight", "→"),
        ("Numpad", "Num "),
        ("Right", " Dir."),
        ("Left", " Esq."),
        ("Control", "Ctrl"),
        ("Comma", ","),
        ("Period", "."),
        ("Slash", "/"),
        ("Semicolon", ";"),
    ];
    for (a, b) in reps {
        s = s.replace(a, b);
    }
    s
}

/// Um controle: guarda quais teclas estão apertadas e junta os eventos, em ordem,
/// para o detector de combos do personagem, uma vez por TU.
#[derive(Clone, Default, Debug)]
pub struct Controller {
    pub state: [bool; 7],
    pub buf: Vec<(Key, bool)>,
}

impl Controller {
    pub fn key(&mut self, k: Key, down: bool) {
        self.buf.push((k, down));
    }
    pub fn is(&self, k: Key) -> bool {
        self.state[k.idx()]
    }
    pub fn clear(&mut self) {
        self.buf.clear();
        self.state = [false; 7];
    }
    // usados pela IA
    pub fn press(&mut self, k: Key) {
        if self.state[k.idx()] {
            self.key(k, false);
        }
        self.key(k, true);
        self.key(k, false);
    }
    pub fn hold(&mut self, k: Key, on: bool) {
        if self.state[k.idx()] != on {
            self.key(k, on);
        }
    }
}

// ---- combos ----

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Combo {
    Left,
    Right,
    Up,
    Down,
    Def,
    Jump,
    Att,
    LeftLeft,
    RightRight,
    JumpAtt,
    DLA,
    DRA,
    DDA,
    DUA,
    DLJ,
    DRJ,
    DDJ,
    DUJ,
    DLAJ,
    DRAJ,
    DJA,
}

pub struct ComboDef {
    pub name: Combo,
    pub seq: &'static [Key],
    pub maxtime: Option<i32>,
    pub keep: bool,
}

use Key::*;
pub const COMBO_LIST: &[ComboDef] = &[
    ComboDef { name: Combo::Left, seq: &[Left], maxtime: None, keep: true },
    ComboDef { name: Combo::Right, seq: &[Right], maxtime: None, keep: true },
    ComboDef { name: Combo::Up, seq: &[Up], maxtime: None, keep: true },
    ComboDef { name: Combo::Down, seq: &[Down], maxtime: None, keep: true },
    ComboDef { name: Combo::Def, seq: &[Def], maxtime: None, keep: true },
    ComboDef { name: Combo::Jump, seq: &[Jump], maxtime: None, keep: true },
    ComboDef { name: Combo::Att, seq: &[Att], maxtime: None, keep: true },
    ComboDef { name: Combo::LeftLeft, seq: &[Left, Left], maxtime: Some(9), keep: false },
    ComboDef { name: Combo::RightRight, seq: &[Right, Right], maxtime: Some(9), keep: false },
    ComboDef { name: Combo::JumpAtt, seq: &[Jump, Att], maxtime: Some(0), keep: true },
    ComboDef { name: Combo::DLA, seq: &[Def, Left, Att], maxtime: None, keep: true },
    ComboDef { name: Combo::DRA, seq: &[Def, Right, Att], maxtime: None, keep: true },
    ComboDef { name: Combo::DDA, seq: &[Def, Down, Att], maxtime: None, keep: false },
    ComboDef { name: Combo::DUA, seq: &[Def, Up, Att], maxtime: None, keep: false },
    ComboDef { name: Combo::DLJ, seq: &[Def, Left, Jump], maxtime: None, keep: false },
    ComboDef { name: Combo::DRJ, seq: &[Def, Right, Jump], maxtime: None, keep: false },
    ComboDef { name: Combo::DDJ, seq: &[Def, Down, Jump], maxtime: None, keep: false },
    ComboDef { name: Combo::DUJ, seq: &[Def, Up, Jump], maxtime: None, keep: false },
    ComboDef { name: Combo::DLAJ, seq: &[Def, Left, Att, Jump], maxtime: None, keep: false },
    ComboDef { name: Combo::DRAJ, seq: &[Def, Right, Att, Jump], maxtime: None, keep: false },
    ComboDef { name: Combo::DJA, seq: &[Def, Jump, Att], maxtime: None, keep: false },
];

impl Combo {
    pub fn priority(self) -> usize {
        COMBO_LIST.iter().position(|c| c.name == self).unwrap_or(99)
    }
    /// etiqueta do quadro (hit_a, hit_Fa...) que este combo dispara
    pub fn tag(self) -> Option<Tag> {
        Some(match self {
            Combo::Def => Tag::D,
            Combo::Jump => Tag::J,
            Combo::Att => Tag::A,
            Combo::DLA | Combo::DRA => Tag::Fa,
            Combo::DDA => Tag::Da,
            Combo::DUA => Tag::Ua,
            Combo::DLJ | Combo::DRJ | Combo::DLAJ | Combo::DRAJ => Tag::Fj,
            Combo::DDJ => Tag::Dj,
            Combo::DUJ => Tag::Uj,
            Combo::DJA => Tag::Ja,
            _ => return None,
        })
    }
    pub fn dir(self) -> i32 {
        match self {
            Combo::DLA | Combo::DLJ | Combo::DLAJ => -1,
            Combo::DRA | Combo::DRJ | Combo::DRAJ => 1,
            _ => 0,
        }
    }
    pub fn is_move(self) -> bool {
        matches!(self, Combo::Left | Combo::Right | Combo::Up | Combo::Down)
    }
}

/// Etiquetas dos quadros: para onde ir ao apertar ataque/defesa/pulo ou um especial.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum Tag {
    A,
    D,
    J,
    Fa,
    Ua,
    Da,
    Fj,
    Uj,
    Dj,
    Ja,
}

impl Tag {
    pub fn name(self) -> &'static str {
        match self {
            Tag::A => "hit_a",
            Tag::D => "hit_d",
            Tag::J => "hit_j",
            Tag::Fa => "hit_Fa",
            Tag::Ua => "hit_Ua",
            Tag::Da => "hit_Da",
            Tag::Fj => "hit_Fj",
            Tag::Uj => "hit_Uj",
            Tag::Dj => "hit_Dj",
            Tag::Ja => "hit_ja",
        }
    }
    pub fn from_name(s: &str) -> Option<Tag> {
        [Tag::A, Tag::D, Tag::J, Tag::Fa, Tag::Ua, Tag::Da, Tag::Fj, Tag::Uj, Tag::Dj, Tag::Ja].into_iter().find(|t| t.name() == s)
    }
}

/// Decodificador de combos de um personagem: olha a sequência recente de teclas.
#[derive(Clone, Default, Debug)]
pub struct ComboDecoder {
    seq: Vec<(Key, i32)>,
    pub time: i32,
}

impl ComboDecoder {
    pub fn new() -> ComboDecoder {
        ComboDecoder { seq: vec![], time: 1 }
    }
    /// uma tecla apertada (ignora repetição automática); devolve os combos detectados, em ordem
    pub fn key(&mut self, k: Key, down: bool, already_down: bool, out: &mut Vec<Combo>) {
        if !down || already_down {
            return;
        }
        if let Some(last) = self.seq.last() {
            if self.time - last.1 > COMBO_GAP {
                self.seq.clear();
            }
        }
        self.seq.push((k, self.time));
        if self.seq.len() > 12 {
            self.seq.remove(0);
        }
        for c in COMBO_LIST {
            let n = c.seq.len();
            if self.seq.len() < n {
                continue;
            }
            let j = self.seq.len() - n;
            let mut ok = true;
            for (i, ck) in c.seq.iter().enumerate() {
                if *ck != self.seq[j + i].0 {
                    ok = false;
                    break;
                }
            }
            if ok {
                if let Some(mt) = c.maxtime {
                    if self.seq[self.seq.len() - 1].1 - self.seq[j].1 > mt {
                        ok = false;
                    }
                }
            }
            if ok {
                out.push(c.name);
                if !c.keep {
                    self.seq.clear();
                }
            }
        }
    }
    pub fn frame(&mut self) {
        self.time += 1;
    }
}

// ---- teclado global ----

pub struct Input {
    pub keys: Vec<KeyMap>,
    pub controllers: Vec<Controller>, // 0-3 são os jogadores no mesmo aparelho; os demais são da IA/rede
    pub down: HashSet<String>,
    pub pressed: HashSet<String>, // códigos apertados neste quadro (menus)
    pub capture: bool,            // tela de configuração de teclas esperando uma tecla
    pub captured: Option<String>,
    pub touch_active: bool,
    pub run_edge: bool,
    pub touch_held: [bool; 4],
    pub android_back: bool,
}

thread_local! {
    pub static INPUT: RefCell<Input> = RefCell::new(Input {
        keys: default_keys(), controllers: (0..4).map(|_| Controller::default()).collect(),
        down: HashSet::new(), pressed: HashSet::new(), capture: false, captured: None, touch_active: false,
        run_edge: false, touch_held: [false; 4], android_back: false,
    });
}

pub fn with<R>(f: impl FnOnce(&mut Input) -> R) -> R {
    INPUT.with(|i| f(&mut i.borrow_mut()))
}

pub fn local_storage() -> Option<web_sys::Storage> {
    web_sys::window().and_then(|w| w.local_storage().ok().flatten())
}

impl Input {
    pub fn load_keys(&mut self) {
        if let Some(st) = local_storage() {
            if let Ok(Some(raw)) = st.get_item("punho.keys") {
                if let Ok(v) = serde_json::from_str::<Vec<KeyMap>>(&raw) {
                    if v.len() == 4 {
                        self.keys = v;
                    }
                }
            }
        }
    }
    pub fn save_keys(&self) {
        if let Some(st) = local_storage() {
            let _ = st.set_item("punho.keys", &serde_json::to_string(&self.keys).unwrap_or_default());
        }
    }
    pub fn is_game_key(&self, code: &str) -> bool {
        self.keys.iter().any(|k| k.iter().any(|c| c == code))
    }

    pub fn set_key(&mut self, code: &str, on: bool) {
        if on {
            if self.down.contains(code) {
                return;
            }
            self.down.insert(code.to_string());
            self.pressed.insert(code.to_string());
        } else {
            if !self.down.contains(code) {
                return;
            }
            self.down.remove(code);
        }
        for p in 0..4 {
            for a in KEY_ACTIONS {
                let gp = format!("G{}_{}", p, a.name());
                if self.keys[p][a.idx()] == code || (p == 0 && a.touch_code() == code) || code == gp {
                    self.controllers[p].key(a, on);
                }
            }
        }
    }

    /// ação do jogador p apertada neste quadro (para os menus)
    pub fn hit(&self, p: usize, a: Key) -> bool {
        if self.pressed.contains(&self.keys[p][a.idx()]) || self.pressed.contains(&format!("G{}_{}", p, a.name())) {
            return true;
        }
        p == 0 && self.pressed.contains(a.touch_code())
    }
    pub fn any_hit(&self, a: Key) -> bool {
        (0..4).any(|p| self.hit(p, a))
    }
    pub fn code(&self, c: &str) -> bool {
        self.pressed.contains(c)
    }
    pub fn end_frame(&mut self) {
        self.pressed.clear();
    }
    pub fn is_down(&self, c: &str) -> bool {
        self.down.contains(c)
    }

    pub fn new_controller(&mut self) -> usize {
        self.controllers.push(Controller::default());
        self.controllers.len() - 1
    }
    /// começo de partida: só os 4 controles humanos sobrevivem (e limpos)
    pub fn reset_controllers(&mut self) {
        self.controllers.truncate(4);
        for c in &mut self.controllers {
            c.clear();
        }
    }

    // Controles bluetooth/USB: o controle de índice i joga como o jogador i+1.
    // A e Y atacam, B pula, X defende, Start pausa. Direcional ou analógico esquerdo movem.
    pub fn poll_pads(&mut self) {
        let Some(win) = web_sys::window() else { return };
        let Ok(pads) = win.navigator().get_gamepads() else { return };
        for pad in pads.iter() {
            if pad.is_null() || pad.is_undefined() {
                continue;
            }
            let pad: web_sys::Gamepad = pad.unchecked_into();
            if !pad.connected() || pad.index() > 3 {
                continue;
            }
            let buttons = pad.buttons();
            let b = |i: u32| -> bool {
                let v = buttons.get(i);
                if v.is_undefined() || v.is_null() {
                    return false;
                }
                let gb: web_sys::GamepadButton = v.unchecked_into();
                gb.pressed()
            };
            let axes = pad.axes();
            let ax = axes.get(0).as_f64().unwrap_or(0.0);
            let ay = axes.get(1).as_f64().unwrap_or(0.0);
            let dz = 0.5;
            let want = [b(12) || ay < -dz, b(13) || ay > dz, b(14) || ax < -dz, b(15) || ax > dz, b(0) || b(3), b(1), b(2) || b(4) || b(5) || b(6) || b(7)];
            let idx = pad.index();
            for a in KEY_ACTIONS {
                self.set_key(&format!("G{}_{}", idx, a.name()), want[a.idx()]);
            }
            let start = format!("G{}_start", idx);
            self.set_key(&start, b(9));
            if self.down.contains(&start) && self.pressed.contains(&start) {
                self.set_key("Escape", true);
                self.set_key("Escape", false);
            }
        }
    }
}

/// Liga os eventos de teclado da janela.
pub fn init() {
    with(|i| i.load_keys());
    let win = web_sys::window().unwrap();
    let on_down = Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(move |e: web_sys::KeyboardEvent| {
        // digitando num campo de texto (formulário do jogo em rede)
        if let Some(t) = e.target() {
            if let Some(el) = t.dyn_ref::<web_sys::Element>() {
                let tag = el.tag_name();
                if tag == "INPUT" || tag == "TEXTAREA" {
                    return;
                }
            }
        }
        let code = e.code();
        let handled = INPUT.with(|i| {
            let Ok(mut i) = i.try_borrow_mut() else { return false };
            if i.capture {
                i.captured = Some(code.clone());
                i.capture = false;
                return true;
            }
            let prevent = i.is_game_key(&code) || code.starts_with("Arrow") || code.starts_with('F') && code.len() <= 3 || code == "Space";
            i.set_key(&code, true);
            prevent
        });
        if handled {
            e.prevent_default();
        }
        sound::init();
    });
    let on_up = Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(move |e: web_sys::KeyboardEvent| {
        let code = e.code();
        INPUT.with(|i| {
            if let Ok(mut i) = i.try_borrow_mut() {
                i.set_key(&code, false);
            }
        });
    });
    let on_blur = Closure::<dyn FnMut(web_sys::Event)>::new(move |_e: web_sys::Event| {
        INPUT.with(|i| {
            if let Ok(mut i) = i.try_borrow_mut() {
                let all: Vec<String> = i.down.iter().cloned().collect();
                for c in all {
                    i.set_key(&c, false);
                }
            }
        });
    });
    let _ = win.add_event_listener_with_callback("keydown", on_down.as_ref().unchecked_ref());
    let _ = win.add_event_listener_with_callback("keyup", on_up.as_ref().unchecked_ref());
    let _ = win.add_event_listener_with_callback("blur", on_blur.as_ref().unchecked_ref());
    on_down.forget();
    on_up.forget();
    on_blur.forget();
}

/// vibração curta ao levar dano, se o aparelho tiver
pub fn buzz(ms: i32) {
    if crate::core::save::settings().vibrate == 0 {
        return;
    }
    if let Some(w) = web_sys::window() {
        let _ = w.navigator().vibrate_with_duration(ms as u32);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed(d: &mut ComboDecoder, keys: &[Key]) -> Vec<Combo> {
        let mut out = vec![];
        for k in keys {
            d.key(*k, true, false, &mut out);
            d.frame();
        }
        out
    }

    #[test]
    fn special_sequence_is_detected() {
        let mut d = ComboDecoder::new();
        let out = feed(&mut d, &[Key::Def, Key::Right, Key::Att]);
        assert!(out.contains(&Combo::DRA), "D → A: {out:?}");
        assert_eq!(Combo::DRA.tag(), Some(Tag::Fa));
    }

    #[test]
    fn slow_keys_do_not_make_a_combo() {
        let mut d = ComboDecoder::new();
        let mut out = vec![];
        d.key(Key::Def, true, false, &mut out);
        for _ in 0..(COMBO_GAP + 2) {
            d.frame();
        }
        d.key(Key::Right, true, false, &mut out);
        d.frame();
        d.key(Key::Att, true, false, &mut out);
        assert!(!out.contains(&Combo::DRA));
    }

    #[test]
    fn double_tap_runs_only_when_quick() {
        let mut d = ComboDecoder::new();
        assert!(feed(&mut d, &[Key::Right, Key::Right]).contains(&Combo::RightRight));
        let mut d = ComboDecoder::new();
        let mut out = vec![];
        d.key(Key::Left, true, false, &mut out);
        for _ in 0..12 {
            d.frame();
        }
        d.key(Key::Left, true, false, &mut out);
        assert!(!out.contains(&Combo::LeftLeft));
    }

    #[test]
    fn auto_repeat_is_ignored() {
        let mut d = ComboDecoder::new();
        let mut out = vec![];
        d.key(Key::Att, true, true, &mut out);
        assert!(out.is_empty());
    }

    #[test]
    fn controller_press_and_hold() {
        let mut c = Controller::default();
        c.press(Key::Att);
        assert_eq!(c.buf, vec![(Key::Att, true), (Key::Att, false)]);
        c.state[Key::Left.idx()] = true;
        c.hold(Key::Left, true);
        assert_eq!(c.buf.len(), 2, "já estava segurando: nada novo");
        c.hold(Key::Left, false);
        assert_eq!(c.buf.last(), Some(&(Key::Left, false)));
    }

    #[test]
    fn key_names_are_readable() {
        assert_eq!(key_name("KeyS"), "S");
        assert_eq!(key_name("ArrowLeft"), "←");
        assert_eq!(key_name("ShiftRight"), "Shift Dir.");
        assert_eq!(key_name(""), "—");
    }
}
