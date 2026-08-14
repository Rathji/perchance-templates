// ============================================================================
//  RPG GAME — src/rpggame.js
//  ============================================================================
//  A text-based dungeon crawler in the spirit of Bard's Tale / Wizardry,
//  built as the game module of the VGN shell. It implements the module API
//  (init / reset / update / render) and drives the shell's HUD, audio, and
//  high-score plumbing.
//
//  WHAT'S WHERE
//    - All GAME CONTENT lives in main.pjs (monsters, spells, loot, names,
//      floor & room flavor, tuning numbers). Edit those lists to change the
//      game — you should rarely need to touch this file.
//    - This file is the ENGINE: party creation, dungeon generation, movement,
//      turn-based combat, leveling, saving.
//
//  GAMEPLAY LOOP (classic dungeon crawler)
//    1. CREATE — pick a class for each of your 4 heroes.
//    2. EXPLORE — grid dungeon, 4 floors deep. Move with arrows or the N/E/S/W
//       number keys. Each step may trigger an encounter.
//    3. COMBAT — turn-based. Choose an action for each hero (attack / spell /
//       item / guard), then END THE ROUND: the party acts, then the monsters
//       hit back. Win XP & gold; level up as you go.
//    4. Loot chests (SEARCH), rest to recover, descend the stairs, and slay
//       THE BLIND WIZARD on the last floor to win.
//  The game auto-saves to localStorage; the title screen offers CONTINUE.
//
//  HOW TO EXTEND
//    New content → main.pjs lists. New mechanics → add states/functions here.
//    The term() / menu() / combat APIs below are designed to be reused.
//  ============================================================================

import { LOGICAL_W, LOGICAL_H } from './engine.js';

const W = LOGICAL_W;
const H = LOGICAL_H;

// ----------------------------------------------------------------------------
//  main.pjs access helpers
// ----------------------------------------------------------------------------
const R = () => window.root;

// Coerce a perchance node / primitive to a plain value. Note: perchance item
// nodes expose `evaluateItem` and `getName` as GETTERS, not methods, and plain
// values come back as strings — so we probe defensively.
function V(n) {
  if (n == null) return '';
  if (typeof n === 'object') {
    try {
      const ev = n.evaluateItem;
      if (ev !== undefined && typeof ev !== 'function') return ev;
    } catch { /* noop */ }
    try { return String(n); } catch { return ''; }
  }
  return n;
}
function nodeId(n) {
  if (n == null) return '';
  try { const nm = n.getName; if (typeof nm === 'string' && nm) return nm; } catch { /* noop */ }
  return '';
}
function N(n, fallback = 0) {
  const v = Number(V(n));
  return Number.isFinite(v) ? v : fallback;
}
function B(n) { return V(n) === true || V(n) === 'true'; }

// Read a top-level `config` key from main.pjs (same contract as the shell).
function cfg(name, fallback) {
  const c = R() && R().config;
  if (!c) return fallback;
  const v = V(c[name]);
  return v === '' || v == null ? fallback : v;
}

// Pick one item from a perchance list (content lists live in main.pjs).
function pick(list) {
  if (!list) return '';
  try { return V(list.selectOne); } catch { return ''; }
}
function pickN(list, n) {
  const out = [];
  if (!list) return out;
  try { for (const it of list.selectMany(n)) out.push(V(it)); } catch { /* noop */ }
  return out;
}

// ----------------------------------------------------------------------------
//  Dice ("NdM±X") + a tiny seeded PRNG for deterministic dungeon layouts
// ----------------------------------------------------------------------------
function parseDice(str) {
  const m = String(str).match(/(\d*)d(\d+)([+-]\d+)?/i);
  if (!m) return { count: 1, sides: 6, flat: 0 };
  return {
    count: Math.max(1, Number(m[1]) || 1),
    sides: Math.max(1, Number(m[2]) || 1),
    flat: m[3] ? Number(m[3]) : 0,
  };
}
function rollDice(str, bonus = 0) {
  const d = parseDice(str);
  let total = d.flat + bonus;
  for (let i = 0; i < d.count; i++) total += 1 + Math.floor(Math.random() * d.sides);
  return Math.max(0, total);
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------------------
//  CLASSES — the four classic archetypes (content, so fork devs can rebalance)
//  base = starting attributes · hp/sp = starting maxes · ac = starting armor ·
//  toHit = base attack bonus · hpGrow = HP gained per level · spells = ids
// ----------------------------------------------------------------------------
const STAT_KEYS = ['str', 'int', 'wis', 'dex', 'con', 'chr'];
const STAT_LABELS = { str: 'STR', int: 'INT', wis: 'WIS', dex: 'DEX', con: 'CON', chr: 'CHR' };
const CLASSES = {
  warrior: { label: 'WARRIOR', base: { str: 16, int: 7, wis: 8, dex: 11, con: 15, chr: 10 }, hp: 16, sp: 0, ac: 2, toHit: 2, hpGrow: 8, spells: [] },
  rogue:   { label: 'ROGUE',   base: { str: 12, int: 10, wis: 9, dex: 16, con: 12, chr: 12 }, hp: 11, sp: 0, ac: 3, toHit: 2, hpGrow: 6, spells: [] },
  mage:    { label: 'MAGE',    base: { str: 8,  int: 16, wis: 12, dex: 10, con: 9,  chr: 9  }, hp: 6,  sp: 10, ac: 1, toHit: 0, hpGrow: 4, spells: ['fireBolt', 'frostWave'] },
  cleric:  { label: 'CLERIC',  base: { str: 11, int: 11, wis: 16, dex: 9,  con: 13, chr: 12 }, hp: 8,  sp: 8,  ac: 2, toHit: 1, hpGrow: 5, spells: ['cureWounds', 'greaterHeal', 'turnUndead'] },
};

const DIRS = [
  { dx: 0, dy: -1, name: 'NORTH' },  // 0 N
  { dx: 1, dy: 0,  name: 'EAST' },   // 1 E
  { dx: 0, dy: 1,  name: 'SOUTH' },  // 2 S
  { dx: -1, dy: 0, name: 'WEST' },   // 3 W
];
const DIR_LETTER = ['N', 'E', 'S', 'W'];

// Monster display name without a leading "THE" (so "THE GOBLIN"/"THE BLIND
// WIZARD" read correctly in log lines like "X HITS THE ...").
const tName = (m) => String(m.name).replace(/^THE\s+/i, '');

// ----------------------------------------------------------------------------
//  CONTENT — parsed once from main.pjs at init()
// ----------------------------------------------------------------------------
let CONTENT = null;

function parseContent() {
  const listN = (name) => R() && R()[name];
  const content = {
    firstNames: listN('firstName'),
    lastNames: listN('surname'),
    floorNames: listN('floorNames'),
    roomFlavor: listN('roomFlavor'),
    corridorFlavor: listN('corridorFlavor'),
    sceneryFlavor: listN('sceneryFlavor'),
    monsters: [],
    weapons: [],
    armors: [],
    potions: [],
    spells: {},
  };

  const ml = listN('monsters');
  if (ml && ml.selectAll) {
    for (const node of ml.selectAll) {
      content.monsters.push({
        id: nodeId(node),
        name: V(node.name),
        hpNode: node.hp,            // re-evaluated at spawn (keeps ranges random)
        hpMin: N(node.hpMin, 6),
        dmg: V(node.dmg) || '1d6',
        xp: N(node.xp, 30),
        goldNode: node.gold,
        level: N(node.level, 1),
        minFloor: N(node.minFloor, 1),
        undead: B(node.undead),
        boss: B(node.boss),
      });
    }
  }
  const wl = listN('weapons');
  if (wl && wl.selectAll) {
    for (const node of wl.selectAll) {
      content.weapons.push({
        id: nodeId(node),
        name: V(node.name),
        dmg: V(node.dmg) || '1d3',
        hit: N(node.hit, 0),
        minFloor: N(node.minFloor, 1),
      });
    }
  }
  const al = listN('armors');
  if (al && al.selectAll) {
    for (const node of al.selectAll) {
      content.armors.push({
        id: nodeId(node),
        name: V(node.name),
        ac: N(node.ac, 0),
        minFloor: N(node.minFloor, 1),
      });
    }
  }
  const pl = listN('potions');
  if (pl && pl.selectAll) {
    for (const node of pl.selectAll) {
      content.potions.push({
        id: nodeId(node),
        name: V(node.name),
        heal: V(node.heal),
        sp: V(node.sp),
      });
    }
  }
  const sl = listN('spells');
  if (sl && sl.selectAll) {
    for (const node of sl.selectAll) {
      content.spells[nodeId(node)] = {
        name: V(node.name),
        school: V(node.school) || 'mage',
        kind: V(node.kind) || 'damage',
        dmg: V(node.dmg) || '1d4',
        sp: N(node.sp, 2),
        target: V(node.target) || 'one',
        undeadOnly: B(node.undeadOnly),
        scaleLevel: B(node.scaleLevel),
      };
    }
  }
  return content;
}

function monsterById(id) { return (CONTENT.monsters.find((m) => m.id === id) || CONTENT.monsters[0]); }
function weaponById(id) { return (CONTENT.weapons.find((w) => w.id === id) || null); }
function armorById(id) { return (CONTENT.armors.find((a) => a.id === id) || null); }

// Monsters that can appear on a floor (non-boss), plus the boss for floor 4.
function poolForFloor(floor) {
  return CONTENT.monsters.filter((m) => m.minFloor <= floor && !m.boss);
}

// ----------------------------------------------------------------------------
//  Characters
// ----------------------------------------------------------------------------
function makeCharacter(clsId, firstName, lastName, slot) {
  const cls = CLASSES[clsId];
  const stats = { ...cls.base };
  const hp = cls.hp;
  return {
    slot,
    name: (firstName + ' ' + lastName).toUpperCase(),
    cls: clsId,
    stats,
    level: 1,
    xp: 0,
    hp,
    maxHp: hp,
    sp: cls.sp,
    maxSp: cls.sp,
    weapon: null,
    armor: null,
  };
}
function strMod(m) { return Math.floor((m.stats.str - 10) / 2); }
function dexMod(m) { return Math.floor((m.stats.dex - 10) / 2); }
function conMod(m) { return Math.floor((m.stats.con - 10) / 2); }
function intMod(m) { return Math.floor((m.stats.int - 10) / 2); }
function wisMod(m) { return Math.floor((m.stats.wis - 10) / 2); }

function totalAC(m) {
  return CLASSES[m.cls].ac + (m.armor ? m.armor.ac : 0) + dexMod(m);
}
function toHit(m) {
  return CLASSES[m.cls].toHit + m.level + (m.weapon ? m.weapon.hit : 0);
}
function dmgStr(m) {
  return m.weapon ? m.weapon.dmg : '1d3';
}
function weaponValue(m) {
  const d = parseDice(dmgStr(m));
  return d.count * (d.sides + 1) / 2 + d.flat;
}
function isAlive(m) { return m.hp > 0; }

function xpForLevel(level) {
  const base = N(cfg('xpBase', 100), 100);
  return Math.round(base * level * (level + 1) / 2);
}
function xpToNext(m) { return xpForLevel(m.level) - xpForLevel(m.level - 1); }

function spellsFor(m) {
  return (CLASSES[m.cls].spells || []).map((id) => CONTENT.spells[id]).filter(Boolean);
}

// ----------------------------------------------------------------------------
//  Dungeon generation  (deterministic per seed+floor)
//  Tiles: 0 wall · 1 floor · 2 entrance · 3 stairs down · 4 stairs up
// ----------------------------------------------------------------------------
const MAP_W = 24;
const MAP_H = 24;

function genDungeon(seed, floor, floorsTotal, rng) {
  const tiles = [];
  for (let y = 0; y < MAP_H; y++) tiles.push(new Array(MAP_W).fill(0));
  const inRoom = [];
  for (let y = 0; y < MAP_H; y++) inRoom.push(new Array(MAP_W).fill(false));
  const roomOf = [];
  for (let y = 0; y < MAP_H; y++) roomOf.push(new Array(MAP_W).fill(-1));

  const rooms = [];
  let attempts = 0;
  const target = 8 + Math.floor(rng() * 3);
  while (rooms.length < target && attempts++ < 400) {
    const rw = 3 + Math.floor(rng() * 3);
    const rh = 3 + Math.floor(rng() * 3);
    const x = 1 + Math.floor(rng() * (MAP_W - rw - 2));
    const y = 1 + Math.floor(rng() * (MAP_H - rh - 2));
    if (rooms.some((r) => x < r.x + r.w + 1 && x + rw + 1 > r.x && y < r.y + r.h + 1 && y + rh + 1 > r.y)) continue;
    rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
  }
  rooms.forEach((r, rid) => {
    for (let yy = r.y; yy < r.y + r.h; yy++) {
      for (let xx = r.x; xx < r.x + r.w; xx++) {
        tiles[yy][xx] = 1;
        inRoom[yy][xx] = true;
        roomOf[yy][xx] = rid;
      }
    }
  });
  // L-shaped corridors between consecutive rooms.
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    const horiz = rng() < 0.5;
    carveL(tiles, a.cx, a.cy, b.cx, b.cy, horiz);
  }
  // A few extra loops so the map is less linear.
  for (let i = 0; i < 3; i++) {
    const a = rooms[Math.floor(rng() * rooms.length)];
    const b = rooms[Math.floor(rng() * rooms.length)];
    if (a === b) continue;
    carveL(tiles, a.cx, a.cy, b.cx, b.cy, rng() < 0.5);
  }

  // Entry = first room (nearest top-left), down = farthest room.
  let entry = rooms[0];
  for (const r of rooms) if (r.cy < entry.cy) entry = r;
  const entryDist = (r) => Math.abs(r.cx - entry.cx) + Math.abs(r.cy - entry.cy);
  let far = rooms[0];
  for (const r of rooms) if (entryDist(r) > entryDist(far)) far = r;

  const dungeon = {
    tiles,
    inRoom,
    rooms,
    roomOf,                         // "x,y" -> room index (-1 = not in a room)
    entry: { x: entry.cx, y: entry.cy },
    down: null,
    boss: null,
    guards: new Map(),              // room index -> [monster ids]
    chests: new Map(),              // "x,y" -> true (a specific tile inside a room)
  };

  const entryTile = floor > 1 ? 4 : 2;
  tiles[entry.cy][entry.x] = entryTile;

  if (floor < floorsTotal) {
    dungeon.down = { x: far.cx, y: far.cy };
    tiles[far.cy][far.x] = 3;
  } else {
    dungeon.boss = { x: far.cx, y: far.cy };
  }

  // Place monsters in rooms (guards) & chests — skip entry & the down/boss room.
  const skip = new Set([rooms.indexOf(entry), rooms.indexOf(far)]);
  const pool = poolForFloor(floor);
  rooms.forEach((r, rid) => {
    if (skip.has(rid)) return;
    if (rng() < 0.75) {
      const count = rng() < 0.3 ? 2 : 1;
      const group = [];
      for (let i = 0; i < count; i++) {
        const m = pool.length ? pool[Math.floor(rng() * pool.length)] : null;
        if (m) group.push(m.id);
      }
      if (group.length) dungeon.guards.set(rid, group);
    }
    if (rng() < 0.5) {
      const cx = r.x + Math.floor(rng() * r.w);
      const cy = r.y + Math.floor(rng() * r.h);
      dungeon.chests.set(key(cx, cy), true);
    }
  });

  // Boss lair guards on the final floor.
  if (dungeon.boss) {
    dungeon.guards.set(rooms.indexOf(far), ['blindWizard', 'mummy', 'mummy']);
  }
  return dungeon;
}

