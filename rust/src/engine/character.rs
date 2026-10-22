//! Lutador: estados (parado, andando, correndo, pulando, defendendo,
//! agarrando, caindo...), combos, golpes, agarrões e armas.
//!
//! Quadros importantes (protocolo dos dados, ver content/moves.rs):
//!   0-3 parado · 5-8 andando · 9-11 correndo · 12-19 com objeto pesado
//!   20-58 golpes e arremessos com arma · 60-73 socos · 80-91 ataques no ar/correndo
//!   100-109 rolamento · 110-114 defesa · 115-117 pegar arma · 120-144 agarrão
//!   180-191 queda · 200-206 gelo e fogo · 210-219 pulo, avanço, agachar · 220-234 dor, deitado

use crate::audio::sound;
use crate::core::consts::*;
use crate::core::input::{self, Combo, Key, Tag};
use crate::engine::data::*;
use crate::engine::object::*;
use crate::engine::r#match::Match;

/// estados em que o lutador pode virar de lado com o direcional
pub fn char_switch(state: i32) -> bool {
    matches!(state, 0 | 1 | 4 | 7)
}

/// vai para o quadro F (o `trans.frame` do lutador confere se há MP para o quadro de destino)
pub fn go(m: &mut Match, id: Id, f: i32, au: i32) {
    let o = &mut m.objs[id];
    if f == 0 || f == 999 {
        o.trans.set_next(f, au, 0);
        o.trans.set_wait(0, au, 0);
        return;
    }
    let Some(nf) = o.frame_data(f.abs()) else { return };
    let dmp = match nf.mp {
        Some(mp) if mp > 0 => (mp % 1000) as f64,
        _ => 0.0,
    };
    if o.health.mp - dmp >= 0.0 {
        o.trans.set_next(f, au, 0);
        o.trans.set_wait(0, au, 0);
    }
}

fn heavy_hold(m: &Match, id: Id) -> bool {
    match m.objs[id].ch().hold {
        Some(h) => m.objs[h].kind_type == ObjType::HeavyWeapon,
        None => false,
    }
}

fn dxz(o: &Obj) -> (i32, i32) {
    let mut dx = 0;
    let mut dz = 0;
    if o.con_is(Key::Left) {
        dx -= 1;
    }
    if o.con_is(Key::Right) {
        dx += 1;
    }
    if o.con_is(Key::Up) {
        dz -= 1;
    }
    if o.con_is(Key::Down) {
        dz += 1;
    }
    (dx, dz)
}

fn sign(v: f64) -> i32 {
    if v > 0.0 {
        1
    } else {
        -1
    }
}

/// comportamento comum a todos os estados
fn generic(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    match ev {
        Ev::Frame => {
            let (mp, pn_next, n) = {
                let o = &m.objs[id];
                (o.fd().mp, o.frame_data(o.frame.pn).map(|d| d.next), o.frame.n)
            };
            if let Some(mp) = mp {
                if mp != 0 {
                    if pn_next == Some(n) {
                        // quadro alcançado pelo `next`: mp negativo consome MP continuamente
                        if mp < 0 {
                            let hit_d = m.objs[id].fd().tag(Tag::D);
                            let o = &mut m.objs[id];
                            o.health.mp += mp as f64;
                            o.health.mp_usage -= mp as f64;
                            if o.health.mp < 0.0 {
                                o.health.mp = 0.0;
                                if let Some(d) = hit_d {
                                    go(m, id, d, 0);
                                }
                            }
                        }
                    } else {
                        let dmp = (mp % 1000) as f64;
                        let dhp = ((mp / 1000) * 10) as f64;
                        let o = &mut m.objs[id];
                        o.health.mp -= dmp;
                        o.health.mp_usage += dmp;
                        injury(m, id, dhp);
                    }
                }
            }
            opoint(m, id);
        }
        Ev::Tu => {
            disappear_tu(m, id);
            if m.state_update(id, Ev::PostInteraction, None).is_none() {
                post_interaction(m, id);
            }
            let (y, vy, n, pn, st) = {
                let o = &m.objs[id];
                (o.ps.y, o.ps.vy, o.frame.n, o.frame.pn, o.state())
            };
            if y == 0.0 && vy == 0.0 && n == 212 && pn != 211 {
                go(m, id, 999, 0);
            } else if y == 0.0 && vy > 0.0 {
                // caiu no chão
                let r = m.state_update(id, Ev::FellOntoGround, None);
                if let Some(r) = r {
                    go(m, id, r, 15);
                } else {
                    let o = &mut m.objs[id];
                    o.ps.vy = 0.0;
                    let (fx, fz) = (lookup_abs(FELL_FRICTION, o.ps.vx), lookup_abs(FELL_FRICTION, o.ps.vz));
                    o.linear_friction(fx, fz);
                }
            } else if y + vy >= 0.0 && vy > 0.0 {
                // vai tocar o chão
                let r = m.state_update(id, Ev::FallOntoGround, None);
                if let Some(r) = r {
                    go(m, id, r, 15);
                } else if st == 13 {
                    // congelado: cai parado
                } else if n == 212 {
                    go(m, id, 215, 15);
                } else {
                    go(m, id, 219, 15);
                }
            }
            let t = m.time;
            let o = &mut m.objs[id];
            // recuperação natural de vida (até o limite escuro) e de MP
            if t % 12 == 0 && o.health.hp > 0.0 && o.health.hp < o.health.hp_bound {
                o.health.hp += 1.0;
            }
            if o.health.hp > 0.0 && o.effect.heal > 0.0 && t % 8 == 0 {
                if o.health.hp + 8.0 <= o.health.hp_bound {
                    o.health.hp += 8.0;
                }
                o.effect.heal -= 8.0;
            }
            if t % 3 == 0 && o.health.mp < o.health.mp_full && !o.dead {
                let lost = o.health.hp_full - o.health.hp.min(o.health.hp_full);
                o.health.mp = (o.health.mp + 1.0 + (lost / 100.0).floor()).min(o.health.mp_full);
            }
            if o.health.fall > 0.0 {
                o.health.fall += RECOVER_FALL;
            }
            if o.health.bdefend > 0.0 {
                o.health.bdefend += RECOVER_BDEFEND;
            }
            let c = o.ch_mut();
            if c.flash_t > 0 {
                c.flash_t -= 1;
            }
            c.combo_timeout -= 1;
            if c.combo_timeout == 0 && matches!(c.combo_name, Some(Combo::Def) | Some(Combo::Jump) | Some(Combo::Att) | Some(Combo::LeftLeft) | Some(Combo::RightRight)) {
                c.combo_name = None;
            }
        }
        Ev::Transit => {
            m.dynamics(id);
            wpoint(m, id);
        }
        Ev::Combo => {
            if let Some(k) = k {
                if !matches!(k, Combo::Left | Combo::Right | Combo::LeftLeft | Combo::RightRight) {
                    if let Some(tag) = k.tag() {
                        let target = m.objs[id].fd().tag(tag);
                        if let Some(target) = target {
                            let dir = k.dir();
                            if dir != 0 {
                                m.objs[id].switch_dir(dir);
                            }
                            go(m, id, target, 11);
                            return Some(1);
                        }
                    }
                }
            }
        }
        Ev::PostCombo => {
            pre_interaction(m, id);
        }
        Ev::StateExit => {
            let c = m.objs[id].ch_mut();
            if matches!(c.combo_name, Some(Combo::LeftLeft) | Some(Combo::RightRight)) {
                c.combo_name = None;
            }
        }
        _ => {}
    }
    None
}

