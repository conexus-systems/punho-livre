//! Áudio do app nativo: um mixer simples. Os efeitos são amostras sintetizadas na abertura
//! (`synth::render`) e a trilha é renderizada em laço (`render_track`) numa thread à parte.
//! A saída é um fluxo do `cpal`; o laço do jogo só mexe no estado compartilhado.

// sem a feature `audio` não há dispositivo de saída e o mixer fica sem uso (só compila)
#![cfg_attr(not(feature = "audio"), allow(dead_code))]

use std::cell::RefCell;
use std::collections::HashMap;
use std::f64::consts::TAU;
use std::sync::{Arc, Mutex};

use super::synth::{hz, render, track, Track, Wave, SOUND_NAMES};

struct Voice {
    buf: Arc<Vec<f32>>,
    pos: usize,
}

struct MusicLoop {
    buf: Arc<Vec<f32>>,
    pos: usize,
}

struct Mix {
    sr: f64,
    sounds: HashMap<&'static str, Arc<Vec<f32>>>,
    voices: Vec<Voice>,
    music: Option<MusicLoop>,
    wanted: Option<String>,
    volume: f64,
    music_volume: f64,
    duck: f64,
    duck_now: f64,
    muted: bool,
    paused: bool,
}

impl Mix {
    fn new() -> Mix {
        Mix {
            sr: 44100.0,
            sounds: HashMap::new(),
            voices: vec![],
            music: None,
            wanted: None,
            volume: 0.55,
            music_volume: 0.4,
            duck: 1.0,
            duck_now: 1.0,
            muted: false,
            paused: false,
        }
    }

    /// próxima amostra mono já com os volumes
    fn next(&mut self) -> f32 {
        if self.paused {
            return 0.0;
        }
        self.duck_now += (self.duck - self.duck_now) * 0.0006;
        let mut sfx = 0.0f32;
        for v in &mut self.voices {
            if v.pos < v.buf.len() {
                sfx += v.buf[v.pos];
                v.pos += 1;
            }
        }
        let mut mus = 0.0f32;
        if let Some(m) = &mut self.music {
            mus = m.buf[m.pos];
            m.pos += 1;
            if m.pos >= m.buf.len() {
                m.pos = 0;
            }
        }
        let out = sfx as f64 * self.volume + mus as f64 * self.music_volume * self.duck_now;
        out.clamp(-1.0, 1.0) as f32
    }

    fn reap(&mut self) {
        self.voices.retain(|v| v.pos < v.buf.len());
    }
}

struct Engine {
    mix: Arc<Mutex<Mix>>,
    _stream: Option<Stream>,
}

thread_local! {
    static ENGINE: RefCell<Option<Engine>> = const { RefCell::new(None) };
    static PENDING: RefCell<(f64, f64, bool)> = const { RefCell::new((0.55, 0.4, false)) };
    static WANT_MUSIC: RefCell<Option<String>> = const { RefCell::new(None) };
}

#[cfg(not(feature = "audio"))]
type Stream = ();
#[cfg(feature = "audio")]
type Stream = cpal::Stream;

#[cfg(not(feature = "audio"))]
fn open_stream(_mix: Arc<Mutex<Mix>>) -> Option<Stream> {
    None
}

