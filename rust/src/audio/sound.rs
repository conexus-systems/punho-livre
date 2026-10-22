//! Sons sintetizados na hora (ruído filtrado e tons), um buffer por nome. Nada de arquivos de áudio.

use std::cell::RefCell;
use std::collections::HashMap;
use web_sys::{AudioBuffer, AudioContext, GainNode};

pub struct SynthState {
    sr: f64,
    lp: [f64; 4],
    ph: [f64; 12],
}

fn rnd() -> f64 {
    js_sys::Math::random()
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

type Gen = fn(f64, &mut SynthState) -> f64;

pub const SOUND_NAMES: &[&str] = &[
    "hit", "hit2", "block", "swing", "step", "jump", "land", "fall", "grab", "pick", "blast", "fire", "freeze", "shatter", "zap", "boom", "slam", "teleport", "heal", "wood",
    "clank", "thud", "break", "ko", "bell", "m_pass", "m_ok", "m_cancel", "m_join", "m_end",
];

fn sound_def(name: &str) -> (f64, Gen) {
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

fn synth(ctx: &AudioContext, dur: f64, gen: Gen) -> Option<AudioBuffer> {
    let sr = ctx.sample_rate() as f64;
    let n = (dur * sr).floor() as u32;
    let buf = ctx.create_buffer(1, n, sr as f32).ok()?;
    let mut d = vec![0f32; n as usize];
    let mut s = SynthState { sr, lp: [0.0; 4], ph: [0.0; 12] };
    for (i, v) in d.iter_mut().enumerate() {
        *v = gen(i as f64 / sr, &mut s).clamp(-1.0, 1.0) as f32;
    }
    buf.copy_to_channel(&d, 0).ok()?;
    Some(buf)
}

pub struct Sound {
    pub ctx: Option<AudioContext>,
    pub gain: Option<GainNode>,
    pub music_gain: Option<GainNode>,
    pub buffers: HashMap<&'static str, AudioBuffer>,
    pub muted: bool,
    pub volume: f64,
    pub music_volume: f64,
}

thread_local! {
    pub static SOUND: RefCell<Sound> = RefCell::new(Sound { ctx: None, gain: None, music_gain: None, buffers: HashMap::new(), muted: false, volume: 0.55, music_volume: 0.4 });
}

pub fn init() {
    SOUND.with(|s| {
        let Ok(mut s) = s.try_borrow_mut() else { return };
        if s.ctx.is_some() {
            if let Some(c) = &s.ctx {
                if c.state() == web_sys::AudioContextState::Suspended {
                    let _ = c.resume();
                }
            }
            return;
        }
        let Ok(ctx) = AudioContext::new() else { return };
        let gain = ctx.create_gain().unwrap();
        gain.gain().set_value(s.volume as f32);
        let _ = gain.connect_with_audio_node(&ctx.destination());
        let mg = ctx.create_gain().unwrap();
        mg.gain().set_value(s.music_volume as f32);
        let _ = mg.connect_with_audio_node(&ctx.destination());
        for name in SOUND_NAMES {
            let (dur, gen) = sound_def(name);
            if let Some(b) = synth(&ctx, dur, gen) {
                s.buffers.insert(name, b);
            }
        }
        s.gain = Some(gain);
        s.music_gain = Some(mg);
        s.ctx = Some(ctx);
    });
}

pub fn resume() {
    SOUND.with(|s| {
        if let Some(c) = &s.borrow().ctx {
            if c.state() == web_sys::AudioContextState::Suspended {
                let _ = c.resume();
            }
        }
    });
}
pub fn suspend() {
    SOUND.with(|s| {
        if let Some(c) = &s.borrow().ctx {
            if c.state() == web_sys::AudioContextState::Running {
                let _ = c.suspend();
            }
        }
    });
}

/// sfx e music de 0 a 1
pub fn set_volumes(sfx: f64, music: f64) {
    SOUND.with(|s| {
        let mut s = s.borrow_mut();
        s.volume = sfx * 0.7;
        s.music_volume = music * 0.8;
        if let Some(g) = &s.gain {
            g.gain().set_value(s.volume as f32);
        }
        if let Some(g) = &s.music_gain {
            g.gain().set_value(s.music_volume as f32);
        }
    });
}

pub fn toggle_mute() {
    SOUND.with(|s| {
        let mut s = s.borrow_mut();
        s.muted = !s.muted;
    });
}

pub fn play(name: &str) {
    SOUND.with(|s| {
        let Ok(s) = s.try_borrow() else { return };
        if s.muted || s.volume == 0.0 || name.is_empty() {
            return;
        }
        let (Some(ctx), Some(gain), Some(buf)) = (&s.ctx, &s.gain, s.buffers.get(name)) else { return };
        let Ok(src) = ctx.create_buffer_source() else { return };
        src.set_buffer(Some(buf));
        let _ = src.connect_with_audio_node(gain);
        let _ = src.start();
    });
}
