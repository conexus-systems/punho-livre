'use strict';
// Servidor do Punho Livre.
//  - Salas de jogo em rede por código de 4 letras (até 4 jogadores humanos).
//    O jogo roda em "lockstep": cada cliente simula a partida inteira e o
//    servidor só repassa as teclas de cada jogador para os outros.
//  - Também serve os arquivos do jogo (index.html, style.css, src/ e fonts/) para
//    jogar direto pelo navegador em http://endereço:porta/.
//
// Uso: node server.js   (porta pela variável PORT, padrão 8080)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(process.env.GAME_ROOT || path.join(__dirname, '..', 'web'));
const MAX_PLAYERS = 4;
const STATIC = ['index.html', 'style.css', 'src/', 'fonts/'];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json',
};

// ---- arquivos do jogo ----

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  if (rel === 'health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  const file = path.resolve(ROOT, rel);
  const allowed = file.startsWith(ROOT + path.sep) && STATIC.some((p) => rel === p || (p.endsWith('/') && rel.startsWith(p)));
  if (!allowed) { res.writeHead(404); res.end('não encontrado'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('não encontrado'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

// ---- salas ----

const rooms = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const p of room.players) if (p && p.ws !== except && p.ws.readyState === 1) p.ws.send(data);
}

function roomState(room) {
  return {
    t: 'room',
    code: room.code,
    host: room.host,
    state: room.state,
    settings: room.settings,
    players: room.players.map((p, slot) => p && { slot, name: p.name, char: p.char, team: p.team, ready: p.ready }).filter(Boolean),
  };
}

function cleanName(n) {
  return String(n || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 10) || 'Jogador';
}

function join(ws, room, name) {
  const slot = room.players.findIndex((p) => !p);
  if (slot < 0 || room.state !== 'lobby') {
    send(ws, { t: 'error', msg: room.state !== 'lobby' ? 'A sala está em partida. Tente quando ela terminar.' : 'A sala está cheia.' });
    return;
  }
  room.players[slot] = { ws, name: cleanName(name), char: -1, team: 0, ready: false };
  ws.room = room;
  ws.slot = slot;
  if (room.host < 0) room.host = slot;
  send(ws, { t: 'joined', code: room.code, slot });
  broadcast(room, roomState(room));
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.players[ws.slot] = null;
  ws.room = null;
  if (room.state === 'match') {
    // alguém saiu no meio da luta: todos voltam para a sala
    room.state = 'lobby';
    broadcast(room, { t: 'left', slot: ws.slot });
  }
  if (room.players.every((p) => !p)) { rooms.delete(room.code); return; }
  if (room.host === ws.slot) room.host = room.players.findIndex((p) => p);
  for (const p of room.players) if (p) p.ready = false;
  broadcast(room, roomState(room));
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('close', () => leave(ws));
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    const room = ws.room;
    switch (m.t) {
      case 'create': {
        if (room) return;
        const code = newCode();
        const r = { code, players: Array(MAX_PLAYERS).fill(null), host: -1, state: 'lobby',
          settings: { cpus: 1, difficulty: 1, bg: -1 } };
        rooms.set(code, r);
        join(ws, r, m.name);
        break;
      }
      case 'join': {
        if (room) return;
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) { send(ws, { t: 'error', msg: 'Sala não encontrada. Confira o código.' }); return; }
        join(ws, r, m.name);
        break;
      }
      case 'pick': {
        if (!room || room.state !== 'lobby') return;
        const p = room.players[ws.slot];
        p.char = Number.isInteger(m.char) ? m.char : -1;
        p.team = Math.max(0, Math.min(4, m.team | 0));
        p.ready = !!m.ready;
        broadcast(room, roomState(room));
        break;
      }
      case 'settings': {
        if (!room || room.host !== ws.slot || room.state !== 'lobby') return;
        room.settings = {
          cpus: Math.max(0, Math.min(7, m.cpus | 0)),
          difficulty: Math.max(0, Math.min(3, m.difficulty | 0)),
          bg: m.bg | 0,
        };
        broadcast(room, roomState(room));
        break;
      }
      case 'start': {
        if (!room || room.host !== ws.slot || room.state !== 'lobby') return;
        // o anfitrião não precisa marcar "pronto": é ele quem começa
        if (!room.players.every((p, i) => !p || p.ready || i === room.host)) return;
        room.state = 'match';
        broadcast(room, { t: 'start', setup: m.setup, seed: Math.floor(Math.random() * 0xffffffff) });
        break;
      }
      case 'in':
        // teclas de um jogador num quadro: repassa para os outros
        if (room && room.state === 'match') broadcast(room, { t: 'in', s: ws.slot, f: m.f, ev: m.ev }, ws);
        break;
      case 'hash':
        if (room && room.state === 'match') broadcast(room, { t: 'hash', s: ws.slot, f: m.f, h: m.h }, ws);
        break;
      case 'lobby':
        // fim da luta: a sala volta a aceitar escolhas
        if (room && room.state === 'match') {
          room.state = 'lobby';
          for (const p of room.players) if (p) p.ready = false;
          broadcast(room, roomState(room));
        }
        break;
      case 'leave':
        leave(ws);
        break;
    }
  });
});

// derruba conexões que pararam de responder
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 15000);

server.listen(PORT, () => {
  console.log(`Punho Livre: servidor na porta ${PORT} (jogo em http://localhost:${PORT}/, salas em /ws)`);
});
