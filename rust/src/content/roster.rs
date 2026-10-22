//! Elenco do Punho Livre: aparência, atributos e golpes especiais de cada lutador.
//! Os números de quadro dos especiais (at) ficam a partir de 240.

use crate::core::input::Tag;

#[derive(Clone, Debug, Default)]
pub struct Emblem {
    pub kind: &'static str,
    pub color: &'static str,
}

#[derive(Clone, Debug, Default)]
pub struct Look {
    pub skin: &'static str,
    pub hair: &'static str,
    pub hair_style: &'static str,
    pub shirt: &'static str,
    pub sleeves: &'static str,
    pub pants: &'static str,
    pub shoes: &'static str,
    pub belt: Option<&'static str>,
    pub headband: Option<&'static str>,
    pub emblem: Option<Emblem>,
    pub eye: Option<&'static str>,
    pub scarf: Option<&'static str>,
    pub mask: Option<&'static str>,
    pub wrist: Option<&'static str>,
    pub beard: bool,
    pub build: f64,
    pub scale: f64,
    pub gloves: Option<&'static str>,
    pub shorts: bool,
    pub socks: Option<&'static str>,
    pub vest: Option<&'static str>,
    pub accent: &'static str,
}

#[derive(Clone, Debug)]
pub struct Stats {
    pub punch: f64,
    pub kick: f64,
    pub speed: f64,
    pub jump: f64,
    pub power: f64,
    pub hp: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpecialType {
    Blast,
    Chase,
    Uppercut,
    Rush,
    Charge,
    Slam,
    Teleport,
    Heal,
    Spin,
    Frost,
}

#[derive(Clone, Debug)]
pub struct SpecialDef {
    pub label: &'static str,
    pub kind: SpecialType,
    pub tag: Tag,
    pub at: i32,
    pub mp: i32,
    pub color: &'static str,
    pub style: &'static str,
    pub effect: i32,
    pub injury: f64,
    pub fall: Option<f64>,
    pub speed: f64,
    pub multi: bool,
    pub sound: Option<&'static str>,
    pub kicks: bool,
}

#[derive(Clone, Debug)]
pub struct FighterDef {
    pub id: i32,
    pub name: &'static str,
    pub color: &'static str,
    pub desc: &'static str,
    pub enemy: bool,
    pub look: Look,
    pub stats: Stats,
    pub specials: Vec<SpecialDef>,
}

fn sp(label: &'static str, kind: SpecialType, tag: Tag, at: i32, mp: i32, injury: f64) -> SpecialDef {
    SpecialDef { label, kind, tag, at, mp, color: "#ffffff", style: "orb", effect: 0, injury, fall: None, speed: 0.0, multi: false, sound: None, kicks: false }
}

fn stats(punch: f64, kick: f64) -> Stats {
    Stats { punch, kick, speed: 1.0, jump: 1.0, power: 1.0, hp: 500.0 }
}

fn look(skin: &'static str, hair: &'static str, hair_style: &'static str, shirt: &'static str, sleeves: &'static str, pants: &'static str, shoes: &'static str) -> Look {
    Look { skin, hair, hair_style, shirt, sleeves, pants, shoes, build: 1.0, scale: 1.0, accent: "#b52a2a", ..Default::default() }
}

pub fn roster() -> Vec<FighterDef> {
    vec![
        FighterDef {
            id: 1,
            name: "Brasa",
            color: "#e2552e",
            desc: "Lutador de rua que solta fogo pelas mãos.",
            enemy: false,
            look: Look {
                belt: Some("#141018"),
                headband: Some("#ffd23a"),
                emblem: Some(Emblem { kind: "flame", color: "#ffd23a" }),
                eye: Some("#3a1a0e"),
                ..look("#f1c08f", "#3a1a0e", "spiky", "#d8402f", "short", "#2d3a63", "#26222b")
            },
            stats: stats(18.0, 40.0),
            specials: vec![
                SpecialDef { color: "#ff7a1f", style: "fire", effect: 20, sound: Some("fire"), ..sp("Bola de fogo", SpecialType::Blast, Tag::Fa, 240, 50, 32.0) },
                SpecialDef { effect: 20, ..sp("Gancho flamejante", SpecialType::Uppercut, Tag::Ua, 250, 80, 50.0) },
                sp("Rajada de socos", SpecialType::Rush, Tag::Fj, 260, 70, 10.0),
            ],
        },
        FighterDef {
            id: 2,
            name: "Geada",
            color: "#5ab8f0",
            desc: "Congela quem chega perto.",
            enemy: false,
            look: Look {
                scarf: Some("#9fdcff"),
                emblem: Some(Emblem { kind: "snow", color: "#e8f8ff" }),
                eye: Some("#2a5a9a"),
                ..look("#f0c8a0", "#bfe6ff", "short", "#2f6fd8", "long", "#e8f4ff", "#2c3550")
            },
            stats: stats(17.0, 38.0),
            specials: vec![
                SpecialDef {
                    color: "#8fe0ff",
                    style: "shard",
                    effect: 30,
                    fall: Some(20.0),
                    sound: Some("freeze"),
                    ..sp("Estilhaço de gelo", SpecialType::Blast, Tag::Fa, 240, 60, 28.0)
                },
                sp("Explosão congelante", SpecialType::Frost, Tag::Da, 250, 120, 30.0),
                sp("Gancho", SpecialType::Uppercut, Tag::Ua, 260, 70, 46.0),
            ],
        },
        FighterDef {
            id: 3,
            name: "Corvo",
            color: "#8a52c8",
            desc: "Ninja que some e reaparece atrás do inimigo.",
            enemy: false,
            look: Look {
                mask: Some("#3a3a4a"),
                belt: Some("#7a3aa8"),
                wrist: Some("#7a3aa8"),
                emblem: Some(Emblem { kind: "star", color: "#b06cff" }),
                eye: Some("#9a5ad8"),
                ..look("#e8b88f", "#1a1a22", "hood", "#2a2a36", "long", "#2a2a36", "#111116")
            },
            stats: Stats { speed: 1.1, ..stats(16.0, 40.0) },
            specials: vec![
                SpecialDef {
                    color: "#c9d2dc",
                    style: "star",
                    multi: true,
                    fall: Some(20.0),
                    speed: 15.0,
                    sound: Some("swing"),
                    ..sp("Estrelas ninja", SpecialType::Blast, Tag::Fa, 240, 45, 18.0)
                },
                sp("Sombra", SpecialType::Teleport, Tag::Uj, 250, 90, 42.0),
                sp("Chute giratório", SpecialType::Spin, Tag::Da, 260, 60, 20.0),
            ],
        },
        FighterDef {
            id: 4,
            name: "Titã",
            color: "#c98a3a",
            desc: "Grandalhão: mais vida e golpes pesados, porém mais lento.",
            enemy: false,
            look: Look {
                beard: true,
                belt: Some("#a83228"),
                build: 1.3,
                scale: 1.08,
                emblem: Some(Emblem { kind: "ring", color: "#a83228" }),
                ..look("#8d5a3a", "#1a1210", "bald", "#e8e2d2", "none", "#5a3a1a", "#241a14")
            },
            stats: Stats { power: 1.2, hp: 620.0, speed: 0.85, ..stats(24.0, 46.0) },
            specials: vec![
                sp("Investida", SpecialType::Charge, Tag::Fa, 240, 70, 55.0),
                SpecialDef { color: "#d9a066", ..sp("Tremor", SpecialType::Slam, Tag::Da, 250, 110, 45.0) },
                sp("Gancho do titã", SpecialType::Uppercut, Tag::Ua, 260, 80, 60.0),
            ],
        },
        FighterDef {
            id: 5,
            name: "Faísca",
            color: "#f2c81e",
            desc: "O mais rápido, com rajadas elétricas.",
            enemy: false,
            look: Look {
                gloves: Some("#f2c81e"),
                belt: Some("#22242c"),
                emblem: Some(Emblem { kind: "bolt", color: "#f2c81e" }),
                eye: Some("#2a8ad8"),
                ..look("#f2c9a0", "#f2d23a", "mohawk", "#22242c", "short", "#f2c81e", "#22242c")
            },
            stats: Stats { speed: 1.2, jump: 1.1, ..stats(15.0, 36.0) },
            specials: vec![
                SpecialDef { color: "#fff06a", style: "orb", fall: Some(25.0), speed: 17.0, sound: Some("zap"), ..sp("Raio", SpecialType::Blast, Tag::Fa, 240, 40, 26.0) },
                sp("Rajada relâmpago", SpecialType::Rush, Tag::Fj, 250, 60, 9.0),
                sp("Giro elétrico", SpecialType::Spin, Tag::Uj, 260, 60, 18.0),
            ],
        },
        FighterDef {
            id: 6,
            name: "Jade",
            color: "#2fae7a",
            desc: "Mestra de chutes que sabe se curar.",
            enemy: false,
            look: Look {
                belt: Some("#e0b030"),
                wrist: Some("#e0b030"),
                emblem: Some(Emblem { kind: "ring", color: "#f2efe6" }),
                eye: Some("#1a6a4a"),
                ..look("#c98a5a", "#151010", "ponytail", "#1f8a70", "none", "#f2efe6", "#2d2a28")
            },
            stats: Stats { jump: 1.08, ..stats(16.0, 44.0) },
            specials: vec![
                SpecialDef { kicks: true, ..sp("Chuva de chutes", SpecialType::Rush, Tag::Fa, 240, 60, 11.0) },
                sp("Chute crescente", SpecialType::Uppercut, Tag::Ua, 250, 70, 48.0),
                SpecialDef { color: "#7dffb0", ..sp("Meditação", SpecialType::Heal, Tag::Dj, 260, 150, 0.0) },
            ],
        },
        FighterDef {
            id: 7,
            name: "Lua",
            color: "#b06cff",
            desc: "Energia que persegue os inimigos.",
            enemy: false,
            look: Look {
                scarf: Some("#d9b8ff"),
                emblem: Some(Emblem { kind: "moon", color: "#f2e8ff" }),
                eye: Some("#6a3ac8"),
                ..look("#f4d2b8", "#3c2a6a", "long", "#6a3ac8", "long", "#2a1f4a", "#1a1430")
            },
            stats: stats(15.0, 36.0),
            specials: vec![
                SpecialDef { color: "#c890ff", ..sp("Orbe caçador", SpecialType::Chase, Tag::Fa, 240, 60, 28.0) },
                SpecialDef { color: "#b06cff", ..sp("Onda lunar", SpecialType::Slam, Tag::Da, 250, 100, 36.0) },
                SpecialDef { color: "#e2c4ff", ..sp("Luz curativa", SpecialType::Heal, Tag::Dj, 260, 150, 0.0) },
            ],
        },
        FighterDef {
            id: 8,
            name: "Bala",
            color: "#e23a4a",
            desc: "Boxeador de socos rápidos e fortes.",
            enemy: false,
            look: Look {
                shorts: true,
                socks: Some("#f2f2f2"),
                gloves: Some("#d8202e"),
                belt: Some("#f2f2f2"),
                emblem: Some(Emblem { kind: "star", color: "#d8202e" }),
                ..look("#6a4028", "#120c0a", "flat", "#f2f2f2", "none", "#c8202e", "#f2f2f2")
            },
            stats: Stats { power: 1.05, ..stats(22.0, 34.0) },
            specials: vec![
                sp("Metralhadora", SpecialType::Rush, Tag::Fa, 240, 60, 12.0),
                sp("Gancho", SpecialType::Uppercut, Tag::Ua, 250, 70, 58.0),
                sp("Direto voador", SpecialType::Charge, Tag::Fj, 260, 60, 45.0),
            ],
        },
        FighterDef {
            id: 30,
            name: "Capanga",
            color: "#8a7a5a",
            desc: "Bandido de rua.",
            enemy: true,
            look: Look { accent: "#b52a2a", vest: Some("#6a4a2a"), ..look("#e3a87e", "#5a3a1a", "bandana", "#e9e2c8", "short", "#4a4a3a", "#2a1a1a") },
            stats: Stats { speed: 0.9, ..stats(14.0, 30.0) },
            specials: vec![],
        },
    ]
}

pub fn fighter_def(id: i32) -> Option<FighterDef> {
    roster().into_iter().find(|f| f.id == id)
}

#[derive(Clone, Debug)]
pub struct WeaponDef {
    pub id: i32,
    pub heavy: bool,
    pub name: &'static str,
    pub kind: &'static str,
    pub hp: f64,
    pub strength: f64,
}

/// armas espalhadas pela arena
pub fn weapons() -> Vec<WeaponDef> {
    vec![
        WeaponDef { id: 100, heavy: false, name: "Bastão", kind: "bat", hp: 200.0, strength: 1.0 },
        WeaponDef { id: 101, heavy: false, name: "Cano", kind: "pipe", hp: 320.0, strength: 1.2 },
        WeaponDef { id: 150, heavy: true, name: "Pedra", kind: "stone", hp: 800.0, strength: 1.0 },
        WeaponDef { id: 151, heavy: true, name: "Caixa", kind: "crate", hp: 300.0, strength: 1.0 },
    ]
}

/// velocidades base de todos os lutadores (multiplicadas por speed/jump de cada um)
pub struct BaseStats;
impl BaseStats {
    pub const WALKING_FRAME_RATE: i32 = 3;
    pub const WALKING_SPEED: f64 = 4.6;
    pub const WALKING_SPEEDZ: f64 = 2.4;
    pub const RUNNING_FRAME_RATE: i32 = 3;
    pub const RUNNING_SPEED: f64 = 9.5;
    pub const RUNNING_SPEEDZ: f64 = 1.6;
    pub const HEAVY_WALKING_SPEED: f64 = 3.4;
    pub const HEAVY_WALKING_SPEEDZ: f64 = 1.7;
    pub const HEAVY_RUNNING_SPEED: f64 = 6.0;
    pub const HEAVY_RUNNING_SPEEDZ: f64 = 1.0;
    pub const JUMP_HEIGHT: f64 = -16.0;
    pub const JUMP_DISTANCE: f64 = 9.5;
    pub const JUMP_DISTANCEZ: f64 = 3.6;
    pub const DASH_HEIGHT: f64 = -10.0;
    pub const DASH_DISTANCE: f64 = 17.0;
    pub const DASH_DISTANCEZ: f64 = 5.0;
    pub const ROWING_HEIGHT: f64 = -2.0;
    pub const ROWING_DISTANCE: f64 = 5.0;
}
