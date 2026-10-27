//! Sons sintetizados na hora (ruído filtrado e tons), um buffer por nome. Nada de arquivos de áudio.

use std::cell::RefCell;
use std::collections::HashMap;
use web_sys::{AudioBuffer, AudioContext, GainNode};

use super::synth::{render, SOUND_NAMES};

fn synth(ctx: &AudioContext, name: &str) -> Option<AudioBuffer> {
    let sr = ctx.sample_rate() as f64;
    let d = render(name, sr);
    let buf = ctx.create_buffer(1, d.len() as u32, sr as f32).ok()?;
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
            if let Some(b) = synth(&ctx, name) {
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