/// comportamento do estado atual do lutador
fn by_state(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    let st = m.objs[id].state();
    match st {
        0 => state_standing(m, id, ev, k),
        1 => state_walking(m, id, ev, k),
        2 => state_running(m, id, ev, k),
        3 => state_attack(m, id, ev),
        4 => state_jump(m, id, ev, k),
        5 => state_dash(m, id, ev, k),
        6 => state_roll(m, id, ev),
        7 => {
            if ev == Ev::Frame && m.objs[id].frame.n == 111 {
                m.objs[id].trans.inc_wait(4, 0, 0);
            }
            None
        }
        8 => state_broken(m, id, ev),
        9 => state_catching(m, id, ev, k),
        10 => state_caught(m, id, ev),
        11 => {
            if ev == Ev::StateEntry {
                m.objs[id].trans.inc_wait(0, 20, 0);
            }
            if ev == Ev::Frame && matches!(m.objs[id].frame.n, 221 | 223 | 225) {
                m.objs[id].trans.set_next(999, 0, 0);
            }
            None
        }
        12 => state_falling(m, id, ev, k),
        13 => {
            if ev == Ev::StateExit {
                m.broken_effect_of(id, 212, 8);
            }
            None
        }
        14 => state_lying(m, id, ev),
        15 => state_misc(m, id, ev, k),
        17 => state_drink(m, id, ev),
        18 => {
            if ev == Ev::Frame {
                m.broken_effect_of(id, 302, 1);
            }
            if ev == Ev::FallOntoGround {
                m.broken_effect_of(id, 302, 8);
            }
            if ev == Ev::FallOntoGround || ev == Ev::FellOntoGround {
                return state_falling(m, id, ev, k);
            }
            None
        }
        19 => {
            if ev == Ev::Tu {
                let o = &mut m.objs[id];
                let v = o.dirv() as f64 * o.data.bmp.running_speedz;
                o.ps.vz = v;
            }
            None
        }
        400 => {
            // teletransporte até o inimigo mais próximo
            if ev == Ev::Frame {
                let team = m.objs[id].team;
                let list = m.query_all(id, &Where { not_team: Some(team), kind: Some(ObjType::Character), sort_distance: true, ..Default::default() });
                if let Some(&t) = list.first() {
                    let (tx, tz) = (m.objs[t].ps.x, m.objs[t].ps.z);
                    let o = &mut m.objs[id];
                    o.ps.x = tx - 120.0 * o.dirh() as f64;
                    o.ps.y = 0.0;
                    o.ps.z = tz;
                }
            }
            None
        }
        401 => {
            if ev == Ev::Frame {
                let team = m.objs[id].team;
                let list = m.query_all(id, &Where { team: Some(team), kind: Some(ObjType::Character), sort_distance: true, ..Default::default() });
                if let Some(&t) = list.last() {
                    let (tx, tz) = (m.objs[t].ps.x, m.objs[t].ps.z);
                    let o = &mut m.objs[id];
                    o.ps.x = tx + 60.0 * o.dirh() as f64;
                    o.ps.y = 0.0;
                    o.ps.z = tz;
                }
            }
            None
        }
        1700 => {
            if ev == Ev::Frame {
                m.objs[id].effect.heal = HEAL_MAX;
            }
            None
        }
        _ => None,
    }
}

pub fn update(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    let r1 = generic(m, id, ev, k);
    let r2 = by_state(m, id, ev, k);
    r1.or(r2)
}

// ---- estados ----

fn state_standing(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    let heavy = heavy_hold(m, id);
    match ev {
        Ev::Frame => {
            if heavy {
                go(m, id, 12, 0);
            }
            None
        }
        Ev::Combo => {
            if matches!(k, Some(Combo::Left) | Some(Combo::Right) | Some(Combo::Up) | Some(Combo::Down) | Some(Combo::Jump) | None) {
                let o = &m.objs[id];
                let dx = o.con_is(Key::Left) != o.con_is(Key::Right);
                let dz = o.con_is(Key::Up) != o.con_is(Key::Down);
                if dx || dz {
                    let (dirh, dirv) = (o.dirh() as f64, o.dirv() as f64);
                    let b = o.data.bmp.clone();
                    if heavy {
                        let o = &mut m.objs[id];
                        if dx {
                            o.ps.vx = dirh * b.heavy_walking_speed;
                        }
                        o.ps.vz = dirv * b.heavy_walking_speedz;
                    } else {
                        if k != Some(Combo::Jump) {
                            go(m, id, 5, 5);
                        }
                        let o = &mut m.objs[id];
                        if dx {
                            o.ps.vx = dirh * b.walking_speed;
                        }
                        o.ps.vz = dirv * b.walking_speedz;
                    }
                }
            }
            match k {
                Some(Combo::LeftLeft) | Some(Combo::RightRight) => {
                    go(m, id, if heavy { 16 } else { 9 }, 10);
                    Some(1)
                }
                Some(Combo::Def) => {
                    if heavy {
                        return Some(1);
                    }
                    go(m, id, 110, 10);
                    Some(1)
                }
                Some(Combo::Jump) => {
                    if heavy {
                        return Some(1);
                    }
                    go(m, id, 210, 10);
                    Some(1)
                }
                Some(Combo::Att) => {
                    if let Some(h) = m.objs[id].ch().hold {
                        let o = &m.objs[id];
                        let dx = o.con_is(Key::Left) != o.con_is(Key::Right);
                        let w = &m.objs[h];
                        let (wkind, wprops) = (w.kind_type, w.prop().clone());
                        if wkind == ObjType::HeavyWeapon {
                            go(m, id, 50, 10);
                            return Some(1);
                        }
                        if wkind == ObjType::Drink {
                            go(m, id, 55, 10);
                            return Some(1);
                        }
                        if wprops.just_throw || (dx && wprops.stand_throw) {
                            go(m, id, 45, 10);
                            return Some(1);
                        }
                        if wprops.attackable {
                            let f = if m.random() < 0.5 { 20 } else { 25 };
                            go(m, id, f, 10);
                            return Some(1);
                        }
                    }
                    // soco forte se houver alguém atordoado (itr kind 6) ao alcance
                    let sp = {
                        let o = &m.objs[id];
                        o.frame_data(72).and_then(|f| f.itr.first().cloned()).or_else(|| o.frame_data(73).and_then(|f| f.itr.first().cloned()))
                    };
                    if let Some(sp) = sp {
                        let vol = m.objs[id].vol_itr(&sp);
                        let team = m.objs[id].team;
                        if !m.query(&vol, &[id], &Where { tag: QTag::Itr(6), not_team: Some(team), ..Default::default() }).is_empty() {
                            go(m, id, 70, 10);
                            return Some(1);
                        }
                    }
                    let f = if m.random() < 0.5 { 60 } else { 65 };
                    go(m, id, f, 10);
                    Some(1)
                }
                _ => None,
            }
        }
        _ => None,
    }
}

fn state_walking(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    let heavy = heavy_hold(m, id);
    let (dx, dz) = dxz(&m.objs[id]);
    match ev {
        Ev::Frame => {
            let o = &mut m.objs[id];
            if heavy {
                if dx != 0 || dz != 0 {
                    o.ani_oscillate(12, 15);
                } else {
                    let n = o.frame.n;
                    o.trans.set_next(n, 0, 0);
                }
            } else {
                o.ani_oscillate(5, 8);
            }
            let w = o.data.bmp.walking_frame_rate - 1;
            o.trans.set_wait(w, 0, 0);
            None
        }
        Ev::Tu => {
            let o = &mut m.objs[id];
            let xf = 1.0 - (if o.dirv() != 0 { 1.0 } else { 0.0 }) * (2.0 / 7.0);
            let b = o.data.bmp.clone();
            let (dirh, dirv) = (o.dirh() as f64, o.dirv() as f64);
            if heavy {
                if dx != 0 {
                    o.ps.vx = xf * dirh * b.heavy_walking_speed;
                }
                o.ps.vz = dirv * b.heavy_walking_speedz;
            } else {
                if dx != 0 {
                    o.ps.vx = xf * dirh * b.walking_speed;
                }
                o.ps.vz = dirv * b.walking_speedz;
                if dx == 0 && dz == 0 && o.trans.next() != 999 {
                    o.trans.set_next(999, 0, 0);
                    o.trans.set_wait(1, 1, 2);
                }
            }
            None
        }
        Ev::StateEntry => {
            m.objs[id].trans.set_wait(0, 0, 0);
            None
        }
        Ev::Combo => {
            {
                let o = &mut m.objs[id];
                if dx != 0 && dx != o.dirh() {
                    let d = -o.dirh();
                    o.switch_dir(d);
                }
                if dx == 0 && dz == 0 && !o.mem.released {
                    o.mem.released = true;
                    o.unit_friction();
                }
            }
            if k.is_some() {
                return state_standing(m, id, ev, k);
            }
            None
        }
        _ => None,
    }
}