function carveL(tiles, x1, y1, x2, y2, horizFirst) {
  if (horizFirst) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) tiles[y1][x] = 1;
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) tiles[y][x2] = 1;
  } else {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) tiles[y][x1] = 1;
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) tiles[y2][x] = 1;
  }
}
function key(x, y) { return x + ',' + y; }

// ----------------------------------------------------------------------------
//  Terminal (canvas text) — scene box + scrolling typed log + menu bar
// ----------------------------------------------------------------------------
const FONT = '8px "Press Start 2P", monospace';
const FONT_BIG = '10px "Press Start 2P", monospace';
const LINE_H = 10;

const PANEL_X = 8;
const PANEL_W = 348;
const SCENE_Y = 26;
const SCENE_MAX = 4;                 // content lines (plus a title line)
const LOG_Y = 88;
const LOG_MAX = 14;                  // log lines on screen
const MENU_Y = 244;

const MAP_X = 364;
const MAP_Y = 24;
const MAP_TILE = 10;
const MAP_SPAN = 4;                  // tiles visible each side of the player

const C_GOLD = '#ffd23e';
const C_CYAN = '#2de1ff';
const C_GREEN = '#39ff6e';
const C_RED = '#ff5a4e';
const C_MAG = '#ff2d95';
const C_WHITE = '#f2eeff';
const C_DIM = '#8b84ad';
const C_PANEL = 'rgba(45,225,255,0.10)';
const C_PANEL_BR = 'rgba(45,225,255,0.35)';

let charW = 8;

let sceneLines = [];                 // [{t, c}] runs
let logLines = [];                   // array of {text, color} fully-revealed lines
let typing = null;                   // {text, color, runs, idx, timer}
let typingQueue = [];

function colsAvailable() { return Math.floor((PANEL_W - 8) / charW); }

function wrapText(text, maxCols) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > maxCols) { lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function setScene(title, lines) {
  sceneLines = [];
  if (title) sceneLines.push({ t: title, c: C_CYAN });
  for (const l of lines) {
    for (const wl of wrapText(l, colsAvailable())) sceneLines.push({ t: wl, c: C_WHITE });
  }
}
function log(text, color) {
  typingQueue.push({ text, color: color || C_WHITE });
}
function flushLog() {
  while (typingQueue.length) {
    const m = typingQueue.shift();
    for (const wl of wrapText(m.text, colsAvailable())) logLines.push({ t: wl, c: m.color });
  }
  trimLog();
}
function trimLog() {
  while (logLines.length > LOG_MAX * 3) logLines.shift();
}

function updateTyping(dt) {
  if (!typing && typingQueue.length) {
    const m = typingQueue.shift();
    typing = { text: m.text, color: m.color, runs: wrapText(m.text, colsAvailable()), idx: 0, timer: 0 };
  }
  if (!typing) return false;
  const speed = N(cfg('typeSpeed', 0.016), 0.016);
  typing.timer -= dt;
  while (typing.timer <= 0) {
    typing.timer += speed;
    typing.idx++;
    if (typing.idx >= typing.text.length) {
      for (const l of typing.runs) logLines.push({ t: l, c: typing.color });
      trimLog();
      typing = null;
      return false;
    }
  }
  return true;
}
function skipTyping() {
  if (!typing) return false;
  for (const l of typing.runs) logLines.push({ t: l, c: typing.color });
  trimLog();
  typing = null;
  return true;
}

// ----------------------------------------------------------------------------
//  Menus (bottom bar) + shared input snapshot
// ----------------------------------------------------------------------------
let menuItems = [];                  // [{k, l}]
let menuHint = '';

function setMenu(items, hint) {
  menuItems = items || [];
  menuHint = hint || '';
}

// One input pass per animation frame: the engine can call update() up to 8× in
// a single frame (fixed-timestep catch-up), so edges must only be read once.
let frameInputDone = false;
function snapshotInput(inp) {
  const s = {
    up: inp.pressed('up'), down: inp.pressed('down'),
    left: inp.pressed('left'), right: inp.pressed('right'),
    conf: inp.pressed('confirm'),
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => inp.pressed('d' + d)),
    anyDigit: false,
    holdUp: inp.isDown('up'), holdDown: inp.isDown('down'),
    holdLeft: inp.isDown('left'), holdRight: inp.isDown('right'),
  };
  s.anyDigit = s.digits.some(Boolean);
  return s;
}

