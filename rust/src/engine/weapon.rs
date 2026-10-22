//! Armas leves (bastão, cano), pesadas (pedra, caixa) e bebidas.
//! Estados: 1000 na mão · 1001 no ar parado · 1002 arremessada · 1003/1004 no chão
//!          2000 pesada no ar · 2001 na mão · 2004 no chão

use crate::audio::sound;
use crate::core::consts::*;
use crate::engine::character::{attacked, hit_any};
use crate::engine::data::*;
use crate::engine::object::*;
use crate::engine::r#match::Match;

fn generic(m: &mut Match, id: Id, ev: Ev) -> Ret {
    match ev {
        Ev::Tu => {
            interaction(m, id);
            let st = m.objs[id].state();
            if st != 1001 && st != 2001 {
                m.dynamics(id);
            }
            let heavy = m.objs[id].wp().heavy;
            let (y, vy) = (m.objs[id].ps.y, m.objs[id].ps.vy);
            if y == 0.0 && vy > 0.0 {
                if m.objs[id].speed() > WEAPON_BOUNCE_LIMIT {
                    let o = &mut m.objs[id];
                    if heavy {
                        o.ps.vy = WEAPON_BOUNCE_VY;
                    } else {
                        o.ps.vy = 0.0;
                        o.trans.frame(70, 0);
                    }
                    if o.ps.vx != 0.0 {
                        o.ps.vx = o.ps.vx.signum() * WEAPON_BOUNCE_VX;
                    }
                    if o.ps.vz != 0.0 {
                        o.ps.vz = o.ps.vz.signum() * WEAPON_BOUNCE_VZ;
                    }
                    let hurt = o.data.bmp.weapon_drop_hurt;
                    o.health.hp -= hurt;
                } else {
                    let o = &mut m.objs[id];
                    o.team = 0;
                    o.ps.vy = 0.0;
                    o.trans.frame(if heavy { 21 } else { 70 }, 0);
                }
                m.objs[id].ps.zz = 0.0;
            }
            None
        }
        Ev::Die => {
            m.objs[id].trans.frame(1000, 0);
            if let Some(s) = m.objs[id].data.bmp.weapon_broken_sound {
                sound::play(s);
            }
            let kind = m.objs[id].id;
            m.broken_effect_of(id, kind, 8);
            if let Some(h) = m.objs[id].wp().holder {
                if let Kind::Character(c) = &mut m.objs[h].kind {
                    c.hold = None;
                }
                m.objs[id].wp_mut().holder = None;
            }
            None
        }
        Ev::Leaving => {
            if m.leaving(id, 200.0) {
                m.objs[id].trans.frame(1000, 0);
            }
            None
        }
        _ => None,
    }
}

pub fn update(m: &mut Match, id: Id, ev: Ev) -> Ret {
    let r1 = generic(m, id, ev);
    let st = m.objs[id].state();
    let r2 = match st {
        1003 => {
            let o = &m.objs[id];
            if ev == Ev::Frame && o.frame.n == 70 && o.fd().sound.is_none() {
                if let Some(s) = o.data.bmp.weapon_drop_sound {
                    sound::play(s);
                }
            }
            None
        }
        1004 => {
            if ev == Ev::Frame && m.objs[id].frame.n == 64 {
                m.objs[id].team = 0;
            }
            None
        }
        2000 => {
            let o = &mut m.objs[id];
            if ev == Ev::Frame && o.frame.n == 21 {
                o.trans.set_next(20, 0, 0);
                if o.fd().sound.is_none() {
                    if let Some(s) = o.data.bmp.weapon_drop_sound {
                        sound::play(s);
                    }
                }
            }
            None
        }
        2004 => {
            if ev == Ev::Frame && m.objs[id].frame.n == 20 {
                m.objs[id].team = 0;
            }
            None
        }
        _ => None,
    };
    r1.or(r2)
}

/// arma arremessada ou caindo acerta quem estiver no caminho
fn interaction(m: &mut Match, id: Id) {
    let (team, heavy, st) = {
        let o = &m.objs[id];
        (o.team, o.wp().heavy, o.state())
    };
    if team == 0 || !(heavy || st == 1002) {
        return;
    }
    let itrs = m.objs[id].fd().itr.clone();
    for i in itrs {
        if i.kind != 0 {
            continue;
        }
        let mut vol = m.objs[id].vol_itr(&i);
        vol.zwidth = 0.0;
        for t in m.query(&vol, &[id], &Where { not_team: Some(team), ..Default::default() }) {
            if m.objs[id].itr.arest != 0 {
                break;
            }
            let attps = m.objs[id].pos3();
            let r = hit_any(m, t, &i, id, attps, Some(&vol));
            if attacked(m, id, r) {
                let o = &mut m.objs[id];
                let vx = if o.ps.vx == 0.0 { 0.0 } else { o.ps.vx.signum() };
                if !heavy {
                    o.ps.vx = vx * WEAPON_HIT_VX;
                    o.ps.vy = 0.0;
                }
                o.arest_update(Some(&i));
                o.effect.dvx = 0.0;
                o.effect.dvy = 0.0;
                o.effect_stuck(0, if !heavy { 2 } else { 4 });
            }
        }
    }
}

