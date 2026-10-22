//! Modo Sobrevivência: ondas de inimigos cada vez mais fortes, sem fim.
//! Entre as ondas os jogadores recuperam parte da vida; a cada três ondas o cenário muda.
//! O recorde (ondas vencidas) fica salvo.

use crate::audio::sound;
use crate::core::consts::*;
use crate::core::input::{self, Key};
use crate::core::save;
use crate::engine::ai::Ai;
use crate::engine::background::Background;
use crate::engine::character::{reset, ResetOpts};
use crate::engine::object::Id;
use crate::engine::r#match::{Match, PanelSlot};
use crate::engine::stage::ENEMY_TEAM;
use crate::gfx::*;

pub struct SurvivalLogic {
    pub wave: i32,
    pub heroes: Vec<Id>,
    pub queue: Vec<(i32, bool)>, // (lutador, chefe)
    pub spawn_t: i32,
    pub cleared: bool,
    pub clear_t: i32,
    pub over_at: Option<i32>,
    pub kos: i32,
    pub bg_order: Vec<i32>,
}

impl SurvivalLogic {
    pub fn new(m: &mut Match) -> SurvivalLogic {
        let heroes: Vec<Id> = m.characters().into_iter().filter(|&c| m.objs[c].team == 1).collect();
        let mut bgs: Vec<i32> = m.assets.backgrounds.iter().map(|b| b.id).filter(|&id| id != m.bg.id).collect();
        // embaralha os cenários seguintes com o sorteio da partida
        for i in (1..bgs.len()).rev() {
            let j = (m.random() * (i + 1) as f64).floor() as usize;
            bgs.swap(i, j.min(i));
        }
        let mut s = SurvivalLogic { wave: 0, heroes, queue: vec![], spawn_t: 0, cleared: false, clear_t: 0, over_at: None, kos: 0, bg_order: bgs };
        s.next_wave(m);
        s
    }

    /// quantos inimigos a onda w tem (mais com mais jogadores)
    fn wave_size(&self, w: i32) -> usize {
        ((2 + (w + 1) / 2) as usize + if self.heroes.len() > 1 { 1 } else { 0 }).min(9)
    }

    fn next_wave(&mut self, m: &mut Match) {
        self.wave += 1;
        let w = self.wave;
        // a cada três ondas, outro cenário
        if w > 1 && (w - 1) % 3 == 0 && !self.bg_order.is_empty() {
            let id = self.bg_order.remove(0);
            self.bg_order.push(id);
            m.bg = Background::new(&m.assets, m.assets.bg(id));
            m.bg.cam_x = 0.0;
        }
        for o in m.live.clone() {
            if m.objs[o].team != 1 || !m.objs[o].is_char() {
                m.remove(o);
            }
        }
        m.effects.clear();
        m.tasks.clear();
        let n = self.heroes.len();
        for (k, &h) in self.heroes.clone().iter().enumerate() {
            let hh = m.objs[h].health.clone();
            let pos = if w == 1 || (w - 1) % 3 == 0 { Some((120.0 + k as f64 * 40.0, m.bg.pos(0.0, (k + 1) as f64 / (n + 1) as f64).1)) } else { None };
            // quem caiu volta com metade da vida; quem ficou de pé recupera um quarto
            let full = hh.hp_full;
            let bound = if hh.hp <= 0.0 { (full * 0.5).round() } else { hh.hp_bound.max((hh.hp + full * 0.25).min(full)) };
            let hp = if hh.hp <= 0.0 { bound } else { (hh.hp + full * 0.25).min(bound) };
            if w > 1 {
                reset(m, h, ResetOpts { hp: Some(hp), bound: Some(bound), mp: Some(hh.mp.max(MP_START)), pos, dir: Some(1) });
            } else if let Some(p) = pos {
                let zb = m.bg.zboundary;
                m.objs[h].set_pos(p.0, 0.0, p.1, zb);
                m.objs[h].switch_dir(1);
            }
        }
        // composição da onda: capangas no começo, elenco depois, chefe a cada cinco
        let size = self.wave_size(w);
        let roster: Vec<i32> = m.assets.character_list().into_iter().filter(|&id| id != 30).collect();
        let p_roster = (0.15 + w as f64 * 0.12).min(0.9);
        self.queue.clear();
        for i in 0..size {
            let boss = w % 5 == 0 && i == size - 1;
            let r = m.random();
            let id = if boss || r < p_roster {
                let k = (m.random() * roster.len() as f64).floor() as usize;
                roster[k.min(roster.len() - 1)]
            } else {
                30
            };
            self.queue.push((id, boss));
        }
        self.spawn_t = 25;
        self.cleared = false;
        self.clear_t = 0;
        m.bound = None;
        m.cam_bound = None;
        m.round_time = 0;
        let t = m.intro.max(45);
        m.announce(&format!("Onda {}", w), None, t);
        if m.random() < 0.7 {
            let ids = m.assets.weapon_ids();
            if !ids.is_empty() {
                let (ri, rx, rz) = (m.random(), m.random(), m.random());
                let id = ids[((ri * ids.len() as f64).floor() as usize).min(ids.len() - 1)];
                let (x, z) = m.bg.pos(0.2 + rx * 0.6, rz);
                m.create_weapon(id, x, -600.0, z);
            }
        }
    }

