//! Monta, por código, todos os dados que o motor usa: lutadores (quadros e folhas
//! de sprites), ataques especiais, armas, efeitos e cenários. O trabalho é feito em
//! passos (um lutador por quadro de animação) para a barra de carregamento andar.

use std::collections::HashMap;

use crate::content::moves::*;
use crate::content::painter::*;
use crate::content::roster::{roster, weapons, BaseStats, FighterDef, WeaponDef};
use crate::content::scenes::{build_scene, scene_list};
use crate::core::input::Tag;
use crate::engine::data::*;
use crate::gfx::*;

type Images = HashMap<String, Canvas>;

pub struct Builder {
    step: usize,
    defs: Vec<FighterDef>,
    objects: Vec<ObjData>,
    images: Images,
    backgrounds: Vec<BgData>,
    next_ball_id: i32,
}

impl Builder {
    pub fn new() -> Builder {
        Builder { step: 0, defs: roster(), objects: vec![], images: HashMap::new(), backgrounds: vec![], next_ball_id: 200 }
    }

    /// um passo; Some(progresso) enquanto houver trabalho, None quando acabar
    pub fn step(&mut self) -> Result<Option<f64>, String> {
        let total = self.defs.len() + 3;
        let i = self.step;
        if i < self.defs.len() {
            let def = self.defs[i].clone();
            self.build_fighter(def);
        } else if i == self.defs.len() {
            for w in weapons() {
                let o = if w.heavy { build_heavy_weapon(&w, &mut self.images) } else { build_light_weapon(&w, &mut self.images) };
                self.objects.push(o);
            }
        } else if i == self.defs.len() + 1 {
            self.objects.push(build_spark(300, "#fff27a", &mut self.images));
            self.objects.push(build_spark(301, "#ff8a8a", &mut self.images));
            self.objects.push(build_broken(&mut self.images));
        } else if i == self.defs.len() + 2 {
            for sc in scene_list() {
                self.backgrounds.push(build_scene(&sc, &mut self.images));
            }
        } else {
            return Ok(None);
        }
        self.step += 1;
        Ok(Some(self.step as f64 / total as f64))
    }

    pub fn finish(self) -> Assets {
        let mut objects = HashMap::new();
        let mut order = vec![];
        for o in self.objects {
            order.push(o.id);
            objects.insert(o.id, o);
        }
        let mut a = Assets { objects, images: self.images, backgrounds: self.backgrounds, sheets: HashMap::new(), order };
        a.make_sheets();
        a
    }

    fn build_fighter(&mut self, def: FighterDef) {
        let mut b = FighterBuilder::new(def.clone(), self.next_ball_id);
        build_moveset(&mut b);
        self.next_ball_id = b.next_ball_id;
        let key = format!("gen/fighter{}", def.id);
        let sheet = render_fighter_sheet(&b, &def.look);
        self.images.insert(key.clone(), sheet);
        self.images.insert(format!("{}_head", key), portrait_canvas(&def, 120.0));
        self.images.insert(format!("{}_small", key), small_canvas(&def));
        let s = &def.stats;
        let (sp, jp) = (s.speed, s.jump);
        let bmp = Bmp {
            name: def.name.to_string(),
            head: format!("{}_head", key),
            small: format!("{}_small", key),
            files: vec![FileSpec { file: key.clone(), w: CELL - 1.0, h: CELL - 1.0, cols: 10, rows: b.poses.len().div_ceil(10) }],
            walking_frame_rate: BaseStats::WALKING_FRAME_RATE,
            walking_speed: BaseStats::WALKING_SPEED * sp,
            walking_speedz: BaseStats::WALKING_SPEEDZ,
            running_frame_rate: BaseStats::RUNNING_FRAME_RATE,
            running_speed: BaseStats::RUNNING_SPEED * sp,
            running_speedz: BaseStats::RUNNING_SPEEDZ,
            heavy_walking_speed: BaseStats::HEAVY_WALKING_SPEED,
            heavy_walking_speedz: BaseStats::HEAVY_WALKING_SPEEDZ,
            heavy_running_speed: BaseStats::HEAVY_RUNNING_SPEED,
            heavy_running_speedz: BaseStats::HEAVY_RUNNING_SPEEDZ,
            jump_height: BaseStats::JUMP_HEIGHT * jp,
            jump_distance: BaseStats::JUMP_DISTANCE * sp,
            jump_distancez: BaseStats::JUMP_DISTANCEZ,
            dash_height: BaseStats::DASH_HEIGHT,
            dash_distance: BaseStats::DASH_DISTANCE * sp,
            dash_distancez: BaseStats::DASH_DISTANCEZ,
            rowing_height: BaseStats::ROWING_HEIGHT,
            rowing_distance: BaseStats::ROWING_DISTANCE,
            ..Default::default()
        };
        let frames = std::mem::take(&mut b.frames);
        self.objects.push(ObjData {
            id: def.id,
            kind: ObjType::Character,
            name: def.name.to_string(),
            bmp,
            frames,
            effect_list: vec![],
            broken_list: vec![],
            weapon_strength_list: HashMap::new(),
            props: Props { hp: Some(s.hp), ..Default::default() },
        });
        for ball in &b.objects {
            self.objects.push(build_ball(ball, &mut self.images));
        }
    }
}

