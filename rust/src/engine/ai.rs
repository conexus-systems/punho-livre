//! Jogador controlado pelo computador. Aperta teclas num controle virtual, igual a
//! um humano, então usa as mesmas regras de combos e golpes especiais dos dados.

use crate::core::input::{self, Key, Tag};
use crate::engine::data::*;
use crate::engine::object::*;
use crate::engine::r#match::Match;

pub struct Level {
    pub name: &'static str,
    pub act: f64,
    pub special: f64,
    pub defend: f64,
    pub dodge: f64,
    pub roll: f64,
    pub combo: f64,
    pub every: i32,
}

pub const AI_LEVELS: [Level; 4] = [
    Level { name: "Fácil", act: 0.3, special: 0.05, defend: 0.02, dodge: 0.05, roll: 0.1, combo: 0.3, every: 9 },
    Level { name: "Normal", act: 0.5, special: 0.1, defend: 0.1, dodge: 0.15, roll: 0.3, combo: 0.55, every: 6 },
    Level { name: "Difícil", act: 0.75, special: 0.2, defend: 0.25, dodge: 0.4, roll: 0.6, combo: 0.85, every: 4 },
    Level { name: "Maluco!", act: 1.0, special: 0.35, defend: 0.45, dodge: 0.75, roll: 0.9, combo: 1.0, every: 3 },
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum SeqKey {
    K(Key),
    F, // frente: vira esquerda ou direita conforme o alvo
}

pub const SPECIAL_KEYS: [(Tag, [SeqKey; 3]); 7] = [
    (Tag::Fa, [SeqKey::K(Key::Def), SeqKey::F, SeqKey::K(Key::Att)]),
    (Tag::Ua, [SeqKey::K(Key::Def), SeqKey::K(Key::Up), SeqKey::K(Key::Att)]),
    (Tag::Da, [SeqKey::K(Key::Def), SeqKey::K(Key::Down), SeqKey::K(Key::Att)]),
    (Tag::Fj, [SeqKey::K(Key::Def), SeqKey::F, SeqKey::K(Key::Jump)]),
    (Tag::Uj, [SeqKey::K(Key::Def), SeqKey::K(Key::Up), SeqKey::K(Key::Jump)]),
    (Tag::Dj, [SeqKey::K(Key::Def), SeqKey::K(Key::Down), SeqKey::K(Key::Jump)]),
    (Tag::Ja, [SeqKey::K(Key::Def), SeqKey::K(Key::Jump), SeqKey::K(Key::Att)]),
];

#[derive(Clone, Debug, Default)]
pub struct SpecialInfo {
    pub ranged: bool,
    pub melee: bool,
    pub teleport: bool,
    pub heal: bool,
    pub cost: f64,
    pub reach: f64,
}

/// Classifica um golpe especial seguindo a cadeia de quadros a partir do quadro inicial.
pub fn classify_special(data: &ObjData, start: i32) -> SpecialInfo {
    let mut n = start;
    let mut info = SpecialInfo::default();
    let mut seen = std::collections::HashSet::new();
    for k in 0..24 {
        let Some(d) = data.frame(n) else { break };
        if seen.contains(&n) {
            break;
        }
        seen.insert(n);
        if k == 0 {
            if let Some(mp) = d.mp {
                if mp > 0 {
                    info.cost = (mp % 1000) as f64;
                }
            }
        }
        if !d.opoint.is_empty() {
            info.ranged = true;
        }
        if d.state == 400 {
            info.teleport = true;
        }
        if d.state == 1700 {
            info.heal = true;
        }
        for i in &d.itr {
            if i.kind == 0 {
                info.melee = true;
                info.reach = info.reach.max(i.x + i.w - d.centerx);
            }
            if i.kind == 8 {
                info.heal = true;
            }
        }
        if d.next == 999 || d.next == 0 || d.next == 1000 {
            break;
        }
        n = d.next.abs();
    }
    info.reach = info.reach.max(40.0);
    info
}

pub struct Ai {
    pub ch: Id,
    pub level: usize,
    pub target: Option<Id>,
    pub retarget: i32,
    pub defend_t: i32,
    pub specials: Vec<(Tag, [SeqKey; 3], SpecialInfo)>,
    pub z_bias: f64,
}

impl Ai {
    pub fn new(m: &mut Match, ch: Id, level: i32) -> Ai {
        let level = level.clamp(0, 3) as usize;
        let mut specials = vec![];
        {
            let o = &m.objs[ch];
            for (tag, seq) in SPECIAL_KEYS {
                if let Some(start) = o.frame_data(0).and_then(|f| f.tag(tag)) {
                    specials.push((tag, seq, classify_special(&o.data, start)));
                }
            }
        }
        let z_bias = (m.random() - 0.5) * 16.0;
        Ai { ch, level, target: None, retarget: 0, defend_t: 0, specials, z_bias }
    }

    pub fn l(&self) -> &'static Level {
        &AI_LEVELS[self.level]
    }
}