fn state_running(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    let heavy = heavy_hold(m, id);
    match ev {
        Ev::Frame | Ev::Tu => {
            let o = &mut m.objs[id];
            if ev == Ev::Frame {
                o.ani_oscillate(if heavy { 16 } else { 9 }, if heavy { 18 } else { 11 });
                let w = o.data.bmp.running_frame_rate;
                o.trans.set_wait(w, 0, 0);
            }
            // continua no TU
            let xf = 1.0 - (if o.dirv() != 0 { 1.0 } else { 0.0 }) * (1.0 / 7.0);
            let b = o.data.bmp.clone();
            let (dirh, dirv) = (o.dirh() as f64, o.dirv() as f64);
            o.ps.vx = xf * dirh * if heavy { b.heavy_running_speed } else { b.running_speed };
            o.ps.vz = dirv * if heavy { b.heavy_running_speedz } else { b.running_speedz };
            None
        }
        Ev::Combo => match k {
            Some(Combo::Left) | Some(Combo::Right) | Some(Combo::LeftLeft) | Some(Combo::RightRight) => {
                let d = if matches!(k, Some(Combo::Left) | Some(Combo::LeftLeft)) { -1 } else { 1 };
                if d != m.objs[id].ps.dir {
                    go(m, id, if heavy { 19 } else { 218 }, 10);
                    return Some(1);
                }
                None
            }
            Some(Combo::Def) => {
                if heavy {
                    return Some(1);
                }
                go(m, id, 102, 10);
                Some(1)
            }
            Some(Combo::Jump) => {
                if heavy {
                    return Some(1);
                }
                go(m, id, 213, 10);
                Some(1)
            }
            Some(Combo::Att) => {
                if let Some(h) = m.objs[id].ch().hold {
                    let w = &m.objs[h];
                    let (wkind, props) = (w.kind_type, w.prop().clone());
                    if wkind == ObjType::HeavyWeapon {
                        go(m, id, 50, 10);
                        return Some(1);
                    }
                    let o = &m.objs[id];
                    let dx = o.con_is(Key::Left) != o.con_is(Key::Right);
                    if dx && props.run_throw {
                        go(m, id, 45, 10);
                        return Some(1);
                    }
                    if props.attackable {
                        go(m, id, 35, 10);
                        return Some(1);
                    }
                }
                go(m, id, 85, 10);
                Some(1)
            }
            _ => None,
        },
        _ => None,
    }
}

fn state_attack(m: &mut Match, id: Id, ev: Ev) -> Ret {
    match ev {
        Ev::Frame => {
            let o = &mut m.objs[id];
            if o.fd().next == 999 && o.ps.y < 0.0 {
                o.trans.set_next(212, 0, 0);
            }
            None
        }
        Ev::FallOntoGround => {
            // golpes que terminam ao tocar o chão (ex.: soco no chão)
            m.objs[id].fd().land
        }
        _ => None,
    }
}

fn state_jump(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    match ev {
        Ev::Frame => {
            let o = &mut m.objs[id];
            o.mem.frame_tu = true;
            if o.frame.pn == 80 || o.frame.pn == 81 {
                o.mem.attlock = 2;
            }
            None
        }
        Ev::Tu => {
            let o = &mut m.objs[id];
            if o.mem.frame_tu {
                o.mem.frame_tu = false;
                if o.frame.n == 212 && o.frame.pn == 211 {
                    let (dx, _) = dxz(o);
                    let b = o.data.bmp.clone();
                    let dirv = o.dirv() as f64;
                    o.ps.vx = dx as f64 * (b.jump_distance - 1.0);
                    o.ps.vz = dirv * (b.jump_distancez - 1.0);
                    o.ps.vy = b.jump_height;
                }
            }
            if o.mem.attlock > 0 {
                o.mem.attlock -= 1;
            }
            None
        }
        Ev::Combo => {
            let o = &m.objs[id];
            if (k == Some(Combo::Att) || o.con_is(Key::Att)) && o.mem.attlock == 0 && o.frame.n == 212 {
                if let Some(h) = o.ch().hold {
                    let dx = o.con_is(Key::Left) != o.con_is(Key::Right);
                    let props = m.objs[h].prop().clone();
                    if dx && props.jump_throw {
                        go(m, id, 52, 10);
                    } else if props.attackable {
                        go(m, id, 30, 10);
                    }
                } else {
                    go(m, id, 80, 10);
                }
                return Some(1);
            }
            None
        }
        _ => None,
    }
}

fn state_dash(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    match ev {
        Ev::StateEntry => {
            let o = &mut m.objs[id];
            if (9..=11).contains(&o.frame.pn) || o.frame.pn == 215 {
                let b = o.data.bmp.clone();
                let (dirh, dirv) = (o.dirh() as f64, o.dirv() as f64);
                o.ps.vx = dirh * (b.dash_distance - 1.0) * if o.frame.n == 213 { 1.0 } else { -1.0 };
                o.ps.vz = dirv * (b.dash_distancez - 1.0);
                o.ps.vy = b.dash_height;
            }
            None
        }
        Ev::Combo => {
            let o = &m.objs[id];
            if (k == Some(Combo::Att) || o.con_is(Key::Att)) && o.dirh() == sign(o.ps.vx) {
                let attackable = o.ch().hold.map(|h| m.objs[h].prop().attackable).unwrap_or(false);
                go(m, id, if attackable { 40 } else { 90 }, 10);
                m.objs[id].allow_switch = false;
                if k == Some(Combo::Att) {
                    return Some(1);
                }
            }
            if k == Some(Combo::Left) || k == Some(Combo::Right) {
                let d = if k == Some(Combo::Left) { -1 } else { 1 };
                let o = &m.objs[id];
                if d != o.ps.dir {
                    let n = o.frame.n;
                    if o.dirh() == sign(o.ps.vx) {
                        if n == 213 {
                            go(m, id, 214, 0);
                        }
                        if n == 216 {
                            go(m, id, 217, 0);
                        }
                    } else {
                        if n == 214 {
                            go(m, id, 213, 0);
                        }
                        if n == 217 {
                            go(m, id, 216, 0);
                        }
                    }
                    m.objs[id].switch_dir(d);
                    return Some(1);
                }
            }
            None
        }
        _ => None,
    }
}

fn state_roll(m: &mut Match, id: Id, ev: Ev) -> Ret {
    let n = m.objs[id].frame.n;
    match ev {
        Ev::Tu => {
            if n == 100 || n == 108 {
                m.objs[id].ps.vy = 0.0;
            }
            None
        }
        Ev::Frame => {
            if n == 100 || n == 108 {
                m.objs[id].trans.set_wait(1, 0, 0);
            }
            None
        }
        Ev::FallOntoGround => {
            if n == 101 || n == 109 {
                return Some(215);
            }
            None
        }
        _ => None,
    }
}

fn state_broken(m: &mut Match, id: Id, ev: Ev) -> Ret {
    if ev == Ev::FrameForce || ev == Ev::TuForce {
        let o = &mut m.objs[id];
        if let Some(dvx) = o.fd().dvx {
            if dvx != 0.0 && sign(o.ps.vx) != o.dirh() {
                let avx = o.ps.vx.abs();
                let d = 2.0 * sign(o.ps.vx) as f64;
                if o.ps.y < 0.0 || avx < dvx {
                    o.ps.vx = d * dvx;
                }
                if dvx < 0.0 {
                    o.ps.vx -= d;
                }
            }
        }
    }
    None
}

