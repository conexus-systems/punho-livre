'use strict';
// Laço principal: a lógica roda a 30 TU por segundo  e o desenho
// acompanha a tela.

(function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  Game.ctx = ctx;
  Save.load();
  Save.apply();
  Input.init();
  setupTouch();
  canvas.addEventListener('pointerdown', () => Sound.init());

  const loading = new LoadingScreen();
  Game.screen = loading;
  const font = document.fonts ? document.fonts.load('40px "Bangers"').catch(() => {}) : Promise.resolve();
  Promise.all([Assets.load((p) => { loading.p = p; }), font])
    .then(() => Game.setScreen(new TitleScreen()))
    .catch((e) => { loading.error = String(e.message || e); });

  // ao sair do app a luta pausa sozinha e o som para
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const m = Game.screen && Game.screen.match;
      if (m && !m.net && !m.paused && !m.summary && !m.demo) m.setPaused(true);
      Sound.suspend();
    } else Sound.resume();
  });

  const STEP = 1000 / LF.FPS;
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(now - last, 250);
    last = now;
    let n = 0;
    while (acc >= STEP && n < 4) {
      Game.update();
      Input.endFrame();
      acc -= STEP;
      n++;
    }
    Game.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.PUNHO = { Game, Assets, Input };

  // Botão voltar do app Android: fecha na tela inicial, senão age como Esc.
  window.androidBack = function () {
    if (Game.screen instanceof TitleScreen) {
      if (window.AndroidApp) window.AndroidApp.exit();
      return;
    }
    Input.setKey('Escape', true);
    Input.setKey('Escape', false);
  };
})();
