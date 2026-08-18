// In-browser Map Editor: paint a hex map with a palette, then export it as
// text rows (paste into gameConfig.map) or Test Play it right away.
import { TERRAIN, FACTIONS, ARTIFACTS, factionCreatures } from './data.js';
import { MAP_CW, MAP_CH, drawMap, mapLayout } from './render.js';
import { pixelToHex } from './hex.js';
import { OBJ_CHARS, LEGEND, serializeMapRows } from './mapformat.js';
import { toast, showModal, hideModal } from './hud.js';
import { setScreen } from './app.js';

const TERRAIN_IDS = Object.keys(TERRAIN);

const OBJECT_TOOLS = [
  { id: 'town0', label: 'Player 1 town', char: '0' },
  { id: 'town1', label: 'Player 2 town', char: '1' },
  { id: 'town2', label: 'Player 3 town', char: '2' },
  { id: 'town3', label: 'Player 4 town', char: '3' },
  { id: 'townN', label: 'Neutral town', char: 'T' },
  { id: 'gold', label: 'Gold pile', char: 'G' },
  { id: 'wood', label: 'Wood pile', char: 'W' },
  { id: 'ore', label: 'Ore pile', char: 'O' },
  { id: 'gems', label: 'Gems pile', char: 'E' },
  { id: 'crystal', label: 'Crystal pile', char: 'C' },
  { id: 'sulfur', label: 'Sulfur pile', char: 'S' },
  { id: 'mercury', label: 'Mercury pile', char: 'M' },
  { id: 'chest', label: 'Chest', char: '$' },
  { id: 'artifact', label: 'Artifact', char: 'A' },
  { id: 'dwelling', label: 'Dwelling', char: 'D' },
  { id: 'stack', label: 'Monsters', char: 'X' },
  { id: 'mine', label: 'Gold mine', char: '*' },
  { id: 'shrine', label: 'Shrine', char: 'H' },
  { id: 'manaWell', label: 'Mana well', char: 'v' },
  { id: 'windmill', label: 'Windmill', char: 'm' },
  { id: 'tradePost', label: 'Trade post', char: 'P' },
  { id: 'refugeeCamp', label: 'Refugee camp', char: 'R' },
  { id: 'graveyard', label: 'Graveyard', char: 'g' },
  { id: 'tower', label: 'Watchtower', char: 't' },
  { id: 'bank', label: 'Bank', char: 'B' },
  { id: 'boat', label: 'Boat', char: 'b' },
];

const CH_COLORS = {
  '0': '#7fc46b', '1': '#4a7fd6', '2': '#c6483e', '3': '#8a5fc4',
  T: '#6a6a72', G: '#d9b45a', W: '#a07040', O: '#8a8578', E: '#7fd0e0',
  C: '#b07fd0', S: '#d0d05a', M: '#7fc4c4', '$': '#c9a24a', A: '#e8c04a',
  D: '#6b4a2a', X: '#c6483e', '*': '#d0665a',
  H: '#e8c04a', v: '#5aa0d6', m: '#b8a884', P: '#c98a4a',
  R: '#7fc46b', g: '#6a6f7a', t: '#8a8f9a', B: '#d9b45a', b: '#7a9ad0',
};

const state = {
  w: 24, h: 16,
  terrain: [],
  obj: [],
  tool: 'grass',
};

let canvas = null;
let painting = false;
let testPlayHandler = null;

export function setTestPlayHandler(fn) { testPlayHandler = fn; }

