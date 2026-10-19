'use strict';
// Elenco do Punho Livre: aparência, atributos e golpes especiais de cada lutador.
// Os números de quadro dos especiais (at) ficam a partir de 240.

const BASE_STATS = {
  walking_frame_rate: 3, walking_speed: 4.6, walking_speedz: 2.4,
  running_frame_rate: 3, running_speed: 9.5, running_speedz: 1.6,
  heavy_walking_speed: 3.4, heavy_walking_speedz: 1.7, heavy_running_speed: 6, heavy_running_speedz: 1,
  jump_height: -16, jump_distance: 9.5, jump_distancez: 3.6,
  dash_height: -10, dash_distance: 17, dash_distancez: 5,
  rowing_height: -2, rowing_distance: 5,
};

const ROSTER = [
  {
    id: 1, name: 'Brasa', color: '#e2552e', desc: 'Lutador de rua que solta fogo pelas mãos.',
    look: { skin: '#f1c08f', hair: '#3a1a0e', hairStyle: 'spiky', shirt: '#d8402f', sleeves: 'short', pants: '#2d3a63', shoes: '#26222b', belt: '#141018', headband: '#ffd23a', emblem: { type: 'flame', color: '#ffd23a' }, eye: '#3a1a0e' },
    stats: { punch: 18, kick: 40 },
    specials: [
      { label: 'Bola de fogo', type: 'blast', tag: 'hit_Fa', at: 240, mp: 50, color: '#ff7a1f', style: 'fire', effect: 20, injury: 32, sound: 'fire' },
      { label: 'Gancho flamejante', type: 'uppercut', tag: 'hit_Ua', at: 250, mp: 80, effect: 20, injury: 50 },
      { label: 'Rajada de socos', type: 'rush', tag: 'hit_Fj', at: 260, mp: 70, injury: 10 },
    ],
  },
  {
    id: 2, name: 'Geada', color: '#5ab8f0', desc: 'Congela quem chega perto.',
    look: { skin: '#f0c8a0', hair: '#bfe6ff', hairStyle: 'short', shirt: '#2f6fd8', sleeves: 'long', pants: '#e8f4ff', shoes: '#2c3550', scarf: '#9fdcff', emblem: { type: 'snow', color: '#e8f8ff' }, eye: '#2a5a9a' },
    stats: { punch: 17, kick: 38 },
    specials: [
      { label: 'Estilhaço de gelo', type: 'blast', tag: 'hit_Fa', at: 240, mp: 60, color: '#8fe0ff', style: 'shard', effect: 30, injury: 28, fall: 20, sound: 'freeze' },
      { label: 'Explosão congelante', type: 'frost', tag: 'hit_Da', at: 250, mp: 120, injury: 30 },
      { label: 'Gancho', type: 'uppercut', tag: 'hit_Ua', at: 260, mp: 70, injury: 46 },
    ],
  },
  {
    id: 3, name: 'Corvo', color: '#8a52c8', desc: 'Ninja que some e reaparece atrás do inimigo.',
    look: { skin: '#e8b88f', hair: '#1a1a22', hairStyle: 'hood', shirt: '#2a2a36', sleeves: 'long', pants: '#2a2a36', shoes: '#111116', mask: '#3a3a4a', belt: '#7a3aa8', wrist: '#7a3aa8', emblem: { type: 'star', color: '#b06cff' }, eye: '#9a5ad8' },
    stats: { punch: 16, kick: 40, speed: 1.1 },
    specials: [
      { label: 'Estrelas ninja', type: 'blast', tag: 'hit_Fa', at: 240, mp: 45, color: '#c9d2dc', style: 'star', multi: true, injury: 18, fall: 20, speed: 15, sound: 'swing' },
      { label: 'Sombra', type: 'teleport', tag: 'hit_Uj', at: 250, mp: 90, injury: 42 },
      { label: 'Chute giratório', type: 'spin', tag: 'hit_Da', at: 260, mp: 60, injury: 20 },
    ],
  },
  {
    id: 4, name: 'Titã', color: '#c98a3a', desc: 'Grandalhão: mais vida e golpes pesados, porém mais lento.',
    look: { skin: '#8d5a3a', hair: '#1a1210', hairStyle: 'bald', beard: true, shirt: '#e8e2d2', sleeves: 'none', pants: '#5a3a1a', shoes: '#241a14', belt: '#a83228', build: 1.3, scale: 1.08, emblem: { type: 'ring', color: '#a83228' } },
    stats: { punch: 24, kick: 46, power: 1.2, hp: 620, speed: 0.85 },
    specials: [
      { label: 'Investida', type: 'charge', tag: 'hit_Fa', at: 240, mp: 70, injury: 55 },
      { label: 'Tremor', type: 'slam', tag: 'hit_Da', at: 250, mp: 110, color: '#d9a066', injury: 45 },
      { label: 'Gancho do titã', type: 'uppercut', tag: 'hit_Ua', at: 260, mp: 80, injury: 60 },
    ],
  },
  {
    id: 5, name: 'Faísca', color: '#f2c81e', desc: 'O mais rápido, com rajadas elétricas.',
    look: { skin: '#f2c9a0', hair: '#f2d23a', hairStyle: 'mohawk', shirt: '#22242c', sleeves: 'short', pants: '#f2c81e', shoes: '#22242c', gloves: '#f2c81e', belt: '#22242c', emblem: { type: 'bolt', color: '#f2c81e' }, eye: '#2a8ad8' },
    stats: { punch: 15, kick: 36, speed: 1.2, jump: 1.1 },
    specials: [
      { label: 'Raio', type: 'blast', tag: 'hit_Fa', at: 240, mp: 40, color: '#fff06a', style: 'orb', injury: 26, fall: 25, speed: 17, sound: 'zap' },
      { label: 'Rajada relâmpago', type: 'rush', tag: 'hit_Fj', at: 250, mp: 60, injury: 9 },
      { label: 'Giro elétrico', type: 'spin', tag: 'hit_Uj', at: 260, mp: 60, injury: 18 },
    ],
  },
  {
    id: 6, name: 'Jade', color: '#2fae7a', desc: 'Mestra de chutes que sabe se curar.',
    look: { skin: '#c98a5a', hair: '#151010', hairStyle: 'ponytail', shirt: '#1f8a70', sleeves: 'none', pants: '#f2efe6', shoes: '#2d2a28', belt: '#e0b030', wrist: '#e0b030', emblem: { type: 'ring', color: '#f2efe6' }, eye: '#1a6a4a' },
    stats: { punch: 16, kick: 44, jump: 1.08 },
    specials: [
      { label: 'Chuva de chutes', type: 'rush', tag: 'hit_Fa', at: 240, mp: 60, kicks: true, injury: 11 },
      { label: 'Chute crescente', type: 'uppercut', tag: 'hit_Ua', at: 250, mp: 70, injury: 48 },
      { label: 'Meditação', type: 'heal', tag: 'hit_Dj', at: 260, mp: 150, color: '#7dffb0' },
    ],
  },
  {
    id: 7, name: 'Lua', color: '#b06cff', desc: 'Energia que persegue os inimigos.',
    look: { skin: '#f4d2b8', hair: '#3c2a6a', hairStyle: 'long', shirt: '#6a3ac8', sleeves: 'long', pants: '#2a1f4a', shoes: '#1a1430', scarf: '#d9b8ff', emblem: { type: 'moon', color: '#f2e8ff' }, eye: '#6a3ac8' },
    stats: { punch: 15, kick: 36 },
    specials: [
      { label: 'Orbe caçador', type: 'chase', tag: 'hit_Fa', at: 240, mp: 60, color: '#c890ff', injury: 28 },
      { label: 'Onda lunar', type: 'slam', tag: 'hit_Da', at: 250, mp: 100, color: '#b06cff', injury: 36 },
      { label: 'Luz curativa', type: 'heal', tag: 'hit_Dj', at: 260, mp: 150, color: '#e2c4ff' },
    ],
  },
  {
    id: 8, name: 'Bala', color: '#e23a4a', desc: 'Boxeador de socos rápidos e fortes.',
    look: { skin: '#6a4028', hair: '#120c0a', hairStyle: 'flat', shirt: '#f2f2f2', sleeves: 'none', pants: '#c8202e', shorts: true, shoes: '#f2f2f2', socks: '#f2f2f2', gloves: '#d8202e', belt: '#f2f2f2', emblem: { type: 'star', color: '#d8202e' } },
    stats: { punch: 22, kick: 34, power: 1.05 },
    specials: [
      { label: 'Metralhadora', type: 'rush', tag: 'hit_Fa', at: 240, mp: 60, injury: 12 },
      { label: 'Gancho', type: 'uppercut', tag: 'hit_Ua', at: 250, mp: 70, injury: 58 },
      { label: 'Direto voador', type: 'charge', tag: 'hit_Fj', at: 260, mp: 60, injury: 45 },
    ],
  },
  {
    id: 30, name: 'Capanga', color: '#8a7a5a', desc: 'Bandido de rua.', enemy: true,
    look: { skin: '#e3a87e', hair: '#5a3a1a', hairStyle: 'bandana', accent: '#b52a2a', shirt: '#e9e2c8', vest: '#6a4a2a', sleeves: 'short', pants: '#4a4a3a', shoes: '#2a1a1a' },
    stats: { punch: 14, kick: 30, speed: 0.9 },
    specials: [],
  },
];

// armas espalhadas pela arena
const WEAPONS = [
  { id: 100, type: 'lightweapon', name: 'Bastão', kind: 'bat', hp: 200, strength: 1 },
  { id: 101, type: 'lightweapon', name: 'Cano', kind: 'pipe', hp: 320, strength: 1.2 },
  { id: 150, type: 'heavyweapon', name: 'Pedra', kind: 'stone', hp: 800 },
  { id: 151, type: 'heavyweapon', name: 'Caixa', kind: 'crate', hp: 300 },
];
