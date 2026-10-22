//! Salvamento local (ajustes, progresso da História e recordes). Fica no
//! armazenamento do aparelho; se ele não estiver disponível, o jogo funciona
//! normalmente e só não lembra de nada.

use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;

use crate::audio::sound;
use crate::core::input::local_storage;

const SAVE_KEY: &str = "punho.save";

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(default)]
pub struct Settings {
    pub sfx: i32,
    pub music: i32,
    #[serde(rename = "touchOpacity")]
    pub touch_opacity: i32,
    #[serde(rename = "touchScale")]
    pub touch_scale: i32,
    pub difficulty: i32,
    pub vibrate: i32,
    pub shake: i32,
    #[serde(rename = "hitNumbers")]
    pub hit_numbers: i32,
    pub rounds: i32,
    #[serde(rename = "timeLimit")]
    pub time_limit: i32,
    pub name: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings { sfx: 8, music: 6, touch_opacity: 6, touch_scale: 10, difficulty: 1, vibrate: 1, shake: 1, hit_numbers: 1, rounds: 1, time_limit: 0, name: String::new() }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct Progress {
    #[serde(rename = "storyBest")]
    pub story_best: i32,
    #[serde(rename = "storyClears")]
    pub story_clears: i32,
    #[serde(rename = "survivalBest")]
    pub survival_best: i32,
    pub fights: i32,
    pub wins: i32,
    pub kos: i32,
    pub seconds: i32,
    #[serde(rename = "bestChars")]
    pub best_chars: HashMap<String, i32>,
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct SaveData {
    pub settings: Settings,
    pub progress: Progress,
}

thread_local! {
    static SAVE: RefCell<SaveData> = RefCell::new(SaveData::default());
    static DIFFICULTY: RefCell<i32> = const { RefCell::new(1) };
}

pub fn load() {
    let mut d = SaveData::default();
    if let Some(st) = local_storage() {
        if let Ok(Some(raw)) = st.get_item(SAVE_KEY) {
            if let Ok(v) = serde_json::from_str::<SaveData>(&raw) {
                d = v;
            }
        }
    }
    d.settings.difficulty = d.settings.difficulty.clamp(0, 3);
    SAVE.with(|s| *s.borrow_mut() = d);
}

pub fn save() {
    let raw = SAVE.with(|s| serde_json::to_string(&*s.borrow()).unwrap_or_default());
    if let Some(st) = local_storage() {
        let _ = st.set_item(SAVE_KEY, &raw);
    }
}

pub fn settings() -> Settings {
    SAVE.with(|s| s.borrow().settings.clone())
}
pub fn progress() -> Progress {
    SAVE.with(|s| s.borrow().progress.clone())
}
pub fn edit_settings(f: impl FnOnce(&mut Settings)) {
    SAVE.with(|s| f(&mut s.borrow_mut().settings));
}
pub fn edit_progress(f: impl FnOnce(&mut Progress)) {
    SAVE.with(|s| f(&mut s.borrow_mut().progress));
}

pub fn reset_progress() {
    SAVE.with(|s| s.borrow_mut().progress = Progress::default());
    save();
}

/// dificuldade da partida atual (começa no ajuste salvo)
pub fn difficulty() -> i32 {
    DIFFICULTY.with(|d| *d.borrow())
}
pub fn set_difficulty(v: i32) {
    let v = v.rem_euclid(4);
    DIFFICULTY.with(|d| *d.borrow_mut() = v);
    edit_settings(|s| s.difficulty = v);
    save();
}

/// aplica os ajustes ao resto do jogo (som, dificuldade e botões de toque)
pub fn apply() {
    let s = settings();
    sound::set_volumes(s.sfx as f64 / 10.0, s.music as f64 / 10.0);
    DIFFICULTY.with(|d| *d.borrow_mut() = s.difficulty);
    if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
        if let Some(root) = doc.document_element() {
            if let Some(el) = wasm_bindgen::JsCast::dyn_ref::<web_sys::HtmlElement>(&root) {
                let st = el.style();
                let _ = st.set_property("--touch-opacity", &format!("{}", 0.25 + (s.touch_opacity as f64 / 10.0) * 0.75));
                let _ = st.set_property("--touch-scale", &format!("{}", 0.7 + (s.touch_scale as f64 / 10.0) * 0.3));
            }
        }
    }
}

/// linha do resumo de uma luta, para as estatísticas
pub struct ResultRow {
    pub human: bool,
    pub win: bool,
    pub kill: i32,
    pub char_id: i32,
}

/// registra o resultado de uma luta dos jogadores humanos
pub fn record(rows: &[ResultRow], seconds: f64) {
    let mine: Vec<&ResultRow> = rows.iter().filter(|r| r.human).collect();
    if mine.is_empty() {
        return;
    }
    edit_progress(|p| {
        p.fights += 1;
        p.seconds += seconds.round() as i32;
        for r in &mine {
            p.kos += r.kill;
            if r.win {
                p.wins += 1;
                *p.best_chars.entry(r.char_id.to_string()).or_insert(0) += 1;
            }
        }
    });
    save();
}
