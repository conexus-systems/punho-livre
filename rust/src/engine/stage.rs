//! Modo História: os jogadores (time 1) atravessam o cenário em trechos.
//! Cada trecho só libera o próximo ("SIGA →") quando todos os inimigos caem.
//! Os chefes de cada fase são lutadores do elenco.

use crate::audio::sound;
use crate::core::consts::*;
use crate::core::input::{self, Key};
use crate::core::save;
use crate::engine::ai::Ai;
use crate::engine::background::Background;
use crate::engine::character::{reset, ResetOpts};
use crate::engine::object::Id;
use crate::engine::r#match::{Bound, Match, PanelSlot};
use crate::gfx::*;

pub struct StageDef {
    pub bg: i32,
    pub phases: Vec<Vec<&'static str>>,
}

pub fn stages() -> Vec<StageDef> {
    vec![
        StageDef { bg: 1, phases: vec![vec!["30", "30", "30"], vec!["30", "30", "30", "30"], vec!["30", "30", "!8"]] },
        StageDef { bg: 3, phases: vec![vec!["30", "30", "30", "30"], vec!["30", "30", "!6"], vec!["30", "30", "!3", "!6"]] },
        StageDef { bg: 5, phases: vec![vec!["30", "30", "30", "30"], vec!["30", "30", "30", "!5"], vec!["30", "30", "!4", "!5"]] },
        StageDef { bg: 2, phases: vec![vec!["30", "30", "30", "30", "30"], vec!["30", "30", "!2"], vec!["30", "!7", "!2"]] },
        StageDef { bg: 4, phases: vec![vec!["30", "30", "30", "30", "30"], vec!["30", "30", "!3", "!4"], vec!["!1", "!7", "!8"]] },
    ]
}

pub const STAGE_COUNT: usize = 5;
pub const ENEMY_TEAM: i32 = 99;

pub struct StageLogic {
    pub stage_index: usize,
    pub heroes: Vec<Id>,
    pub section_w: f64,
    pub phase: usize,
    pub queue: Vec<&'static str>,
    pub locked: bool,
    pub go_arrow: bool,
    pub spawn_t: i32,
    pub cleared: bool,
    pub clear_t: i32,
    pub over_at: Option<i32>,
}

impl StageLogic {
    pub fn new(m: &mut Match, stage_index: usize) -> StageLogic {
        let heroes = m.characters().into_iter().filter(|&c| m.objs[c].team == 1).collect();
        let mut s =
            StageLogic { stage_index, heroes, section_w: 0.0, phase: 0, queue: vec![], locked: true, go_arrow: false, spawn_t: 0, cleared: false, clear_t: 0, over_at: None };
        s.load_stage(m, stage_index, true);
        s
    }

    fn load_stage(&mut self, m: &mut Match, i: usize, first: bool) {
        let st = &stages()[i];
        self.stage_index = i;
        m.bg = Background::new(&m.assets, m.assets.bg(st.bg));
        for o in m.live.clone() {
            if m.objs[o].team != 1 || !m.objs[o].is_char() {
                m.remove(o);
            }
        }
        m.effects.clear();
        m.tasks.clear();
        self.section_w = m.bg.width / st.phases.len() as f64;
        let n = self.heroes.len();
        for (k, &h) in self.heroes.clone().iter().enumerate() {
            let z = m.bg.pos(0.0, (k + 1) as f64 / (n + 1) as f64).1;
            let pos = (80.0 + k as f64 * 30.0, z);
            if first {
                let zb = m.bg.zboundary;
                m.objs[h].set_pos(pos.0, 0.0, pos.1, zb);
                m.objs[h].switch_dir(1);
                continue;
            }
            let hh = m.objs[h].health.clone();
            // quem caiu volta com 40% da vida; quem ficou de pé recupera 150
            let bound = if hh.hp <= 0.0 { (hh.hp_full * 0.4).round() } else { hh.hp_bound.max((hh.hp + 150.0).min(hh.hp_full)) };
            let hp = if hh.hp <= 0.0 { bound } else { (hh.hp + 150.0).min(bound) };
            reset(m, h, ResetOpts { hp: Some(hp), bound: Some(bound), mp: Some(hh.mp), pos: Some(pos), dir: Some(1) });
        }
        m.bg.cam_x = 0.0;
        m.round_time = 0;
        self.cleared = false;
        self.clear_t = 0;
        self.start_phase(m, 0);
        let t = m.intro.max(45);
        m.announce(&format!("Fase {}", i + 1), None, t);
        if !m.net {
            let best = save::progress().story_best;
            if i as i32 > best {
                save::edit_progress(|p| p.story_best = i as i32);
                save::save();
            }
        }
    }

    fn start_phase(&mut self, m: &mut Match, p: usize) {
        self.phase = p;
        self.queue = stages()[self.stage_index].phases[p].clone();
        self.locked = true;
        self.go_arrow = false;
        self.spawn_t = 20;
        self.set_bounds(m, p as f64 * self.section_w, (p + 1) as f64 * self.section_w);
        if m.random() < 0.6 {
            let ids = m.assets.weapon_ids();
            let rz = m.random();
            let z = m.bg.pos(0.0, rz).1;
            if !ids.is_empty() {
                let (ri, rx) = (m.random(), m.random());
                let id = ids[((ri * ids.len() as f64).floor() as usize).min(ids.len() - 1)];
                m.create_weapon(id, p as f64 * self.section_w + 200.0 + rx * 300.0, -600.0, z);
            }
        }
    }