    fn spawn(&mut self, m: &mut Match, id: i32, boss: bool) {
        if m.assets.obj(id).is_none() {
            return;
        }
        let from_left = m.random() < 0.5;
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
        let w = self.wave;
        let o = &mut m.objs[c];
        let hp = if id == 30 {
            (180 + 60 * diff + 10 * w) as f64
        } else {
            let k = (0.6 + 0.08 * w as f64).min(1.3) * if boss { 1.3 } else { 1.0 };
            (o.health.hp_full * k).round()
        };
        o.health.hp = hp;
        o.health.hp_full = hp;
        o.health.hp_bound = hp;
        let level = ((diff - 1).max(0) + w / 4).min(3);
        let ai = Ai::new(m, c, if boss { level.max(diff) } else { level });
        m.ais.push(ai);
    }

    pub fn tu(&mut self, m: &mut Match) {
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
                let cleared = self.wave - 1;
                if !m.net {
                    save::edit_progress(|p| {
                        if cleared > p.survival_best {
                            p.survival_best = cleared;
                        }
                    });
                    save::save();
                }
            }
            if m.time == self.over_at.unwrap() + 45 {
                m.panel = self.heroes.iter().map(|&c| PanelSlot { ch: c, name: m.objs[c].ch().label.clone(), player: m.objs[c].ch().player }).collect();
                let w = self.wave - 1;
                m.show_summary(Some(&format!("Fim: {} onda{} vencida{}", w, if w == 1 { "" } else { "s" }, if w == 1 { "" } else { "s" })));
            }
            return;
        }
        let alive: Vec<Id> = enemies.iter().copied().filter(|&c| m.objs[c].health.hp > 0.0).collect();
        if self.cleared {
            self.clear_t += 1;
            if self.clear_t == 75 {
                self.next_wave(m);
            }
            return;
        }
        let diff = save::difficulty();
        let cap = 2 + diff.min(2) as usize + if self.heroes.len() > 1 { 1 } else { 0 };
        if !self.queue.is_empty() && alive.len() < cap && !m.in_intro() {
            self.spawn_t -= 1;
            if self.spawn_t <= 0 {
                let (id, boss) = self.queue.remove(0);
                self.spawn(m, id, boss);
                self.spawn_t = 35 + (m.random() * 30.0).floor() as i32;
            }
        }
        if self.queue.is_empty() && alive.is_empty() {
            self.cleared = true;
            self.kos += self.wave_size(self.wave) as i32;
            m.announce(&format!("Onda {} vencida!", self.wave), Some("Recuperando fôlego..."), 75);
            sound::play("m_end");
        }
    }

    pub fn draw(&self, ctx: &Ctx, m: &Match) {
        let left = self.queue.len() + m.characters().iter().filter(|&&c| m.objs[c].team == ENEMY_TEAM && m.objs[c].health.hp > 0.0).count();
        title(ctx, &format!("Onda {}", self.wave), 12.0, H - 16.0, 20.0, UI_TEXT, Align::Left);
        if !self.cleared && m.summary.is_none() {
            text(
                ctx,
                &format!("{} inimigo{} restante{}", left, if left == 1 { "" } else { "s" }, if left == 1 { "" } else { "s" }),
                96.0,
                H - 16.0,
                &TextOpt::default().size(12.0).color(UI_MUTED).shadow("#000"),
            );
        }
    }
}