// ----------------------------------------------------------------------------
//  Game state
// ----------------------------------------------------------------------------
let ctxGame = null;                  // the shell's game context
let mode = 'boot';                   // 'load' | 'create' | 'explore' | 'char' | 'combat'
let sub = null;                      // 'actions' sub-menu in explore; pick phase in combat

let seed = 0;
let floor = 1;
let px = 0, py = 0;
let facing = 0;
let turns = 0;
let gold = 0;
let party = [];
let inventory = {};                  // potionId -> count
let explored = [];                   // per floor: array of bools
let guardsDead = new Set();          // "floor:x,y"
let chestsOpen = new Set();          // "floor:x,y"
let dungeons = {};                   // floor -> generated dungeon
let combat = null;
let victory = false;
let pendingGameOverAt = null;

let createSel = 0;
let lastMoveKey = null, repeatTimer = 0;
let cursorBlink = 0;

// ----------------------------------------------------------------------------
//  Saving
// ----------------------------------------------------------------------------
function saveGame() {
  const keyName = cfg('saveKey', 'vgn-text-rpg-save');
  try {
    const data = {
      v: 1, seed, floor, px, py, facing, turns, gold,
      party: party.map((m) => ({
        name: m.name, cls: m.cls, slot: m.slot, level: m.level, xp: m.xp,
        hp: m.hp, sp: m.sp, maxHp: m.maxHp, maxSp: m.maxSp,
        stats: m.stats, weapon: m.weapon ? m.weapon.id : null, armor: m.armor ? m.armor.id : null,
      })),
      inventory,
      explored: explored.map((f) => f.map((row) => row.map((b) => b ? 1 : 0).join('')).join('')),
      guardsDead: [...guardsDead],
      chestsOpen: [...chestsOpen],
    };
    localStorage.setItem(keyName, JSON.stringify(data));
  } catch { /* storage full / unavailable — ignore */ }
}
function hasSave() {
  try { return !!localStorage.getItem(cfg('saveKey', 'vgn-text-rpg-save')); }
  catch { return false; }
}
function wipeSave() {
  try { localStorage.removeItem(cfg('saveKey', 'vgn-text-rpg-save')); } catch { /* noop */ }
}
function loadGame() {
  const keyName = cfg('saveKey', 'vgn-text-rpg-save');
  try {
    const raw = localStorage.getItem(keyName);
    if (!raw) return false;
    const d = JSON.parse(raw);
    seed = d.seed; floor = d.floor; px = d.px; py = d.py; facing = d.facing;
    turns = d.turns; gold = d.gold;
    party = d.party.map((p, i) => {
      const cls = CLASSES[p.cls];
      return {
        name: p.name, cls: p.cls,
        slot: p.slot != null ? p.slot : i,
        level: p.level, xp: p.xp, hp: p.hp, sp: p.sp,
        stats: p.stats,
        // maxHp/maxSp were not saved by early builds — recompute a close value
        maxHp: p.maxHp != null ? p.maxHp
          : (cls.hp + (p.level - 1) * (cls.hpGrow + Math.max(1, Math.floor((p.stats.con - 10) / 2)) + 1)),
        maxSp: p.maxSp != null ? p.maxSp
          : (cls.sp > 0 ? cls.sp + (p.level - 1) * (2 + Math.max(1, Math.floor((p.stats.int - 10) / 2))) : 0),
        weapon: weaponById(p.weapon), armor: armorById(p.armor),
      };
    });
    inventory = d.inventory || {};
    explored = (d.explored || []).map((fstr) => {
      const rows = [];
      for (let y = 0; y < MAP_H; y++) {
        const row = [];
        for (let x = 0; x < MAP_W; x++) row.push(fstr[y * MAP_W + x] === '1');
        rows.push(row);
      }
      return rows;
    });
    guardsDead = new Set(d.guardsDead || []);
    chestsOpen = new Set(d.chestsOpen || []);
    ensureFloor(floor);
    victory = false;
    return true;
  } catch { return false; }
}

function ensureFloor(f) {
  while (explored.length <= f) {
    const arr = [];
    for (let y = 0; y < MAP_H; y++) arr.push(new Array(MAP_W).fill(false));
    explored.push(arr);
  }
  if (!dungeons[f]) {
    const rng = mulberry32((seed * 7919 + f * 104729) >>> 0);
    dungeons[f] = genDungeon(seed, f, totalFloors(), rng);
  }
}
function totalFloors() { return Math.max(1, N(cfg('dungeonFloors', 4), 4)); }
function dungeon() { return dungeons[floor]; }
function tileAt(x, y) {
  const d = dungeon();
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 0;
  return d.tiles[y][x];
}
function reveal(x, y) {
  const f = explored[floor];
  if (!f || x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
  f[y][x] = true;
  for (const d of DIRS) {
    const nx = x + d.dx, ny = y + d.dy;
    if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H && tileAt(nx, ny) !== 0) f[ny][nx] = true;
  }
}
function isRoomTile(x, y) {
  const d = dungeon();
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  return d.inRoom[y][x];
}

// ----------------------------------------------------------------------------
//  Scenes & description
// ----------------------------------------------------------------------------
function floorTitle() {
  const names = CONTENT.floorNames;
  if (names) {
    const all = names.selectAll || [];
    if (all.length) return V(all[Math.min(floor, all.length) - 1]);
  }
  return 'FLOOR ' + floor;
}

function describe() {
  const t = tileAt(px, py);
  const lines = [];
  if (t === 2) lines.push('THE ENTRANCE TO THE DUNGEON. STAIRS... NO. A GRATE. THE ONLY WAY IS DOWN.');
  const flavor = isRoomTile(px, py) ? pick(CONTENT.roomFlavor) : pick(CONTENT.corridorFlavor);
  lines.push('YOU STAND IN ' + String(flavor).toLowerCase() + '.');
  const exits = [];
  DIRS.forEach((d, i) => { if (tileAt(px + d.dx, py + d.dy) !== 0) exits.push(DIR_LETTER[i]); });
  lines.push('EXITS: ' + (exits.join(' ') || 'NONE'));
  if (t === 3) lines.push('STONE STAIRS PLUNGE DOWNWARD.');
  if (t === 4) lines.push('CRUMBLING STAIRS LEAD BACK UPWARD.');
  const ck = key(px, py);
  if (dungeon().chests.has(ck) && !chestsOpen.has(floorKey(ck))) lines.push('A BANDED CHEST SITS IN THE CORNER.');
  if (Math.random() < 0.6) {
    const s = pick(CONTENT.sceneryFlavor);
    if (s) lines.push(String(s).toUpperCase());
  }
  setScene(floorTitle() + '  ·  ' + (exits.join(' ') || '·'), lines.slice(0, SCENE_MAX));
}

function floorKey(k) { return floor + ':' + k; }

// ----------------------------------------------------------------------------
//  Combat
// ----------------------------------------------------------------------------
function spawnMonster(m, floorNum) {
  const scale = 1 + 0.3 * Math.max(0, floorNum - m.minFloor);
  const hp = Math.round(Math.max(m.hpMin, N(m.hpNode, 8)) * scale);
  return {
    id: m.id,
    name: m.name,
    hp, maxHp: hp,
    dmg: m.dmg,
    dmgBonus: Math.max(0, floorNum - m.minFloor),
    xp: Math.round(m.xp * (1 + 0.2 * Math.max(0, floorNum - m.minFloor))),
    gold: N(m.goldNode, 0),
    undead: m.undead,
    level: m.level + Math.max(0, floorNum - m.minFloor),
    boss: m.boss,
    alive: true,
  };
}

function startCombat(ids, blocked) {
  const mons = ids.map((id) => spawnMonster(monsterById(id), floor));
  combat = {
    monsters: mons,
    round: 0,
    phase: 'start',
    memberIdx: -1,
    actions: [],
    blocked,
    pending: null,       // {type, after}
    sourceKey: null,
  };
  mode = 'combat';
  sub = null;
  const names = mons.map((m) => m.name).join(' AND ');
  setScene('ENCOUNTER!', [names + ' ATTACK' + (mons.length > 1 ? '' : 'S') + '!']);
  log('A BATTLE BEGINS!', C_MAG);
  if (blocked) log('THERE IS NO WAY TO FLEE.', C_DIM);
  ctxGame.audio.sfx('encounter');
  ctxGame.audio.setMusicTheme('combat');
  menuFor();
  refreshHud();
}

function endCombat(won) {
  if (!combat) return;
  ctxGame.audio.setMusicTheme('explore');
  if (won) {
    const src = combat.sourceKey;
    if (src) guardsDead.add(floorKey(src));
    log('THE WAY IS CLEAR.', C_GREEN);
  }
  combat = null;
  mode = 'explore';
  sub = null;
  describe();
  saveGame();
}

function combatTitle() {
  return 'ROUND ' + (combat.round + 1);
}

function livingMonsters() { return combat.monsters.filter((m) => m.alive); }
function livingParty() { return party.filter(isAlive); }
function firstLivingMember() {
  for (let i = 0; i < party.length; i++) if (isAlive(party[i])) return i;
  return -1;
}