#[cfg(feature = "audio")]
fn open_stream(mix: Arc<Mutex<Mix>>) -> Option<Stream> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    let host = cpal::default_host();
    let device = host.default_output_device()?;
    let supported = device.default_output_config().ok()?;
    let channels = supported.channels() as usize;
    let sr = supported.sample_rate().0 as f64;
    mix.lock().ok()?.sr = sr;
    let config: cpal::StreamConfig = supported.clone().into();
    let err = |e| eprintln!("áudio: {e}");

    fn build<T: cpal::SizedSample + cpal::FromSample<f32>>(
        device: &cpal::Device,
        config: &cpal::StreamConfig,
        channels: usize,
        mix: Arc<Mutex<Mix>>,
        err: impl FnMut(cpal::StreamError) + Send + 'static,
    ) -> Option<cpal::Stream> {
        use cpal::traits::DeviceTrait;
        device
            .build_output_stream(
                config,
                move |data: &mut [T], _| {
                    let Ok(mut m) = mix.lock() else { return };
                    for frame in data.chunks_mut(channels) {
                        let v = T::from_sample(m.next());
                        for s in frame.iter_mut() {
                            *s = v;
                        }
                    }
                    m.reap();
                },
                err,
                None,
            )
            .ok()
    }

    let stream = match supported.sample_format() {
        cpal::SampleFormat::F32 => build::<f32>(&device, &config, channels, mix, err),
        cpal::SampleFormat::I16 => build::<i16>(&device, &config, channels, mix, err),
        cpal::SampleFormat::U16 => build::<u16>(&device, &config, channels, mix, err),
        _ => None,
    }?;
    stream.play().ok()?;
    Some(stream)
}

/// abre o dispositivo de áudio (só na primeira vez) e sintetiza os efeitos
pub fn init() {
    ENGINE.with(|e| {
        if e.borrow().is_some() {
            return;
        }
        let mix = Arc::new(Mutex::new(Mix::new()));
        let stream = open_stream(mix.clone());
        let sr = mix.lock().map(|m| m.sr).unwrap_or(44100.0);
        {
            let (v, mv, muted) = PENDING.with(|p| *p.borrow());
            if let Ok(mut m) = mix.lock() {
                m.volume = v;
                m.music_volume = mv;
                m.muted = muted;
                for name in SOUND_NAMES {
                    m.sounds.insert(name, Arc::new(render(name, sr)));
                }
            }
        }
        *e.borrow_mut() = Some(Engine { mix, _stream: stream });
    });
    // a faixa pedida antes de o áudio abrir começa agora
    if let Some(w) = WANT_MUSIC.with(|w| w.borrow().clone()) {
        with_mix(|m| m.wanted = Some(w.clone()));
        start_music(&w);
    }
}

fn with_mix<R>(f: impl FnOnce(&mut Mix) -> R) -> Option<R> {
    ENGINE.with(|e| {
        let e = e.borrow();
        let eng = e.as_ref()?;
        let mut m = eng.mix.lock().ok()?;
        Some(f(&mut m))
    })
}

pub fn resume() {
    with_mix(|m| m.paused = false);
}
pub fn suspend() {
    with_mix(|m| m.paused = true);
}

/// sfx e music de 0 a 1
pub fn set_volumes(sfx: f64, music: f64) {
    let (v, mv) = (sfx * 0.7, music * 0.8);
    PENDING.with(|p| {
        let mut p = p.borrow_mut();
        p.0 = v;
        p.1 = mv;
    });
    with_mix(|m| {
        m.volume = v;
        m.music_volume = mv;
    });
}

pub fn toggle_mute() {
    PENDING.with(|p| {
        let mut p = p.borrow_mut();
        p.2 = !p.2;
    });
    with_mix(|m| m.muted = !m.muted);
}

pub fn play(name: &str) {
    with_mix(|m| {
        if m.muted || m.volume == 0.0 || name.is_empty() || m.voices.len() > 24 {
            return;
        }
        if let Some(b) = m.sounds.get(name) {
            let buf = b.clone();
            m.voices.push(Voice { buf, pos: 0 });
        }
    });
}

// ---- trilha ----

/// troca de faixa (None para silenciar)
pub fn music_play(name: Option<&str>) {
    WANT_MUSIC.with(|w| *w.borrow_mut() = name.map(|s| s.to_string()));
    let same = with_mix(|m| {
        let same = m.wanted.as_deref() == name;
        m.wanted = name.map(|s| s.to_string());
        if name.is_none() {
            m.music = None;
        }
        same
    });
    if same == Some(true) {
        return;
    }
    if let Some(n) = name {
        start_music(n);
    }
}

