//! Backend nativo do desenho: a mesma interface curta do Canvas 2D, sobre o `tiny-skia`.
//! Cada `Canvas` é um `Pixmap` compartilhado; `Ctx` guarda o estado do contexto (transformação,
//! estilos, recorte, caminho atual). O texto usa as fontes de `rust/assets/fonts`, desenhadas
//! como contornos, então gira, estica e ganha contorno como no navegador.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use tiny_skia::{
    BlendMode, Color, FillRule, FilterQuality, GradientStop, LineCap, LineJoin, LinearGradient, Mask, Paint, Path, PathBuilder, Pattern, Pixmap, PixmapPaint, Point,
    RadialGradient, Rect, Shader, SpreadMode, Stroke, Transform,
};

use super::{Align, P};

// ---------------------------------------------------------------------------------------------
// Canvas e gradiente
// ---------------------------------------------------------------------------------------------

/// Uma tela de pixels (o `HtmlCanvasElement` do navegador). Clonar compartilha os pixels.
#[derive(Clone)]
pub struct Canvas(Rc<RefCell<Pixmap>>);

impl Canvas {
    pub fn new(w: u32, h: u32) -> Canvas {
        Canvas(Rc::new(RefCell::new(Pixmap::new(w.max(1), h.max(1)).expect("tamanho de canvas inválido"))))
    }
    pub fn width(&self) -> u32 {
        self.0.borrow().width()
    }
    pub fn height(&self) -> u32 {
        self.0.borrow().height()
    }
    /// pixels RGBA (alfa pré-multiplicado), linha a linha
    pub fn with_pixels<R>(&self, f: impl FnOnce(&[u8], u32, u32) -> R) -> R {
        let p = self.0.borrow();
        f(p.data(), p.width(), p.height())
    }
    pub fn save_png(&self, path: &str) -> Result<(), String> {
        self.0.borrow().save_png(path).map_err(|e| e.to_string())
    }
    fn same(&self, o: &Canvas) -> bool {
        Rc::ptr_eq(&self.0, &o.0)
    }
}

pub fn make_canvas(w: f64, h: f64) -> Canvas {
    Canvas::new(w.ceil().max(1.0) as u32, h.ceil().max(1.0) as u32)
}

pub fn ctx_of(c: &Canvas) -> Ctx {
    Ctx { inner: Rc::new(RefCell::new(Inner::new(c.clone()))) }
}

#[derive(Clone)]
enum GradKind {
    Linear { x0: f32, y0: f32, x1: f32, y1: f32 },
    Radial { x0: f32, y0: f32, r0: f32, x1: f32, y1: f32, r1: f32 },
}

#[derive(Clone)]
pub struct Gradient {
    kind: GradKind,
    stops: Vec<(f32, Color)>,
}

impl Gradient {
    fn shader(&self, alpha: f32) -> Shader<'static> {
        let mut stops: Vec<(f32, Color)> = self.stops.clone();
        stops.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        let last = stops.last().map(|s| s.1).unwrap_or(Color::BLACK);
        let built: Option<Shader<'static>> = {
            match self.kind {
                GradKind::Linear { x0, y0, x1, y1 } => {
                    let gs = stops.iter().map(|(t, c)| GradientStop::new(t.clamp(0.0, 1.0), *c)).collect();
                    LinearGradient::new(Point::from_xy(x0, y0), Point::from_xy(x1, y1), gs, SpreadMode::Pad, Transform::identity())
                }
                GradKind::Radial { x0, y0, r0, x1, y1, r1 } => {
                    let concentric = (x0 - x1).abs() < 0.001 && (y0 - y1).abs() < 0.001;
                    let mut st = stops.clone();
                    if concentric && r0 > 0.0 && r1 > r0 {
                        // círculo interno com raio: reescala as paradas e pinta o miolo com a primeira cor
                        let k = r0 / r1;
                        st = st.iter().map(|(t, c)| (k + t * (1.0 - k), *c)).collect();
                        if let Some(first) = stops.first() {
                            st.insert(0, (0.0, first.1));
                        }
                    }
                    let gs = st.iter().map(|(t, c)| GradientStop::new(t.clamp(0.0, 1.0), *c)).collect();
                    RadialGradient::new(Point::from_xy(x0, y0), Point::from_xy(x1, y1), r1.max(0.01), gs, SpreadMode::Pad, Transform::identity())
                }
            }
        };
        let mut shader = built.unwrap_or(Shader::SolidColor(last));
        shader.apply_opacity(alpha);
        shader
    }
}

// ---------------------------------------------------------------------------------------------
// Cores em texto (#rgb, #rrggbb, rgb(), rgba() e alguns nomes)
// ---------------------------------------------------------------------------------------------

