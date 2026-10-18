'use strict';
// Laço principal com passo fixo de 60 quadros por segundo.

(function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  Keys.init();
  setupTouch();
  canvas.addEventListener('pointerdown', () => { Sound.init(); Sound.resume(); });
  Game.init(ctx);

  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(now - last, 250);
    last = now;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      Game.update();
      Keys.endFrame();
      acc -= STEP;
      steps++;
    }
    Game.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