fn state_catching(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    match ev {
        Ev::StateEntry => {
            let o = &mut m.objs[id];
            o.mem.state_tu = true;
            o.mem.counter = 43;
            o.mem.attacks = 0;
            None
        }
        Ev::StateExit => {
            let o = &mut m.objs[id];
            o.ch_mut().catching = None;
            o.ps.zz = 0.0;
            None
        }
        Ev::Frame => {
            {
                let o = &mut m.objs[id];
                match o.frame.n {
                    123 => {
                        o.mem.attacks += 1;
                        o.mem.counter += 3;
                        o.trans.inc_wait(1, 0, 0);
                    }
                    233 | 234 => o.trans.inc_wait(-1, 0, 0),
                    _ => {}
                }
            }
            let (catching, cp) = {
                let o = &m.objs[id];
                (o.ch().catching, o.fd().cpoint.clone())
            };
            if let (Some(c), Some(cp)) = (catching, cp) {
                let o = &m.objs[id];
                let hold = o.point(cp.x, cp.y);
                let (adir, vdir) = (o.ps.dir, o.dirv());
                caught_b(m, c, hold, cp, adir, vdir);
            }
            None
        }
        Ev::Tu => {
            let (catching, my_kind, state_tu) = {
                let o = &m.objs[id];
                (o.ch().catching, cpoint_kind(o), o.mem.state_tu)
            };
            if let Some(c) = catching {
                if my_kind == 1 && cpoint_kind(&m.objs[c]) == 2 && state_tu {
                    m.objs[id].mem.state_tu = false;
                    let cp = m.objs[id].fd().cpoint.clone().unwrap();
                    if let Some(inj) = cp.injury {
                        if inj != 0.0 {
                            let itr = Itr { injury: Some(inj), ..Default::default() };
                            let attps = m.objs[id].pos3();
                            let r = hit_any(m, c, &itr, id, attps, None);
                            if attacked(m, id, r) {
                                m.objs[id].trans.inc_wait(1, 10, 99);
                            }
                        }
                    }
                    let cover = cp.cover.unwrap_or(0);
                    let o = &mut m.objs[id];
                    o.ps.zz = if cover == 0 || cover == 10 { 1.0 } else { -1.0 };
                    if cp.dircontrol == Some(1) {
                        if o.con_is(Key::Left) {
                            o.switch_dir(-1);
                        }
                        if o.con_is(Key::Right) {
                            o.switch_dir(1);
                        }
                    }
                }
            }
            None
        }
        Ev::PostCombo => {
            let (catching, counter, n, attacks) = {
                let o = &mut m.objs[id];
                if o.ch().catching.is_some() {
                    o.mem.counter -= 1;
                }
                (o.ch().catching, o.mem.counter, o.frame.n, o.mem.attacks)
            };
            if counter <= 0 && !(n == 122 && attacks == 4) && (n == 121 || n == 122) {
                if let Some(c) = catching {
                    caught_release(m, c);
                    go(m, id, 999, 15);
                }
            }
            None
        }
        Ev::Combo => {
            if k == Some(Combo::Att) {
                let (cp, catching) = {
                    let o = &m.objs[id];
                    (o.fd().cpoint.clone(), o.ch().catching)
                };
                if let (Some(cp), Some(c)) = (cp, catching) {
                    if cp.taction.is_some() || cp.aaction.is_some() {
                        let o = &m.objs[id];
                        let dx = o.con_is(Key::Left) != o.con_is(Key::Right);
                        let dy = o.con_is(Key::Up) != o.con_is(Key::Down);
                        if let Some(t) = cp.taction.filter(|_| dx || dy) {
                            if t < 0 {
                                let d = -m.objs[id].ps.dir;
                                m.objs[id].switch_dir(d);
                                go(m, id, -t, 10);
                            } else {
                                go(m, id, t, 10);
                            }
                            m.objs[id].mem.counter += 10;
                        } else if let Some(a) = cp.aaction {
                            go(m, id, a, 10);
                        }
                        let nf_cp = {
                            let o = &m.objs[id];
                            o.frame_data(o.trans.next()).and_then(|f| f.cpoint.clone())
                        };
                        if let Some(nc) = nf_cp {
                            let vdir = m.objs[id].dirv();
                            caught_throw(m, c, &nc, vdir);
                        }
                    }
                }
                return Some(1);
            }
            if k == Some(Combo::Jump) && m.objs[id].frame.n == 121 {
                if let Some(ja) = m.objs[id].fd().cpoint.as_ref().and_then(|c| c.jaction) {
                    go(m, id, ja, 10);
                    return Some(1);
                }
            }
            None
        }
        _ => None,
    }
}

fn state_caught(m: &mut Match, id: Id, ev: Ev) -> Ret {
    match ev {
        Ev::StateExit => {
            let c = m.objs[id].ch_mut();
            c.catching = None;
            c.caught = None;
            c.caught_throw_z = None;
            None
        }
        Ev::Frame => {
            let o = &mut m.objs[id];
            o.mem.frame_tu = true;
            o.trans.set_wait(99, 10, 99);
            None
        }
        Ev::Tu => {
            if m.objs[id].frame.n == 135 {
                m.objs[id].ps.vy = 0.0;
            }
            let (catching, my_kind) = {
                let o = &m.objs[id];
                (o.ch().catching, cpoint_kind(o))
            };
            let c = catching?;
            if my_kind == 2 && cpoint_kind(&m.objs[c]) == 1 {
                let (frame_tu, caught) = {
                    let o = &m.objs[id];
                    (o.mem.frame_tu, o.ch().caught.clone())
                };
                if let (true, Some(cg)) = (frame_tu, caught) {
                    m.objs[id].mem.frame_tu = false;
                    let cp = cg.cpoint;
                    if let Some(va) = cp.vaction {
                        go(m, id, va, 22);
                    }
                    if let Some(dvx) = cp.throwvx {
                        let dvy = cp.throwvy;
                        let mut dvz = cp.throwvz;
                        let o = &mut m.objs[id];
                        if dvx != 0.0 {
                            o.ps.vx = cg.adir as f64 * dvx;
                        }
                        if let Some(dvy) = dvy {
                            if dvy != 0.0 {
                                o.ps.vy = dvy;
                            }
                        }
                        if dvz == Some(UNSPECIFIED) {
                            dvz = Some(0.0);
                        }
                        if let Some(dvz) = dvz {
                            if dvz != 0.0 {
                                o.ps.vz = dvz;
                            }
                        }
                        let tz = o.ch().caught_throw_z.unwrap_or(cg.vdir);
                        o.ps.vz *= tz as f64;
                        let ti = match cp.throwinjury {
                            Some(t) if t != UNSPECIFIED => t,
                            _ => THROW_INJURY,
                        };
                        o.ch_mut().caught_throw_injury = Some(ti);
                        let (x, y, z) = (o.ps.x + o.ps.vx, o.ps.y + o.ps.vy * 2.0, o.ps.z + o.ps.vz);
                        let zb = m.bg.zboundary;
                        m.objs[id].set_pos(x, y, z, zb);
                    } else {
                        let o = &mut m.objs[id];
                        if cp.dircontrol.is_none() {
                            let d = if cp.cover.map(|c| c >= 10).unwrap_or(false) { cg.adir } else { -cg.adir };
                            o.switch_dir(d);
                        }
                        let mycp = o.fd().cpoint.clone().unwrap();
                        let pt = o.point(mycp.x, mycp.y);
                        o.coincide_xy(cg.hold, pt);
                    }
                }
            } else {
                go(m, id, 212, 10);
            }
            None
        }
        _ => None,
    }
}