    fn set_bounds(&mut self, m: &mut Match, min: f64, max: f64) {
        m.bound = Some(Bound { team: 1, min: min + 10.0, max: max - 10.0 });
        m.cam_bound = Some((min, (max - W).max(min)));
    }

    fn spawn(&mut self, m: &mut Match, spec: &str) {
        let boss = spec.starts_with('!');
        let id: i32 = if boss { spec[1..].parse().unwrap_or(30) } else { spec.parse().unwrap_or(30) };
        if m.assets.obj(id).is_none() {
            return;
        }
        let from_left = self.phase > 0 && m.random() < 0.4;
        let x = if from_left { m.bg.cam_x - 60.0 } else { m.bg.cam_x + W + 60.0 };
        let con = input::with(|i| i.new_controller());
        let c = m.add_character(id, ENEMY_TEAM, Some(con), -1, if boss { "Chefe" } else { "COM" }, true);
        let rz = m.random();
        let z = m.bg.pos(0.0, rz).1;
        let zb = m.bg.zboundary;
        let bw = m.bg.width;
        m.objs[c].set_pos(x.clamp(0.0, bw), 0.0, z, zb);
        m.objs[c].switch_dir(if from_left { 1 } else { -1 });
        let diff = save::difficulty();
        if !boss {
            let hp = (180 + 60 * diff) as f64;
            let o = &mut m.objs[c];
            o.health.hp = hp;
            o.health.hp_full = hp;
            o.health.hp_bound = hp;
        }
        let ai = Ai::new(m, c, if boss { diff } else { (diff - 1).max(0) });
        m.ais.push(ai);
    }

    pub fn tu(&mut self, m: &mut Match) {
        // painel: jogadores primeiro, depois os inimigos em campo
        let enemies: Vec<Id> = m.characters().into_iter().filter(|&c| m.objs[c].team == ENEMY_TEAM && m.objs[c].uid >= 0).collect();
        m.panel = self.heroes.iter().chain(enemies.iter()).take(8).map(|&c| PanelSlot { ch: c, name: m.objs[c].ch().label.clone(), player: m.objs[c].ch().player }).collect();

        if m.summary.is_some() {
            let att = input::with(|i| i.any_hit(Key::Att) || i.any_hit(Key::Jump));
            if m.time > self.over_at.unwrap_or(0) + 60 && att {
                m.end();
            }
            return;
        }
        if !self.heroes.iter().any(|&h| m.objs[h].health.hp > 0.0) {
            if self.over_at.is_none() {
                self.over_at = Some(m.time);
            }
            if m.time == self.over_at.unwrap() + 45 {
                m.panel = self.heroes.iter().map(|&c| PanelSlot { ch: c, name: m.objs[c].ch().label.clone(), player: m.objs[c].ch().player }).collect();
                m.show_summary(Some("Game Over"));
            }
            return;
        }
        let alive: Vec<Id> = enemies.iter().copied().filter(|&c| m.objs[c].health.hp > 0.0).collect();
        if self.cleared {
            self.clear_t += 1;
            if self.clear_t == 90 {
                if self.stage_index + 1 < STAGE_COUNT {
                    let next = self.stage_index + 1;
                    self.load_stage(m, next, false);
                } else {
                    self.over_at = Some(m.time);
                    m.panel = self.heroes.iter().map(|&c| PanelSlot { ch: c, name: m.objs[c].ch().label.clone(), player: m.objs[c].ch().player }).collect();
                    save::edit_progress(|p| {
                        p.story_clears += 1;
                        p.story_best = STAGE_COUNT as i32 - 1;
                    });
                    save::save();
                    m.show_summary(Some("Todas as fases concluídas!"));
                }
            }
            return;
        }
        let diff = save::difficulty();
        if self.locked {
            let cap = 2 + diff.min(2) as usize + if self.heroes.len() > 1 { 1 } else { 0 };
            if !self.queue.is_empty() && alive.len() < cap {
                self.spawn_t -= 1;
                if self.spawn_t <= 0 {
                    let spec = self.queue.remove(0);
                    self.spawn(m, spec);
                    self.spawn_t = 45 + (m.random() * 30.0).floor() as i32;
                }
            }
            if self.queue.is_empty() && alive.is_empty() {
                if self.phase == stages()[self.stage_index].phases.len() - 1 {
                    self.cleared = true;
                    m.announce("Fase concluída!", None, 90);
                    sound::play("m_end");
                } else {
                    self.locked = false;
                    self.go_arrow = true;
                    let (a, b) = (self.phase as f64 * self.section_w, (self.phase + 2) as f64 * self.section_w);
                    self.set_bounds(m, a, b);
                }
            }
        } else if self.heroes.iter().any(|&h| m.objs[h].health.hp > 0.0 && m.objs[h].ps.x > (self.phase + 1) as f64 * self.section_w + 60.0) {
            let p = self.phase + 1;
            self.start_phase(m, p);
        }
    }

    pub fn draw(&self, ctx: &Ctx, m: &Match) {
        if self.go_arrow && (m.time / 10) % 2 == 0 {
            title(ctx, "SIGA →", W - 30.0, 240.0, 40.0, UI_AMBER, Align::Right);
        }
        title(ctx, &format!("Fase {}-{}", self.stage_index + 1, self.phase + 1), 12.0, H - 16.0, 20.0, UI_TEXT, Align::Left);
    }
}
