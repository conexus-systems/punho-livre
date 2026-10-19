// Gera a arte da ficha da Play Store em store/: ícone 512, gráfico de recursos
// 1024x500 e capturas de tela 1920x1080, tudo a partir do próprio jogo.
//   npm i playwright && node tools/store-assets.cjs
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'store');
const URL = 'file://' + path.join(ROOT, 'web', 'index.html');

const ready = async (page) => {
  await page.goto(URL);
  await page.waitForFunction(() => window.PUNHO && PUNHO.Game.screen.constructor.name === 'TitleScreen', null, { timeout: 30000 });
};
const save = (name, dataUrl) => fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

(async () => {
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });
  const browser = await chromium.launch();

  // ---- ícone e gráfico de recursos ----
  {
    const page = await browser.newPage();
    await ready(page);
    const art = await page.evaluate(() => {
      const icon = document.createElement('canvas'); icon.width = icon.height = 512;
      let g = icon.getContext('2d');
      let bg = g.createLinearGradient(0, 0, 0, 512); bg.addColorStop(0, '#141b4a'); bg.addColorStop(1, '#2a1240');
      g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
      drawBurst(g, 256, 262, 230, 13, '#c4281c', 0.1);
      drawBurst(g, 256, 262, 186, 13, '#f28a1a', 0.3);
      g.save(); g.translate(256, 300); g.rotate(-0.08); g.textAlign = 'center'; g.lineJoin = 'round';
      g.font = `250px ${LOGO_FONT}`; g.lineWidth = 26; g.strokeStyle = '#120a1e'; g.strokeText('PL', 0, 70);
      const gr = g.createLinearGradient(0, -110, 0, 70); gr.addColorStop(0, '#fff3a6'); gr.addColorStop(0.5, '#ffc21c'); gr.addColorStop(1, '#ff6a00');
      g.fillStyle = gr; g.fillText('PL', 0, 70); g.restore();

      const f = document.createElement('canvas'); f.width = 1024; f.height = 500;
      g = f.getContext('2d');
      bg = g.createLinearGradient(0, 0, 1024, 500); bg.addColorStop(0, '#0b1030'); bg.addColorStop(1, '#3a1646');
      g.fillStyle = bg; g.fillRect(0, 0, 1024, 500);
      g.globalAlpha = 0.12; g.fillStyle = '#ffb000';
      for (let i = -4; i < 14; i++) { g.beginPath(); g.moveTo(i * 90, 0); g.lineTo(i * 90 + 40, 0); g.lineTo(i * 90 - 160, 500); g.lineTo(i * 90 - 200, 500); g.fill(); }
      g.globalAlpha = 1;
      drawLogo(g, 270, 200, 1.05, 0);
      g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#e9ebff';
      g.fillText('Luta 2.5D para até 4 jogadores', 270, 400);
      g.font = '22px Arial, sans-serif'; g.fillStyle = '#9aa3d8';
      g.fillText('8 lutadores · 6 cenários · online · controle bluetooth', 270, 436);
      const poses = [[POSE.guard[0], 0], [ATK.jabA[1], 1], [ATK.jumpKick[3], 3], [POSE.guard[2], 5]];
      const cast = [ROSTER[0], ROSTER[1], ROSTER[3], ROSTER[2]];
      const spots = [[560, 300], [690, 330], [810, 290], [930, 330]];
      cast.forEach((r, i) => {
        const look = { ...r.look, scale: (r.look.scale || 1) * 2.3 };
        drawPoseCell(g, look, poses[i][0], spots[i][0] - 120, spots[i][1] - 200, 240, 200);
      });
      return { icon: icon.toDataURL('image/png'), feature: f.toDataURL('image/png') };
    });
    save('icon-512.png', art.icon);
    save('feature-1024x500.png', art.feature);
    await page.close();
  }

  // ---- capturas de tela (celular deitado, 1920x1080) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await ready(page);
    await page.touchscreen.tap(960, 540);
    await page.waitForTimeout(300);
    let n = 0;
    const shot = async (label) => { n++; await page.screenshot({ path: path.join(OUT, 'screenshots', `${String(n).padStart(2, '0')}-${label}.png`) }); };
    const fight = (ids, bg, ai = 2) => page.evaluate(([ids, bg, ai]) => {
      startMatch({ players: ids.map((id, i) => ({ id, team: i < 2 ? 1 : 2, con: i === 0 ? Input.controllers[0] : new Controller(), player: i === 0 ? 0 : -1, ai: i === 0 ? null : ai, name: i === 0 ? '1P' : 'COM' })), bg, mode: 'vs', onEnd: () => {} });
      const m = Game.screen.match; for (const c of m.characters()) c.health.mp = c.health.mp_full;
    }, [ids, bg, ai]);

    await shot('titulo');
    await page.evaluate(() => { const s = new SelectScreen('vs'); s.players[0].state = 'char'; s.players[1].state = 'char'; s.players[0].cur = 0; s.players[1].cur = 3; Game.setScreen(s); });
    await page.waitForTimeout(250); await shot('selecao');
    for (const [ids, bg] of [[[1, 2, 3, 4], 2], [[5, 6, 7, 8], 1], [[3, 8, 1, 6], 3], [[2, 4, 7, 5], 4], [[6, 1, 4, 3], 5]]) {
      await fight(ids, bg);
      await page.waitForTimeout(6000);
      await shot('luta');
    }
    await page.evaluate(() => { const s = new SelectScreen('stage'); s.players[0].state = 'ready'; s.phase = 'settings'; Game.setScreen(s); });
    await page.waitForTimeout(250); await shot('historia-ajustes');
    await ctx.close();
  }
  await browser.close();
  console.log('Arte da loja gerada em', OUT);
})();