impl Default for Builder {
    fn default() -> Self {
        Self::new()
    }
}

// ---- lutadores ----

fn render_fighter_sheet(b: &FighterBuilder, look: &crate::content::roster::Look) -> Canvas {
    let cols = 10;
    let rows = b.poses.len().div_ceil(cols);
    let c = make_canvas(cols as f64 * CELL, rows as f64 * CELL);
    let ctx = ctx_of(&c);
    for (i, pose) in b.poses.iter().enumerate() {
        let x0 = (i % cols) as f64 * CELL;
        let y0 = (i / cols) as f64 * CELL;
        ctx.save();
        ctx.begin();
        ctx.rect(x0, y0, CELL - 1.0, CELL - 1.0);
        ctx.clip();
        if let Some(g) = pose.glow {
            glow(&ctx, x0 + CX, y0 + BASE - 35.0, 42.0, &rgba(g, 0.55), 0.4);
        }
        if pose.frost > 0 {
            for k in 0..7 {
                let x = x0 + 6.0 + k as f64 * 14.0;
                let h = 10.0 + ((k * 7 + pose.frost as usize * 5) % 13) as f64;
                blob(&ctx, &[[x - 5.0, y0 + BASE], [x, y0 + BASE - h], [x + 5.0, y0 + BASE]], "#bff0ff", 0.7);
            }
        }
        let j = draw_pose_cell(&ctx, look, pose, x0, y0, CELL, BASE);
        if let Some(fire) = pose.fire {
            for (k, len) in [("chest", 5), ("kf", 2), ("head", 4), ("hb", 2)] {
                let q = j.get(k);
                draw_flame(&ctx, q[0], q[1] + 6.0, (fire + len) as usize, 0.9);
            }
        }
        if pose.ice {
            draw_ice_block(&ctx, x0 + CX - 30.0, y0 + 8.0, 60.0, BASE - 8.0);
        }
        ctx.restore();
    }
    c
}

fn portrait_canvas(def: &FighterDef, size: f64) -> Canvas {
    let c = make_canvas(size, size);
    draw_portrait(&ctx_of(&c), &def.look, 0.0, 0.0, size, Some(def.color));
    c
}

fn small_canvas(def: &FighterDef) -> Canvas {
    let c = make_canvas(40.0, 45.0);
    draw_portrait(&ctx_of(&c), &def.look, -2.0, 0.0, 45.0, Some(def.color));
    c
}

// ---- ataques especiais ----