pub fn parse_color(s: &str) -> Color {
    let s = s.trim();
    let rgba = |r: f32, g: f32, b: f32, a: f32| {
        Color::from_rgba(r.clamp(0.0, 255.0) / 255.0, g.clamp(0.0, 255.0) / 255.0, b.clamp(0.0, 255.0) / 255.0, a.clamp(0.0, 1.0)).unwrap_or(Color::BLACK)
    };
    if let Some(h) = s.strip_prefix('#') {
        let v = |i: usize, n: usize| u32::from_str_radix(&h[i..i + n], 16).unwrap_or(0) as f32;
        return match h.len() {
            3 => rgba(v(0, 1) * 17.0, v(1, 1) * 17.0, v(2, 1) * 17.0, 1.0),
            4 => rgba(v(0, 1) * 17.0, v(1, 1) * 17.0, v(2, 1) * 17.0, v(3, 1) * 17.0 / 255.0),
            6 => rgba(v(0, 2), v(2, 2), v(4, 2), 1.0),
            8 => rgba(v(0, 2), v(2, 2), v(4, 2), v(6, 2) / 255.0),
            _ => Color::BLACK,
        };
    }
    if let Some(open) = s.find('(') {
        let args: Vec<f32> = s[open + 1..].trim_end_matches(')').split(',').map(|p| p.trim().parse::<f32>().unwrap_or(0.0)).collect();
        if (s.starts_with("rgba") || s.starts_with("rgb")) && args.len() >= 3 {
            return rgba(args[0], args[1], args[2], args.get(3).copied().unwrap_or(1.0));
        }
    }
    match s {
        "white" => Color::WHITE,
        "black" => Color::BLACK,
        "transparent" => Color::TRANSPARENT,
        "red" => rgba(255.0, 0.0, 0.0, 1.0),
        "green" => rgba(0.0, 128.0, 0.0, 1.0),
        "blue" => rgba(0.0, 0.0, 255.0, 1.0),
        "yellow" => rgba(255.0, 255.0, 0.0, 1.0),
        "orange" => rgba(255.0, 165.0, 0.0, 1.0),
        "gray" | "grey" => rgba(128.0, 128.0, 128.0, 1.0),
        _ => Color::BLACK,
    }
}

// ---------------------------------------------------------------------------------------------
// Fontes
// ---------------------------------------------------------------------------------------------

const BANGERS: &[u8] = include_bytes!("../../assets/fonts/Bangers-Regular.ttf");
const SANS: &[u8] = include_bytes!("../../assets/fonts/LiberationSans-Regular.ttf");
const SANS_BOLD: &[u8] = include_bytes!("../../assets/fonts/LiberationSans-Bold.ttf");

const F_DISPLAY: usize = 0;
const F_SANS: usize = 1;
const F_BOLD: usize = 2;

struct Fonts {
    faces: Vec<ttf_parser::Face<'static>>,
    cache: HashMap<(usize, u16), Option<Rc<Path>>>,
}

thread_local! {
    static FONTS: RefCell<Fonts> = RefCell::new(Fonts {
        faces: [BANGERS, SANS, SANS_BOLD].iter().map(|b| ttf_parser::Face::parse(b, 0).expect("fonte embutida inválida")).collect(),
        cache: HashMap::new(),
    });
}

struct Outline(PathBuilder);
impl ttf_parser::OutlineBuilder for Outline {
    fn move_to(&mut self, x: f32, y: f32) {
        self.0.move_to(x, y);
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.0.line_to(x, y);
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.0.quad_to(x1, y1, x, y);
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.0.cubic_to(x1, y1, x2, y2, x, y);
    }
    fn close(&mut self) {
        self.0.close();
    }
}

/// um glifo posicionado: contorno em unidades da fonte (y para cima) e avanço em unidades da fonte
struct Glyph {
    path: Option<Rc<Path>>,
    advance: f32,
    triangle: Option<bool>, // ◀ (true) ou ▶ (false), que a fonte não tem
}

impl Fonts {
    fn upm(&self, f: usize) -> f32 {
        self.faces[f].units_per_em() as f32
    }
    fn glyph(&mut self, family: usize, ch: char) -> Glyph {
        if ch == '◀' || ch == '▶' {
            return Glyph { path: None, advance: self.upm(family) * 0.85, triangle: Some(ch == '◀') };
        }
        // a fonte pedida; se não tiver o caractere, a sans em negrito
        let order = if family == F_BOLD {
            [F_BOLD, F_SANS]
        } else if family == F_SANS {
            [F_SANS, F_BOLD]
        } else {
            [F_DISPLAY, F_BOLD]
        };
        for &f in &order {
            if let Some(gid) = self.faces[f].glyph_index(ch) {
                let scale = self.upm(family) / self.upm(f);
                let advance = self.faces[f].glyph_hor_advance(gid).unwrap_or(0) as f32 * scale;
                let path = if let Some(p) = self.cache.get(&(f, gid.0)) {
                    p.clone()
                } else {
                    let mut o = Outline(PathBuilder::new());
                    let has = self.faces[f].outline_glyph(gid, &mut o).is_some();
                    let p = if has { o.0.finish().map(Rc::new) } else { None };
                    self.cache.insert((f, gid.0), p.clone());
                    p
                };
                // contornos de outra fonte são reescalados para a unidade da fonte pedida
                let path = match (path, (scale - 1.0).abs() > 1e-4) {
                    (Some(p), true) => p.as_ref().clone().transform(Transform::from_scale(scale, scale)).map(Rc::new),
                    (p, _) => p,
                };
                return Glyph { path, advance, triangle: None };
            }
        }
        Glyph { path: None, advance: self.upm(family) * 0.5, triangle: None }
    }
}

