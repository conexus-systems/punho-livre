//! Ataques especiais: bolas de energia e ondas de choque.
//! Estados: 3000 bola voando (rebate e se anula com outras) · 3001-3004 variações
//!          3005/3006 bolas fortes · 1002 projéteis com física · 15 redemoinho

use crate::audio::sound;
use crate::core::consts::*;
use crate::core::input::Tag;
use crate::engine::character::{attacked, heal, hit_any};
use crate::engine::data::*;
use crate::engine::object::*;
use crate::engine::r#match::Match;

fn generic(m: &mut Match, id: Id, ev: Ev) -> Ret {
    match ev {
        Ev::Tu => {
            interaction(m, id);
            m.dynamics(id);
            // hit_a é quanto de "vida" a bola perde por TU; ao zerar vai para hit_d
            let o = &mut m.objs[id];
            if let Some(a) = o.fd().tag(Tag::A) {
                if a != 0 {
                    o.health.hp -= a as f64;
                }
            }
        }
        Ev::Frame => {
            let ops = m.objs[id].fd().opoint.clone();
            for op in ops {
                m.create_object(&op, id);
            }
            if m.objs[id].frame.n == 15 {
                m.objs[id].trans.frame(1000, 0);
            }
        }
        Ev::FrameForce | Ev::TuForce => {
            let o = &mut m.objs[id];
            if let Some(j) = o.fd().tag(Tag::J) {
                if j != 0 {
                    o.ps.vz = (j - 50) as f64;
                }
            }
        }
        Ev::Leaving => {
            if m.leaving(id, 200.0) {
                m.objs[id].trans.frame(1000, 0);
            }
        }
        Ev::Die => {
            let d = m.objs[id].fd().tag(Tag::D);
            if let Some(d) = d {
                m.objs[id].trans.frame(d, 0);
            }
        }
        _ => {}
    }
    chase(m, id, ev);
    None
}

/// bolas que perseguem o alvo (hit_Fa 1/2) ou disparam em linha reta (hit_Fa 10)
fn chase(m: &mut Match, id: Id, ev: Ev) {
    if ev != Ev::Tu {
        return;
    }
    let fa = m.objs[id].fd().tag(Tag::Fa).unwrap_or(0);
    if (fa == 1 || fa == 2) && m.objs[id].health.hp > 0.0 {
        if let Some(t) = chase_target(m, id) {
            let (tx, tz) = (m.objs[t].ps.x, m.objs[t].ps.z);
            let o = &mut m.objs[id];
            let dx = tx - o.ps.x;
            let dz = tz - o.ps.z;
            let sx = if dx >= 0.0 { 1.0 } else { -1.0 };
            let sz = if dz >= 0.0 { 1.0 } else { -1.0 };
            if o.ps.vx * sx < 14.0 {
                o.ps.vx += sx * 0.7;
            }
            if o.ps.vz * sz < 2.2 {
                o.ps.vz += sz * 0.4;
            }
            let d = if o.ps.vx >= 0.0 { 1 } else { -1 };
            o.switch_dir(d);
        }
    }
    if fa == 10 {
        let o = &mut m.objs[id];
        o.ps.vx = (if o.ps.vx > 0.0 { 1.0 } else { -1.0 }) * 17.0;
        o.ps.vz = 0.0;
    }
}

pub fn update(m: &mut Match, id: Id, ev: Ev) -> Ret {
    let r1 = generic(m, id, ev);
    let st = m.objs[id].state();
    let r2 = match st {
        1002 => state_1002(m, id, ev),
        3000 => {
            if ev == Ev::StateExit && m.objs[id].prop().shatter {
                m.broken_effect_of(id, 212, 8);
            }
            None
        }
        15 => {
            if ev == Ev::Tu {
                let o = &mut m.objs[id];
                let v = o.dirh() as f64 * o.fd().dvx.unwrap_or(0.0);
                o.ps.vx = v;
            }
            None
        }
        _ => None,
    };
    r1.or(r2)
}

fn state_1002(m: &mut Match, id: Id, ev: Ev) -> Ret {
    match ev {
        Ev::StateEntry => {
            let p = m.objs[id].bl().parent;
            let nb = p.map(|p| m.objs[p].ps.y == 0.0).unwrap_or(false);
            m.objs[id].bl_mut().nobounce = nb;
        }
        Ev::Tu => {
            let o = &mut m.objs[id];
            if o.ps.y == 0.0 && o.ps.vy > 0.0 {
                if o.bl().nobounce {
                    o.trans.frame(1000, 0);
                } else if o.speed() > WEAPON_BOUNCE_LIMIT {
                    o.trans.frame(10, 0);
                    o.ps.vy = WEAPON_BOUNCE_VY;
                    if o.ps.vx != 0.0 {
                        o.ps.vx = o.ps.vx.signum() * WEAPON_BOUNCE_VX;
                    }
                    if o.ps.vz != 0.0 {
                        o.ps.vz = o.ps.vz.signum() * WEAPON_BOUNCE_VZ;
                    }
                }
            }
        }
        _ => {}
    }
    None
}

