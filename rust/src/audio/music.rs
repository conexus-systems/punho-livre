//! Trilha sonora sintetizada: um sequenciador pequeno que toca baixo, bateria e
//! melodia com osciladores do Web Audio. Não usa arquivos de áudio.

use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{AudioBuffer, AudioContext, GainNode, OscillatorType};

use crate::audio::sound::SOUND;

fn hz(n: f64) -> f64 {
    440.0 * 2f64.powf((n - 69.0) / 12.0)
}

/// Cada faixa: andamento, acordes (notas MIDI) e padrões por instrumento. Nos padrões, um
/// número é o grau do acorde (0 fundamental, 1 terça, 2 quinta, 3 oitava) e None é pausa.
pub struct Track {
    bpm: f64,
    steps: usize,
    swing: f64,
    chords: &'static [[f64; 3]],
    bass: [Option<u8>; 16],
    arp: [Option<u8>; 16],
    arp_oct: f64,
    arp_vol: f64,
    arp_wave: OscillatorType,
    kick: [u8; 16],
    snare: [u8; 16],
    hat: [u8; 16],
    drums: f64,
}

const N: Option<u8> = None;
const fn s(v: u8) -> Option<u8> {
    Some(v)
}

fn track(name: &str) -> Option<Track> {
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
            arp_wave: OscillatorType::Triangle,
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
            arp_wave: OscillatorType::Square,
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
            arp_wave: OscillatorType::Sawtooth,
            kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
            hat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
            drums: 1.0,
        },
        _ => return None,
    })
}

pub struct Music {
    pub current: Option<String>,
    started: bool,
    step: usize,
    bar: usize,
    next: f64,
    noise: Option<AudioBuffer>,
    pub duck: f64,
}

thread_local! {
    static MUSIC: RefCell<Music> = const { RefCell::new(Music { current: None, started: false, step: 0, bar: 0, next: 0.0, noise: None, duck: 1.0 }) };
}

/// troca de faixa (None para silenciar)
pub fn play(name: Option<&str>) {
    MUSIC.with(|m| {
        let mut m = m.borrow_mut();
        if m.current.as_deref() == name {
            return;
        }
        m.current = name.map(|s| s.to_string());
        m.step = 0;
        m.bar = 0;
        m.next = 0.0;
        if !m.started {
            m.started = true;
            let cb = Closure::<dyn FnMut()>::new(tick);
            let _ = web_sys::window().unwrap().set_interval_with_callback_and_timeout_and_arguments_0(cb.as_ref().unchecked_ref(), 30);
            cb.forget();
        }
    });
}

/// abaixa a música durante a pausa
pub fn set_duck(v: f64) {
    MUSIC.with(|m| m.borrow_mut().duck = v);
    SOUND.with(|s| {
        let s = s.borrow();
        if let (Some(ctx), Some(g)) = (&s.ctx, &s.music_gain) {
            let _ = g.gain().set_target_at_time((s.music_volume * v) as f32, ctx.current_time(), 0.05);
        }
    });
}

struct Out {
    ctx: AudioContext,
    gain: GainNode,
}

fn out() -> Option<(Out, f64)> {
    SOUND.with(|s| {
        let s = s.try_borrow().ok()?;
        let ctx = s.ctx.clone()?;
        if ctx.state() != web_sys::AudioContextState::Running || s.music_volume == 0.0 {
            return None;
        }
        Some((Out { ctx, gain: s.music_gain.clone()? }, s.music_volume))
    })
}

fn tick() {
    let Some((o, _)) = out() else { return };
    MUSIC.with(|m| {
        let Ok(mut m) = m.try_borrow_mut() else { return };
        let Some(name) = m.current.clone() else { return };
        let Some(t) = track(&name) else { return };
        if m.noise.is_none() {
            m.noise = make_noise(&o.ctx);
        }
        let step_len = 60.0 / t.bpm / (t.steps as f64 / 4.0);
        let now = o.ctx.current_time();
        if m.next < now {
            m.next = now + 0.05;
        }
        while m.next < now + 0.2 {
            let s = m.step % t.steps;
            let odd = s % 2 == 1;
            let tm = m.next + if odd { t.swing * step_len } else { 0.0 };
            let bar = m.bar;
            play_step(&o, &t, s, bar, tm, step_len, m.noise.as_ref());
            m.step += 1;
            if m.step % t.steps == 0 {
                m.bar = (m.bar + 1) % t.chords.len();
            }
            m.next += step_len;
        }
    });
}