fn state_falling(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    match ev {
        Ev::Frame => {
            let o = &mut m.objs[id];
            let n = o.frame.n;
            if o.effect.dvy <= 0.0 {
                match n {
                    180 => {
                        o.trans.set_next(181, 0, 0);
                        let w = lookup_abs(FALL_WAIT180, o.effect.dvy) as i32;
                        o.trans.set_wait(w, 0, 0);
                    }
                    181 => {
                        o.trans.set_next(182, 0, 0);
                        if o.ps.vy == 0.0 {
                            o.ps.vy = 5.0;
                        }
                        let vy = o.ps.vy.abs();
                        o.trans.set_wait(
                            if vy <= 4.0 {
                                2
                            } else if vy < 7.0 {
                                3
                            } else {
                                4
                            },
                            0,
                            0,
                        );
                    }
                    182 => o.trans.set_next(183, 0, 0),
                    186 => {
                        if o.ps.vy == 0.0 {
                            o.ps.vy = 5.0;
                        }
                        o.trans.set_next(187, 0, 0);
                    }
                    187 => o.trans.set_next(188, 0, 0),
                    188 => o.trans.set_next(189, 0, 0),
                    _ => {}
                }
            } else if n == 180 {
                o.trans.set_next(185, 0, 0);
                o.trans.set_wait(1, 0, 0);
            } else if n == 186 {
                o.trans.set_next(191, 0, 0);
            }
            None
        }
        Ev::FellOntoGround | Ev::FallOntoGround => {
            let cti = m.objs[id].ch().caught_throw_injury;
            if let Some(cti) = cti {
                if cti > 0.0 {
                    injury(m, id, cti);
                }
                m.objs[id].ch_mut().caught_throw_injury = None;
            }
            sound::play("fall");
            let (x, z) = (m.objs[id].ps.x, m.objs[id].ps.z);
            m.puff(x, z, 5, None, 1.4);
            let o = &mut m.objs[id];
            let n = o.frame.n;
            if o.speed() > BOUNCE_XY || o.ps.vy > BOUNCE_Y_LIMIT {
                let (fx, fz) = (lookup_abs(BOUNCE_ABSORB, o.ps.vx), lookup_abs(BOUNCE_ABSORB, o.ps.vz));
                o.linear_friction(fx, fz);
                o.ps.vy = -BOUNCE_Y;
                if (203..=206).contains(&n) || (180..=185).contains(&n) {
                    return Some(185);
                }
                if (186..=191).contains(&n) {
                    return Some(191);
                }
            } else {
                if (203..=206).contains(&n) || (180..=185).contains(&n) {
                    return Some(230);
                }
                if (186..=191).contains(&n) {
                    return Some(231);
                }
            }
            None
        }
        Ev::Combo => {
            let o = &m.objs[id];
            let n = o.frame.n;
            if (n == 182 || n == 188) && k == Some(Combo::Jump) && o.health.fall < FALL_KO && o.health.hp > 0.0 {
                go(m, id, if n == 182 { 100 } else { 108 }, 0);
                let o = &mut m.objs[id];
                if o.ps.vx != 0.0 {
                    o.ps.vx = 5.0 * sign(o.ps.vx) as f64;
                }
                if o.ps.vy == 0.0 {
                    o.ps.vy = 5.0;
                }
                if o.ps.vz != 0.0 {
                    o.ps.vz = 2.0 * sign(o.ps.vz) as f64;
                }
            }
            Some(1)
        }
        _ => None,
    }
}

fn state_lying(m: &mut Match, id: Id, ev: Ev) -> Ret {
    match ev {
        Ev::StateEntry => {
            let o = &mut m.objs[id];
            o.health.fall = 0.0;
            o.health.bdefend = 0.0;
            if o.health.hp <= 0.0 {
                let rod = o.ch().remove_on_death;
                die(m, id);
                m.on_ko(id);
                if rod {
                    m.objs[id].ch_mut().dead_blink = 0;
                }
            }
            None
        }
        Ev::StateExit => {
            let ef = &mut m.objs[id].effect;
            ef.timein = 0;
            ef.timeout = 30;
            ef.blink = true;
            ef.sup = true;
            None
        }
        _ => None,
    }
}

fn state_misc(m: &mut Match, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
    match ev {
        Ev::Frame => {
            let n = m.objs[id].frame.n;
            match n {
                19 => {
                    if heavy_hold(m, id) {
                        m.objs[id].trans.set_next(12, 0, 0);
                    }
                }
                215 => m.objs[id].trans.inc_wait(-1, 0, 0),
                219 => {
                    let o = &mut m.objs[id];
                    if o.frame.pn == 105 {
                        o.unit_friction();
                    } else if matches!(o.frame.pn, 216 | 90 | 91 | 92) {
                        o.trans.inc_wait(-1, 0, 0);
                    }
                }
                54 => {
                    let o = &mut m.objs[id];
                    if o.fd().next == 999 && o.ps.y < 0.0 {
                        o.trans.set_next(212, 0, 0);
                    }
                }
                _ => {}
            }
            None
        }
        Ev::Combo => {
            if m.objs[id].frame.n == 215 {
                if k == Some(Combo::Def) {
                    go(m, id, 102, 10);
                    return Some(1);
                }
                if k == Some(Combo::Jump) {
                    let (dx, _) = dxz(&m.objs[id]);
                    let (vx, dirh) = (m.objs[id].ps.vx, m.objs[id].dirh());
                    if dx != 0 {
                        go(m, id, 213, 10);
                        m.objs[id].switch_dir(dx);
                    } else if vx == 0.0 {
                        let o = &mut m.objs[id];
                        o.trans.inc_wait(2, 10, 99);
                        o.trans.set_next(210, 10, 0);
                    } else if sign(vx) == dirh {
                        go(m, id, 213, 10);
                    } else {
                        go(m, id, 214, 10);
                    }
                    return Some(1);
                }
            }
            None
        }
        _ => None,
    }
}

fn state_drink(m: &mut Match, id: Id, ev: Ev) -> Ret {
    if ev != Ev::Tu {
        return None;
    }
    let h = m.objs[id].ch().hold?;
    if m.objs[h].kind_type != ObjType::Drink {
        return None;
    }
    let is_milk = m.objs[h].prop().milk;
    if m.time % 2 == 0 {
        let o = &mut m.objs[id];
        if is_milk {
            o.health.hp = (o.health.hp + 2.0).min(o.health.hp_bound);
            o.health.mp = (o.health.mp + 1.0).min(o.health.mp_full);
        } else {
            o.health.mp = (o.health.mp + 4.0).min(o.health.mp_full);
        }
    }
    m.objs[h].health.hp -= 4.0;
    if m.objs[h].health.hp <= 0.0 {
        drop_weapon(m, id, 0.0, 0.0);
        go(m, id, 999, 15);
    }
    None
}

// ---- combos ----

/// o detector de combos recebeu uma tecla: vira de lado ou guarda o combo (com prioridade)
pub fn on_combo(m: &mut Match, id: Id, k: Combo) {
    let o = &mut m.objs[id];
    if (k == Combo::Left || k == Combo::Right) && o.allow_switch {
        o.switch_dir(if k == Combo::Left { -1 } else { 1 });
    }
    let c = o.ch_mut();
    if c.combo_timeout == COMBO_TIMEOUT {
        if let Some(cur) = c.combo_name {
            if k.priority() < cur.priority() {
                return;
            }
        }
    }
    c.combo_name = Some(k);
    c.combo_timeout = COMBO_TIMEOUT;
}

pub fn combo_update(m: &mut Match, id: Id) {
    let name = m.objs[id].ch().combo_name;
    let k = match name {
        Some(Combo::JumpAtt) => Some(Combo::Jump),
        other => other,
    };
    let r1 = by_state(m, id, Ev::Combo, k);
    let r2 = if r1.is_none() { generic(m, id, Ev::Combo, k) } else { None };
    by_state(m, id, Ev::PostCombo, None);
    generic(m, id, Ev::PostCombo, None);
    let c = m.objs[id].ch_mut();
    if c.combo_name == Some(Combo::JumpAtt) {
        if r1.is_some() || r2.is_some() {
            c.combo_name = Some(Combo::Att);
        }
    } else if r1.is_some() || r2.is_some() || k.map(|k| k.is_move()).unwrap_or(false) {
        c.combo_name = None;
    }
}