fn con_of(m: &Match, ch: Id) -> Option<usize> {
    m.objs[ch].ch().con
}

fn hold(m: &Match, ch: Id, k: Key, on: bool) {
    if let Some(c) = con_of(m, ch) {
        input::with(|i| i.controllers[c].hold(k, on));
    }
}
fn press(m: &Match, ch: Id, k: Key) {
    if let Some(c) = con_of(m, ch) {
        input::with(|i| i.controllers[c].press(k));
    }
}
fn release_moves(m: &Match, ch: Id) {
    for k in [Key::Up, Key::Down, Key::Left, Key::Right] {
        hold(m, ch, k, false);
    }
}
fn press_seq(m: &Match, ch: Id, seq: &[SeqKey; 3], dir: i32) {
    release_moves(m, ch);
    for k in seq {
        let key = match k {
            SeqKey::K(k) => *k,
            SeqKey::F => {
                if dir > 0 {
                    Key::Right
                } else {
                    Key::Left
                }
            }
        };
        press(m, ch, key);
    }
}
fn mv(m: &Match, ch: Id, dx: f64, dz: f64, tol: f64) {
    hold(m, ch, Key::Left, dx < -tol);
    hold(m, ch, Key::Right, dx > tol);
    hold(m, ch, Key::Up, dz < -4.0);
    hold(m, ch, Key::Down, dz > 4.0);
}

fn pick_target(m: &Match, ch: Id) -> Option<Id> {
    let me = &m.objs[ch];
    let mut best = None;
    let mut bd = f64::INFINITY;
    for &oid in &m.live {
        let o = &m.objs[oid];
        if !o.is_char() || o.team == me.team || o.health.hp <= 0.0 || !o.visible {
            continue;
        }
        let d = (o.ps.x - me.ps.x).abs() + 2.0 * (o.ps.z - me.ps.z).abs() + if o.state() == 14 { 250.0 } else { 0.0 };
        if d < bd {
            bd = d;
            best = Some(oid);
        }
    }
    best
}