fn play_step(o: &Out, t: &Track, s: usize, bar: usize, tm: f64, len: f64, noise: Option<&AudioBuffer>) {
    let chord = t.chords[bar];
    let note = |deg: u8, oct: f64| chord[(deg % 3) as usize] + if deg == 3 { 12.0 } else { 0.0 } + oct;
    if let Some(b) = t.bass[s] {
        voice(o, OscillatorType::Sawtooth, hz(note(b, -12.0)), tm, len * 1.6, 0.16, 600.0);
    }
    if let Some(a) = t.arp[s] {
        voice(o, t.arp_wave, hz(note(a, t.arp_oct - 12.0)), tm, len * 1.3, t.arp_vol, 3200.0);
    }
    let d = t.drums;
    if t.kick[s] == 1 {
        kick(o, tm, d);
    }
    if t.snare[s] == 1 {
        snare(o, tm, d, noise);
    }
    if t.hat[s] == 1 {
        burst(o, tm, 0.05, 0.12 * d * if s.is_multiple_of(4) { 1.0 } else { 0.6 }, web_sys::BiquadFilterType::Highpass, 7000.0, noise);
    }
}

fn voice(o: &Out, ty: OscillatorType, f: f64, t: f64, dur: f64, vol: f64, cutoff: f64) {
    let ctx = &o.ctx;
    let (Ok(osc), Ok(g), Ok(lp)) = (ctx.create_oscillator(), ctx.create_gain(), ctx.create_biquad_filter()) else { return };
    osc.set_type(ty);
    osc.frequency().set_value(f as f32);
    lp.set_type(web_sys::BiquadFilterType::Lowpass);
    lp.frequency().set_value(cutoff as f32);
    let _ = g.gain().set_value_at_time(0.0, t);
    let _ = g.gain().linear_ramp_to_value_at_time(vol as f32, t + 0.008);
    let _ = g.gain().exponential_ramp_to_value_at_time(0.0001, t + dur);
    let _ = osc.connect_with_audio_node(&lp);
    let _ = lp.connect_with_audio_node(&g);
    let _ = g.connect_with_audio_node(&o.gain);
    let _ = osc.start_with_when(t);
    let _ = osc.stop_with_when(t + dur + 0.02);
}

fn kick(o: &Out, t: f64, vol: f64) {
    let ctx = &o.ctx;
    let (Ok(osc), Ok(g)) = (ctx.create_oscillator(), ctx.create_gain()) else { return };
    let _ = osc.frequency().set_value_at_time(150.0, t);
    let _ = osc.frequency().exponential_ramp_to_value_at_time(42.0, t + 0.12);
    let _ = g.gain().set_value_at_time((0.5 * vol) as f32, t);
    let _ = g.gain().exponential_ramp_to_value_at_time(0.0001, t + 0.2);
    let _ = osc.connect_with_audio_node(&g);
    let _ = g.connect_with_audio_node(&o.gain);
    let _ = osc.start_with_when(t);
    let _ = osc.stop_with_when(t + 0.22);
}

fn snare(o: &Out, t: f64, vol: f64, noise: Option<&AudioBuffer>) {
    burst(o, t, 0.16, 0.28 * vol, web_sys::BiquadFilterType::Bandpass, 1800.0, noise);
    let ctx = &o.ctx;
    let (Ok(osc), Ok(g)) = (ctx.create_oscillator(), ctx.create_gain()) else { return };
    osc.set_type(OscillatorType::Triangle);
    let _ = osc.frequency().set_value_at_time(220.0, t);
    let _ = osc.frequency().exponential_ramp_to_value_at_time(120.0, t + 0.08);
    let _ = g.gain().set_value_at_time((0.18 * vol) as f32, t);
    let _ = g.gain().exponential_ramp_to_value_at_time(0.0001, t + 0.1);
    let _ = osc.connect_with_audio_node(&g);
    let _ = g.connect_with_audio_node(&o.gain);
    let _ = osc.start_with_when(t);
    let _ = osc.stop_with_when(t + 0.12);
}

#[allow(deprecated)]
fn burst(o: &Out, t: f64, dur: f64, vol: f64, ty: web_sys::BiquadFilterType, freq: f64, noise: Option<&AudioBuffer>) {
    let Some(noise) = noise else { return };
    let ctx = &o.ctx;
    let (Ok(src), Ok(f), Ok(g)) = (ctx.create_buffer_source(), ctx.create_biquad_filter(), ctx.create_gain()) else { return };
    src.set_buffer(Some(noise));
    f.set_type(ty);
    f.frequency().set_value(freq as f32);
    let _ = g.gain().set_value_at_time(vol as f32, t);
    let _ = g.gain().exponential_ramp_to_value_at_time(0.0001, t + dur);
    let _ = src.connect_with_audio_node(&f);
    let _ = f.connect_with_audio_node(&g);
    let _ = g.connect_with_audio_node(&o.gain);
    let _ = src.start_with_when_and_grain_offset(t, js_sys::Math::random() * 0.5);
    let _ = src.stop_with_when(t + dur + 0.02);
}

fn make_noise(ctx: &AudioContext) -> Option<AudioBuffer> {
    let n = ctx.sample_rate() as u32;
    let buf = ctx.create_buffer(1, n, ctx.sample_rate()).ok()?;
    let mut d = vec![0f32; n as usize];
    for v in d.iter_mut() {
        *v = (js_sys::Math::random() * 2.0 - 1.0) as f32;
    }
    buf.copy_to_channel(&d, 0).ok()?;
    Some(buf)
}