#[derive(Clone)]
struct FontSpec {
    family: usize,
    size: f32,
}

fn parse_font(spec: &str) -> FontSpec {
    let size = spec.split_whitespace().find_map(|w| w.strip_suffix("px").and_then(|n| n.parse::<f32>().ok())).unwrap_or(10.0);
    let family = if spec.contains("Bangers") {
        F_DISPLAY
    } else if spec.split_whitespace().any(|w| w == "bold") {
        F_BOLD
    } else {
        F_SANS
    };
    FontSpec { family, size }
}

// ---------------------------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------------------------

#[derive(Clone)]
enum Style {
    Color(Color),
    Grad(Gradient),
}

#[derive(Clone)]
struct State {
    ctm: Transform,
    fill: Style,
    stroke: Style,
    line_width: f32,
    cap: LineCap,
    join: LineJoin,
    alpha: f32,
    blend: BlendMode,
    clip: Option<Mask>,
    shadow_color: Color,
    shadow_blur: f32,
    font: FontSpec,
    align: Align,
    baseline: String,
    smooth: bool,
}

struct Inner {
    cv: Canvas,
    st: State,
    stack: Vec<State>,
    path: PathBuilder,
}

impl Inner {
    fn new(cv: Canvas) -> Inner {
        Inner {
            cv,
            st: State {
                ctm: Transform::identity(),
                fill: Style::Color(Color::BLACK),
                stroke: Style::Color(Color::BLACK),
                line_width: 1.0,
                cap: LineCap::Butt,
                join: LineJoin::Miter,
                alpha: 1.0,
                blend: BlendMode::SourceOver,
                clip: None,
                shadow_color: Color::TRANSPARENT,
                shadow_blur: 0.0,
                font: FontSpec { family: F_SANS, size: 10.0 },
                align: Align::Left,
                baseline: "alphabetic".into(),
                smooth: true,
            },
            stack: vec![],
            path: PathBuilder::new(),
        }
    }

    fn paint(&self, style: &Style) -> Paint<'static> {
        let mut p = Paint { anti_alias: true, blend_mode: self.st.blend, ..Paint::default() };
        match style {
            Style::Color(c) => {
                let mut c = *c;
                c.apply_opacity(self.st.alpha);
                p.set_color(c);
            }
            Style::Grad(g) => p.shader = g.shader(self.st.alpha),
        }
        p
    }

    fn pen(&self) -> Stroke {
        Stroke { width: self.st.line_width.max(0.0), line_cap: self.st.cap, line_join: self.st.join, ..Stroke::default() }
    }

    fn has_shadow(&self) -> bool {
        self.st.shadow_color.alpha() > 0.0 && self.st.shadow_blur > 0.0
    }

    /// desenha `draw` na camada de sombra, borra e compõe por baixo do que vem a seguir
    fn shadow_pass(&mut self, draw: &dyn Fn(&mut Pixmap, &State)) {
        let (w, h) = (self.cv.width(), self.cv.height());
        let Some(mut layer) = Pixmap::new(w, h) else { return };
        let mut st = self.st.clone();
        st.fill = Style::Color(self.st.shadow_color);
        st.stroke = Style::Color(self.st.shadow_color);
        st.blend = BlendMode::SourceOver;
        draw(&mut layer, &st);
        blur(&mut layer, self.st.shadow_blur / 2.0);
        let mask = self.st.clip.as_ref();
        self.cv.0.borrow_mut().draw_pixmap(
            0,
            0,
            layer.as_ref(),
            &PixmapPaint { blend_mode: self.st.blend, opacity: self.st.alpha, quality: FilterQuality::Nearest },
            Transform::identity(),
            mask,
        );
    }

    fn fill_path(&mut self, path: &Path) {
        if self.has_shadow() {
            let path = path.clone();
            self.shadow_pass(&|px, st| {
                let mut p = Paint { anti_alias: true, ..Paint::default() };
                if let Style::Color(c) = &st.fill {
                    p.set_color(*c);
                }
                px.fill_path(&path, &p, FillRule::Winding, st.ctm, st.clip.as_ref());
            });
        }
        let paint = self.paint(&self.st.fill.clone());
        self.cv.0.borrow_mut().fill_path(path, &paint, FillRule::Winding, self.st.ctm, self.st.clip.as_ref());
    }

    fn stroke_path(&mut self, path: &Path) {
        if self.st.line_width <= 0.0 {
            return;
        }
        if self.has_shadow() {
            let path = path.clone();
            let pen = self.pen();
            self.shadow_pass(&|px, st| {
                let mut p = Paint { anti_alias: true, ..Paint::default() };
                if let Style::Color(c) = &st.stroke {
                    p.set_color(*c);
                }
                px.stroke_path(&path, &p, &pen, st.ctm, st.clip.as_ref());
            });
        }
        let paint = self.paint(&self.st.stroke.clone());
        let pen = self.pen();
        self.cv.0.borrow_mut().stroke_path(path, &paint, &pen, self.st.ctm, self.st.clip.as_ref());
    }
}

