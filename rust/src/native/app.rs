//! Janela, laço de tempo e entrada do app nativo (winit + softbuffer). O jogo é desenhado num
//! `Canvas` de 794x470, como no navegador; a janela mostra esse quadro ampliado, com os
//! controles de toque por cima.

use std::num::NonZeroU32;
use std::rc::Rc;
use std::time::{Duration, Instant};

use winit::application::ApplicationHandler;
use winit::event::{ElementState, MouseButton, TouchPhase, WindowEvent};
use winit::event_loop::{ActiveEventLoop, ControlFlow, EventLoop};
use winit::keyboard::{Key as LogicalKey, KeyCode, NamedKey, PhysicalKey};
use winit::window::{Window, WindowId};

use crate::audio::sound;
use crate::core::consts::FPS;
use crate::core::input;
use crate::game;
use crate::gfx::{ctx_of, make_canvas, Canvas, Ctx};
use crate::ui::screens;
use crate::ui::touch;

const MOUSE_ID: u64 = u64::MAX;

/// No Android o `softbuffer` aceita um buffer menor que a janela e o sistema amplia (por hardware):
/// desenhar em até esta largura (lado maior) mantém 30 quadros por segundo em celulares modestos.
/// No computador o buffer tem que ter o tamanho da janela.
const MAX_LONG_SIDE: f64 = if cfg!(target_os = "android") { 1280.0 } else { f64::MAX };

struct Surface {
    window: Rc<Window>,
    surface: softbuffer::Surface<Rc<Window>, Rc<Window>>,
}

struct App {
    gfx: Option<Surface>,
    game: Canvas,
    frame: Option<(Canvas, Ctx)>,
    step: Duration,
    next_tick: Instant,
    started: bool,
    /// o mouse faz o papel do dedo (`--touch`), para testar os controles de toque no computador
    mouse_as_touch: bool,
    mouse_down: bool,
    mouse: (f64, f64),
    /// pixels do buffer por pixel da janela (1 no computador)
    scale: f64,
    dirty: bool,
}

impl App {
    fn new() -> App {
        let game = make_canvas(touch::GAME_W, touch::GAME_H);
        App {
            gfx: None,
            game,
            frame: None,
            step: Duration::from_secs_f64(1.0 / FPS as f64),
            next_tick: Instant::now(),
            started: false,
            mouse_as_touch: std::env::args().any(|a| a == "--touch"),
            mouse_down: false,
            mouse: (0.0, 0.0),
            scale: 1.0,
            dirty: true,
        }
    }

    fn start_game(&mut self) {
        if self.started {
            return;
        }
        self.started = true;
        game::init(ctx_of(&self.game));
        self.next_tick = Instant::now();
    }

    /// roda os TU que já passaram do relógio (no máximo 4, como no navegador)
    fn tick(&mut self) {
        let now = Instant::now();
        if now < self.next_tick {
            return;
        }
        // atrasado demais: não tenta recuperar tudo
        if now - self.next_tick > Duration::from_millis(250) {
            self.next_tick = now;
        }
        let mut n = 0;
        while self.next_tick <= now && n < 4 {
            game::update();
            self.next_tick += self.step;
            n += 1;
        }
        self.dirty = true;
    }

    fn render(&mut self) {
        let Some(g) = self.gfx.as_mut() else { return };
        let size = g.window.inner_size();
        let scale = (MAX_LONG_SIDE / size.width.max(size.height).max(1) as f64).min(1.0);
        let (fw, fh) = (((size.width as f64 * scale).round() as u32).max(1), ((size.height as f64 * scale).round() as u32).max(1));
        let (Some(w), Some(h)) = (NonZeroU32::new(fw), NonZeroU32::new(fh)) else { return };
        if g.surface.resize(w, h).is_err() {
            return;
        }
        self.scale = scale;
        game::draw();
        if self.frame.as_ref().map(|(c, _)| (c.width(), c.height())) != Some((fw, fh)) {
            let c = make_canvas(fw as f64, fh as f64);
            let x = ctx_of(&c);
            self.frame = Some((c, x));
        }
        let (canvas, ctx) = self.frame.as_ref().unwrap();
        touch::resize(fw as f64, fh as f64);
        let l = touch::layout(fw as f64, fh as f64, touch::is_active());
        ctx.reset_transform();
        ctx.fill_style("#0b1030");
        ctx.fill_rect(0.0, 0.0, fw as f64, fh as f64);
        ctx.smoothing(true);
        ctx.draw_image_scaled(&self.game, l.game.x, l.game.y, l.game.w, l.game.h);
        touch::draw(ctx);
        let Ok(mut buf) = g.surface.buffer_mut() else { return };
        canvas.with_pixels(|px, _, _| {
            for (dst, p) in buf.iter_mut().zip(px.chunks(4)) {
                *dst = ((p[0] as u32) << 16) | ((p[1] as u32) << 8) | p[2] as u32;
            }
        });
        g.window.pre_present_notify();
        let _ = buf.present();
        self.dirty = false;
    }