fn disappear_tu(m: &mut Match, id: Id) {
    let mut destroy = false;
    {
        let o = &mut m.objs[id];
        let (dis, dead_blink) = (o.ch().disappear, o.ch().dead_blink);
        if dis >= 0 {
            let d = dis + 1;
            o.ch_mut().disappear = d;
            if (DISAPPEAR_SHADOW..DISAPPEAR_BODY).contains(&d) {
                o.shadow_visible = (d / 2) % 2 == 0;
            }
            if d == DISAPPEAR_BODY {
                o.effect.blink = true;
                o.effect.timein = 0;
                o.effect.timeout = 30;
                o.shadow_visible = true;
                o.visible = true;
                o.effect.sup = false;
            }
            if d > DISAPPEAR_BODY {
                o.ch_mut().disappear = -1;
            }
        }
        if dead_blink >= 0 {
            if dead_blink == 0 {
                o.effect.blink = true;
            }
            let d = dead_blink + 1;
            o.ch_mut().dead_blink = d;
            if d >= 30 {
                o.ch_mut().dead_blink = -1;
                o.visible = false;
                destroy = true;
            }
        }
    }
    if destroy {
        m.destroy_object(id);
    }
}

// ---- dano ----

/// golpe recebido por qualquer objeto
pub fn hit_any(m: &mut Match, target: Id, itr: &Itr, att: Id, attps: [f64; 3], rect: Option<&Vol>) -> HitRes {
    match m.objs[target].kind {
        Kind::Character(_) => hit(m, target, itr, att, attps, rect),
        Kind::Weapon(_) => crate::engine::weapon::hit(m, target, itr, att, attps, rect),
        Kind::Ball(_) => crate::engine::ball::hit(m, target, itr, att),
    }
}

/// o atacante registra o golpe que deu (estatísticas); devolve se valeu
pub fn attacked(m: &mut Match, id: Id, r: HitRes) -> bool {
    match m.objs[id].kind {
        Kind::Character(_) => match r {
            HitRes::Yes => true,
            HitRes::Inj(v) if v > 0.0 => {
                m.objs[id].ch_mut().stat.attack += v;
                true
            }
            _ => false,
        },
        Kind::Ball(_) => match m.objs[id].bl().parent {
            Some(p) => attacked(m, p, r),
            None => r.truthy(),
        },
        Kind::Weapon(_) => match m.objs[id].wp().pre {
            Some(p) => attacked(m, p, r),
            None => r != HitRes::No,
        },
    }
}

pub fn killed(m: &mut Match, id: Id) {
    match m.objs[id].kind {
        Kind::Character(_) => m.objs[id].ch_mut().stat.kill += 1,
        Kind::Ball(_) => {
            if let Some(p) = m.objs[id].bl().parent {
                killed(m, p);
            }
        }
        Kind::Weapon(_) => {
            if let Some(p) = m.objs[id].wp().pre {
                killed(m, p);
            }
        }
    }
}

fn die(m: &mut Match, id: Id) {
    if let Some(a) = m.objs[id].itr.attacker {
        if a < m.objs.len() {
            killed(m, a);
        }
    }
}

/// aplica o dano e devolve quanto foi tirado de verdade
pub fn injury(m: &mut Match, id: Id, inj: f64) -> f64 {
    if inj == 0.0 {
        return 0.0;
    }
    let o = &mut m.objs[id];
    let mut inj = inj;
    // jogadores humanos levam menos dano nas dificuldades fáceis
    let dt = o.ch().damage_taken;
    if dt != 1.0 && inj > 0.0 {
        inj = (inj * dt).round().max(1.0);
    }
    let h = &mut o.health;
    h.hp -= inj;
    h.hp_lost += inj;
    h.hp_bound -= (inj / 3.0).ceil();
    inj
}

/// ITR: o itr (ou cpoint) que acertou; att: atacante; attps: posição do atacante; rect: área do golpe
pub fn hit(m: &mut Match, id: Id, itr: &Itr, att: Id, attps: [f64; 3], rect: Option<&Vol>) -> HitRes {
    let att_uid = m.objs[att].uid;
    if !m.objs[id].vrest_test(att_uid) {
        return HitRes::No;
    }
    let mut accept = false;
    let mut defended = false;
    let mut ef_dvx;
    let mut ef_dvy = 0.0;
    let mut inj = 0.0;
    let st = m.objs[id].state();
    let front = (attps[0] > m.objs[id].ps.x) == (m.objs[id].ps.dir == 1);
    let kind = itr.kind;

    // helpers que levam o lutador ao chão
    fn falldown(m: &mut Match, id: Id, itr: &Itr, front: bool, ef_dvy: &mut f64) {
        if itr.dvy.is_none() {
            *ef_dvy = FALL_DVY;
        }
        let o = &mut m.objs[id];
        o.health.fall = 0.0;
        o.ps.vy = 0.0;
        if front && itr.dvx.unwrap_or(0.0) < 0.0 && itr.bdefend.unwrap_or(0.0) >= 60.0 {
            go(m, id, 186, 21);
        } else {
            go(m, id, if front { 180 } else { 186 }, 21);
        }
    }
    fn fall(m: &mut Match, id: Id, itr: &Itr, front: bool, inj: f64, ef_dvy: &mut f64) {
        m.objs[id].health.fall += itr.fall.unwrap_or(FALL_VALUE);
        let o = &m.objs[id];
        let f = o.health.fall;
        if o.state() == 13 || o.ps.y < 0.0 || o.ps.vy < 0.0 || o.health.hp - inj <= 0.0 {
            falldown(m, id, itr, front, ef_dvy);
        } else if f > 0.0 && f <= 20.0 {
            go(m, id, 220, 20);
        } else if f > 20.0 && f <= 30.0 {
            go(m, id, 222, 20);
        } else if f > 30.0 && f <= 40.0 {
            go(m, id, 224, 20);
        } else if f > 40.0 && f <= 60.0 {
            go(m, id, 226, 20);
        } else if f > FALL_KO {
            falldown(m, id, itr, front, ef_dvy);
        }
    }

    if st == 10 {
        // sendo agarrado
        let catching = m.objs[id].ch().catching;
        let hurtable = match catching {
            Some(c) => cpoint_hurtable(&m.objs[c]),
            None => 1,
        };
        if hurtable != 0 {
            accept = true;
            fall(m, id, itr, front, inj, &mut ef_dvy);
        }
        if !(hurtable == 0 && catching != Some(att)) {
            accept = true;
            inj += itr.injury.unwrap_or(0.0).abs();
            if itr.injury.unwrap_or(0.0) > 0.0 {
                m.objs[id].effect_create(0, EFFECT_DURATION, None, None);
                let cp = m.objs[id].fd().cpoint.clone().unwrap_or_default();
                let tar = itr.vaction.or(if front { cp.fronthurtact } else { cp.backhurtact });
                if let Some(t) = tar {
                    go(m, id, t, 20);
                }
            }
        }
    } else if st == 14 {
        // deitado: não recebe golpes
    } else if st == 19 && m.objs[att].state() == 3000 {
        return HitRes::No;
    } else if kind == 0 || kind == 4 || kind == 9 {
        accept = true;
        let compen = if m.objs[id].ps.y == 0.0 { 1.0 } else { 0.0 };
        let a = &m.objs[att];
        let attdir = if a.ps.vx == 0.0 { a.dirh() } else { sign(a.ps.vx) };
        ef_dvx = match itr.dvx {
            Some(d) if d != 0.0 => attdir as f64 * (d - compen),
            _ => 0.0,
        };
        ef_dvy = itr.dvy.unwrap_or(0.0);
        let effectnum = itr.effect.unwrap_or(0);
        if st == 13 && effectnum == 30 {
            return HitRes::No;
        }
        if (st == 18 || st == 19) && (effectnum == 20 || effectnum == 21) {
            return HitRes::No;
        }
        if st == 7 && front {
            if let Some(i) = itr.injury {
                inj += DEFEND_FACTOR * i;
            }
            if let Some(b) = itr.bdefend {
                m.objs[id].health.bdefend += b;
            }
            let broken = m.objs[id].health.bdefend > DEFEND_BREAK;
            go(m, id, if broken { 112 } else { 111 }, 20);
            if ef_dvx != 0.0 {
                ef_dvx += (if ef_dvx > 0.0 { -1.0 } else { 1.0 }) * lookup_abs(DEFEND_ABSORB, ef_dvx);
            }
            ef_dvy = 0.0;
            if m.objs[id].health.hp - inj <= 0.0 {
                falldown(m, id, itr, front, &mut ef_dvy);
            } else {
                defended = true;
            }
        } else {
            if heavy_hold(m, id) {
                drop_weapon(m, id, 0.0, 0.0);
            }
            if let Some(i) = itr.injury {
                inj += i;
            }
            m.objs[id].health.bdefend = 45.0;
            fall(m, id, itr, front, inj, &mut ef_dvy);
        }
        let mut vanish = EFFECT_DURATION - 1;
        let nxt = m.objs[id].trans.next();
        if nxt == 111 {
            vanish = 3;
        }
        if nxt == 112 {
            vanish = 4;
        }
        m.objs[id].effect_create(effectnum, vanish, Some(ef_dvx), Some(ef_dvy));
        // efeitos especiais: sangue, fogo, gelo
        if defended {
            if effectnum == 0 || effectnum == 1 {
                sound::play("block");
            }
        } else {
            match effectnum {
                0 | 1 => {
                    let nxt = m.objs[id].trans.next();
                    if nxt == 180 || nxt == 186 {
                        drop_weapon(m, id, ef_dvx, ef_dvy);
                    }
                    if let Some(r) = rect {
                        let variant = if m.objs[id].health.fall > 0.0 { 0 } else { 1 };
                        let righttip = attps[0] < m.objs[id].ps.x;
                        m.visual_effect_at(id, effectnum, r, righttip, variant, true);
                    }
                }
                2 | 21 | 22 | 23 | 20 => {
                    if effectnum != 20 {
                        drop_weapon(m, id, ef_dvx, ef_dvy);
                    }
                    go(m, id, 203, 36);
                    sound::play("fire");
                }
                3 | 30 => {
                    drop_weapon(m, id, ef_dvx, ef_dvy);
                    if m.objs[id].state() != 13 {
                        go(m, id, 200, 38);
                        sound::play("freeze");
                    } else {
                        go(m, id, 182, 21);
                        sound::play("shatter");
                    }
                }
                4 => drop_weapon(m, id, ef_dvx, ef_dvy),
                _ => {}
            }
        }
    } else if kind == 10 || kind == 11 {
        flute_force(m, id);
        if st == 12 {
            inj = itr.injury.unwrap_or(0.0) * 2.0;
            accept = true;
        }
    } else if kind == 15 {
        if let Some(r) = rect {
            whirlwind_force(m, id, r);
        }
    } else if kind == 16 {
        go(m, id, 200, 38);
        inj = itr.injury.unwrap_or(0.0);
        accept = true;
    }

    if accept {
        let o = &mut m.objs[id];
        o.itr.attacker = Some(att);
        o.vrest_update(att_uid, itr);
    }
    let dealt = injury(m, id, inj);
    if accept && inj >= 30.0 {
        m.add_shake((inj / 9.0).min(6.0));
    }
    if accept && dealt > 0.0 {
        if m.objs[id].ch().player >= 0 && !m.net {
            input::buzz(if dealt >= 40.0 { 60 } else { 25 });
        }
        m.objs[id].ch_mut().flash_t = if defended { 1 } else { 3 };
        let (x, y, z) = (m.objs[id].ps.x, m.objs[id].ps.y, m.objs[id].ps.z);
        let color = if defended {
            "#9fb4ff"
        } else if dealt >= 40.0 {
            "#ffb000"
        } else {
            "#ffffff"
        };
        let size = if defended {
            14.0
        } else if dealt >= 40.0 {
            22.0
        } else {
            18.0
        };
        m.float_text(x, y - 78.0, z, format!("{}", dealt.round() as i64), color, size);
        // quem deu o golpe (ou lançou a bola / arremessou a arma) emenda mais um no combo
        let owner = if m.objs[att].is_char() { Some(att) } else { m.objs[att].owner() };
        if let Some(ow) = owner {
            if ow != id && m.objs[ow].is_char() && !defended {
                let t = m.time;
                let c = m.objs[ow].ch_mut();
                c.hits_n = if t - c.hits_t <= COMBO_WINDOW { c.hits_n + 1 } else { 1 };
                c.hits_t = t;
                if c.hits_n > c.stat.best_combo {
                    c.stat.best_combo = c.hits_n;
                }
            }
        }
    }
    if accept {
        HitRes::Inj(inj)
    } else {
        HitRes::No
    }
}