/// desfoque gaussiano aproximado por três passadas de média (sigma em pixels)
fn blur(px: &mut Pixmap, sigma: f32) {
    if sigma < 0.3 {
        return;
    }
    let (w, h) = (px.width() as usize, px.height() as usize);
    let boxw = ((12.0 * sigma * sigma / 3.0 + 1.0).sqrt()).floor() as usize;
    let r = (boxw.max(1) - 1) / 2;
    if r == 0 {
        return;
    }
    let data = px.data_mut();
    let mut tmp = vec![0u8; data.len()];
    for _ in 0..3 {
        // horizontal
        for y in 0..h {
            for c in 0..4 {
                let mut acc: u32 = 0;
                let row = y * w * 4 + c;
                for x in 0..=r.min(w - 1) {
                    acc += data[row + x * 4] as u32;
                }
                for x in 0..w {
                    let lo = x as isize - r as isize - 1;
                    let hi = x + r;
                    if x > 0 && hi < w {
                        acc += data[row + hi * 4] as u32;
                    }
                    if lo >= 0 {
                        acc -= data[row + lo as usize * 4] as u32;
                    }
                    tmp[row + x * 4] = (acc / (2 * r as u32 + 1)) as u8;
                }
            }
        }
        // vertical
        for x in 0..w {
            for c in 0..4 {
                let col = x * 4 + c;
                let mut acc: u32 = 0;
                for y in 0..=r.min(h - 1) {
                    acc += tmp[col + y * w * 4] as u32;
                }
                for y in 0..h {
                    let lo = y as isize - r as isize - 1;
                    let hi = y + r;
                    if y > 0 && hi < h {
                        acc += tmp[col + hi * w * 4] as u32;
                    }
                    if lo >= 0 {
                        acc -= tmp[col + lo as usize * w * 4] as u32;
                    }
                    data[col + y * w * 4] = (acc / (2 * r as u32 + 1)) as u8;
                }
            }
        }
    }
}

fn blend_of(op: &str) -> BlendMode {
    match op {
        "source-atop" => BlendMode::SourceAtop,
        "source-in" => BlendMode::SourceIn,
        "source-out" => BlendMode::SourceOut,
        "destination-out" => BlendMode::DestinationOut,
        "destination-in" => BlendMode::DestinationIn,
        "destination-over" => BlendMode::DestinationOver,
        "destination-atop" => BlendMode::DestinationAtop,
        "lighter" => BlendMode::Plus,
        "multiply" => BlendMode::Multiply,
        "screen" => BlendMode::Screen,
        "overlay" => BlendMode::Overlay,
        "darken" => BlendMode::Darken,
        "lighten" => BlendMode::Lighten,
        "xor" => BlendMode::Xor,
        "copy" => BlendMode::Source,
        _ => BlendMode::SourceOver,
    }
}

#[derive(Clone)]
pub struct Ctx {
    inner: Rc<RefCell<Inner>>,
}