/// a bola acertou alguém (reage conforme o estado)
fn hit_others(m: &mut Match, id: Id, itr: &Itr, att: Id) {
    let st = m.objs[id].state();
    if let Some(s) = m.objs[id].data.bmp.weapon_broken_sound {
        sound::play(s);
    }
    if st == 3000 {
        let is_ball = m.objs[att].is_ball();
        let att_itr_effect = m.objs[att].fd().itr.first().and_then(|i| i.effect);
        let att_state = m.objs[att].state();
        if itr.effect == Some(3) && is_ball && att_state == 3000 && att_itr_effect != Some(3) && att_itr_effect != Some(2) {
            return;
        }
        if itr.effect != Some(3) && itr.effect != Some(2) && is_ball && att_itr_effect == Some(3) {
            m.objs[id].ps.vx = 0.0;
            m.objs[id].trans.frame(1000, 0);
            return;
        }
        m.objs[id].ps.vx = 0.0;
        m.objs[id].trans.frame(10, 0);
    } else if st == 3006 {
        let is_ball = m.objs[att].is_ball();
        let att_state = m.objs[att].state();
        if is_ball && (att_state == 3005 || att_state == 3006) {
            let o = &mut m.objs[id];
            o.trans.frame(10, 0);
            o.ps.vx = 0.0;
            o.ps.vz = 0.0;
        }
    }
}

fn interaction(m: &mut Match, id: Id) {
    let team = m.objs[id].team;
    if team == 0 {
        return;
    }
    let itrs = m.objs[id].fd().itr.clone();
    let zw = m.objs[id].prop().zwidth.unwrap_or(0.0);
    for i in itrs {
        let mut vol = m.objs[id].vol_itr(&i);
        vol.zwidth = zw;
        for t in m.query(&vol, &[id], &Where::default()) {
            if [0, 9, 15, 16].contains(&i.kind) {
                let (t_char, t_team, t_dir) = {
                    let tg = &m.objs[t];
                    (tg.is_char(), tg.team, tg.ps.dir)
                };
                if t_char && t_team == team {
                    continue;
                }
                if i.kind == 0 && !t_char && t_team == team && t_dir == m.objs[id].ps.dir {
                    continue;
                }
                if m.objs[id].itr.arest != 0 {
                    continue;
                }
                let attps = m.objs[id].pos3();
                let r = hit_any(m, t, &i, id, attps, Some(&vol));
                if attacked(m, id, r) {
                    m.objs[id].arest_update(Some(&i));
                    hit_others(m, id, &i, t);
                    if i.arest.is_some() {
                        break;
                    }
                    if t_char && i.kind == 9 {
                        m.objs[id].health.hp = 0.0; // escudo se desfaz ao tocar alguém
                    }
                }
            } else if i.kind == 8 && m.objs[t].is_char() && heal(m, t, i.injury.unwrap_or(0.0)) {
                let f = i.dvx.unwrap_or(0.0) as i32;
                m.objs[id].trans.frame(f, 0);
            }
        }
    }
}