pub fn hit(m: &mut Match, id: Id, itr: &Itr, att: Id, attps: [f64; 3], rect: Option<&Vol>) -> HitRes {
    let att_uid = m.objs[att].uid;
    {
        let o = &m.objs[id];
        if o.wp().holder.is_some() || o.itr.vrest.contains_key(&att_uid) {
            return HitRes::No;
        }
    }
    if itr.kind == 15 {
        if let Some(r) = rect {
            whirlwind(m, id, r);
        }
        return HitRes::Yes;
    }
    if itr.kind == 10 || itr.kind == 11 {
        flute(m, id);
        return HitRes::Yes;
    }
    let mut accept = false;
    let fall = itr.fall.unwrap_or(FALL_VALUE);
    let (light, st) = (!m.objs[id].wp().heavy, m.objs[id].state());
    let (a_dirh, a_vx, a_vz, a_team, a_kind) = {
        let a = &m.objs[att];
        (a.dirh(), a.ps.vx, a.ps.vz, a.team, a.kind_type)
    };
    if light {
        if st == 1002 {
            accept = true;
            let o = &mut m.objs[id];
            if (a_dirh > 0) != (o.ps.vx > 0.0) {
                o.ps.vx *= WEAPON_REVERSE_VX;
            }
            o.ps.vy *= WEAPON_REVERSE_VY;
            o.ps.vz *= WEAPON_REVERSE_VZ;
            o.team = a_team;
        } else if st == 1004 && a_kind.is_weapon() {
            accept = true;
            let o = &mut m.objs[id];
            o.ps.vx = (if a_vx != 0.0 { a_vx.signum() } else { 0.0 }) * WEAPON_BOUNCE_VX;
            o.ps.vz = (if a_vz != 0.0 { a_vz.signum() } else { 0.0 }) * WEAPON_BOUNCE_VZ;
        }
    } else if st == 2004 {
        accept = true;
        let o = &mut m.objs[id];
        if fall < 30.0 {
            o.effect_create(0, EFFECT_DURATION, None, None);
        } else if fall < FALL_KO {
            o.ps.vy = WEAPON_SOFT_BOUNCE_VY;
        } else {
            o.ps.vy = WEAPON_BOUNCE_VY;
            if a_vx != 0.0 {
                o.ps.vx = a_vx.signum() * WEAPON_BOUNCE_VX;
            }
            if a_vz != 0.0 {
                o.ps.vz = a_vz.signum() * WEAPON_BOUNCE_VZ;
            }
            o.trans.frame(999, 0);
        }
    } else if st == 2000 && fall >= FALL_KO {
        accept = true;
        let o = &mut m.objs[id];
        if (a_dirh > 0) != (o.ps.vx > 0.0) {
            o.ps.vx *= WEAPON_REVERSE_VX;
        }
        o.ps.vy *= WEAPON_REVERSE_VY;
        o.ps.vz *= WEAPON_REVERSE_VZ;
        o.team = a_team;
    }
    if accept {
        if let Some(r) = rect {
            let righttip = attps[0] < m.objs[id].ps.x;
            m.visual_effect_at(id, 0, r, righttip, if fall < FALL_KO { 1 } else { 2 }, false);
        }
        let o = &mut m.objs[id];
        if let Some(v) = itr.vrest {
            o.itr.vrest.insert(att_uid, v);
        }
        if let Some(i) = itr.injury {
            o.health.hp -= i;
        }
        if let Some(s) = o.data.bmp.weapon_hit_sound {
            sound::play(s);
        }
    }
    if accept {
        HitRes::Yes
    } else {
        HitRes::No
    }
}

pub struct ActRes {
    pub thrown: bool,
    pub hit: bool,
    pub vrest: Option<i32>,
    pub arest: Option<i32>,
}