fn build_ball(o: &BallSpec, images: &mut Images) -> ObjData {
    let wave = o.style == "wave";
    let k = match o.style.as_str() {
        "fire" => 1.75,
        "orb" => 1.55,
        "shard" => 1.45,
        "star" => 1.3,
        "wave" => 1.3,
        _ => 1.5,
    };
    let w = 130.0;
    let h = if wave { 76.0 } else { 80.0 };
    let cx = 88.0;
    let cy = if wave { h - 20.0 } else { 40.0 };
    let c = make_canvas(w * 10.0, h);
    let ctx = ctx_of(&c);
    for i in 0..10usize {
        ctx.save();
        ctx.begin();
        ctx.rect(i as f64 * w, 0.0, w - 1.0, h - 1.0);
        ctx.clip();
        ctx.translate(i as f64 * w + cx, cy);
        ctx.scale(k, k);
        if i < 4 {
            draw_orb(&ctx, 0.0, 0.0, &o.color, i, &o.style);
        } else if i < 8 {
            draw_energy_burst(&ctx, 0.0, 0.0, &o.color, i - 4, if o.style == "star" { 0.7 } else { 1.1 });
        }
        ctx.restore();
    }
    let key = format!("gen/ball{}", o.id);
    images.insert(key.clone(), c);
    let r = |v: f64| (v * k).round();
    let bx = if wave {
        Rect { x: cx - r(30.0), y: cy - r(22.0), w: r(44.0), h: r(32.0), zwidth: None }
    } else {
        Rect { x: cx - r(15.0), y: cy - r(10.0), w: r(28.0), h: r(20.0), zwidth: None }
    };
    let mut itr = Itr {
        kind: 0,
        x: bx.x,
        y: bx.y,
        w: bx.w,
        h: bx.h,
        injury: Some(o.injury),
        dvx: Some(7.0),
        fall: Some(o.fall),
        arest: Some(6),
        bdefend: Some(12.0),
        effect: Some(o.effect),
        ..Default::default()
    };
    if wave {
        itr.dvy = Some(-8.0);
        itr.vrest = Some(15);
        itr.arest = None;
    }
    let mut d = ObjData {
        id: o.id,
        kind: ObjType::SpecialAttack,
        name: String::new(),
        bmp: Bmp::default(),
        frames: vec![],
        effect_list: vec![],
        broken_list: vec![],
        weapon_strength_list: HashMap::new(),
        props: Props { zwidth: Some(10.0), shatter: o.broken, ..Default::default() },
    };
    let base = |pic: usize, state: i32, next: i32| Frame { state, pic, next, wait: 1, centerx: cx, centery: cy, ..Default::default() };
    for i in 0..4 {
        let mut f = base(i, 3000, if i < 3 { i as i32 + 1 } else { 0 });
        f.dvx = Some(if o.chase { 3.0 } else { o.speed });
        f.itr = vec![itr.clone()];
        f.bdy = vec![bx.clone()];
        f.set_tag(Tag::D, 40);
        f.set_tag(
            Tag::A,
            if o.chase {
                4
            } else if wave {
                14
            } else {
                0
            },
        );
        f.set_tag(Tag::Fa, if o.chase { 1 } else { 0 });
        d.set_frame(i as i32, f);
    }
    for i in 0..4 {
        d.set_frame(10 + i as i32, base(4 + i, 3001, if i < 3 { 11 + i as i32 } else { 1000 }));
        d.set_frame(20 + i as i32, base(4 + i, 3002, if i < 3 { 21 + i as i32 } else { 1000 }));
    }
    d.set_frame(30, base(4, 3003, 31));
    let mut f31 = base(5, 3003, 32);
    f31.opoint = vec![OPoint { kind: 1, x: cx, y: cy, action: 0, dvx: 0.0, dvy: 0.0, oid: o.id, facing: 1, dvz: None }];
    d.set_frame(31, f31);
    d.set_frame(32, base(6, 3003, 1000));
    for i in 0..3 {
        d.set_frame(40 + i as i32, base(5 + i, 3004, if i < 2 { 41 + i as i32 } else { 1000 }));
    }
    let snd = if o.effect == 30 {
        "freeze"
    } else if o.effect == 20 {
        "fire"
    } else {
        "boom"
    };
    d.bmp = Bmp {
        files: vec![FileSpec { file: key, w: w - 1.0, h: h - 1.0, cols: 10, rows: 1 }],
        weapon_hit_sound: Some(snd),
        weapon_drop_sound: Some(snd),
        weapon_broken_sound: Some(snd),
        ..Default::default()
    };
    d
}

// ---- armas ----