impl Ctx {
    pub fn fill_style(&self, s: &str) {
        self.inner.borrow_mut().st.fill = Style::Color(parse_color(s));
    }
    pub fn fill_grad(&self, g: &Gradient) {
        self.inner.borrow_mut().st.fill = Style::Grad(g.clone());
    }
    pub fn stroke_style(&self, s: &str) {
        self.inner.borrow_mut().st.stroke = Style::Color(parse_color(s));
    }
    pub fn line_width(&self, w: f64) {
        self.inner.borrow_mut().st.line_width = w as f32;
    }
    pub fn line_cap(&self, s: &str) {
        self.inner.borrow_mut().st.cap = match s {
            "round" => LineCap::Round,
            "square" => LineCap::Square,
            _ => LineCap::Butt,
        };
    }
    pub fn line_join(&self, s: &str) {
        self.inner.borrow_mut().st.join = match s {
            "round" => LineJoin::Round,
            "bevel" => LineJoin::Bevel,
            _ => LineJoin::Miter,
        };
    }
    pub fn alpha(&self, a: f64) {
        self.inner.borrow_mut().st.alpha = a.clamp(0.0, 1.0) as f32;
    }
    pub fn composite(&self, op: &str) {
        self.inner.borrow_mut().st.blend = blend_of(op);
    }
    pub fn save(&self) {
        let mut i = self.inner.borrow_mut();
        let st = i.st.clone();
        i.stack.push(st);
    }
    pub fn restore(&self) {
        let mut i = self.inner.borrow_mut();
        if let Some(st) = i.stack.pop() {
            i.st = st;
        }
    }
    pub fn translate(&self, x: f64, y: f64) {
        let mut i = self.inner.borrow_mut();
        i.st.ctm = i.st.ctm.pre_translate(x as f32, y as f32);
    }
    pub fn rotate(&self, a: f64) {
        let mut i = self.inner.borrow_mut();
        i.st.ctm = i.st.ctm.pre_concat(Transform::from_rotate(a.to_degrees() as f32));
    }
    pub fn scale(&self, x: f64, y: f64) {
        let mut i = self.inner.borrow_mut();
        i.st.ctm = i.st.ctm.pre_scale(x as f32, y as f32);
    }
    pub fn reset_transform(&self) {
        self.inner.borrow_mut().st.ctm = Transform::identity();
    }
    pub fn begin(&self) {
        self.inner.borrow_mut().path = PathBuilder::new();
    }
    pub fn close(&self) {
        self.inner.borrow_mut().path.close();
    }
    pub fn move_to(&self, x: f64, y: f64) {
        self.inner.borrow_mut().path.move_to(x as f32, y as f32);
    }
    pub fn line_to(&self, x: f64, y: f64) {
        let mut i = self.inner.borrow_mut();
        if i.path.is_empty() {
            i.path.move_to(x as f32, y as f32);
        } else {
            i.path.line_to(x as f32, y as f32);
        }
    }
    pub fn quad_to(&self, cx: f64, cy: f64, x: f64, y: f64) {
        let mut i = self.inner.borrow_mut();
        if i.path.is_empty() {
            i.path.move_to(cx as f32, cy as f32);
        }
        i.path.quad_to(cx as f32, cy as f32, x as f32, y as f32);
    }
    pub fn arc(&self, x: f64, y: f64, r: f64, a0: f64, a1: f64) {
        self.arc_dir(x, y, r, a0, a1, false);
    }
    pub fn arc_dir(&self, x: f64, y: f64, r: f64, a0: f64, a1: f64, ccw: bool) {
        self.ellipse_dir(x, y, r.max(0.0), r.max(0.0), 0.0, a0, a1, ccw);
    }
    pub fn circle(&self, x: f64, y: f64, r: f64) {
        self.begin();
        self.arc(x, y, r, 0.0, std::f64::consts::TAU);
    }
    pub fn ellipse(&self, x: f64, y: f64, rx: f64, ry: f64, rot: f64, a0: f64, a1: f64) {
        self.ellipse_dir(x, y, rx.max(0.0), ry.max(0.0), rot, a0, a1, false);
    }
    #[allow(clippy::too_many_arguments)]
    fn ellipse_dir(&self, cx: f64, cy: f64, rx: f64, ry: f64, rot: f64, a0: f64, a1: f64, ccw: bool) {
        use std::f64::consts::TAU;
        let delta = if !ccw {
            if a1 - a0 >= TAU {
                TAU
            } else {
                (a1 - a0).rem_euclid(TAU)
            }
        } else if a0 - a1 >= TAU {
            -TAU
        } else {
            -((a0 - a1).rem_euclid(TAU))
        };
        let (sr, cr) = rot.sin_cos();
        let pt = |a: f64| -> (f32, f32) {
            let (ex, ey) = (rx * a.cos(), ry * a.sin());
            ((cx + ex * cr - ey * sr) as f32, (cy + ex * sr + ey * cr) as f32)
        };
        let tangent = |a: f64| -> (f64, f64) {
            let (ex, ey) = (-rx * a.sin(), ry * a.cos());
            (ex * cr - ey * sr, ex * sr + ey * cr)
        };
        let mut i = self.inner.borrow_mut();
        let (sx, sy) = pt(a0);
        if i.path.is_empty() {
            i.path.move_to(sx, sy);
        } else {
            i.path.line_to(sx, sy);
        }
        let n = ((delta.abs() / (std::f64::consts::FRAC_PI_2)).ceil() as usize).max(1);
        let step = delta / n as f64;
        let k = 4.0 / 3.0 * (step / 4.0).tan();
        let mut a = a0;
        for _ in 0..n {
            let b = a + step;
            let (p0, p3) = (pt(a), pt(b));
            let (t0, t3) = (tangent(a), tangent(b));
            i.path.cubic_to(p0.0 + (t0.0 * k) as f32, p0.1 + (t0.1 * k) as f32, p3.0 - (t3.0 * k) as f32, p3.1 - (t3.1 * k) as f32, p3.0, p3.1);
            a = b;
        }
    }
    pub fn rect(&self, x: f64, y: f64, w: f64, h: f64) {
        let mut i = self.inner.borrow_mut();
        let (x, y, w, h) = (x as f32, y as f32, w as f32, h as f32);
        i.path.move_to(x, y);
        i.path.line_to(x + w, y);
        i.path.line_to(x + w, y + h);
        i.path.line_to(x, y + h);
        i.path.close();
    }
    fn current(&self) -> Option<Path> {
        self.inner.borrow().path.clone().finish()
    }
    pub fn fill(&self) {
        if let Some(p) = self.current() {
            self.inner.borrow_mut().fill_path(&p);
        }
    }
    pub fn stroke(&self) {
        if let Some(p) = self.current() {
            self.inner.borrow_mut().stroke_path(&p);
        }
    }
    pub fn clip(&self) {
        let Some(p) = self.current() else { return };
        let mut i = self.inner.borrow_mut();
        let (w, h, ctm) = (i.cv.width(), i.cv.height(), i.st.ctm);
        match i.st.clip.as_mut() {
            Some(m) => m.intersect_path(&p, FillRule::Winding, true, ctm),
            None => {
                if let Some(mut m) = Mask::new(w, h) {
                    m.fill_path(&p, FillRule::Winding, true, ctm);
                    i.st.clip = Some(m);
                }
            }
        }
    }
    fn rect_path(x: f64, y: f64, w: f64, h: f64) -> Option<Path> {
        let mut pb = PathBuilder::new();
        let (x, y, w, h) = (x as f32, y as f32, w as f32, h as f32);
        pb.move_to(x, y);
        pb.line_to(x + w, y);
        pb.line_to(x + w, y + h);
        pb.line_to(x, y + h);
        pb.close();
        pb.finish()
    }
    pub fn fill_rect(&self, x: f64, y: f64, w: f64, h: f64) {
        if let Some(p) = Self::rect_path(x, y, w, h) {
            self.inner.borrow_mut().fill_path(&p);
        }
    }
    pub fn stroke_rect(&self, x: f64, y: f64, w: f64, h: f64) {
        if let Some(p) = Self::rect_path(x, y, w, h) {
            self.inner.borrow_mut().stroke_path(&p);
        }
    }
    pub fn clear_rect(&self, x: f64, y: f64, w: f64, h: f64) {
        if let Some(p) = Self::rect_path(x, y, w, h) {
            let i = self.inner.borrow();
            let paint = Paint { blend_mode: BlendMode::Clear, anti_alias: false, ..Paint::default() };
            i.cv.0.borrow_mut().fill_path(&p, &paint, FillRule::Winding, i.st.ctm, i.st.clip.as_ref());
        }
    }
    pub fn fill_circle(&self, x: f64, y: f64, r: f64, color: &str) {
        self.fill_style(color);
        self.circle(x, y, r);
        self.fill();
    }
    pub fn line(&self, x0: f64, y0: f64, x1: f64, y1: f64) {
        self.begin();
        self.move_to(x0, y0);
        self.line_to(x1, y1);
        self.stroke();
    }
    pub fn poly(&self, pts: &[P]) {
        self.begin();
        for (i, p) in pts.iter().enumerate() {
            if i == 0 {
                self.move_to(p[0], p[1]);
            } else {
                self.line_to(p[0], p[1]);
            }
        }
        self.close();
    }
    pub fn linear(&self, x0: f64, y0: f64, x1: f64, y1: f64, stops: &[(f64, &str)]) -> Gradient {
        Gradient { kind: GradKind::Linear { x0: x0 as f32, y0: y0 as f32, x1: x1 as f32, y1: y1 as f32 }, stops: stops.iter().map(|(t, c)| (*t as f32, parse_color(c))).collect() }
    }
    pub fn radial(&self, x0: f64, y0: f64, r0: f64, x1: f64, y1: f64, r1: f64, stops: &[(f64, &str)]) -> Gradient {
        Gradient {
            kind: GradKind::Radial { x0: x0 as f32, y0: y0 as f32, r0: r0.max(0.0) as f32, x1: x1 as f32, y1: y1 as f32, r1: r1.max(0.0) as f32 },
            stops: stops.iter().map(|(t, c)| (*t as f32, parse_color(c))).collect(),
        }
    }
    pub fn shadow(&self, color: &str, blur: f64) {
        let mut i = self.inner.borrow_mut();
        i.st.shadow_color = parse_color(color);
        i.st.shadow_blur = blur as f32;
    }