fn start_music(name: &str) {
    let Some((mix, sr)) = ENGINE.with(|e| e.borrow().as_ref().and_then(|e| e.mix.lock().ok().map(|m| (e.mix.clone(), m.sr)))) else { return };
    let name = name.to_string();
    std::thread::spawn(move || {
        let Some(t) = track(&name) else { return };
        let buf = Arc::new(render_track(&t, sr));
        if let Ok(mut m) = mix.lock() {
            if m.wanted.as_deref() == Some(name.as_str()) {
                m.music = Some(MusicLoop { buf, pos: 0 });
            }
        }
    });
}

/// abaixa a música durante a pausa
pub fn music_set_duck(v: f64) {
    with_mix(|m| m.duck = v);
}

// ---- síntese da trilha (um ciclo inteiro dos acordes, para tocar em laço) ----

struct Noise(u64);
impl Noise {
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 11) as f64 / (1u64 << 53) as f64 * 2.0 - 1.0
    }
}

#[derive(Clone, Copy)]
enum Filt {
    Low,
    High,
    Band,
}

/// filtro biquad (receitas do Audio EQ Cookbook, as mesmas do Web Audio)
struct Biquad {
    b: [f64; 3],
    a: [f64; 2],
    x: [f64; 2],
    y: [f64; 2],
}

impl Biquad {
    fn new(kind: Filt, f: f64, sr: f64, q: f64) -> Biquad {
        let w = TAU * (f / sr).min(0.49);
        let (s, c) = (w.sin(), w.cos());
        let al = s / (2.0 * q);
        let (b0, b1, b2) = match kind {
            Filt::Low => ((1.0 - c) / 2.0, 1.0 - c, (1.0 - c) / 2.0),
            Filt::High => ((1.0 + c) / 2.0, -(1.0 + c), (1.0 + c) / 2.0),
            Filt::Band => (al, 0.0, -al),
        };
        let a0 = 1.0 + al;
        Biquad { b: [b0 / a0, b1 / a0, b2 / a0], a: [-2.0 * c / a0, (1.0 - al) / a0], x: [0.0; 2], y: [0.0; 2] }
    }
    fn run(&mut self, x: f64) -> f64 {
        let y = self.b[0] * x + self.b[1] * self.x[0] + self.b[2] * self.x[1] - self.a[0] * self.y[0] - self.a[1] * self.y[1];
        self.x = [x, self.x[0]];
        self.y = [y, self.y[0]];
        y
    }
}

fn osc(w: Wave, ph: f64) -> f64 {
    let p = ph.rem_euclid(1.0);
    match w {
        Wave::Sine => (TAU * p).sin(),
        Wave::Square => {
            if p < 0.5 {
                1.0
            } else {
                -1.0
            }
        }
        Wave::Sawtooth => 2.0 * p - 1.0,
        Wave::Triangle => 4.0 * (p - 0.5).abs() - 1.0,
    }
}

/// soma `f(t)` (t em segundos desde `start`) no laço a partir de `start`, dando a volta no fim
fn add_wrapped(buf: &mut [f32], sr: f64, start: f64, dur: f64, mut f: impl FnMut(f64) -> f64) {
    let n = (dur * sr).ceil() as usize;
    let first = (start * sr).round() as usize;
    for i in 0..n {
        let idx = (first + i) % buf.len();
        buf[idx] += f(i as f64 / sr) as f32;
    }
}

/// rampa exponencial de `v` até 0.0001 em `dur` segundos
fn exp_fall(v: f64, t: f64, dur: f64) -> f64 {
    v * (0.0001 / v).powf((t / dur).min(1.0))
}

#[allow(clippy::too_many_arguments)]
fn voice(buf: &mut [f32], sr: f64, wave: Wave, f: f64, start: f64, dur: f64, vol: f64, cutoff: f64) {
    let mut lp = Biquad::new(Filt::Low, cutoff, sr, 1.0);
    let mut ph = 0.0;
    add_wrapped(buf, sr, start, dur + 0.02, |t| {
        ph += f / sr;
        let env = if t < 0.008 { vol * t / 0.008 } else { exp_fall(vol, t - 0.008, (dur - 0.008).max(0.001)) };
        lp.run(osc(wave, ph)) * if t > dur { 0.0 } else { env }
    });
}