fn build_light_weapon(w: &WeaponDef, images: &mut Images) -> ObjData {
    let s = 48.0;
    let c = make_canvas(s * 17.0, s);
    let ctx = ctx_of(&c);
    for k in 0..16usize {
        ctx.save();
        ctx.begin();
        ctx.rect(k as f64 * s, 0.0, s - 1.0, s - 1.0);
        ctx.clip();
        draw_weapon(&ctx, w.kind, k as f64 * s + 24.0, 24.0, weapon_angle(k), 1.0);
        ctx.restore();
    }
    draw_weapon(&ctx, w.kind, 16.0 * s + 20.0, 38.0, 90.0, 1.0);
    let key = format!("gen/weapon{}", w.id);
    images.insert(key.clone(), c);
    let st = w.strength;
    let shaft = |k: usize| -> Itr {
        let tip = along([24.0, 24.0], weapon_angle(k), 20.0);
        let base = along([24.0, 24.0], weapon_angle(k) + 180.0, 4.0);
        let b = box_around(&[tip, base], 4.0);
        Itr { kind: 5, x: b.x, y: b.y, w: b.w, h: b.h, fall: Some(20.0), bdefend: Some(16.0), ..Default::default() }
    };
    let mut d = ObjData {
        id: w.id,
        kind: ObjType::LightWeapon,
        name: w.name.to_string(),
        bmp: Bmp::default(),
        frames: vec![],
        effect_list: vec![],
        broken_list: vec![],
        weapon_strength_list: HashMap::new(),
        props: Props { attackable: true, stand_throw: true, run_throw: true, jump_throw: true, ..Default::default() },
    };
    let base = |pic: usize, state: i32, next: i32| Frame { state, pic, next, wait: 0, centerx: 24.0, centery: 40.0, ..Default::default() };
    for k in 0..16usize {
        let mut f = base(k, 1000, if k < 15 { k as i32 + 1 } else { 999 });
        f.bdy = vec![Rect { x: 8.0, y: 8.0, w: 32.0, h: 32.0, zwidth: None }];
        d.set_frame(k as i32, f);
    }
    for k in 0..16usize {
        let mut f = base(k, 1001, 0);
        f.itr = vec![shaft(k)];
        f.wpoint = Some(WPoint { kind: 2, x: 24.0, y: 24.0, weaponact: 0, attacking: 0, cover: 0, dvx: 0.0, dvy: 0.0, dvz: 0.0 });
        d.set_frame(20 + k as i32, f);
    }
    let thrown = Itr { kind: 0, x: 6.0, y: 6.0, w: 36.0, h: 36.0, dvx: Some(8.0), fall: Some(70.0), bdefend: Some(16.0), injury: Some((45.0 * st).round()), ..Default::default() };
    for k in 0..16usize {
        let mut f = base((k * 2) % 16, 1002, if k < 15 { 41 + k as i32 } else { 40 });
        f.itr = vec![thrown.clone()];
        f.bdy = vec![Rect { x: 6.0, y: 6.0, w: 36.0, h: 36.0, zwidth: None }];
        d.set_frame(40 + k as i32, f);
    }
    let lying = Rect { x: 2.0, y: 30.0, w: 44.0, h: 14.0, zwidth: None };
    let snd = if w.kind == "pipe" { "clank" } else { "wood" };
    let mut f60 = base(16, 1003, 61);
    f60.wait = 1;
    f60.sound = Some(snd);
    d.set_frame(60, f60);
    for (n, wait, next) in [(61, 2, 62), (62, 2, 63), (63, 1, 64)] {
        let mut f = base(16, 1003, next);
        f.wait = wait;
        d.set_frame(n, f);
    }
    let mut f64_ = base(16, 1004, 0);
    f64_.bdy = vec![lying];
    d.set_frame(64, f64_);
    let mut f70 = base(16, 1003, 71);
    f70.wait = 1;
    f70.sound = Some(snd);
    d.set_frame(70, f70);
    for (n, wait, next) in [(71, 2, 72), (72, 2, 64)] {
        let mut f = base(16, 1003, next);
        f.wait = wait;
        d.set_frame(n, f);
    }
    let stl = |dvx: f64, fall: f64, injury: f64| Itr {
        kind: 0,
        bdefend: Some(16.0),
        vrest: Some(10),
        dvx: Some(dvx),
        fall: Some(fall),
        injury: Some((injury * st).round()),
        ..Default::default()
    };
    d.weapon_strength_list = HashMap::from([(1, stl(3.0, 40.0, 32.0)), (2, stl(7.0, 70.0, 36.0)), (3, stl(10.0, 70.0, 44.0)), (4, stl(12.0, 70.0, 48.0))]);
    d.bmp = Bmp {
        name: w.name.to_string(),
        files: vec![FileSpec { file: key, w: s - 1.0, h: s - 1.0, cols: 17, rows: 1 }],
        weapon_hp: w.hp,
        weapon_drop_hurt: 35.0,
        weapon_hit_sound: Some(snd),
        weapon_drop_sound: Some(snd),
        weapon_broken_sound: Some("break"),
        ..Default::default()
    };
    d
}