    // ---- texto ----

    pub fn font(&self, f: &str) {
        self.inner.borrow_mut().st.font = parse_font(f);
    }
    pub fn text_align(&self, a: Align) {
        self.inner.borrow_mut().st.align = a;
    }
    pub fn baseline(&self, b: &str) {
        self.inner.borrow_mut().st.baseline = b.to_string();
    }

    fn glyphs(font: &FontSpec, s: &str) -> (Vec<(Glyph, f32)>, f32) {
        FONTS.with(|f| {
            let mut f = f.borrow_mut();
            let scale = font.size / f.upm(font.family);
            let mut x = 0.0;
            let mut out = vec![];
            for ch in s.chars() {
                let g = f.glyph(font.family, ch);
                let adv = g.advance * scale;
                out.push((g, x));
                x += adv;
            }
            (out, x)
        })
    }

    /// contorno do texto, com a origem na linha de base à esquerda; devolve também a largura
    fn text_path(&self, s: &str, max: Option<f64>) -> Option<(Path, f32)> {
        let (font, align, baseline) = {
            let i = self.inner.borrow();
            (i.st.font.clone(), i.st.align, i.st.baseline.clone())
        };
        let (glyphs, width) = Self::glyphs(&font, s);
        let (asc, desc, upm) = FONTS.with(|f| {
            let f = f.borrow();
            let face = &f.faces[font.family];
            (face.ascender() as f32, -(face.descender() as f32), f.upm(font.family))
        });
        let k = font.size / upm;
        let squeeze = match max {
            Some(m) if (m as f32) < width && width > 0.0 => m as f32 / width,
            _ => 1.0,
        };
        let w = width * squeeze;
        let x0 = match align {
            Align::Left => 0.0,
            Align::Center => -w / 2.0,
            Align::Right => -w,
        };
        let y0 = match baseline.as_str() {
            "middle" => (asc - desc) / 2.0 * k,
            "top" | "hanging" => asc * k,
            "bottom" => -desc * k,
            _ => 0.0,
        };
        let mut pb = PathBuilder::new();
        for (g, gx) in &glyphs {
            let gx = gx * squeeze + x0;
            if let Some(p) = &g.path {
                // contorno em unidades da fonte (y para cima) → pixels (y para baixo)
                if let Some(t) = p.as_ref().clone().transform(Transform::from_row(k * squeeze, 0.0, 0.0, -k, gx, y0)) {
                    pb.push_path(&t);
                }
            } else if let Some(left) = g.triangle {
                let (a, b) = (gx + font.size * 0.1 * squeeze, gx + font.size * 0.75 * squeeze);
                let (top, bot) = (y0 - font.size * 0.75, y0 - font.size * 0.05);
                let mid = (top + bot) / 2.0;
                if left {
                    pb.move_to(b, top);
                    pb.line_to(a, mid);
                    pb.line_to(b, bot);
                } else {
                    pb.move_to(a, top);
                    pb.line_to(b, mid);
                    pb.line_to(a, bot);
                }
                pb.close();
            }
        }
        pb.finish().map(|p| (p, w))
    }