pub fn heal(m: &mut Match, id: Id, amount: f64) -> bool {
    m.objs[id].effect.heal = amount;
    true
}

fn flute_force(m: &mut Match, id: Id) {
    let o = &mut m.objs[id];
    o.effect.sup = true;
    o.ps.vx = 0.0;
    o.ps.vz = 0.0;
    if o.ps.y > -140.0 {
        o.ps.vy = if o.ps.vy <= 0.0 { -7.5 } else { -o.ps.vy / 2.0 };
    } else if o.ps.y > -160.0 {
        o.ps.vy -= o.mass / 2.0;
    } else if o.ps.y > -180.0 {
        o.ps.vy += o.mass / 2.0;
    }
    let f = if o.ps.vy > 0.0 { 181 } else { 182 };
    go(m, id, f, 20);
}

fn whirlwind_force(m: &mut Match, id: Id, rect: &Vol) {
    let o = &mut m.objs[id];
    let ps = &mut o.ps;
    ps.vy -= 2.0 / o.mass;
    let cx = rect.x + rect.vx + rect.w * 0.5;
    ps.vx -= (if ps.x - cx > 0.0 { 1.0 } else { -1.0 }) * 2.0 / o.mass;
    ps.vz -= (if ps.z - rect.z > 0.0 { 1.0 } else { -1.0 }) * 0.5 / o.mass;
}

// ---- interações ----

/// antes da transição: agarrar e pegar armas (usa o itr do próximo quadro)
fn pre_interaction(m: &mut Match, id: Id) {
    let itrs: Vec<Itr> = {
        let o = &m.objs[id];
        let mut n = o.trans.next();
        if n == 999 || n == 1280 {
            n = 0;
        }
        o.frame_data(n).map(|f| f.itr.clone()).unwrap_or_default()
    };
    for itr in itrs {
        if ![1, 2, 3, 7].contains(&itr.kind) {
            continue;
        }
        let mut vol = m.objs[id].vol_itr(&itr);
        vol.zwidth = 0.0;
        let hits = m.query(&vol, &[id], &Where::default());
        let team = m.objs[id].team;
        if itr.kind == 1 || itr.kind == 3 {
            for t in hits {
                let tg = &m.objs[t];
                if tg.team == team || !tg.is_char() {
                    continue;
                }
                if !((itr.kind == 1 && tg.state() == 16) || itr.kind == 3) || m.objs[id].itr.arest != 0 {
                    continue;
                }
                let attps = m.objs[id].pos3();
                if let Some(dir) = caught_a(m, t, &itr, id, attps) {
                    m.objs[id].arest_update(Some(&itr));
                    if let Some(ca) = itr.catchingact {
                        go(m, id, ca[if dir { 0 } else { 1 }], 10);
                    }
                    m.objs[id].ch_mut().catching = Some(t);
                    break;
                }
            }
        } else if m.objs[id].ch().hold.is_none() && (itr.kind == 2 || (itr.kind == 7 && m.objs[id].con_is(Key::Att))) {
            for t in hits {
                let tk = m.objs[t].kind_type;
                if itr.kind == 7 && tk == ObjType::HeavyWeapon {
                    continue;
                }
                if !tk.is_weapon() {
                    continue;
                }
                if crate::engine::weapon::pick(m, t, id) {
                    m.objs[id].ch_mut().stat.picking += 1;
                    m.objs[id].arest_update(Some(&itr));
                    if itr.kind == 2 {
                        go(m, id, if tk == ObjType::HeavyWeapon { 116 } else { 115 }, 10);
                    }
                    m.objs[id].ch_mut().hold = Some(t);
                    break;
                }
            }
        }
    }
}