    fn key(&mut self, event_loop: &ActiveEventLoop, ev: &winit::event::KeyEvent) {
        let down = ev.state == ElementState::Pressed;
        // botão voltar do Android: fecha na tela inicial, senão age como Esc
        let back = matches!(ev.physical_key, PhysicalKey::Code(KeyCode::BrowserBack))
            || matches!(ev.logical_key, LogicalKey::Named(NamedKey::GoBack) | LogicalKey::Named(NamedKey::BrowserBack));
        if back {
            if down {
                let at_title = game::with_game(|g| matches!(g.screen, screens::Screen::Title(_))).unwrap_or(true);
                if at_title {
                    event_loop.exit();
                } else {
                    input::with(|i| {
                        i.set_key("Escape", true);
                        i.set_key("Escape", false);
                    });
                }
            }
            return;
        }
        let PhysicalKey::Code(code) = ev.physical_key else { return };
        // os nomes de `KeyCode` são os mesmos de `KeyboardEvent.code` do navegador (KeyA, ArrowLeft...)
        let name = format!("{code:?}");
        let typing = crate::native::text_mode()
            && !name.starts_with("Arrow")
            && !matches!(name.as_str(), "Enter" | "NumpadEnter" | "Escape" | "Backspace" | "Tab")
            && !name.starts_with('F');
        if down {
            sound::init();
            if let Some(t) = &ev.text {
                if !ev.repeat || typing {
                    crate::native::push_typed(t);
                }
            }
        }
        if typing {
            return;
        }
        input::with(|i| {
            if down && i.capture {
                i.captured = Some(name.clone());
                i.capture = false;
                return;
            }
            i.set_key(&name, down);
        });
    }

    fn pause_everything(&mut self) {
        game::with_game(screens::auto_pause);
        sound::suspend();
        touch::release_all();
        input::with(|i| {
            let all: Vec<String> = i.down.iter().cloned().collect();
            for c in all {
                i.set_key(&c, false);
            }
        });
    }
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.gfx.is_none() {
            let attrs = Window::default_attributes().with_title("Punho Livre").with_inner_size(winit::dpi::LogicalSize::new(1112.0, 658.0));
            let Ok(window) = event_loop.create_window(attrs) else {
                event_loop.exit();
                return;
            };
            let window = Rc::new(window);
            let Ok(context) = softbuffer::Context::new(window.clone()) else { return };
            let Ok(surface) = softbuffer::Surface::new(&context, window.clone()) else { return };
            self.gfx = Some(Surface { window, surface });
        }
        self.start_game();
        sound::resume();
        self.next_tick = Instant::now();
        event_loop.set_control_flow(ControlFlow::WaitUntil(self.next_tick));
    }

    fn suspended(&mut self, _event_loop: &ActiveEventLoop) {
        // no Android a superfície some junto com a janela
        self.pause_everything();
        self.gfx = None;
        self.frame = None;
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _id: WindowId, event: WindowEvent) {
        if let WindowEvent::CursorMoved { position, .. } = &event {
            self.mouse = (position.x, position.y);
        }
        match event {
            WindowEvent::CloseRequested => event_loop.exit(),
            WindowEvent::Resized(_) => self.dirty = true,
            WindowEvent::Focused(false) => self.pause_everything(),
            WindowEvent::Focused(true) => sound::resume(),
            WindowEvent::KeyboardInput { event, .. } => self.key(event_loop, &event),
            WindowEvent::Touch(t) => {
                let phase = match t.phase {
                    TouchPhase::Started => 0,
                    TouchPhase::Moved => 1,
                    TouchPhase::Ended | TouchPhase::Cancelled => 2,
                };
                touch::pointer(t.id, phase, t.location.x * self.scale, t.location.y * self.scale);
            }
            WindowEvent::CursorMoved { position, .. } if self.mouse_as_touch && self.mouse_down => touch::pointer(MOUSE_ID, 1, position.x * self.scale, position.y * self.scale),
            WindowEvent::MouseInput { state, button: MouseButton::Left, .. } if self.mouse_as_touch => {
                self.mouse_down = state == ElementState::Pressed;
                touch::pointer(MOUSE_ID, if self.mouse_down { 0 } else { 2 }, self.mouse.0 * self.scale, self.mouse.1 * self.scale);
            }
            WindowEvent::RedrawRequested => self.render(),
            _ => {}
        }
    }

    fn about_to_wait(&mut self, event_loop: &ActiveEventLoop) {
        if !self.started {
            return;
        }
        self.tick();
        if self.dirty {
            if let Some(g) = &self.gfx {
                g.window.request_redraw();
            }
        }
        event_loop.set_control_flow(ControlFlow::WaitUntil(self.next_tick));
    }
}

/// abre a janela e roda o jogo até fechar
pub fn run() {
    let event_loop = match EventLoop::new() {
        Ok(e) => e,
        Err(e) => {
            eprintln!("Não foi possível abrir a janela: {e}");
            return;
        }
    };
    event_loop.set_control_flow(ControlFlow::Poll);
    let mut app = App::new();
    let _ = event_loop.run_app(&mut app);
}

#[cfg(target_os = "android")]
pub fn run_android(android: winit::platform::android::activity::AndroidApp) {
    use winit::platform::android::EventLoopBuilderExtAndroid;
    crate::native::android::init(&android);
    let event_loop = match EventLoop::builder().with_android_app(android).build() {
        Ok(e) => e,
        Err(_) => return,
    };
    event_loop.set_control_flow(ControlFlow::Poll);
    let mut app = App::new();
    let _ = event_loop.run_app(&mut app);
}