fn kick(buf: &mut [f32], sr: f64, start: f64, vol: f64) {
    let mut ph = 0.0;
    add_wrapped(buf, sr, start, 0.22, |t| {
        let f = 150.0 * (42.0f64 / 150.0).powf((t / 0.12).min(1.0));
        ph += f / sr;
        osc(Wave::Sine, ph) * exp_fall(0.5 * vol, t, 0.2)
    });
}

fn burst(buf: &mut [f32], sr: f64, noise: &mut Noise, kind: Filt, start: f64, dur: f64, vol: f64, freq: f64) {
    let mut f = Biquad::new(kind, freq, sr, 1.0);
    add_wrapped(buf, sr, start, dur + 0.02, |t| f.run(noise.next()) * if t > dur { 0.0 } else { exp_fall(vol, t, dur) });
}

fn snare(buf: &mut [f32], sr: f64, noise: &mut Noise, start: f64, vol: f64) {
    burst(buf, sr, noise, Filt::Band, start, 0.16, 0.28 * vol, 1800.0);
    let mut ph = 0.0;
    add_wrapped(buf, sr, start, 0.12, |t| {
        let f = 220.0 * (120.0f64 / 220.0).powf((t / 0.08).min(1.0));
        ph += f / sr;
        osc(Wave::Triangle, ph) * if t > 0.1 { 0.0 } else { exp_fall(0.18 * vol, t, 0.1) }
    });
}

/// um ciclo inteiro da faixa (todos os acordes), pronto para tocar em laço
fn render_track(t: &Track, sr: f64) -> Vec<f32> {
    let step_len = 60.0 / t.bpm / (t.steps as f64 / 4.0);
    let total_steps = t.steps * t.chords.len();
    let len = (total_steps as f64 * step_len * sr).round() as usize;
    let mut buf = vec![0f32; len.max(1)];
    let mut noise = Noise(0x2545_F491_4F6C_DD1D);
    for step in 0..total_steps {
        let s = step % t.steps;
        let bar = step / t.steps;
        let chord = t.chords[bar];
        let note = |deg: u8, oct: f64| chord[(deg % 3) as usize] + if deg == 3 { 12.0 } else { 0.0 } + oct;
        let odd = s % 2 == 1;
        let tm = step as f64 * step_len + if odd { t.swing * step_len } else { 0.0 };
        if let Some(b) = t.bass[s] {
            voice(&mut buf, sr, Wave::Sawtooth, hz(note(b, -12.0)), tm, step_len * 1.6, 0.16, 600.0);
        }
        if let Some(a) = t.arp[s] {
            voice(&mut buf, sr, t.arp_wave, hz(note(a, t.arp_oct - 12.0)), tm, step_len * 1.3, t.arp_vol, 3200.0);
        }
        let d = t.drums;
        if t.kick[s] == 1 {
            kick(&mut buf, sr, tm, d);
        }
        if t.snare[s] == 1 {
            snare(&mut buf, sr, &mut noise, tm, d);
        }
        if t.hat[s] == 1 {
            burst(&mut buf, sr, &mut noise, Filt::High, tm, 0.05, 0.12 * d * if s.is_multiple_of(4) { 1.0 } else { 0.6 }, 7000.0);
        }
    }
    buf
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracks_render_to_audible_loops() {
        for name in ["menu", "fight1", "fight2"] {
            let t = track(name).expect("faixa");
            let buf = render_track(&t, 22050.0);
            let peak = buf.iter().fold(0f32, |a, v| a.max(v.abs()));
            assert!(buf.len() > 22050 * 3, "{name}: laço curto demais ({})", buf.len());
            assert!(peak > 0.05 && peak < 4.0, "{name}: pico {peak}");
            assert!(buf.iter().all(|v| v.is_finite()), "{name}: amostra inválida");
        }
    }

    #[test]
    fn sounds_are_finite() {
        for n in SOUND_NAMES {
            let b = render(n, 22050.0);
            assert!(!b.is_empty() && b.iter().all(|v| v.is_finite() && v.abs() <= 1.0), "{n}");
        }
    }
}
