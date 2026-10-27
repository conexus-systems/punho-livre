//! Dados por quadros que o motor lê: cada lutador, arma e ataque é uma tabela de quadros
//! com imagem (pic), duração (wait), próximo quadro (next), estado, caixas de corpo (bdy)
//! e de golpe (itr), ponto da arma (wpoint), de agarrão (cpoint) e de criação (opoint).

use std::collections::HashMap;

use crate::core::input::Tag;
use crate::gfx::{Canvas, SpriteSheet};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub zwidth: Option<f64>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Itr {
    pub kind: i32,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub zwidth: Option<f64>,
    pub dvx: Option<f64>,
    pub dvy: Option<f64>,
    pub fall: Option<f64>,
    pub vrest: Option<i32>,
    pub arest: Option<i32>,
    pub bdefend: Option<f64>,
    pub injury: Option<f64>,
    pub effect: Option<i32>,
    pub catchingact: Option<[i32; 2]>,
    pub caughtact: Option<[i32; 2]>,
    pub vaction: Option<i32>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct WPoint {
    pub kind: i32,
    pub x: f64,
    pub y: f64,
    pub weaponact: i32,
    pub attacking: i32,
    pub cover: i32,
    pub dvx: f64,
    pub dvy: f64,
    pub dvz: f64,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct CPoint {
    pub kind: i32,
    pub x: f64,
    pub y: f64,
    pub injury: Option<f64>,
    pub hurtable: Option<i32>,
    pub throwvx: Option<f64>,
    pub throwvy: Option<f64>,
    pub throwvz: Option<f64>,
    pub throwinjury: Option<f64>,
    pub vaction: Option<i32>,
    pub aaction: Option<i32>,
    pub taction: Option<i32>,
    pub jaction: Option<i32>,
    pub dircontrol: Option<i32>,
    pub cover: Option<i32>,
    pub fronthurtact: Option<i32>,
    pub backhurtact: Option<i32>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct OPoint {
    pub kind: i32,
    pub x: f64,
    pub y: f64,
    pub action: i32,
    pub dvx: f64,
    pub dvy: f64,
    pub oid: i32,
    pub facing: i32,
    pub dvz: Option<f64>,
}

#[derive(Clone, Debug, Default)]
pub struct Frame {
    pub name: &'static str,
    pub state: i32,
    pub wait: i32,
    pub next: i32,
    pub pic: usize,
    pub centerx: f64,
    pub centery: f64,
    pub dvx: Option<f64>,
    pub dvy: Option<f64>,
    pub dvz: Option<f64>,
    pub mp: Option<i32>,
    /// hit_a, hit_d, hit_j, hit_Fa... (nas bolas: hit_a = vida perdida por TU, hit_d = quadro ao morrer, hit_Fa = perseguição)
    pub tags: [Option<i32>; 10],
    pub sound: Option<&'static str>,
    pub land: Option<i32>,
    pub bdy: Vec<Rect>,
    pub itr: Vec<Itr>,
    pub wpoint: Option<WPoint>,
    pub cpoint: Option<CPoint>,
    pub opoint: Vec<OPoint>,
}

impl Frame {
    pub fn tag(&self, t: Tag) -> Option<i32> {
        self.tags[tag_index(t)]
    }
    pub fn set_tag(&mut self, t: Tag, v: i32) {
        self.tags[tag_index(t)] = Some(v);
    }
}

pub fn tag_index(t: Tag) -> usize {
    match t {
        Tag::A => 0,
        Tag::D => 1,
        Tag::J => 2,
        Tag::Fa => 3,
        Tag::Ua => 4,
        Tag::Da => 5,
        Tag::Fj => 6,
        Tag::Uj => 7,
        Tag::Dj => 8,
        Tag::Ja => 9,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ObjType {
    Character,
    LightWeapon,
    HeavyWeapon,
    Drink,
    SpecialAttack,
    Effect,
    Broken,
}

impl ObjType {
    pub fn is_weapon(self) -> bool {
        matches!(self, ObjType::LightWeapon | ObjType::HeavyWeapon | ObjType::Drink)
    }
}

#[derive(Clone, Debug)]
pub struct FileSpec {
    pub file: String,
    pub w: f64,
    pub h: f64,
    pub cols: usize,
    pub rows: usize,
}

/// o bloco `bmp` dos dados: nome, imagens e velocidades
#[derive(Clone, Debug, Default)]
pub struct Bmp {
    pub name: String,
    pub head: String,
    pub small: String,
    pub files: Vec<FileSpec>,
    pub walking_frame_rate: i32,
    pub walking_speed: f64,
    pub walking_speedz: f64,
    pub running_frame_rate: i32,
    pub running_speed: f64,
    pub running_speedz: f64,
    pub heavy_walking_speed: f64,
    pub heavy_walking_speedz: f64,
    pub heavy_running_speed: f64,
    pub heavy_running_speedz: f64,
    pub jump_height: f64,
    pub jump_distance: f64,
    pub jump_distancez: f64,
    pub dash_height: f64,
    pub dash_distance: f64,
    pub dash_distancez: f64,
    pub rowing_height: f64,
    pub rowing_distance: f64,
    pub weapon_hp: f64,
    pub weapon_drop_hurt: f64,
    pub weapon_hit_sound: Option<&'static str>,
    pub weapon_drop_sound: Option<&'static str>,
    pub weapon_broken_sound: Option<&'static str>,
}

/// propriedades extras (o antigo `Assets.prop`)
#[derive(Clone, Debug, Default)]
pub struct Props {
    pub hp: Option<f64>,
    pub mass: Option<f64>,
    pub zwidth: Option<f64>,
    pub shatter: bool,
    pub attackable: bool,
    pub stand_throw: bool,
    pub run_throw: bool,
    pub jump_throw: bool,
    pub just_throw: bool,
    pub milk: bool,
    pub no_shadow: bool,
}

#[derive(Clone, Debug)]
pub struct ObjData {
    pub id: i32,
    pub kind: ObjType,
    pub name: String,
    pub bmp: Bmp,
    pub frames: Vec<Option<Frame>>,
    pub effect_list: Vec<(&'static str, i32)>,
    pub broken_list: Vec<(i32, i32)>,
    pub weapon_strength_list: HashMap<i32, Itr>,
    pub props: Props,
}

impl ObjData {
    pub fn frame(&self, n: i32) -> Option<&Frame> {
        if n < 0 {
            return None;
        }
        self.frames.get(n as usize).and_then(|f| f.as_ref())
    }
    pub fn set_frame(&mut self, n: i32, f: Frame) {
        let n = n as usize;
        if self.frames.len() <= n {
            self.frames.resize(n + 1, None);
        }
        self.frames[n] = Some(f);
    }
}

#[derive(Clone, Debug)]
pub struct Layer {
    pub pic: String,
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
    pub front: bool,
    pub alpha: f64,
    pub i: usize,
    pub ratio: f64,
}

#[derive(Clone, Debug)]
pub struct BgData {
    pub id: i32,
    pub name: String,
    pub width: f64,
    pub zboundary: [f64; 2],
    pub shadow: String,
    pub layers: Vec<Layer>,
    pub tone: Option<String>,
    pub vignette: f64,
}

pub struct Assets {
    pub objects: HashMap<i32, ObjData>,
    pub images: HashMap<String, Canvas>,
    pub backgrounds: Vec<BgData>,
    pub sheets: HashMap<i32, SpriteSheet>,
    pub order: Vec<i32>, // ids dos objetos na ordem de criação
}

impl Assets {
    pub fn obj(&self, id: i32) -> Option<&ObjData> {
        self.objects.get(&id)
    }
    pub fn img(&self, key: &str) -> Option<&Canvas> {
        self.images.get(key)
    }
    pub fn sheet(&self, id: i32) -> Option<&SpriteSheet> {
        self.sheets.get(&id)
    }
    pub fn bg(&self, id: i32) -> &BgData {
        self.backgrounds.iter().find(|b| b.id == id).unwrap_or(&self.backgrounds[0])
    }
    pub fn bg_index(&self, id: i32) -> usize {
        self.backgrounds.iter().position(|b| b.id == id).unwrap_or(0)
    }
    /// lutadores na ordem do elenco (1-8 e o capanga por último)
    pub fn character_list(&self) -> Vec<i32> {
        let order = [1, 2, 3, 4, 5, 6, 7, 8, 30];
        let mut ids: Vec<i32> = self.objects.values().filter(|o| o.kind == ObjType::Character).map(|o| o.id).collect();
        ids.sort_by_key(|id| order.iter().position(|o| o == id).unwrap_or(99));
        ids
    }
    pub fn weapon_ids(&self) -> Vec<i32> {
        let mut ids: Vec<i32> = self.objects.keys().copied().filter(|id| (100..200).contains(id)).collect();
        ids.sort();
        ids
    }
    pub fn make_sheets(&mut self) {
        let mut sheets = HashMap::new();
        for (id, o) in &self.objects {
            if o.bmp.files.is_empty() {
                continue;
            }
            let files = o
                .bmp
                .files
                .iter()
                .filter_map(|f| {
                    let img = self.images.get(&f.file)?.clone();
                    Some(crate::gfx::SheetFile { img, w: f.w, h: f.h, cols: f.cols, count: f.cols * f.rows })
                })
                .collect::<Vec<_>>();
            if files.is_empty() {
                continue;
            }
            let w = o.bmp.files[0].w + 1.0;
            let h = o.bmp.files[0].h + 1.0;
            sheets.insert(*id, SpriteSheet { files, w, h });
        }
        self.sheets = sheets;
    }
}

pub fn assets_info_json() -> String {
    let a = crate::game::assets();
    let fighters = a.objects.values().filter(|o| o.kind == ObjType::Character).count();
    let sheets = a.images.keys().filter(|k| k.starts_with("gen/fighter") && !k.contains('_')).count();
    format!("{{\"fighters\":{},\"scenes\":{},\"sheets\":{},\"objects\":{}}}", fighters, a.backgrounds.len(), sheets, a.objects.len())
}