function hpBar(g, x, y, w, frac, filledC, emptyC) {
  const bars = Math.max(1, Math.round(w * frac));
  for (let i = 0; i < w; i++) {
    g.fillStyle = i < bars ? filledC : (emptyC || 'rgba(255,255,255,0.12)');
    g.fillRect(x + i * 6, y, 5, 5);
  }
}

function monsterStr(m) {
  const pct = Math.max(0, m.hp / m.maxHp);
  const bar = pct >= 1 ? '▮▮▮▮▮' : pct > 0.75 ? '▮▮▮▮░' : pct > 0.5 ? '▮▮▮░░' : pct > 0.25 ? '▮▮░░░' : '▮░░░░';
  return m.name + '  HP ' + m.hp + '/' + m.maxHp + ' ' + bar;
}

// Player action resolution (runs in slot order), then monsters attack.
function resolveRound() {
  const round = combat.round + 1;
  combat.round = round;
  turns++;
  setScene('ROUND ' + round, ['THE PARTY ACTS...']);

  // 1. Party acts.
  for (let i = 0; i < party.length; i++) {
    const m = party[i];
    const a = combat.actions[i];
    if (!a || !isAlive(m)) continue;
    if (a.type === 'attack') resolveAttack(m, a.target);
    else if (a.type === 'spell') resolveSpell(m, a);
    else if (a.type === 'guard') log(m.name.split(' ')[0] + ' GUARDS.', C_DIM);
  }

  // 2. Monsters attack.
  const aliveMons = livingMonsters();
  if (aliveMons.length) {
    for (const mon of aliveMons) {
      const targets = livingParty();
      if (!targets.length) break;
      const target = targets[Math.floor(Math.random() * targets.length)];
      monsterAttack(mon, target);
      if (!livingParty().length) break;
    }
  }

  // 3. End conditions.
  if (!livingParty().length) {
    setScene('THE PARTY HAS FALLEN', ['ALL HEROES ARE DEAD. THE DUNGEON CLAIMS ANOTHER PARTY...']);
    log('EVERY HERO HAS FALLEN.', C_RED);
    pendingGameOverAt = ctxGame.wallTime() + 2.2;
    return;
  }
  if (!livingMonsters().length) {
    const bossDied = combat.monsters.some((m) => m.boss);
    setScene('VICTORY!', ['THE LAST MONSTER COLLAPSES.']);
    endCombat(true);
    if (bossDied) {
      victory = true;
      setScene('THE BLIND WIZARD IS DESTROYED', ['THE DUNGEON FALLS SILENT. THE QUEST IS COMPLETE.']);
      log('★ THE DUNGEON IS DELIVERED FROM THE BLIND WIZARD! ★', C_GOLD);
      ctxGame.audio.sfx('victory');
      pendingGameOverAt = ctxGame.wallTime() + 3.5;
    } else {
      ctxGame.audio.sfx('levelup');
    }
    return;
  }

  // 4. Next round.
  combat.actions = new Array(party.length).fill(null);
  combat.memberIdx = firstLivingMember();
  combat.phase = 'pick';
  combat.pending = null;
  combatMenu();
  refreshHud();
}

function resolveAttack(m, targetIdx) {
  const target = combat.monsters[targetIdx];
  if (!target || !target.alive) return;
  const name = m.name.split(' ')[0];
  const crit = Math.random() < 0.05;
  const hit = Math.random() < clamp(0.55 + (toHit(m) - target.level) * 0.05, 0.15, 0.95);
  ctxGame.audio.sfx(crit && hit ? 'crit' : 'hit');
  if (!hit) { log(name + ' MISSES THE ' + tName(target) + '!', C_DIM); return; }
  let dmg = rollDice(dmgStr(m), strMod(m));
  if (crit) dmg *= 2;
  target.hp -= dmg;
  target.alive = target.hp > 0;
  log(name + ' ' + (crit ? 'LANDS A CRITICAL BLOW ON' : 'HITS') + ' THE ' + tName(target) + ' FOR ' + dmg + '.', C_WHITE);
  if (!target.alive) killMonster(target);
}

function killMonster(target) {
  target.alive = false;
  log('THE ' + tName(target) + ' IS SLAIN!  +' + target.xp + ' XP  +' + target.gold + ' GOLD', C_GOLD);
  gold += target.gold;
  ctxGame.hud.setScore(gold);
  for (const m of party) if (isAlive(m)) gainXp(m, target.xp);
  ctxGame.audio.sfx(target.boss ? 'victory' : 'coin');
}

function gainXp(m, amount) {
  m.xp += amount;
  let leveled = false;
  while (m.xp >= xpForLevel(m.level) && m.level < 20) {
    levelUp(m);
    leveled = true;
  }
  if (leveled) {
    log(m.name.split(' ')[0] + ' ADVANCES TO LEVEL ' + m.level + '!', C_GREEN);
    ctxGame.audio.sfx('levelup');
  }
}

function levelUp(m) {
  m.level++;
  const cls = CLASSES[m.cls];
  const hpGain = cls.hpGrow + Math.max(1, conMod(m)) + Math.floor(Math.random() * 3);
  m.maxHp += hpGain;
  m.hp += hpGain;
  if (cls.sp > 0) {
    const spGain = 2 + Math.max(1, intMod(m));
    m.maxSp += spGain;
    m.sp += spGain;
  }
  // +1 to a relevant attribute (spellcasters: int/wis, others: str/con/dex).
  const keys = m.cls === 'mage' ? ['int', 'wis'] : m.cls === 'cleric' ? ['wis', 'int'] : ['str', 'con', 'dex'];
  const k = keys[Math.floor(Math.random() * keys.length)];
  m.stats[k]++;
}

function resolveSpell(m, a) {
  const sp = CONTENT.spells[a.spellId];
  if (!sp) return;
  const name = m.name.split(' ')[0];
  m.sp = Math.max(0, m.sp - sp.sp);        // SP is spent when the spell resolves
  const bonus = sp.scaleLevel ? m.level : 0;
  ctxGame.audio.sfx('spell');
  if (sp.kind === 'heal') {
    const targets = livingParty();
    if (!targets.length) return;
    let t = targets[0];
    for (const x of targets) if (x.hp / x.maxHp < t.hp / t.maxHp) t = x;
    const heal = rollDice(sp.dmg, bonus);
    t.hp = Math.min(t.maxHp, t.hp + heal);
    log(name + ' CALLS FORTH ' + sp.name + ' — ' + t.name.split(' ')[0] + ' RECOVERS ' + heal + ' HP.', C_GREEN);
    return;
  }
  // damage
  const targets = livingMonsters();
  if (sp.undeadOnly) {
    const undead = targets.filter((t) => t.undead);
    if (!undead.length) { log(sp.name + ' FADES — NO UNDEAD ARE PRESENT.', C_DIM); return; }
    for (const t of undead) {
      const dmg = rollDice(sp.dmg, bonus);
      t.hp -= dmg; t.alive = t.hp > 0;
      log(name + ' SMITES THE ' + t.name + ' FOR ' + dmg + '.', C_CYAN);
      if (!t.alive) killMonster(t);
    }
    return;
  }
  const list = sp.target === 'all' ? targets : [targets[a.target || 0]].filter(Boolean);
  for (const t of list) {
    if (!t.alive) continue;
    const dmg = rollDice(sp.dmg, bonus);
    t.hp -= dmg; t.alive = t.hp > 0;
    log(name + '\'S ' + sp.name + ' BLASTS THE ' + t.name + ' FOR ' + dmg + '.', C_CYAN);
    if (!t.alive) killMonster(t);
  }
}

function monsterAttack(mon, target) {
  const hit = Math.random() < clamp(0.5 + (mon.level - target.level) * 0.05 - totalAC(target) * 0.03, 0.1, 0.9);
  if (!hit) { log('THE ' + tName(mon) + ' MISSES ' + target.name.split(' ')[0] + '.', C_DIM); return; }
  const dmg = rollDice(mon.dmg, mon.dmgBonus);
  target.hp -= dmg;
  log('THE ' + tName(mon) + ' HITS ' + target.name.split(' ')[0] + ' FOR ' + dmg + '.', C_RED);
  ctxGame.audio.sfx('hurt');
  if (target.hp <= 0) {
    target.hp = 0;
    log(target.name.split(' ')[0] + ' HAS FALLEN!', C_RED);
    ctxGame.audio.sfx('death');
  }
}

// Combat menu (rebuilt per phase).
function combatMenu() {
  const c = combat;
  if (c.phase === 'start') {
    setMenu([{ k: 1, l: 'FIGHT' }, { k: 2, l: 'FLEE' }], 'PRESS 1 TO FIGHT, 2 TO FLEE');
  } else if (c.phase === 'pick') {
    const m = party[c.memberIdx];
    setMenu([{ k: 1, l: 'ATTACK' }, { k: 2, l: 'SPELL' }, { k: 3, l: 'ITEM' }, { k: 4, l: 'GUARD' }],
      m.name.split(' ')[0] + ' — CHOOSE ACTION');
  } else if (c.phase === 'round') {
    setMenu([{ k: 1, l: 'END ROUND' }, { k: 2, l: 'FLEE' }], 'PRESS 1 TO RESOLVE THE ROUND');
  } else if (c.phase === 'target') {
    const items = livingMonsters().map((m, i) => ({ k: i + 1, l: m.name }));
    setMenu([...items, { k: 0, l: 'BACK' }], 'CHOOSE TARGET');
  } else if (c.phase === 'spell') {
    const m = party[c.memberIdx];
    const spells = spellsFor(m);
    setMenu(spells.map((s, i) => ({ k: i + 1, l: s.name + ' (' + s.sp + 'SP)' })).concat({ k: 0, l: 'BACK' }),
      m.name.split(' ')[0] + ' — CHOOSE SPELL  (SP ' + m.sp + '/' + m.maxSp + ')');
  } else if (c.phase === 'item') {
    const pots = potionList();
    setMenu(pots.map((p, i) => ({ k: i + 1, l: p.name + ' x' + inventory[p.id] })).concat({ k: 0, l: 'BACK' }),
      'CHOOSE POTION');
  } else if (c.phase === 'memberpick') {
    const list = livingParty();
    setMenu(list.map((m, i) => ({ k: i + 1, l: m.name.split(' ')[0] + ' ' + m.hp + '/' + m.maxHp })).concat({ k: 0, l: 'BACK' }),
      'WHO DRINKS IT?');
  }
}
function potionList() {
  return CONTENT.potions.filter((p) => (inventory[p.id] || 0) > 0);
}

