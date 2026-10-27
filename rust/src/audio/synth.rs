//! O que os sons e a trilha são, sem depender de onde tocam: os geradores de cada efeito e as
//! faixas musicais. O navegador toca isto com o Web Audio; o app nativo, com o mixer de `native`.

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Wave {
    Sine,
    Square,
    Sawtooth,
    Triangle,
}

pub struct SynthState {
    pub sr: f64,
    pub lp: [f64; 4],
    pub ph: [f64; 12],
}

fn rnd() -> f64 {
    crate::platform::random()
}

/// envelope: sobe em a segundos e cai exponencialmente com constante d
fn env(t: f64, a: f64, d: f64) -> f64 {
    if t < a {
        t / a
    } else {
        (-(t - a) / d).exp()
    }
}
/// ruído com filtro passa-baixa (c perto de 1 = agudo)
fn noise(s: &mut SynthState, c: f64, k: usize) -> f64 {
    let y = s.lp[k];
    s.lp[k] = y + c * (rnd() * 2.0 - 1.0 - y);
    s.lp[k]
}
fn tone(s: &mut SynthState, f: f64, k: usize, shape: &str) -> f64 {
    s.ph[k] += f / s.sr;
    let p = s.ph[k].rem_euclid(1.0);
    match shape {
        "sq" => {
            if p < 0.5 {
                0.6
            } else {
                -0.6
            }
        }
        "tri" => 4.0 * (p - 0.5).abs() - 1.0,
        _ => (std::f64::consts::TAU * p).sin(),
    }
}
fn notes(s: &mut SynthState, t: f64, list: &[f64], len: f64, shape: &str) -> f64 {
    let i = ((t / len).floor() as usize).min(list.len() - 1);
    tone(s, list[i], 9, shape) * env(t - i as f64 * len, 0.005, len * 0.7)
}

pub type Gen = fn(f64, &mut SynthState) -> f64;

pub const SOUND_NAMES: &[&str] = &[
    "hit", "hit2", "block", "swing", "step", "jump", "land", "fall", "grab", "pick", "blast", "fire", "freeze", "shatter", "zap", "boom", "slam", "teleport", "heal", "wood",
    "clank", "thud", "break", "ko", "bell", "m_pass", "m_ok", "m_cancel", "m_join", "m_end",
];