    pub fn fill_text(&self, s: &str, x: f64, y: f64) {
        self.fill_text_max(s, x, y, None);
    }
    pub fn fill_text_max(&self, s: &str, x: f64, y: f64, max: Option<f64>) {
        let Some((p, _)) = self.text_path(s, max) else { return };
        let mut i = self.inner.borrow_mut();
        let saved = i.st.ctm;
        i.st.ctm = saved.pre_translate(x as f32, y as f32);
        i.fill_path(&p);
        i.st.ctm = saved;
    }
    pub fn stroke_text(&self, s: &str, x: f64, y: f64) {
        let Some((p, _)) = self.text_path(s, None) else { return };
        let mut i = self.inner.borrow_mut();
        let saved = i.st.ctm;
        i.st.ctm = saved.pre_translate(x as f32, y as f32);
        i.stroke_path(&p);
        i.st.ctm = saved;
    }
    pub fn measure(&self, s: &str) -> f64 {
        let font = self.inner.borrow().st.font.clone();
        Self::glyphs(&font, s).1 as f64
    }

    // ---- imagens ----

    pub fn smoothing(&self, on: bool) {
        self.inner.borrow_mut().st.smooth = on;
    }
    pub fn draw_image(&self, img: &Canvas, x: f64, y: f64) {
        let (w, h) = (img.width() as f64, img.height() as f64);
        self.draw_image_part(img, 0.0, 0.0, w, h, x, y, w, h);
    }
    pub fn draw_image_scaled(&self, img: &Canvas, x: f64, y: f64, w: f64, h: f64) {
        self.draw_image_part(img, 0.0, 0.0, img.width() as f64, img.height() as f64, x, y, w, h);
    }
    #[allow(clippy::too_many_arguments)]
    pub fn draw_image_part(&self, img: &Canvas, sx: f64, sy: f64, sw: f64, sh: f64, dx: f64, dy: f64, dw: f64, dh: f64) {
        if sw <= 0.0 || sh <= 0.0 || dw == 0.0 || dh == 0.0 {
            return;
        }
        let i = self.inner.borrow();
        // desenhar a tela sobre ela mesma: usa uma cópia dos pixels
        let copy;
        let src_cell: &RefCell<Pixmap> = if img.same(&i.cv) {
            copy = RefCell::new(img.0.borrow().clone());
            &copy
        } else {
            &img.0
        };
        let src = src_cell.borrow();
        let quality = if i.st.smooth { FilterQuality::Bilinear } else { FilterQuality::Nearest };
        let map = Transform::from_translate(dx as f32, dy as f32).pre_scale((dw / sw) as f32, (dh / sh) as f32).pre_translate(-sx as f32, -sy as f32);
        let paint = Paint { anti_alias: false, blend_mode: i.st.blend, shader: Pattern::new(src.as_ref(), SpreadMode::Pad, quality, i.st.alpha, map), ..Paint::default() };
        let Some(rect) = Rect::from_xywh(dx.min(dx + dw) as f32, dy.min(dy + dh) as f32, dw.abs() as f32, dh.abs() as f32) else { return };
        let mut dst = i.cv.0.borrow_mut();
        dst.fill_rect(rect, &paint, i.st.ctm, i.st.clip.as_ref());
    }
    pub fn canvas(&self) -> Canvas {
        self.inner.borrow().cv.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn px(c: &Canvas, x: u32, y: u32) -> [u8; 4] {
        c.with_pixels(|d, w, _| {
            let i = ((y * w + x) * 4) as usize;
            [d[i], d[i + 1], d[i + 2], d[i + 3]]
        })
    }

    #[test]
    fn colors_parse() {
        assert_eq!(parse_color("#ff8000").to_color_u8().red(), 255);
        assert_eq!(parse_color("rgba(10,20,30,0.5)").alpha(), 0.5);
        assert_eq!(parse_color("#fff").to_color_u8().blue(), 255);
    }

    #[test]
    fn fill_clip_and_transform() {
        let c = make_canvas(40.0, 40.0);
        let g = ctx_of(&c);
        g.fill_style("#ff0000");
        g.fill_rect(0.0, 0.0, 10.0, 10.0);
        assert_eq!(px(&c, 5, 5), [255, 0, 0, 255]);
        assert_eq!(px(&c, 20, 20)[3], 0);
        g.save();
        g.translate(20.0, 20.0);
        g.fill_style("#00ff00");
        g.fill_rect(0.0, 0.0, 5.0, 5.0);
        g.restore();
        assert_eq!(px(&c, 22, 22), [0, 255, 0, 255]);
        g.save();
        g.begin();
        g.rect(30.0, 0.0, 5.0, 5.0);
        g.clip();
        g.fill_style("#0000ff");
        g.fill_rect(0.0, 0.0, 40.0, 40.0);
        g.restore();
        assert_eq!(px(&c, 32, 2), [0, 0, 255, 255]);
        assert_eq!(px(&c, 38, 2)[3], 0, "fora do recorte");
    }

    #[test]
    fn circle_and_gradient() {
        let c = make_canvas(40.0, 40.0);
        let g = ctx_of(&c);
        let gr = g.linear(0.0, 0.0, 40.0, 0.0, &[(0.0, "#000000"), (1.0, "#ffffff")]);
        g.fill_grad(&gr);
        g.circle(20.0, 20.0, 15.0);
        g.fill();
        assert!(px(&c, 20, 20)[3] == 255);
        assert_eq!(px(&c, 1, 1)[3], 0);
        let left = px(&c, 8, 20)[0];
        let right = px(&c, 32, 20)[0];
        assert!(right > left + 80, "gradiente cresce para a direita: {left} {right}");
    }

    #[test]
    fn text_has_width_and_pixels() {
        let c = make_canvas(200.0, 40.0);
        let g = ctx_of(&c);
        g.font("bold 20px Arial, Helvetica, sans-serif");
        let w = g.measure("Punho Livre");
        assert!(w > 80.0 && w < 160.0, "largura {w}");
        g.fill_style("#ffffff");
        g.baseline("middle");
        g.fill_text("Punho Livre", 5.0, 20.0);
        assert!(c.with_pixels(|d, _, _| d.chunks(4).any(|p| p[3] > 0)));
        let logo = g.measure("◀");
        assert!(logo > 5.0);
    }

    #[test]
    fn draw_image_flip_and_atop() {
        let a = make_canvas(8.0, 8.0);
        let ga = ctx_of(&a);
        ga.fill_style("#ff0000");
        ga.fill_rect(0.0, 0.0, 4.0, 8.0);
        let b = make_canvas(8.0, 8.0);
        let gb = ctx_of(&b);
        gb.save();
        gb.translate(8.0, 0.0);
        gb.scale(-1.0, 1.0);
        gb.draw_image(&a, 0.0, 0.0);
        gb.restore();
        assert_eq!(px(&b, 6, 4), [255, 0, 0, 255], "espelhado: o vermelho foi para a direita");
        assert_eq!(px(&b, 1, 4)[3], 0);
        gb.composite("source-atop");
        gb.fill_style("#0000ff");
        gb.fill_rect(0.0, 0.0, 8.0, 8.0);
        assert_eq!(px(&b, 6, 4), [0, 0, 255, 255], "azul só onde já havia pixel");
        assert_eq!(px(&b, 1, 4)[3], 0);
    }

    #[test]
    fn shadow_spreads_color() {
        let c = make_canvas(60.0, 60.0);
        let g = ctx_of(&c);
        g.shadow("#ff00ff", 10.0);
        g.fill_style("#ffffff");
        g.fill_rect(25.0, 25.0, 10.0, 10.0);
        assert!(px(&c, 22, 30)[3] > 0, "a sombra passa da borda");
    }
}