function doCombatDigit(d) {
  const c = combat;
  if (!c) return;
  if (c.phase === 'start') {
    if (d === 1) advanceToPick();
    else if (d === 2) tryFlee(true);
  } else if (c.phase === 'pick') {
    const m = party[c.memberIdx];
    if (d === 1) {
      const mons = livingMonsters();
      if (mons.length === 1) assignAction({ type: 'attack', target: combat.monsters.indexOf(mons[0]) });
      else { c.pending = { type: 'attack' }; c.phase = 'target'; combatMenu(); }
    } else if (d === 2) {
      const spells = spellsFor(m);
      const usable = spells.filter((s) => s.sp <= m.sp);
      if (!usable.length) { log(m.name.split(' ')[0] + ' CANNOT CAST — NO USABLE SPELLS.', C_DIM); return; }
      c.phase = 'spell'; combatMenu();
    } else if (d === 3) {
      if (!potionList().length) { log('NO POTIONS LEFT.', C_DIM); return; }
      c.phase = 'item'; combatMenu();
    } else if (d === 4) {
      assignAction({ type: 'guard' });
    }
  } else if (c.phase === 'round') {
    if (d === 1) resolveRound();
    else if (d === 2) tryFlee(false);
  } else if (c.phase === 'target') {
    if (d === 0) { c.phase = 'pick'; combatMenu(); return; }
    const mons = livingMonsters();
    const t = mons[d - 1];
    if (!t) return;
    if (c.pending && c.pending.type === 'spell') assignAction({ type: 'spell', spellId: c.pending.spellId, target: combat.monsters.indexOf(t) });
    else assignAction({ type: 'attack', target: combat.monsters.indexOf(t) });
  } else if (c.phase === 'spell') {
    if (d === 0) { c.phase = 'pick'; combatMenu(); return; }
    const m = party[c.memberIdx];
    const spells = spellsFor(m);
    const s = spells[d - 1];
    if (!s) return;
    if (s.sp > m.sp) { log('NOT ENOUGH SP.', C_DIM); return; }
    if (s.target === 'one' && s.kind === 'damage' && livingMonsters().length > 1) {
      c.pending = { type: 'spell', spellId: idOfSpell(m, s) };
      c.phase = 'target'; combatMenu();
    } else {
      assignAction({ type: 'spell', spellId: idOfSpell(m, s) });
    }
  } else if (c.phase === 'item') {
    if (d === 0) { c.phase = 'pick'; combatMenu(); return; }
    const pots = potionList();
    const p = pots[d - 1];
    if (!p) return;
    c.pending = { type: 'item', potion: p };
    c.phase = 'memberpick'; combatMenu();
  } else if (c.phase === 'memberpick') {
    const list = livingParty();
    if (d === 0) { c.phase = 'item'; combatMenu(); return; }
    const m = list[d - 1];
    if (!m) return;
    const p = c.pending.potion;
    inventory[p.id]--;
    if (p.heal) { const heal = rollDice(p.heal); m.hp = Math.min(m.maxHp, m.hp + heal); log(m.name.split(' ')[0] + ' DRINKS THE ' + p.name + ' — HEALS ' + heal + '.', C_GREEN); }
    if (p.sp) { const sp = rollDice(p.sp); m.sp = Math.min(m.maxSp, m.sp + sp); log(m.name.split(' ')[0] + ' DRINKS THE ' + p.name + ' — RESTORES ' + sp + ' SP.', C_CYAN); }
    ctxGame.audio.sfx('heal');
    c.pending = null;
    assignAction({ type: 'item' });          // this member's action is "used an item"
  }
}

function idOfSpell(m, s) {
  return CLASSES[m.cls].spells.find((id) => CONTENT.spells[id] === s);
}

function assignAction(a) {
  combat.actions[combat.memberIdx] = a;
  const next = nextMemberIndex(combat.memberIdx);
  if (next === -1) {
    combat.phase = 'round';
    combat.memberIdx = -1;
  } else {
    combat.phase = 'pick';           // back to the action menu for the next hero
    combat.memberIdx = next;
  }
  combatMenu();
}
function nextMemberIndex(fromIdx) {
  for (let i = (fromIdx + 1) % party.length; i !== fromIdx; i = (i + 1) % party.length) {
    if (isAlive(party[i]) && !combat.actions[i]) return i;   // skip members who already acted
  }
  return -1;
}
function advanceToPick() {
  combat.actions = new Array(party.length).fill(null);
  combat.memberIdx = firstLivingMember();
  if (combat.memberIdx === -1) { ctxGame.gameOver(); return; }
  combat.phase = 'pick';
  combat.pending = null;
  combatMenu();
  refreshHud();
}
function tryFlee(fromStart) {
  if (combat.blocked) {
    log('THE WAY IS BLOCKED — THERE IS NO ESCAPE!', C_RED);
    ctxGame.audio.sfx('bump');
    if (!fromStart) return;
  }
  if (Math.random() < N(cfg('fleeChance', 0.65), 0.65)) {
    log('YOU FLEE INTO THE DARKNESS!', C_CYAN);
    ctxGame.audio.sfx('flee');
    combat = null;
    mode = 'explore';
    sub = null;
    describe();
    return;
  }
  log('THE ESCAPE FAILS!', C_RED);
  if (!fromStart) resolveRound(); else advanceToPick();
}

// ----------------------------------------------------------------------------
//  Exploration actions
// ----------------------------------------------------------------------------
function step(dx, dy) {
  const nx = px + dx, ny = py + dy;
  const t = tileAt(nx, ny);
  if (t === 0) {
    log('A WALL OF STONE BLOCKS THE WAY.', C_DIM);
    ctxGame.audio.sfx('bump');
    return;
  }
  px = nx; py = ny;
  turns++;
  reveal(px, py);
  ctxGame.audio.sfx('move');
  const tile = tileAt(px, py);
  if (tile === 3) { descend(); return; }
  if (tile === 4) { ascend(); return; }
  describe();
  checkEnterEncounter();
  refreshHud();
}

function checkEnterEncounter() {
  const d = dungeon();
  // Room guards (persistent) — keyed by the room you're standing in.
  const rid = d.roomOf[py][px];
  if (rid >= 0 && d.guards.has(rid) && !guardsDead.has(floorKey('r' + rid))) {
    startCombat(d.guards.get(rid), true);
    combat.sourceKey = 'r' + rid;
    return;
  }
  // Random ambush.
  const chance = isRoomTile(px, py) ? N(cfg('roomEncounter', 0.4), 0.4) : N(cfg('wanderEncounter', 0.14), 0.14);
  if (Math.random() < chance) {
    const pool = poolForFloor(floor);
    if (pool.length) {
      const ids = [pool[Math.floor(Math.random() * pool.length)].id];
      if (Math.random() < 0.25 && pool.length > 1) ids.push(pool[Math.floor(Math.random() * pool.length)].id);
      startCombat(ids, false);
    }
  }
}

function descend() {
  if (floor >= totalFloors()) return;
  floor++;
  facing = 0;
  ensureFloor(floor);
  const d = dungeon();
  px = d.entry.x; py = d.entry.y;
  reveal(px, py);
  turns++;
  log('YOU DESCEND THE CRUMBLING STAIRS...', C_MAG);
  ctxGame.audio.sfx('stairs');
  describe();
  saveGame();
  refreshHud();
}
function ascend() {
  if (floor <= 1) return;
  floor--;
  ensureFloor(floor);
  if (dungeon().down) { px = dungeon().down.x; py = dungeon().down.y; }
  else { px = dungeon().entry.x; py = dungeon().entry.y; }
  reveal(px, py);
  turns++;
  log('YOU CLIMB BACK UPWARD...', C_MAG);
  ctxGame.audio.sfx('stairs');
  describe();
  saveGame();
  refreshHud();
}

function doSearch() {
  turns++;
  ctxGame.audio.sfx('search');
  const d = dungeon();
  const ck = key(px, py);
  if (d.chests.has(ck) && !chestsOpen.has(floorKey(ck))) {
    chestsOpen.add(floorKey(ck));
    log('YOU PRY THE CHEST OPEN...', C_WHITE);
    ctxGame.audio.sfx('chest');
    let got = false;
    const g = rollDice(V(cfg('chestGold', '2d20+10')));
    gold += g; got = true;
    log('  FOUND ' + g + ' GOLD!', C_GOLD);
    if (Math.random() < N(cfg('potionChance', 0.5), 0.5) && CONTENT.potions.length) {
      const p = CONTENT.potions[Math.floor(Math.random() * CONTENT.potions.length)];
      inventory[p.id] = (inventory[p.id] || 0) + 1;
      log('  FOUND A ' + p.name + '!', C_GREEN);
    }
    if (Math.random() < N(cfg('gearChance', 0.4), 0.4)) {
      const gear = randomGear();
      if (gear) giveGear(gear);
    }
    if (!got) log('THE CHEST IS EMPTY.', C_DIM);
    ctxGame.hud.setScore(gold);
    saveGame();
    return;
  }
  // Plain search: small chance of loose gold.
  if (Math.random() < 0.35) {
    const g = rollDice(V(cfg('searchGold', '1d12+2')));
    gold += g;
    log('YOU PRY A LOOSE STONE FREE AND FIND ' + g + ' GOLD.', C_GOLD);
    ctxGame.hud.setScore(gold);
    ctxGame.audio.sfx('chest');
    saveGame();
  } else {
    log('YOU FIND NOTHING BUT DUST.', C_DIM);
  }
  refreshHud();
}