pub fn sound_def(name: &str) -> (f64, Gen) {
    match name {
        "hit" => (0.12, |t, s| 1.3 * noise(s, 0.35, 0) * env(t, 0.002, 0.04) + 0.6 * tone(s, 140.0 - t * 400.0, 0, "sin") * env(t, 0.001, 0.05)),
        "hit2" => (0.25, |t, s| 1.6 * noise(s, 0.22, 0) * env(t, 0.002, 0.08) + 0.8 * tone(s, 90.0 - t * 160.0, 0, "sin") * env(t, 0.001, 0.12)),
        "block" => (0.12, |t, s| 0.35 * (tone(s, 900.0, 0, "sin") + tone(s, 1340.0, 1, "sin")) * env(t, 0.001, 0.04) + 0.4 * noise(s, 0.8, 0) * env(t, 0.001, 0.015)),
        "swing" => (0.16, |t, s| 1.2 * noise(s, 0.08 + t * 2.0, 0) * ((std::f64::consts::PI * t) / 0.16).sin()),
        "step" => (0.06, |t, s| 1.2 * noise(s, 0.12, 0) * env(t, 0.002, 0.02)),
        "jump" => (0.12, |t, s| 0.9 * noise(s, 0.15 + t * 3.0, 0) * ((std::f64::consts::PI * t) / 0.12).sin()),
        "land" => (0.12, |t, s| 1.6 * noise(s, 0.08, 0) * env(t, 0.002, 0.04)),
        "fall" => (0.3, |t, s| 2.0 * noise(s, 0.06, 0) * env(t, 0.002, 0.08) + 0.7 * tone(s, 70.0 - t * 60.0, 0, "sin") * env(t, 0.001, 0.12)),
        "grab" => (0.12, |t, s| 0.9 * noise(s, 0.4, 0) * env(t, 0.002, 0.03) + 0.4 * tone(s, 260.0, 0, "sin") * env(t, 0.001, 0.05)),
        "pick" => (0.1, |t, s| 0.3 * tone(s, 600.0 + t * 3000.0, 0, "tri") * env(t, 0.002, 0.05)),
        "blast" => (0.4, |t, s| 0.5 * tone(s, 700.0 - t * 1300.0, 0, "tri") * env(t, 0.005, 0.15) + 0.8 * noise(s, 0.3, 0) * env(t, 0.01, 0.12)),
        "fire" => (0.45, |t, s| 1.2 * noise(s, 0.22, 0) * env(t, 0.03, 0.18) * (0.7 + 0.3 * (t * 90.0).sin())),
        "freeze" => (0.5, |t, s| {
            0.22 * (tone(s, 1800.0, 0, "sin") + tone(s, 2420.0, 1, "sin") + tone(s, 3160.0, 2, "sin")) * env(t, 0.005, 0.18) + 0.4 * noise(s, 0.9, 0) * env(t, 0.001, 0.08)
        }),
        "shatter" => (0.35, |t, s| 1.1 * noise(s, 0.9, 0) * env(t, 0.001, 0.1) + 0.3 * tone(s, 2600.0 + 900.0 * (t * 300.0).sin(), 0, "sin") * env(t, 0.001, 0.08)),
        "zap" => (0.3, |t, s| 0.5 * tone(s, 900.0 + 600.0 * (t * 160.0).sin().signum(), 0, "sq") * env(t, 0.002, 0.1) + 0.5 * noise(s, 0.7, 0) * env(t, 0.002, 0.06)),
        "boom" => (0.45, |t, s| 1.8 * noise(s, 0.1, 0) * env(t, 0.003, 0.14) + 0.8 * tone(s, 75.0 - t * 60.0, 0, "sin") * env(t, 0.002, 0.2)),
        "slam" => (0.6, |t, s| 2.2 * noise(s, 0.05, 0) * env(t, 0.003, 0.2) + tone(s, 55.0 - t * 30.0, 0, "sin") * env(t, 0.002, 0.3)),
        "teleport" => (0.35, |t, s| 0.4 * tone(s, 300.0 + t * 4000.0 + 60.0 * (t * 120.0).sin(), 0, "sin") * env(t, 0.01, 0.15)),
        "heal" => (0.7, |t, s| 0.4 * notes(s, t, &[523.0, 659.0, 784.0, 1046.0], 0.12, "tri")),
        "wood" => (0.12, |t, s| 0.5 * (tone(s, 420.0, 0, "sin") + tone(s, 690.0, 1, "sin")) * env(t, 0.001, 0.03) + 0.6 * noise(s, 0.5, 0) * env(t, 0.001, 0.015)),
        "clank" => (0.35, |t, s| 0.25 * (tone(s, 1700.0, 0, "sin") + tone(s, 2650.0, 1, "sin") + tone(s, 3330.0, 2, "sin")) * env(t, 0.001, 0.09)),
        "thud" => (0.25, |t, s| 0.9 * tone(s, 95.0 - t * 100.0, 0, "sin") * env(t, 0.001, 0.08) + 1.2 * noise(s, 0.1, 0) * env(t, 0.001, 0.05)),
        "break" => (0.35, |t, s| 1.3 * noise(s, 0.6, 0) * env(t, 0.001, 0.08) + 0.6 * noise(s, 0.1, 1) * env(t, 0.001, 0.15)),
        "ko" => (0.7, |t, s| {
            2.2 * noise(s, 0.06, 0) * env(t, 0.004, 0.22)
                + 1.1 * tone(s, 60.0 - t * 40.0, 0, "sin") * env(t, 0.002, 0.35)
                + 0.5 * tone(s, 180.0 - t * 200.0, 1, "sin") * env(t, 0.001, 0.1)
        }),
        "bell" => (0.9, |t, s| {
            0.3 * (tone(s, 660.0, 0, "sin") + 0.6 * tone(s, 1320.0, 1, "sin") + 0.4 * tone(s, 1980.0, 2, "sin")) * env(t, 0.003, 0.3) + 0.2 * noise(s, 0.8, 0) * env(t, 0.001, 0.02)
        }),
        "m_pass" => (0.05, |t, s| 0.18 * tone(s, 880.0, 0, "sq") * env(t, 0.001, 0.02)),
        "m_ok" => (0.2, |t, s| 0.3 * notes(s, t, &[660.0, 990.0], 0.08, "sq")),
        "m_cancel" => (0.18, |t, s| 0.3 * notes(s, t, &[440.0, 330.0], 0.08, "sq")),
        "m_join" => (0.2, |t, s| 0.3 * notes(s, t, &[523.0, 784.0, 1046.0], 0.06, "sq")),
        "m_end" => (0.9, |t, s| 0.32 * notes(s, t, &[523.0, 659.0, 784.0, 1046.0, 1046.0], 0.14, "sq")),
        _ => (0.05, |_, _| 0.0),
    }
}