fn build_heavy_weapon(w: &WeaponDef, images: &mut Images) -> ObjData {
    let s = 64.0;
    let c = make_canvas(s * 4.0, s);
    let ctx = ctx_of(&c);
    for k in 0..4usize {
        ctx.save();
        ctx.begin();
        ctx.rect(k as f64 * s, 0.0, s - 1.0, s - 1.0);
        ctx.clip();
        ctx.translate(k as f64 * s + 32.0, 44.0);
        ctx.rotate(k as f64 * std::f64::consts::PI / 4.0);
        ctx.translate(-32.0, -44.0);
        draw_weapon(&ctx, w.kind, 32.0, 44.0, 0.0, 1.0);
        ctx.restore();
    }
    let key = format!("gen/weapon{}", w.id);
    images.insert(key.clone(), c);
    let bx = Rect { x: 15.0, y: 27.0, w: 34.0, h: 34.0, zwidth: None };
    let hit_i = Itr {
        kind: 0,
        x: bx.x,
        y: bx.y,
        w: bx.w,
        h: bx.h,
        dvx: Some(5.0),
        dvy: Some(-7.0),
        fall: Some(70.0),
        vrest: Some(17),
        bdefend: Some(30.0),
        injury: Some(if w.kind == "stone" { 60.0 } else { 45.0 }),
        ..Default::default()
    };
    let mut d = ObjData {
        id: w.id,
        kind: ObjType::HeavyWeapon,
        name: w.name.to_string(),
        bmp: Bmp::default(),
        frames: vec![],
        effect_list: vec![],
        broken_list: vec![],
        weapon_strength_list: HashMap::new(),
        props: Props::default(),
    };
    let base = |pic: usize, state: i32, next: i32, wait: i32| Frame { state, pic, next, wait, centerx: 32.0, centery: 60.0, ..Default::default() };
    for (i, pic) in [0usize, 1, 2, 3, 2, 1].iter().enumerate() {
        let mut f = base(*pic, 2000, if i < 5 { i as i32 + 1 } else { 999 }, 2);
        f.itr = vec![hit_i.clone()];
        f.bdy = vec![bx.clone()];
        d.set_frame(i as i32, f);
    }
    let mut f10 = base(0, 2001, 0, 0);
    f10.wpoint = Some(WPoint { kind: 2, x: 32.0, y: 60.0, weaponact: 0, attacking: 0, cover: 0, dvx: 0.0, dvy: 0.0, dvz: 0.0 });
    d.set_frame(10, f10);
    let mut f20 = base(0, 2004, 0, 0);
    f20.itr = vec![Itr { kind: 14, x: 20.0, y: 36.0, w: 24.0, h: 22.0, vrest: Some(1), ..Default::default() }];
    f20.bdy = vec![bx.clone()];
    d.set_frame(20, f20);
    let mut f21 = base(0, 2000, 999, 1);
    f21.itr = vec![hit_i];
    d.set_frame(21, f21);
    let snd = if w.kind == "stone" { "thud" } else { "wood" };
    d.bmp = Bmp {
        name: w.name.to_string(),
        files: vec![FileSpec { file: key, w: s - 1.0, h: s - 1.0, cols: 4, rows: 1 }],
        weapon_hp: w.hp,
        weapon_drop_hurt: 120.0,
        weapon_hit_sound: Some(snd),
        weapon_drop_sound: Some(snd),
        weapon_broken_sound: Some("break"),
        ..Default::default()
    };
    d
}

// ---- efeitos ----