function shrink(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * 0.45)},${Math.round(((n >> 8) & 255) * 0.45)},${Math.round((n & 255) * 0.45)})`;
}

function emptyGrid() {
  return Array.from({ length: state.h }, () => new Array(state.w).fill('grass'));
}

function previewGame() {
  const game = {
    w: state.w, h: state.h,
    map: { terrain: state.terrain.map(row => row.map(t => t || 'grass')) },
    towns: [], objects: [], heroes: [],
    players: [], gameOver: null,
  };
  const factionKeys = Object.keys(FACTIONS);
  const towns = [];
  const objects = [];
  for (let r = 0; r < state.h; r++) for (let q = 0; q < state.w; q++) {
    const ch = state.obj[r][q];
    if (!ch) continue;
    const o = OBJ_CHARS[ch];
    if (!o) continue;
    if (o.type === 'town') {
      const fac = o.player === null ? 'rampart' : factionKeys[o.player % factionKeys.length];
      towns.push({ name: 'Town', faction: fac, q, r, owner: o.player, buildings: [], guard: null, stock: {} });
    } else if (o.type === 'mine') {
      objects.push({ type: 'mine', sub: 'gold', owner: null, q, r });
    } else if (o.type === 'dwelling') {
      const fac = factionKeys[Math.floor(Math.random() * factionKeys.length)];
      const tier = 1 + Math.floor(Math.random() * 5);
      const c = factionCreatures(fac)[tier - 1];
      objects.push({ type: 'dwelling', creatureId: c.id, tier, guard: null, owner: null, stock: 0, q, r });
    } else if (o.type === 'stack') {
      const fac = factionKeys[Math.floor(Math.random() * factionKeys.length)];
      const c = factionCreatures(fac)[0];
      objects.push({ type: 'stack', army: [{ id: c.id, count: 7 }], q, r });
    } else if (o.type === 'artifact') {
      objects.push({ type: 'artifact', artifactId: ARTIFACTS[Math.floor(Math.random() * ARTIFACTS.length)].id, q, r });
    } else if (o.type === 'chest') {
      objects.push({ type: 'chest', gold: 1500, q, r });
    } else {
      objects.push({ type: o.type, amt: 1000, q, r });
    }
  }
  game.towns = towns;
  game.objects = objects;
  return game;
}

export function fitEditorCanvas() {
  if (!canvas) return;
  const wrap = document.getElementById('editorWrap');
  const availW = Math.max(100, wrap.clientWidth || 600);
  const availH = Math.max(100, wrap.clientHeight || 400);
  const ar = MAP_CW / MAP_CH;
  let w = availW, h = w / ar;
  if (h > availH) { h = availH; w = h * ar; }
  canvas.style.width = Math.floor(w) + 'px';
  canvas.style.height = Math.floor(h) + 'px';
}

function render() {
  const ctx = canvas.getContext('2d');
  drawMap(ctx, previewGame(), { hover: null, pathPreview: null, selectedHeroId: null });
}

function hexFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * (canvas.width / rect.width);
  const y = (evt.clientY - rect.top) * (canvas.height / rect.height);
  const L = mapLayout(previewGame());
  const h = pixelToHex(x - L.ox, y - L.oy, L.size);
  return h;
}

function paint(q, r) {
  if (q < 0 || q >= state.w || r < 0 || r >= state.h) return;
  const t = state.tool;
  if (t === 'erase') {
    state.terrain[r][q] = 'grass';
    state.obj[r][q] = null;
  } else if (TERRAIN_IDS.includes(t)) {
    state.terrain[r][q] = t;
  } else {
    const tool = OBJECT_TOOLS.find(tt => tt.id === t);
    if (tool) state.obj[r][q] = tool.char;
  }
  render();
}

function selectTool(id) {
  state.tool = id;
  document.querySelectorAll('#editorPalette .paletteBtn').forEach(b => b.classList.toggle('sel', b.dataset.tool === id));
}

function buildPalette() {
  const pal = document.getElementById('editorPalette');
  pal.innerHTML = '';
  const items = [{ id: 'erase', label: 'Eraser' }];
  for (const id of TERRAIN_IDS) items.push({ id, label: TERRAIN[id].name });
  items.push(...OBJECT_TOOLS);
  for (const t of items) {
    const btn = document.createElement('button');
    btn.className = 'paletteBtn';
    btn.dataset.tool = t.id;
    btn.addEventListener('click', () => selectTool(t.id));
    if (TERRAIN_IDS.includes(t.id)) {
      btn.style.background = shrink(TERRAIN[t.id].colors[0]);
      btn.textContent = t.label;
    } else {
      btn.innerHTML = `<span class="palCh" style="color:${t.char ? (CH_COLORS[t.char] || '#eee') : '#eee'}">${t.char || '×'}</span> <span class="palLbl">${t.label}</span>`;
    }
    pal.appendChild(btn);
  }
  selectTool('grass');
}

function randomTerrain() {
  const w = state.w, h = state.h;
  const g = Array.from({ length: h }, () => new Array(w).fill('grass'));
  const set = (q, r, t) => { if (q >= 0 && q < w && r >= 0 && r < h) g[r][q] = t; };
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const blobs = [
    { t: 'water', n: 4, len: 12 },
    { t: 'rock', n: 7, len: 9 },
    { t: 'trees', n: 7, len: 22 },
    { t: 'dirt', n: 4, len: 20 },
    { t: 'sand', n: 3, len: 18 },
    { t: 'snow', n: 2, len: 8 },
  ];
  for (const b of blobs) for (let i = 0; i < b.n; i++) {
    let q = Math.floor(Math.random() * w), r = Math.floor(Math.random() * h);
    for (let s = 0; s < b.len; s++) {
      set(q, r, b.t);
      const [dq, dr] = dirs[Math.floor(Math.random() * 6)];
      q = Math.max(0, Math.min(w - 1, q + dq));
      r = Math.max(0, Math.min(h - 1, r + dr));
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const ng = g.map(row => [...row]);
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
      if (g[r][q] !== 'grass') continue;
      const counts = {};
      for (const [dq, dr] of dirs) {
        const nq = q + dq, nr = r + dr;
        if (nq < 0 || nq >= w || nr < 0 || nr >= h) continue;
        const t = g[nr][nq];
        if (t !== 'grass') counts[t] = (counts[t] || 0) + 1;
      }
      for (const t in counts) if (counts[t] >= 4) ng[r][q] = t;
    }
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) g[r][q] = ng[r][q];
  }
  state.terrain = g;
  render();
}

function setSize(w, h) {
  const t = Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, q) => state.terrain[r]?.[q] || 'grass'));
  const o = Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, q) => state.obj[r]?.[q] || null));
  state.w = w; state.h = h;
  state.terrain = t; state.obj = o;
  render();
}

function getMapRows() {
  return serializeMapRows(previewGame());
}

function openExport() {
  const text = getMapRows().join('\n');
  showModal(`
    <h2>Export Map</h2>
    <p class="sub">Paste this into <code>gameConfig.map</code> in main.pjs (one line per row) to make it the default map, or keep it in a scratchpad for a campaign.</p>
    <textarea id="exportText" readonly spellcheck="false">${text}</textarea>
    <div class="modalBtns">
      <button class="btn" id="exportCopyBtn">Copy</button>
      <button class="btn primary" id="exportCloseBtn">Close</button>
    </div>
    <div class="sub" style="white-space:pre-line;margin-top:10px">${LEGEND}</div>
  `);
  document.getElementById('exportCopyBtn').addEventListener('click', async () => {
    const ta = document.getElementById('exportText');
    try { await navigator.clipboard.writeText(ta.value); toast('Copied to clipboard'); }
    catch (e) { ta.focus(); ta.select(); toast('Select all + copy manually'); }
  });
  document.getElementById('exportCloseBtn').addEventListener('click', hideModal);
}

const IMPORT_CHARS = { gold: 'G', wood: 'W', ore: 'O', gems: 'E', crystal: 'C', sulfur: 'S', mercury: 'M', chest: '$', artifact: 'A', dwelling: 'D', stack: 'X', mine: '*', shrine: 'H', manaWell: 'v', windmill: 'm', tradePost: 'P', graveyard: 'g', tower: 't', bank: 'B', refugeeCamp: 'R', boat: 'b' };

function importCurrentGame() {
  const g = (window.__game && window.__game.state) || null;
  if (!g) { toast('Start a game first, then come back and Import Game'); return; }
  const rows = serializeMapRows(g);
  const w = rows[0].length, h = rows.length;
  state.w = w; state.h = h;
  state.terrain = g.map.terrain.map(row => row.slice());
  state.obj = Array.from({ length: h }, () => new Array(w).fill(null));
  for (const t of g.towns) {
    const ch = t.owner === null || t.owner === undefined ? 'T' : String(t.owner);
    if (ch in OBJ_CHARS) state.obj[t.r][t.q] = ch;
  }
  for (const o of g.objects) {
    const ch = IMPORT_CHARS[o.type];
    if (ch) state.obj[o.r][o.q] = ch;
  }
  render();
  toast('Imported the current game map');
}

export function openEditor() {
  if (!canvas) return;
  if (!state.terrain.length) {
    state.terrain = emptyGrid();
    state.obj = Array.from({ length: state.h }, () => new Array(state.w).fill(null));
  }
  setScreen('editor');
  render();
  fitEditorCanvas();
}

export function initEditor() {
  canvas = document.getElementById('editorCanvas');
  canvas.width = MAP_CW;
  canvas.height = MAP_CH;
  buildPalette();
  state.terrain = emptyGrid();
  state.obj = Array.from({ length: state.h }, () => new Array(state.w).fill(null));
  window.addEventListener('resize', fitEditorCanvas);
  setTimeout(fitEditorCanvas, 50);

  canvas.addEventListener('pointerdown', evt => {
    painting = true;
    try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* synthetic events have no active pointer */ }
    const h = hexFromEvent(evt);
    paint(h.q, h.r);
  });
  canvas.addEventListener('pointermove', evt => {
    if (!painting) return;
    const h = hexFromEvent(evt);
    paint(h.q, h.r);
  });
  canvas.addEventListener('pointerup', () => { painting = false; });
  canvas.addEventListener('pointerleave', () => { painting = false; });

  document.getElementById('editorSize').value = 'medium';
  document.getElementById('editorSize').addEventListener('change', e => {
    const s = { small: [20, 14], medium: [24, 16], large: [30, 20] }[e.target.value];
    if (s) setSize(s[0], s[1]);
  });
  document.getElementById('editorRandomBtn').addEventListener('click', randomTerrain);
  document.getElementById('editorImportBtn').addEventListener('click', importCurrentGame);
  document.getElementById('editorExportBtn').addEventListener('click', openExport);
  document.getElementById('editorTestBtn').addEventListener('click', () => {
    const rows = getMapRows();
    if (testPlayHandler) testPlayHandler(rows);
    else toast('Editor not ready yet');
  });
  document.getElementById('editorBackBtn').addEventListener('click', () => setScreen('title'));
}