/// depois da transição: golpes do quadro atual
fn post_interaction(m: &mut Match, id: Id) {
    let itrs = m.objs[id].fd().itr.clone();
    for itr in itrs {
        if itr.kind != 0 && itr.kind != 4 {
            continue;
        }
        let mut vol = m.objs[id].vol_itr(&itr);
        vol.zwidth = 0.0;
        let team = m.objs[id].team;
        let my_state = m.objs[id].state();
        for t in m.query(&vol, &[id], &Where::default()) {
            let mut can = true;
            let ef = itr.effect;
            let tg = &m.objs[t];
            if itr.kind == 0 && tg.is_char() && tg.team == team {
                can = false;
            }
            if ef == Some(4) && !(!tg.is_char() && tg.state() == 3000) {
                can = false;
            }
            if matches!(ef, Some(20) | Some(21) | Some(22)) && !tg.is_char() {
                can = false;
            }
            if matches!(ef, Some(21) | Some(22)) && my_state == 18 && tg.team == team {
                can = false;
            }
            if itr.kind == 4 {
                let a = m.objs[id].itr.attacker;
                match a {
                    None => can = false,
                    Some(a) => {
                        let ao = &m.objs[a];
                        let a_parent = ao.owner();
                        let a_holder = ao.holder();
                        if ao.uid == tg.uid || a_parent.map(|p| m.objs[p].uid == tg.uid).unwrap_or(false) || a_holder.map(|h| m.objs[h].uid == tg.uid).unwrap_or(false) {
                            can = false;
                        }
                    }
                }
            }
            if !can || m.objs[id].itr.arest != 0 {
                continue;
            }
            let attps = m.objs[id].pos3();
            let r = hit_any(m, t, &itr, id, attps, Some(&vol));
            if attacked(m, id, r) {
                m.objs[id].arest_update(Some(&itr));
                if m.state_update(id, Ev::HitStop, None).is_none() {
                    let o = &mut m.objs[id];
                    if matches!(o.frame.n, 86 | 87 | 91) {
                        o.effect_stuck(0, 2);
                        o.trans.inc_wait(1, 0, 0);
                    } else {
                        o.effect_stuck(0, HIT_STOP);
                    }
                }
                if itr.arest.is_some() {
                    break;
                }
            }
        }
    }
}

/// arma na mão segue o wpoint do quadro
fn wpoint(m: &mut Match, id: Id) {
    let Some(h) = m.objs[id].ch().hold else { return };
    let Some(wp) = m.objs[id].fd().wpoint.clone() else { return };
    if wp.kind == 1 {
        let holdpoint = m.objs[id].point(wp.x, wp.y);
        let act = crate::engine::weapon::act(m, h, id, &wp, holdpoint);
        if act.thrown {
            m.objs[id].ch_mut().hold = None;
        }
        if act.hit {
            let fake = Itr { arest: act.arest, vrest: act.vrest, ..Default::default() };
            m.objs[id].arest_update(Some(&fake));
            m.objs[id].trans.inc_wait(HIT_STOP, 10, 0);
        }
    } else if wp.kind == 3 {
        drop_weapon(m, id, 0.0, 0.0);
    }
}

fn opoint(m: &mut Match, id: Id) {
    let ops = m.objs[id].fd().opoint.clone();
    for op in ops {
        if op.facing.abs() > 10 {
            m.create_multiple(&op, id, op.facing / 10, op.dvz.unwrap_or(3.0));
        } else {
            m.create_object(&op, id);
        }
    }
}

pub fn drop_weapon(m: &mut Match, id: Id, dvx: f64, dvy: f64) {
    if let Some(h) = m.objs[id].ch().hold {
        crate::engine::weapon::drop(m, h, dvx, dvy);
        m.objs[id].ch_mut().hold = None;
    }
}

// ---- protocolo de agarrão ----

pub fn cpoint_kind(o: &Obj) -> i32 {
    o.fd().cpoint.as_ref().map(|c| c.kind).unwrap_or(0)
}

fn cpoint_hurtable(o: &Obj) -> i32 {
    o.fd().cpoint.as_ref().and_then(|c| c.hurtable).unwrap_or(0)
}

/// a vítima é agarrada; devolve Some(true) pela frente, Some(false) por trás
fn caught_a(m: &mut Match, id: Id, itr: &Itr, att: Id, attps: [f64; 3]) -> Option<bool> {
    let o = &m.objs[id];
    if !((itr.kind == 1 && o.state() == 16) || itr.kind == 3) {
        return None;
    }
    let front = (attps[0] > o.ps.x) == (o.ps.dir == 1);
    if let Some(ca) = itr.caughtact {
        go(m, id, ca[if front { 0 } else { 1 }], 22);
    }
    let o = &mut m.objs[id];
    o.health.fall = 0.0;
    o.ch_mut().catching = Some(att);
    o.itr.attacker = Some(att);
    drop_weapon(m, id, 0.0, 0.0);
    Some(front)
}

fn caught_b(m: &mut Match, id: Id, hold: [f64; 3], cpoint: CPoint, adir: i32, vdir: i32) {
    m.objs[id].ch_mut().caught = Some(Caught { hold, cpoint, adir, vdir });
}

fn caught_throw(m: &mut Match, id: Id, cpoint: &CPoint, vdir: i32) {
    go(m, id, cpoint.vaction.unwrap_or(CPOINT_VACTION), 22);
    m.objs[id].ch_mut().caught_throw_z = Some(vdir);
}

fn caught_release(m: &mut Match, id: Id) {
    m.objs[id].ch_mut().catching = None;
    go(m, id, 181, 22);
    let ef = &mut m.objs[id].effect;
    ef.dvx = 3.0;
    ef.dvy = -3.0;
    ef.timein = -1;
    ef.timeout = 0;
}

/// volta a ficar de pé e inteiro: próximo round, próxima fase ou próxima onda
pub struct ResetOpts {
    pub hp: Option<f64>,
    pub bound: Option<f64>,
    pub mp: Option<f64>,
    pub pos: Option<(f64, f64)>,
    pub dir: Option<i32>,
}

pub fn reset(m: &mut Match, id: Id, r: ResetOpts) {
    if m.objs[id].ch().hold.is_some() {
        drop_weapon(m, id, 0.0, 0.0);
    }
    let zb = m.bg.zboundary;
    let o = &mut m.objs[id];
    let h = &mut o.health;
    h.hp = r.hp.unwrap_or(h.hp_full);
    h.hp_bound = r.bound.unwrap_or(h.hp);
    h.mp = r.mp.unwrap_or(MP_START);
    h.fall = 0.0;
    h.bdefend = 0.0;
    o.dead = false;
    o.visible = true;
    o.hidden = false;
    o.shadow_visible = true;
    o.effect = Effect::default();
    o.itr = ItrState::default();
    {
        let c = o.ch_mut();
        c.disappear = -1;
        c.dead_blink = -1;
        c.catching = None;
        c.caught = None;
        c.caught_throw_z = None;
        c.caught_throw_injury = None;
        c.combo_name = None;
        c.combo_timeout = 0;
        c.hits_n = 0;
        c.hits_t = -999;
        c.flash_t = 0;
        c.con_state = [false; 7];
    }
    o.mem = StateMem::default();
    o.allow_switch = true;
    o.frame = FrameState { pn: 0, n: 0, ani_i: 0, ani_up: true };
    let (w, n) = (o.fd().wait, o.fd().next);
    o.trans = Trans { wait: w, next_n: n, lock: 0, lockout: 1, flip_after: false };
    o.ps.vx = 0.0;
    o.ps.vy = 0.0;
    o.ps.vz = 0.0;
    o.ps.zz = 0.0;
    o.ps.fric = 1.0;
    let (x, z) = r.pos.unwrap_or((o.ps.x, o.ps.z));
    o.set_pos(x, 0.0, z, zb);
    if let Some(d) = r.dir {
        o.switch_dir(d);
    }
    if let Some(con) = o.ch().con {
        input::with(|i| {
            if let Some(c) = i.controllers.get_mut(con) {
                c.clear();
            }
        });
    }
}