fn build_spark(id: i32, color: &str, images: &mut Images) -> ObjData {
    let s = 80.0;
    let c = make_canvas(s * 10.0, s);
    let ctx = ctx_of(&c);
    for i in 0..10usize {
        ctx.save();
        ctx.begin();
        ctx.rect(i as f64 * s, 0.0, s - 1.0, s - 1.0);
        ctx.clip();
        draw_spark(&ctx, i as f64 * s + 40.0, 40.0, i % 5, i < 5, color);
        ctx.restore();
    }
    let key = format!("gen/effect{}", id);
    images.insert(key.clone(), c);
    let mut d = ObjData {
        id,
        kind: ObjType::Effect,
        name: String::new(),
        bmp: Bmp { files: vec![FileSpec { file: key, w: s - 1.0, h: s - 1.0, cols: 10, rows: 1 }], ..Default::default() },
        frames: vec![],
        effect_list: vec![("small", 10), ("big", 0)],
        broken_list: vec![],
        weapon_strength_list: HashMap::new(),
        props: Props::default(),
    };
    for i in 0..5usize {
        d.set_frame(
            i as i32,
            Frame {
                name: "big",
                pic: i,
                wait: 0,
                next: if i < 4 { i as i32 + 1 } else { 1000 },
                centerx: 40.0,
                centery: 40.0,
                sound: if i == 0 { Some("hit2") } else { None },
                ..Default::default()
            },
        );
        d.set_frame(
            10 + i as i32,
            Frame {
                name: "small",
                pic: 5 + i,
                wait: 0,
                next: if i < 4 { 11 + i as i32 } else { 1000 },
                centerx: 40.0,
                centery: 40.0,
                sound: if i == 0 { Some("hit") } else { None },
                ..Default::default()
            },
        );
    }
    d
}

/// pedaços de armas quebradas, fagulhas de fogo e cacos de gelo
fn build_broken(images: &mut Images) -> ObjData {
    let s = 28.0;
    let kinds: [(i32, i32, &str); 6] = [(150, 0, "#8d8d94"), (100, 10, "#c88a4a"), (101, 20, "#9aa4b2"), (151, 40, "#b9803f"), (302, 60, "fire"), (212, 70, "#bff0ff")];
    let c = make_canvas(s * 10.0, s * 8.0);
    let ctx = ctx_of(&c);
    let mut d = ObjData {
        id: 320,
        kind: ObjType::Broken,
        name: String::new(),
        bmp: Bmp { files: vec![FileSpec { file: "gen/broken".into(), w: s - 1.0, h: s - 1.0, cols: 10, rows: 8 }], ..Default::default() },
        frames: vec![],
        effect_list: vec![],
        broken_list: vec![],
        weapon_strength_list: HashMap::new(),
        props: Props::default(),
    };
    for (row, (id, first, col)) in kinds.iter().enumerate() {
        for i in 0..8usize {
            let x = i as f64 * s + 14.0;
            let y = row as f64 * s + 14.0;
            ctx.save();
            ctx.begin();
            ctx.rect(i as f64 * s, row as f64 * s, s - 1.0, s - 1.0);
            ctx.clip();
            if *col == "fire" {
                draw_flame(&ctx, x, y + 8.0, i, 0.6);
            } else {
                ctx.translate(x, y);
                ctx.rotate(i as f64 * std::f64::consts::PI / 4.0);
                let r = if i < 4 { 6.0 } else { 4.0 };
                blob(&ctx, &[[-r, -r * 0.6], [r * 0.4, -r], [r, r * 0.3], [-r * 0.2, r]], col, 0.8);
            }
            ctx.restore();
            let n = first + i as i32;
            let pic = row * 10 + i;
            let fire = *col == "fire";
            let next = if fire {
                if i % 4 < 3 {
                    n + 1
                } else {
                    1000
                }
            } else if i % 4 < 3 {
                n + 1
            } else {
                n - 3
            };
            d.set_frame(n, Frame { state: 9999, pic, wait: 2, centerx: 14.0, centery: if fire { 22.0 } else { 14.0 }, next, ..Default::default() });
        }
        d.broken_list.push((*id, *first));
        d.broken_list.push((*id, *first + 4));
    }
    images.insert("gen/broken".into(), c);
    d
}