/// o som `name` inteiro como amostras mono em `sr` Hz
pub fn render(name: &str, sr: f64) -> Vec<f32> {
    let (dur, gen) = sound_def(name);
    let n = (dur * sr).floor() as usize;
    let mut s = SynthState { sr, lp: [0.0; 4], ph: [0.0; 12] };
    (0..n).map(|i| gen(i as f64 / sr, &mut s).clamp(-1.0, 1.0) as f32).collect()
}

pub fn hz(n: f64) -> f64 {
    440.0 * 2f64.powf((n - 69.0) / 12.0)
}

/// Cada faixa: andamento, acordes (notas MIDI) e padrões por instrumento. Nos padrões, um
/// número é o grau do acorde (0 fundamental, 1 terça, 2 quinta, 3 oitava) e None é pausa.
pub struct Track {
    pub bpm: f64,
    pub steps: usize,
    pub swing: f64,
    pub chords: &'static [[f64; 3]],
    pub bass: [Option<u8>; 16],
    pub arp: [Option<u8>; 16],
    pub arp_oct: f64,
    pub arp_vol: f64,
    pub arp_wave: Wave,
    pub kick: [u8; 16],
    pub snare: [u8; 16],
    pub hat: [u8; 16],
    pub drums: f64,
}

const N: Option<u8> = None;
const fn s(v: u8) -> Option<u8> {
    Some(v)
}

pub fn track(name: &str) -> Option<Track> {
    Some(match name {
        "menu" => Track {
            bpm: 92.0,
            steps: 16,
            swing: 0.0,
            chords: &[[57.0, 60.0, 64.0], [53.0, 57.0, 60.0], [48.0, 52.0, 55.0], [55.0, 59.0, 62.0]], // Am F C G
            bass: [s(0), N, N, N, s(0), N, N, N, s(2), N, N, N, s(0), N, N, N],
            arp: [s(0), s(1), s(2), s(3), s(2), s(1), s(2), s(1), s(0), s(1), s(2), s(3), s(2), s(1), s(2), s(3)],
            arp_oct: 12.0,
            arp_vol: 0.05,
            arp_wave: Wave::Triangle,
            kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
            drums: 0.6,
        },
        "fight1" => Track {
            bpm: 148.0,
            steps: 16,
            swing: 0.0,
            chords: &[[52.0, 55.0, 59.0], [48.0, 52.0, 55.0], [50.0, 54.0, 57.0], [47.0, 51.0, 54.0]], // Em C D B
            bass: [s(0), N, s(0), s(0), N, s(0), N, s(3), s(0), N, s(0), s(0), N, s(0), s(3), N],
            arp: [N, s(3), N, s(2), N, s(3), s(1), N, s(3), N, s(2), N, s(3), N, s(1), s(2)],
            arp_oct: 24.0,
            arp_vol: 0.045,
            arp_wave: Wave::Square,
            kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
            hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            drums: 1.0,
        },
        "fight2" => Track {
            bpm: 132.0,
            steps: 16,
            swing: 0.12,
            chords: &[[50.0, 53.0, 57.0], [46.0, 50.0, 53.0], [43.0, 46.0, 50.0], [45.0, 49.0, 52.0]], // Dm Bb Gm A
            bass: [s(0), N, N, s(0), N, s(3), N, s(0), N, N, s(0), N, s(3), N, s(0), N],
            arp: [s(0), N, s(1), N, s(2), N, s(3), N, s(2), N, s(1), N, s(0), N, s(1), s(2)],
            arp_oct: 24.0,
            arp_vol: 0.05,
            arp_wave: Wave::Sawtooth,
            kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
            hat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
            drums: 1.0,
        },
        _ => return None,
    })
}