/// na mão do personagem: segue o wpoint e, se for o caso, ataca ou é arremessada
pub fn act(m: &mut Match, id: Id, att: Id, wp: &WPoint, holdpoint: [f64; 3]) -> ActRes {
    let mut res = ActRes { thrown: false, hit: false, vrest: None, arest: None };
    if m.objs[id].frame_data(wp.weaponact).is_some() {
        m.objs[id].trans.frame(wp.weaponact, 0);
        m.trans_trans(id);
    }
    let Some(fwp) = m.objs[id].fd().wpoint.clone() else { return res };
    if fwp.kind != 2 {
        return res;
    }
    let light = !m.objs[id].wp().heavy;
    let (a_dirh, a_dirv, a_pos, a_dir, a_team) = {
        let a = &m.objs[att];
        (a.dirh(), a.dirv(), a.pos3(), a.ps.dir, a.team)
    };
    let zb = m.bg.zboundary;
    {
        let o = &mut m.objs[id];
        if wp.dvx != 0.0 {
            o.ps.vx = a_dirh as f64 * wp.dvx;
        }
        if wp.dvz != 0.0 {
            o.ps.vz = a_dirv as f64 * wp.dvz;
        }
        if wp.dvy != 0.0 {
            o.ps.vy = wp.dvy;
        }
    }
    let moving = {
        let o = &m.objs[id];
        o.ps.vx != 0.0 || o.ps.vy != 0.0 || o.ps.vz != 0.0
    };
    if moving {
        let o = &mut m.objs[id];
        let imx = if light { 58.0 } else { 48.0 };
        let imy = if light { -15.0 } else { -40.0 };
        let vz = o.ps.vz;
        o.set_pos(a_pos[0] + a_dirh as f64 * imx, a_pos[1] + imy, a_pos[2] + vz, zb);
        o.ps.zz = 1.0;
        o.trans.frame(if light { 40 } else { 999 }, 0);
        m.trans_trans(id);
        let o = &mut m.objs[id];
        o.wp_mut().holder = None;
        o.shadow_visible = true;
        res.thrown = true;
    } else {
        let o = &mut m.objs[id];
        o.ps.zz = if wp.cover == 1 { -1.0 } else { 1.0 };
        o.switch_dir(a_dir);
        o.ps.z = a_pos[2];
        o.update_screen_pos();
        let pt = o.point(fwp.x, fwp.y);
        o.coincide_xy(holdpoint, pt);
    }
    if light && wp.attacking != 0 {
        let itrs = m.objs[id].fd().itr.clone();
        for i in itrs {
            if i.kind != 5 {
                continue;
            }
            let mut vol = m.objs[id].vol_itr(&i);
            vol.zwidth = 0.0;
            for t in m.query(&vol, &[id, att], &Where { not_team: Some(a_team), ..Default::default() }) {
                if m.objs[att].itr.arest != 0 {
                    break;
                }
                let citr = m.objs[id].data.weapon_strength_list.get(&wp.attacking).cloned().unwrap_or_else(|| i.clone());
                let attps = m.objs[att].pos3();
                let r = hit_any(m, t, &citr, att, attps, Some(&vol));
                if attacked(m, id, r) {
                    res.vrest = citr.vrest;
                    res.arest = citr.arest;
                    res.hit = true;
                }
            }
        }
    }
    res
}

pub fn drop(m: &mut Match, id: Id, dvx: f64, dvy: f64) {
    let o = &mut m.objs[id];
    o.team = 0;
    o.wp_mut().holder = None;
    if dvx != 0.0 {
        o.ps.vx = dvx * 0.5;
    }
    if dvy != 0.0 {
        o.ps.vy = dvy * 0.2;
    }
    o.ps.zz = 0.0;
    o.trans.frame(999, 0);
    o.shadow_visible = true;
}

pub fn pick(m: &mut Match, id: Id, att: Id) -> bool {
    let team = m.objs[att].team;
    let o = &mut m.objs[id];
    if o.wp().holder.is_some() {
        return false;
    }
    o.wp_mut().holder = Some(att);
    o.wp_mut().pre = Some(att);
    o.team = team;
    o.shadow_visible = false;
    true
}

fn whirlwind(m: &mut Match, id: Id, rect: &Vol) {
    let o = &mut m.objs[id];
    let ps = &mut o.ps;
    ps.vy -= 2.0 / o.mass;
    let cx = rect.x + rect.vx + rect.w * 0.5;
    ps.vx -= (if ps.x - cx > 0.0 { 1.0 } else { -1.0 }) * 2.0 / o.mass;
    ps.vz -= (if ps.z - rect.z > 0.0 { 1.0 } else { -1.0 }) * 0.5 / o.mass;
}

fn flute(m: &mut Match, id: Id) {
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
    let light = !o.wp().heavy;
    if light && o.frame.n >= 55 {
        o.trans.frame(40, 20);
    }
    if !light && o.frame.n >= 5 {
        o.trans.frame(1, 20);
    }
}

/// cria uma arma caindo numa posição
pub fn init_from_opoint(m: &mut Match, id: Id, parent: Id, op: &OPoint) {
    if op.kind == 2 {
        if let Kind::Character(c) = &mut m.objs[parent].kind {
            c.hold = Some(id);
        }
        pick(m, id, parent);
    }
}