function randomGear() {
  const availW = CONTENT.weapons.filter((w) => w.minFloor <= floor);
  const availA = CONTENT.armors.filter((a) => a.minFloor <= floor);
  const pool = [...availW, ...availA];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function giveGear(gear) {
  const slot = gear.ac !== undefined ? 'armor' : 'weapon';
  let best = null;
  for (const m of party) {
    if (!isAlive(m)) continue;
    const cur = m[slot];
    const curVal = slot === 'weapon' ? weaponValue(m) : (cur ? cur.ac : 0);
    const newVal = slot === 'weapon' ? weaponValue({ weapon: gear }) : gear.ac;
    if (!best || newVal - curVal > best.diff) best = { m, curVal, newVal, diff: newVal - curVal };
  }
  if (best && best.diff > 0) {
    best.m[slot] = gear;
    log(best.m.name.split(' ')[0] + ' EQUIPS THE ' + gear.name + '!', C_GREEN);
    ctxGame.audio.sfx('levelup');
  } else {
    const sell = rollDice('1d6+4');
    gold += sell;
    log('THE ' + gear.name + ' IS SOLD FOR ' + sell + ' GOLD.', C_GOLD);
    ctxGame.hud.setScore(gold);
  }
}

function doRest() {
  const anyHurt = livingParty().some((m) => m.hp < m.maxHp);
  const anySp = livingParty().some((m) => m.sp < m.maxSp);
  if (!anyHurt && !anySp) {
    log('NOTHING TO RECOVER FROM. YOU MOVE ON.', C_DIM);
    ctxGame.audio.sfx('bump');
    return;
  }
  turns += N(cfg('restTurns', 12), 12);
  const heal = N(cfg('restHeal', 2), 2);
  for (const m of party) {
    if (!isAlive(m)) continue;
    m.hp = Math.min(m.maxHp, m.hp + heal);
    m.sp = m.maxSp;
  }
  log('YOU CAMP FOR A WHILE — EVERYONE RECOVERS A LITTLE.', C_GREEN);
  ctxGame.audio.sfx('rest');
  if (Math.random() < N(cfg('restEncounter', 0.45), 0.45)) {
    log('BUT YOU ARE AMBUSHED WHILE YOU SLEEP!', C_RED);
    const pool = poolForFloor(floor);
    if (pool.length) startCombat([pool[Math.floor(Math.random() * pool.length)].id], false);
  } else {
    ctxGame.audio.sfx('flee');
  }
  refreshHud();
  saveGame();
}

function randomPartyName() {
  const f = pick(CONTENT.firstNames) || 'HERO';
  const l = pick(CONTENT.lastNames) || 'OF GORM';
  return (f + ' ' + l).toUpperCase();
}

// ----------------------------------------------------------------------------
//  HUD / helpers
// ----------------------------------------------------------------------------
function refreshHud() {
  ctxGame.hud.setScore(gold);
  const alive = livingParty().length;
  const hp = party.reduce((a, m) => a + Math.max(0, m.hp), 0);
  const maxHp = party.reduce((a, m) => a + m.maxHp, 0);
  ctxGame.hud.setLabel(alive + '/' + party.length + ' · ' + hp + ' HP');
  ctxGame.hud.setClock('LV ' + floor + '/' + totalFloors());
  ctxGame.hud.setExtra('');
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ----------------------------------------------------------------------------
//  Input handling per mode
// ----------------------------------------------------------------------------
function handleInput(s) {
  if (s.conf && skipTyping()) return;      // Enter fast-forwards the log
  if (s.anyDigit) {
    const d = s.digits.findIndex(Boolean);
    handleDigit(d);
    return;
  }
  if (s.conf) {
    if (mode === 'create') confirmCreate();
    else if (mode === 'combat' && combat.phase === 'start') advanceToPick();
    else if (mode === 'combat' && combat.phase === 'round') resolveRound();
    else if (mode === 'explore' && sub === 'actions') { sub = null; menuFor(); }
    else if (mode === 'char') { mode = 'explore'; menuFor(); describe(); }
    return;
  }
  if (mode === 'create') {
    if (s.up || s.down) { createSel = (createSel + (s.down ? 1 : 3)) % 4; ctxGame.audio.sfx('move'); }
    if (s.left || s.right) cycleCreateClass(s.left ? -1 : 1);
    return;
  }
  if (mode === 'explore') handleExploreMove(s);
}

function handleExploreMove(s) {
  if (sub === 'actions') {
    if (s.up || s.down) { sub = null; menuFor(); }
    return;
  }
  const dir = directionalPress(s);
  if (!dir) return;
  repeatTimer = 0.34;
  lastMoveKey = dir;
  if (dir === 'F') step(DIRS[facing].dx, DIRS[facing].dy);
  else if (dir === 'B') step(-DIRS[facing].dx, -DIRS[facing].dy);
  else if (dir === 'L') turn(-1);
  else if (dir === 'R') turn(1);
  else { step(DIRS[dir].dx, DIRS[dir].dy); }
}

// Return 'F' forward / 'B' back / 'L' turn left / 'R' turn right / 0..3 abs dir.
function directionalPress(s) {
  if (s.up) return 'F';
  if (s.down) return 'B';
  if (s.left) return 'L';
  if (s.right) return 'R';
  return null;
}

function handleHeldRepeat(s, dt) {
  if (mode !== 'explore' || sub === 'actions') { lastMoveKey = null; return; }
  let held = null;
  if (s.holdUp) held = 'F';
  else if (s.holdDown) held = 'B';
  else if (s.holdLeft) held = 'L';
  else if (s.holdRight) held = 'R';
  if (!held) { lastMoveKey = null; repeatTimer = 0; return; }
  if (held !== lastMoveKey) { lastMoveKey = held; repeatTimer = 0.34; }
  repeatTimer -= dt;
  if (repeatTimer <= 0) {
    repeatTimer = 0.14;
    if (held === 'F') step(DIRS[facing].dx, DIRS[facing].dy);
    else if (held === 'B') step(-DIRS[facing].dx, -DIRS[facing].dy);
    else if (held === 'L') turn(-1);
    else if (held === 'R') turn(1);
  }
}

function turn(dirDelta) {
  facing = (facing + dirDelta + 4) % 4;
  turns++;
  ctxGame.audio.sfx('move');
  refreshHud();
}

function handleDigit(d) {
  switch (mode) {
    case 'load':
      if (d === 1) { loadGame(); enterExplore(); }
      else if (d === 2) { wipeSave(); startCreate(); }
      break;
    case 'create':
      if (d === 1) confirmCreate();
      else if (d === 2) randomizeCreateNames();
      break;
    case 'explore': {
      if (sub === 'actions') {
        if (d === 1) { sub = null; doLook(); }
        else if (d === 2) { sub = null; doSearch(); }
        else if (d === 3) { sub = null; doRest(); }
        else if (d === 4) { mode = 'char'; menuFor(); }
        else if (d === 5) { sub = null; log('GAME SAVED.', C_GREEN); saveGame(); ctxGame.audio.sfx('select'); }
        else if (d === 9) { sub = null; }
        menuFor();
      } else {
        if (d >= 1 && d <= 4) { sub = null; step(DIRS[d - 1].dx, DIRS[d - 1].dy); }
        else if (d === 5) { sub = 'actions'; }
        menuFor();
      }
      break;
    }
    case 'char': {
      if (d === 1) usePotionFlow();
      else if (d === 2) castFlow();
      else if (d === 3) { mode = 'explore'; sub = null; describe(); }
      menuFor();
      break;
    }
    case 'combat':
      doCombatDigit(d);
      break;
  }
}

function doLook() { describe(); log('YOU TAKE STOCK OF YOUR SURROUNDINGS.', C_DIM); ctxGame.audio.sfx('select'); }

// After CONTINUE on the load screen — return to the saved position.
function enterExplore() {
  mode = 'explore';
  sub = null;
  combat = null;
  refreshHud();
  log('YOU RETURN TO THE DARKNESS...', C_CYAN);
  describe();
  menuFor();
}

function usePotionFlow() {
  const pots = potionList();
  if (!pots.length) { log('NO POTIONS LEFT.', C_DIM); ctxGame.audio.sfx('bump'); return; }
  const p = pots[0];
  const target = livingParty().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  inventory[p.id]--;
  if (p.heal) { const heal = rollDice(p.heal); target.hp = Math.min(target.maxHp, target.hp + heal); log(target.name.split(' ')[0] + ' DRINKS THE ' + p.name + ' — HEALS ' + heal + '.', C_GREEN); }
  if (p.sp) { const sp = rollDice(p.sp); target.sp = Math.min(target.maxSp, target.sp + sp); log(target.name.split(' ')[0] + ' DRINKS THE ' + p.name + ' — RESTORES ' + sp + ' SP.', C_CYAN); }
  ctxGame.audio.sfx('heal');
  saveGame();
}
function castFlow() {
  const casters = livingParty().filter((m) => spellsFor(m).length);
  const m = casters[0];
  if (!m) { log('NO ONE CAN CAST SPELLS.', C_DIM); ctxGame.audio.sfx('bump'); return; }
  const usable = spellsFor(m).filter((s) => s.kind === 'heal' && s.sp <= m.sp);
  if (!usable.length) { log('NO HEALING SPELLS AVAILABLE.', C_DIM); ctxGame.audio.sfx('bump'); return; }
  const s = usable[0];
  if (m.sp < s.sp) { log('NOT ENOUGH SP.', C_DIM); return; }
  m.sp -= s.sp;
  const bonus = s.scaleLevel ? m.level : 0;
  const heal = rollDice(s.dmg, bonus);
  const target = livingParty().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  target.hp = Math.min(target.maxHp, target.hp + heal);
  log(m.name.split(' ')[0] + ' CASTS ' + s.name + ' — HEALS ' + target.name.split(' ')[0] + ' FOR ' + heal + '.', C_GREEN);
  ctxGame.audio.sfx('spell');
  saveGame();
}

// ----------------------------------------------------------------------------
//  Menus per mode
// ----------------------------------------------------------------------------
function menuFor() {
  if (mode === 'load') setMenu([{ k: 1, l: 'CONTINUE' }, { k: 2, l: 'NEW GAME' }], 'A SAVED ADVENTURE AWAITS.');
  else if (mode === 'create') setMenu([{ k: 1, l: 'CONFIRM PARTY' }, { k: 2, l: 'REROLL NAMES' }], 'ARROWS: MEMBER · LEFT/RIGHT: CLASS');
  else if (mode === 'explore') {
    if (sub === 'actions') setMenu([{ k: 1, l: 'LOOK' }, { k: 2, l: 'SEARCH' }, { k: 3, l: 'REST' }, { k: 4, l: 'PARTY' }, { k: 5, l: 'SAVE' }, { k: 9, l: 'CLOSE' }], 'ACTIONS');
    else setMenu([{ k: 1, l: 'N' }, { k: 2, l: 'E' }, { k: 3, l: 'S' }, { k: 4, l: 'W' }, { k: 5, l: 'ACTIONS' }], 'ARROWS MOVE · 5 = ACTIONS');
  } else if (mode === 'char') setMenu([{ k: 1, l: 'USE POTION' }, { k: 2, l: 'CAST HEAL' }, { k: 3, l: 'BACK' }], 'PARTY SHEET');
  else if (mode === 'combat') combatMenu();
}

// ----------------------------------------------------------------------------
//  Party creation
// ----------------------------------------------------------------------------
let createParty = [];
function startCreate() {
  mode = 'create';
  createSel = 0;
  createParty = [0, 1, 2, 3].map((slot) => makeCharacter(['warrior', 'rogue', 'mage', 'cleric'][slot], pick(CONTENT.firstNames) || 'HERO', pick(CONTENT.lastNames) || 'OF GORM', slot));
  randomizeCreateNames();
  victory = false;
  setScene('PARTY CREATION', ['FORM YOUR PARTY OF FOUR HEROES.', 'CHOOSE CLASSES AND REROLL NAMES.']);
  log('CHOOSE YOUR PARTY.', C_GOLD);
  menuFor();
}
function randomizeCreateNames() {
  const pool = [...(CONTENT.firstNames && CONTENT.firstNames.selectAll || [])];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  createParty.forEach((m, i) => {
    const fn = (pool[i] && V(pool[i])) || 'HERO';
    m.name = (fn + ' ' + (pick(CONTENT.lastNames) || 'OF GORM')).toUpperCase();
  });
}
function cycleCreateClass(dir) {
  const order = Object.keys(CLASSES);
  const idx = order.indexOf(createParty[createSel].cls);
  createParty[createSel].cls = order[(idx + dir + order.length) % order.length];
  ctxGame.audio.sfx('select');
}
function confirmCreate() {
  ctxGame.audio.sfx('start');
  party = createParty.map((m) => makeCharacter(m.cls, m.name.split(' ')[0], m.name.split(' ').slice(1).join(' ') || 'OF GORM', m.slot));
  gold = N(cfg('startGold', 0), 0);
  floor = 1; facing = 0; turns = 0; victory = false;
  seed = (Math.random() * 0x7fffffff) | 0;
  dungeons = {}; guardsDead = new Set(); chestsOpen = new Set(); explored = [];
  ensureFloor(1);
  const d = dungeon();
  px = d.entry.x; py = d.entry.y;
  reveal(px, py);
  inventory = {};
  mode = 'explore';
  sub = null;
  refreshHud();
  log('THE ADVENTURE BEGINS!', C_GOLD);
  ctxGame.audio.sfx('start');
  describe();
  saveGame();
  menuFor();
}

// ----------------------------------------------------------------------------
//  Party creation rendering
// ----------------------------------------------------------------------------
function renderCreate(g) {
  let y = SCENE_Y + 8;
  drawText(g, 'PARTY CREATION', PANEL_X + 5, y, C_CYAN); y += LINE_H;
  drawText(g, 'FORM YOUR PARTY OF FOUR HEROES.', PANEL_X + 5, y, C_WHITE); y += LINE_H;
  drawText(g, '1 CONFIRM · 2 REROLL NAMES', PANEL_X + 5, y, C_DIM); y += LINE_H + 4;
  for (let i = 0; i < createParty.length; i++) {
    const m = createParty[i];
    const cls = CLASSES[m.cls];
    const sel = i === createSel;
    const blink = sel && Math.floor(ctxGame.wallTime() * 2) % 2;
    drawText(g, (sel && blink ? '▶' : ' ') + ' ' + (i + 1) + '. ' + m.name, PANEL_X + 5, y, sel ? C_GOLD : C_WHITE);
    y += LINE_H;
    drawText(g, '    ' + cls.label + '  LV1', PANEL_X + 5, y, C_CYAN);
    y += LINE_H;
    drawText(g, '    HP ' + cls.hp + '  SP ' + cls.sp + '  AC ' + cls.ac + '  STR ' + cls.base.str,
      PANEL_X + 5, y, C_DIM);
    y += LINE_H + 4;
  }
}

// ----------------------------------------------------------------------------
//  Char sheet rendering
// ----------------------------------------------------------------------------
function renderCharSheet(g) {
  const cols = colsAvailable();
  let y = SCENE_Y;
  for (const m of party) {
    const head = m.name + '  ' + CLASSES[m.cls].label + '  LV' + m.level;
    drawText(g, head, PANEL_X + 4, y, m.hp <= 0 ? C_RED : C_WHITE);
    y += LINE_H;
    const hp = 'HP ' + m.hp + '/' + m.maxHp + '   SP ' + m.sp + '/' + m.maxSp + '   AC ' + totalAC(m);
    drawText(g, hp, PANEL_X + 4, y, m.hp <= 0 ? C_RED : C_CYAN);
    y += LINE_H;
    const stats = STAT_KEYS.map((k) => STAT_LABELS[k] + ' ' + m.stats[k]).join('  ');
    drawText(g, stats, PANEL_X + 4, y, C_DIM);
    y += LINE_H;
    const gear = 'WPN ' + (m.weapon ? m.weapon.name : 'NONE') + '   ARM ' + (m.armor ? m.armor.name : 'NONE');
    drawText(g, gear, PANEL_X + 4, y, C_DIM);
    y += LINE_H + 4;
  }
  if (y < LOG_Y) {
    const inv = CONTENT.potions.map((p) => (inventory[p.id] || 0) > 0 ? p.name + ' x' + inventory[p.id] : null).filter(Boolean).join('  ');
    drawText(g, 'POTIONS: ' + (inv || 'NONE'), PANEL_X + 4, LOG_Y - 4, C_GOLD);
  }
}

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------
function drawText(g, text, x, y, color) {
  g.fillStyle = color || C_WHITE;
  g.font = FONT;
  g.fillText(text, x, y + 8);
}
function drawMenuBar(g) {
  g.fillStyle = '#0a0520';
  g.fillRect(PANEL_X, MENU_Y, PANEL_W, H - MENU_Y);
  g.fillStyle = C_PANEL_BR;
  g.fillRect(PANEL_X, MENU_Y, PANEL_W, 1);
  let x = PANEL_X + 4;
  g.font = FONT;
  for (const it of menuItems) {
    const label = it.k + ' ' + it.l;
    g.fillStyle = C_GOLD;
    g.fillText(it.k + ' ', x, MENU_Y + 9);
    g.fillStyle = C_WHITE;
    g.fillText(it.l, x + charW * 2, MENU_Y + 9);
    x += charW * (2 + it.l.length + 2);
  }
  if (menuHint) {
    g.fillStyle = C_DIM;
    g.font = FONT;
    g.fillText(menuHint, PANEL_X + 4, MENU_Y + 18);
  }
}
function renderMap(g) {
  const t = ctxGame.wallTime();
  g.fillStyle = '#0a0520';
  g.fillRect(MAP_X, MAP_Y, 108, 108);
  g.strokeStyle = C_PANEL_BR;
  g.strokeRect(MAP_X + 0.5, MAP_Y + 0.5, 108, 108);
  const cx = MAP_X + 4 + MAP_SPAN * (MAP_TILE + 1) + MAP_TILE / 2;
  const cy = MAP_Y + 4 + MAP_SPAN * (MAP_TILE + 1) + MAP_TILE / 2;
  for (let r = -MAP_SPAN; r <= MAP_SPAN; r++) {
    for (let c = -MAP_SPAN; c <= MAP_SPAN; c++) {
      const tx = px + c, ty = py + r;
      const x = MAP_X + 4 + (c + MAP_SPAN) * (MAP_TILE + 1);
      const y = MAP_Y + 4 + (r + MAP_SPAN) * (MAP_TILE + 1);
      let col = '#000';
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) {
        const f = explored[floor];
        if (f && f[ty] && f[ty][tx]) {
          const tile = tileAt(tx, ty);
          col = tile === 0 ? '#1b1240' : tile === 3 ? C_MAG : tile === 4 ? C_CYAN : tile === 2 ? C_GREEN : '#20415c';
        }
      }
      g.fillStyle = col;
      g.fillRect(x, y, MAP_TILE, MAP_TILE);
    }
  }
  // player (blinking) + facing wedge
  const px2 = MAP_X + 4 + MAP_SPAN * (MAP_TILE + 1);
  const py2 = MAP_Y + 4 + MAP_SPAN * (MAP_TILE + 1);
  g.fillStyle = Math.floor(t * 2) % 2 ? C_GOLD : '#fff';
  g.fillRect(px2 + 1, py2 + 1, MAP_TILE - 2, MAP_TILE - 2);
  g.fillStyle = C_GOLD;
  const fx = DIRS[facing].dx, fy = DIRS[facing].dy;
  g.fillRect(px2 + 1 + fx * (MAP_TILE + 1), py2 + 1 + fy * (MAP_TILE + 1), MAP_TILE - 2, MAP_TILE - 2);
  // compass
  g.font = FONT;
  DIRS.forEach((d, i) => {
    g.fillStyle = i === facing ? C_GOLD : '#45395e';
    g.fillText(DIR_LETTER[i], MAP_X + 6 + i * 24, MAP_Y + 126);
  });
  drawText(g, 'FLOOR ' + floor + '/' + totalFloors(), MAP_X + 2, MAP_Y + 134, C_CYAN);
  drawText(g, 'TURN ' + turns, MAP_X + 2, MAP_Y + 146, C_DIM);
  drawText(g, 'GOLD ' + gold, MAP_X + 2, MAP_Y + 158, C_GOLD);
  const alive = livingParty().length;
  const denom = party.length || createParty.length || 0;
  drawText(g, 'HEROES ' + alive + '/' + denom, MAP_X + 2, MAP_Y + 170, alive ? C_GREEN : C_RED);
  drawText(g, 'HP ' + party.reduce((a, m) => a + Math.max(0, m.hp), 0) + '/' + party.reduce((a, m) => a + m.maxHp, 0), MAP_X + 2, MAP_Y + 182, C_DIM);
}

function renderTerminal(g) {
  // scene box
  g.fillStyle = '#0a0520';
  g.fillRect(PANEL_X, SCENE_Y, PANEL_W, LOG_Y - SCENE_Y - 4);
  g.strokeStyle = C_PANEL_BR;
  g.strokeRect(PANEL_X + 0.5, SCENE_Y + 0.5, PANEL_W, LOG_Y - SCENE_Y - 5);
  let y = SCENE_Y + 8;

  if (mode === 'combat' && combat) {
    // combat: show the enemy roster with HP bars instead of the room text
    drawText(g, 'ENCOUNTER — ROUND ' + combat.round, PANEL_X + 5, y, C_MAG);
    y += LINE_H;
    const mons = livingMonsters().slice(0, SCENE_MAX);
    for (const m of mons) {
      drawText(g, m.name, PANEL_X + 5, y, m.undead ? C_MAG : C_WHITE);
      hpBar(g, PANEL_X + 6, y + 8, 12, m.hp / m.maxHp, m.undead ? C_MAG : C_RED);
      drawText(g, m.hp + '/' + m.maxHp, PANEL_X + 6 + 12 * 6 + 6, y, C_DIM);
      y += LINE_H;
    }
  } else {
    for (const l of sceneLines.slice(0, SCENE_MAX + 1)) {
      drawText(g, l.t, PANEL_X + 5, y, l.c);
      y += LINE_H;
    }
  }
  drawLogBox(g);
}

function drawLogBox(g) {
  // log box
  g.fillStyle = '#07031a';
  g.fillRect(PANEL_X, LOG_Y, PANEL_W, H - LOG_Y - 24);
  g.strokeStyle = C_PANEL_BR;
  g.strokeRect(PANEL_X + 0.5, LOG_Y + 0.5, PANEL_W, H - LOG_Y - 25);
  let ly = LOG_Y + 8;
  // visible = tail of logLines (up to LOG_MAX) + the typing line
  const visible = logLines.slice(-LOG_MAX);
  const nTyped = typing ? Math.ceil(typing.idx / Math.max(1, typing.text.length) * typing.text.length) : 0;
  const typingVisible = typing ? 1 : 0;
  const startIdx = Math.max(0, visible.length + typingVisible - LOG_MAX);
  const shown = visible.slice(startIdx);
  for (const l of shown) {
    drawText(g, l.t, PANEL_X + 5, ly, l.c);
    ly += LINE_H;
  }
  if (typing) {
    // partial reveal of the current typing message
    const typedText = typing.text.slice(0, nTyped);
    let ty = ly;
    for (const line of wrapText(typedText, colsAvailable())) {
      drawText(g, line, PANEL_X + 5, ty, typing.color);
      ty += LINE_H;
    }
    // blinking cursor at the end of the typed text
    const cw = Math.min(ctxGame ? charW : 8, 8);
    const endX = PANEL_X + 5 + (typedText.length % Math.max(1, colsAvailable())) * cw;
    const endY = ty - LINE_H;
    if (Math.floor(ctxGame.wallTime() * 2) % 2 && typedText.length > 0) {
      g.fillStyle = C_GOLD;
      g.fillRect(Math.min(endX, PANEL_X + PANEL_W - 10), endY, 6, 8);
    }
  }
}

// ----------------------------------------------------------------------------
//  The module the shell imports
// ----------------------------------------------------------------------------
function init(ctx) {
  ctxGame = ctx;
  CONTENT = parseContent();
  try { document.fonts && document.fonts.load('8px "Press Start 2P"'); } catch { /* noop */ }
  try { document.fonts && document.fonts.load('10px "Press Start 2P"'); } catch { /* noop */ }
  charW = 8;
  // measure actual glyph width once the font is available
  const g2 = document.createElement('canvas').getContext('2d');
  g2.font = FONT;
  charW = g2.measureText('M').width || 8;
  logLines = [];
  typingQueue = [];
}

function reset(ctx) {
  ctxGame = ctx;
  frameInputDone = false;
  pendingGameOverAt = null;
  menuItems = [];
  logLines = [];
  typingQueue = [];
  typing = null;
  victory = false;
  sub = null;
  if (hasSave()) {
    mode = 'load';
    setScene('WELCOME BACK', ['AN ADVENTURE IS SAVED.', 'CONTINUE, OR BEGIN ANEW.']);
    log('A SAVED PARTY WAITS IN THE DARK.', C_CYAN);
    menuFor();
  } else {
    startCreate();
  }
  refreshHud();
  ctx.audio.stopMusic();
}

function update(dt, ctx) {
  ctxGame = ctx;

  if (pendingGameOverAt && ctx.wallTime() >= pendingGameOverAt) {
    pendingGameOverAt = null;
    ctx.gameOver();
    return;
  }
  if (!frameInputDone) {
    frameInputDone = true;
    const s = snapshotInput(ctx.input);
    if (mode === 'explore' && !combat) handleHeldRepeat(s, dt);
    handleInput(s);
  }
  updateTyping(dt);
  cursorBlink += dt;
}

function render(g, dt, ctx) {
  ctxGame = ctx;
  frameInputDone = false;                  // fresh input snapshot next frame

  g.fillStyle = '#04020c';
  g.fillRect(0, 0, W, H);

  if (mode === 'char') {
    renderCharSheet(g);
  } else if (mode === 'create') {
    renderCreate(g);
  } else {
    renderTerminal(g);
  }
  renderMap(g);
  drawMenuBar(g);
}

export default {
  init, reset, update, render,
  get victory() { return victory; },   // read by src/main.js for the game-over title
};

// Debug / playtest hook — handy for testing from the devtools console
// (e.g. `__rpg.mode`, `__rpg.party`). Not used by the app.
window.__rpg = {
  get mode() { return mode; },
  get party() { return party.map((m) => m.name); },
  get floor() { return floor; },
  get turns() { return turns; },
  get gold() { return gold; },
  get combat() { return combat ? combat.phase : null; },
  get typing() { return typing ? typing.text.slice(0, typing.idx) : null; },
  get typingQueue() { return typingQueue.map((m) => m.text); },
  get log() { return logLines.slice(-12).map((l) => l.t); },
  combatInfo() {
    if (!combat) return null;
    return {
      phase: combat.phase, memberIdx: combat.memberIdx, round: combat.round,
      monsters: combat.monsters.map((m) => m.name + ' ' + m.hp + '/' + m.maxHp + (m.alive ? '' : ' DEAD')),
      actions: combat.actions,
    };
  },
  newGame() { confirmCreate(); },
  fight(ids) { ensureFloor(floor); startCombat(ids || ['goblin'], false); },
  down() { descend(); },
  up() { ascend(); },
  get pos() { return { x: px, y: py, floor }; },
  warp(x, y) { px = x; py = y; reveal(x, y); describe(); },
  get partyFull() {
    return party.map((m) => ({ name: m.name, hp: m.hp, maxHp: m.maxHp, lvl: m.level, stats: m.stats, weapon: m.weapon && m.weapon.id, armor: m.armor && m.armor.id }));
  },
  buff(levels) {               // playtest helper: level everyone up & heal
    for (const m of party) {
      while (m.level < (levels || 5)) levelUp(m);
      m.hp = m.maxHp; m.sp = m.maxSp;
    }
    refreshHud();
  },
  hurt(amount) {               // playtest helper: damage the whole party
    for (const m of party) m.hp = Math.max(0, m.hp - (amount || 10));
    refreshHud();
  },
  digit(d) { handleDigit(d); },
  skipTyping() { return skipTyping(); },
};