/// a bola foi atingida (por um golpe, outra bola...)
pub fn hit(m: &mut Match, id: Id, itr: &Itr, att: Id) -> HitRes {
    let att_uid = m.objs[att].uid;
    if m.objs[id].itr.vrest.contains_key(&att_uid) {
        return HitRes::No;
    }
    if let Some(v) = itr.vrest {
        m.objs[id].itr.vrest.insert(att_uid, v);
    }
    let st = m.objs[id].state();
    let my_itr = m.objs[id].fd().itr.first().cloned().unwrap_or_default();
    let is_ball = m.objs[att].is_ball();
    let (att_team, att_dir, att_state, att_itr_effect) = {
        let a = &m.objs[att];
        (a.team, a.ps.dir, a.state(), a.fd().itr.first().and_then(|i| i.effect))
    };
    match st {
        3000 => {
            if my_itr.kind == 14 {
                m.objs[id].trans.set_wait(0, 20, 0);
                return HitRes::Yes;
            }
            if att_team == m.objs[id].team && att_dir == m.objs[id].ps.dir {
                return HitRes::No;
            }
            if my_itr.effect == Some(3) && is_ball && att_state == 3000 && att_itr_effect != Some(3) && att_itr_effect != Some(2) {
                return HitRes::Yes;
            }
            if is_ball {
                if my_itr.effect != Some(3) && my_itr.effect != Some(2) && itr.effect == Some(3) {
                    m.objs[id].ps.vx = 0.0;
                    m.objs[id].trans.frame(1000, 0);
                    return HitRes::Yes;
                }
                if itr.kind == 0 {
                    m.objs[id].ps.vx = 0.0;
                    m.objs[id].trans.frame(20, 0);
                    return HitRes::Yes;
                }
            }
            if att_state == 19 {
                m.objs[id].ps.vx = 0.0;
                m.objs[id].trans.frame(20, 0);
                return HitRes::Yes;
            }
            if itr.kind == 0 || itr.kind == 9 {
                // rebatida: muda de time e volta
                m.objs[id].ps.vx = 0.0;
                m.objs[id].team = att_team;
                m.objs[id].trans.frame(30, 0);
                m.trans_trans(id);
                m.tu(id);
                m.trans_trans(id);
                m.tu(id);
                return HitRes::Yes;
            }
            None
        }
        3006 => {
            if itr.kind == 9 {
                let o = &mut m.objs[id];
                o.ps.vx *= -1.0;
                o.ps.z += 0.3;
                return HitRes::Yes;
            }
            if is_ball && (att_state == 3005 || att_state == 3006) {
                let o = &mut m.objs[id];
                o.trans.frame(20, 0);
                o.ps.vx = 0.0;
                o.ps.vz = 0.0;
                return HitRes::Yes;
            }
            if is_ball && att_state == 3000 {
                let o = &mut m.objs[id];
                o.ps.vx = (if o.ps.vx > 0.0 { -1.0 } else { 1.0 }) * 7.0;
                return HitRes::Yes;
            }
            if itr.kind == 0 {
                let o = &mut m.objs[id];
                o.ps.vx = if o.ps.vx > 0.0 { -1.0 } else { 1.0 };
                if itr.bdefend.unwrap_or(0.0) > DEFEND_BREAK {
                    o.health.hp = 0.0;
                }
                return HitRes::Yes;
            }
            None
        }
        1002 => {
            // projéteis com física: param ao acertar
            m.objs[id].ps.vx = 0.0;
            m.objs[id].trans.frame(10, 0);
            None
        }
        _ => None,
    }
    .unwrap_or(HitRes::No)
}

fn chase_target(m: &mut Match, id: Id) -> Option<Id> {
    let team = m.objs[id].team;
    let (x, z) = (m.objs[id].ps.x, m.objs[id].ps.z);
    let mut list: Vec<Id> =
        m.query_all(id, &Where { kind: Some(ObjType::Character), not_team: Some(team), ..Default::default() }).into_iter().filter(|&c| !m.objs[c].dead).collect();
    if list.is_empty() {
        return None;
    }
    let chased = m.objs[id].bl().chased.clone();
    let score = |o: &Obj, oid: Id| -> f64 {
        let dx = o.ps.x - x;
        let dz = o.ps.z - z;
        (dx * dx + dz * dz).sqrt() + 500.0 * *chased.get(&oid).unwrap_or(&0) as f64
    };
    list.sort_by(|&a, &b| score(&m.objs[a], a).partial_cmp(&score(&m.objs[b], b)).unwrap());
    let t = list[0];
    *m.objs[id].bl_mut().chased.entry(t).or_insert(0) += 1;
    Some(t)
}

/// posiciona a bola recém-criada a partir do opoint do pai
pub fn init(m: &mut Match, id: Id, parent: Id, op: &OPoint, pos: [f64; 3], z: f64, pdir: i32, dvz: f64) {
    let zb = m.bg.zboundary;
    {
        let o = &mut m.objs[id];
        o.bl_mut().parent = Some(parent);
        o.ps.z = z;
        o.update_screen_pos();
        let (cx, cy) = (o.fd().centerx, o.fd().centery);
        let pt = o.point(cx, cy);
        o.coincide_xy(pos, pt);
        let mut face = op.facing;
        if face >= 20 {
            face %= 10;
        }
        let dir = if face == 0 {
            pdir
        } else if face == 1 {
            -pdir
        } else if (2..=10).contains(&face) {
            1
        } else {
            -1
        };
        o.switch_dir(dir);
        o.trans.frame(if op.action == 0 { 999 } else { op.action }, 0);
    }
    m.trans_trans(id);
    let o = &mut m.objs[id];
    o.ps.vx = o.dirh() as f64 * op.dvx;
    o.ps.vy = op.dvy;
    o.ps.vz = if o.fd().dvx.unwrap_or(0.0) != 0.0 { dvz } else { 0.0 };
    o.ps.z = clamp_z(o.ps.z, zb);
    o.health.hp = o.prop().hp.unwrap_or(HP_FULL);
    if !GC_PROJECTILES.contains(&o.id) {
        o.mass = 0.0;
    }
}

/// ataques especiais com gravidade (nenhum por enquanto)
const GC_PROJECTILES: &[i32] = &[];