pub fn think(m: &mut Match, ai_index: usize) {
    let ch = m.ais[ai_index].ch;
    let l = m.ais[ai_index].l();
    let (hp, summary) = (m.objs[ch].health.hp, m.summary.is_some());
    if hp <= 0.0 || summary {
        release_moves(m, ch);
        hold(m, ch, Key::Def, false);
        return;
    }
    let st = m.objs[ch].state();
    let n = m.objs[ch].frame.n;

    // recuperar no ar com rolamento
    if (n == 182 || n == 188) && m.random() < l.roll {
        press(m, ch, Key::Jump);
        return;
    }
    if m.ais[ai_index].defend_t > 0 {
        m.ais[ai_index].defend_t -= 3;
        let on = m.ais[ai_index].defend_t > 0;
        hold(m, ch, Key::Def, on);
        return;
    }

    {
        m.ais[ai_index].retarget -= 1;
        let stale = match m.ais[ai_index].target {
            Some(t) => m.objs[t].health.hp <= 0.0 || m.objs[t].uid < 0,
            None => true,
        };
        if m.ais[ai_index].retarget <= 0 || stale {
            let t = pick_target(m, ch);
            let ai = &mut m.ais[ai_index];
            ai.target = t;
            ai.retarget = 20;
        }
    }
    let Some(tg) = m.ais[ai_index].target else {
        release_moves(m, ch);
        return;
    };
    let (dx, dz) = {
        let (me, t) = (&m.objs[ch], &m.objs[tg]);
        (t.ps.x - me.ps.x, t.ps.z - me.ps.z)
    };
    let (adx, adz) = (dx.abs(), dz.abs());
    let dir = if dx >= 0.0 { 1 } else { -1 };
    let dir_key = if dir > 0 { Key::Right } else { Key::Left };
    let free = st == 0 || st == 1 || st == 2;

    // agarrando: soca ou arremessa
    if st == 9 {
        if m.random() < 0.6 {
            press(m, ch, Key::Att);
        } else if m.random() < 0.3 {
            hold(m, ch, dir_key, true);
            press(m, ch, Key::Att);
        }
        return;
    }
    if st == 3 || st == 15 {
        if m.random() < l.combo {
            press(m, ch, Key::Att);
        }
        return;
    }
    if !free && st != 4 && st != 5 && st != 7 {
        return;
    }

    // desviar de bolas de energia vindo na minha direção
    let (mx, mz, my_team) = (m.objs[ch].ps.x, m.objs[ch].ps.z, m.objs[ch].team);
    let incoming: Vec<Id> = m
        .live
        .iter()
        .copied()
        .filter(|&o| {
            let b = &m.objs[o];
            b.is_ball() && b.team != my_team
        })
        .collect();
    for o in incoming {
        let b = &m.objs[o];
        let ox = b.ps.x - mx;
        if (b.ps.z - mz).abs() < 20.0 && ox.abs() < 160.0 && b.ps.vx.signum() == -ox.signum() && free && m.random() < l.dodge {
            if m.random() < 0.5 {
                press(m, ch, Key::Jump);
            } else {
                let d = if ox == 0.0 { 1 } else { ox.signum() as i32 };
                m.objs[ch].switch_dir(d);
                m.ais[ai_index].defend_t = 9;
                press(m, ch, Key::Def);
                hold(m, ch, Key::Def, true);
            }
            return;
        }
    }

    if st == 4 {
        // no ar: chute
        if adx < 90.0 && adz < 18.0 && m.random() < l.act {
            press(m, ch, Key::Att);
        }
        return;
    }
    if st == 5 {
        if adx < 120.0 && adz < 18.0 && m.random() < l.act {
            press(m, ch, Key::Att);
        }
        return;
    }
    if st == 7 {
        return;
    }

    // golpes especiais
    let tg_state = m.objs[tg].state();
    if free && m.random() < l.special && tg_state != 14 {
        let (mp, hp, hp_full) = {
            let o = &m.objs[ch];
            (o.health.mp, o.health.hp, o.health.hp_full)
        };
        let mut opts: Vec<[SeqKey; 3]> = vec![];
        for (_, seq, sp) in &m.ais[ai_index].specials {
            if mp < sp.cost + 20.0 {
                continue;
            }
            if sp.heal {
                if hp < hp_full * 0.5 {
                    opts.push(*seq);
                }
                continue;
            }
            if sp.teleport {
                if adx > 250.0 {
                    opts.push(*seq);
                }
                continue;
            }
            if (sp.ranged && adz < 22.0 && adx > 90.0 && adx < 560.0) || (sp.melee && !sp.ranged && adz < 16.0 && adx < sp.reach + 50.0) {
                opts.push(*seq);
            }
        }
        if !opts.is_empty() {
            m.objs[ch].switch_dir(dir);
            let pick = (m.random() * opts.len() as f64).floor() as usize;
            press_seq(m, ch, &opts[pick.min(opts.len() - 1)], dir);
            return;
        }
    }

    // defender quando o alvo ataca de perto
    if tg_state == 3 && adx < 110.0 && adz < 20.0 && m.random() < l.defend {
        m.objs[ch].switch_dir(dir);
        release_moves(m, ch);
        m.ais[ai_index].defend_t = 12;
        press(m, ch, Key::Def);
        hold(m, ch, Key::Def, true);
        return;
    }

    // pegar arma por perto
    if m.objs[ch].ch().hold.is_none() && m.random() < 0.4 {
        let w = m.live.iter().copied().find(|&o| {
            let w = &m.objs[o];
            matches!(w.kind_type, ObjType::LightWeapon | ObjType::HeavyWeapon) && w.holder().is_none() && w.ps.y == 0.0 && (w.ps.x - mx).abs() < 160.0 && (w.ps.z - mz).abs() < 60.0
        });
        if let Some(w) = w {
            if adx > 120.0 {
                let wx = m.objs[w].ps.x - mx;
                let wz = m.objs[w].ps.z - mz;
                if wx.abs() < 25.0 && wz.abs() < 8.0 {
                    release_moves(m, ch);
                    press(m, ch, Key::Att);
                    return;
                }
                mv(m, ch, wx, wz, 6.0);
                return;
            }
        }
    }
    // arremessar arma pesada
    if let Some(h) = m.objs[ch].ch().hold {
        if m.objs[h].kind_type == ObjType::HeavyWeapon && adz < 18.0 && adx < 400.0 {
            m.objs[ch].switch_dir(dir);
            press(m, ch, Key::Att);
            return;
        }
    }

    let reach = 55.0;
    if adx < reach && adz < 12.0 {
        release_moves(m, ch);
        if m.objs[ch].dirh() != dir {
            hold(m, ch, dir_key, true);
            return;
        }
        if m.random() < l.act {
            press(m, ch, Key::Att);
        }
        return;
    }
    // pulo ou corrida com ataque
    if st == 2 {
        if adz < 16.0 && adx < 130.0 && m.random() < l.act {
            press(m, ch, Key::Att);
            return;
        }
        if adx < 170.0 && m.random() < 0.3 {
            press(m, ch, Key::Jump);
            return;
        }
        if dx.signum() as i32 != m.objs[ch].dirh() {
            press(m, ch, dir_key);
            return;
        }
        hold(m, ch, Key::Up, dz < -6.0);
        hold(m, ch, Key::Down, dz > 6.0);
        return;
    }
    if adx > 260.0 && adz < 60.0 && m.random() < 0.5 {
        release_moves(m, ch);
        m.objs[ch].switch_dir(dir);
        press(m, ch, dir_key);
        press(m, ch, dir_key);
        return;
    }
    if adx > 80.0 && adx < 150.0 && adz < 14.0 && m.random() < 0.12 * l.act {
        hold(m, ch, dir_key, true);
        press(m, ch, Key::Jump);
        return;
    }
    let zb = m.ais[ai_index].z_bias;
    mv(m, ch, dx - dir as f64 * (reach - 15.0), dz + if adx > 120.0 { zb } else { 0.0 }, 8.0);
}
