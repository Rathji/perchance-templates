// ============================================================================
//  src/rpggame.js — the GAME MODULE for the VGN shell
//  ----------------------------------------------------------------------------
//  The shell (src/main.js) knows nothing about RPGs. It boots, shows a title
//  screen, and calls the four hooks below; THIS module is the whole game:
//      init(ctx)     — once at boot: kv storage, touch, input listeners
//      reset(ctx)    — start of every run: fresh party + world (or inn-revival
//                      when `revive` is set, after a party wipe)
//      update(dt, ctx) — fixed 60 Hz tick (keeps the shell HUD clock going)
//      render(g, dt, ctx) — the shared 480×270 canvas: attract-mode world map
//                      behind the title screen; dark fill during play
//  The actual RPG lives in the other src/ modules — game.js (state/save),
//  battle.js, maps.js, data.js, render.js, ui.js (menus). This file wires
//  them into the cabinet.
//  ============================================================================

import { Game } from "./game.js";
import * as D from "./data.js";
import { TILES, heroCanvas, drawPerson, drawMonster } from "./render.js";
import { modalOpen, listChoice, infoWindow, openMenu, shopMenu, innMenu } from "./ui.js";

const TILE = 16;
const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");
const battleCanvas = document.getElementById("battleCanvas");
const bctx = battleCanvas.getContext("2d");
const msgbox = document.getElementById("msgbox");
const partybar = document.getElementById("partybar");
const worldWrap = document.getElementById("worldWrap");
const battleScreen = document.getElementById("battleScreen");
const battleLog = document.getElementById("battleLog");
const cmdTitle = document.getElementById("cmdTitle");
const cmdOptions = document.getElementById("cmdOptions");
const rpgUi = document.getElementById("rpgUi");

const game = new Game();
window.game = game;

let shell = null;         // the shell's game context (ctx) — see init()
let battle = null;
let waitingMsg = null;

// When the CONTINUE button is pressed after a wipe, the shell sets this flag;
// reset() then does the "awaken at the inn" revival instead of a new game.
let revive = false;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

const DIRS = {
  ArrowUp: 0, w: 0, W: 0,
  ArrowRight: 1, d: 1, D: 1,
  ArrowDown: 2, s: 2, S: 2,
  ArrowLeft: 3, a: 3, A: 3,
};
const DIRKEY = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];

// ---- input -----------------------------------------------------------------
// The shell's Input handles start/pause at the menu level. THIS listener owns
// every in-game key (movement, talk, menu, battle) and only acts while PLAYING.
window.addEventListener("keydown", onKey);

function onKey(e) {
  if (!shell || shell.state() !== "PLAYING") return;
  const k = e.key;
  if (waitingMsg) {
    if (k === "Enter" || k === " " || k === "Escape") advanceMsg();
    return;
  }
  if (modalOpen) return;
  if (game.mode === "battle") { e.preventDefault(); battleKey(k); return; }
  if (DIRS[k] !== undefined) { e.preventDefault(); move(DIRS[k]); return; }
  if (k === "Enter") { e.preventDefault(); interact(); return; }
  if (k === "Escape") { e.preventDefault(); openMenu(game).then(afterMenu); }
}

function afterMenu() { refreshHud(); renderWorld(); }

function move(dir) {
  game.facing = dir;
  const p = game.pos;
  const nx = p.x + (dir === 1 ? 1 : dir === 3 ? -1 : 0);
  const ny = p.y + (dir === 2 ? 1 : dir === 0 ? -1 : 0);
  const door = game.map.doors.find(dd => dd.x === nx && dd.y === ny);
  if (door) {
    game.pos = { x: nx, y: ny };
    enterDoor();
    return;
  }
  if (game.blocked(nx, ny)) return;
  game.pos = { x: nx, y: ny };
  const tile = game.tile(nx, ny);
  const zone = game.zone(nx, ny);
  if (D.ZONES[zone] && TILES[tile] && !D.TILE_BLOCKED.includes(tile)) {
    const chance = tile === "P" ? 0 : zone === "castle" ? 0.10 : 0.13;
    if (Math.random() < chance) startBattle();
  }
  refreshHud();
  renderWorld();
}

function enterDoor() {
  game.teleportAt(game.pos.x, game.pos.y);
  refreshHud();
  renderWorld();
}

function front() {
  const p = game.pos;
  return {
    x: p.x + (game.facing === 1 ? 1 : game.facing === 3 ? -1 : 0),
    y: p.y + (game.facing === 2 ? 1 : game.facing === 0 ? -1 : 0),
  };
}

function interact() {
  const f = front();
  const npc = game.npcAt(f.x, f.y);
  if (npc) {
    game.facing = f.x > game.pos.x ? 1 : f.x < game.pos.x ? 3 : f.y > game.pos.y ? 2 : 0;
    talkTo(npc);
    return;
  }
  const door = game.map.doors.find(dd => dd.x === f.x && dd.y === f.y);
  if (door) {
    game.pos = { x: f.x, y: f.y };
    enterDoor();
    return;
  }
  move(game.facing);
}

async function talkTo(npc) {
  if (shell) shell.audio.sfx("select");
  if (npc.kind === "shop") { await shopMenu(game, npc.shop); refreshHud(); renderWorld(); return; }
  if (npc.kind === "inn") { await innMenu(game); refreshHud(); renderWorld(); return; }
  await showMessage(npc.msg);
}

function showMessage(text) {
  return new Promise(resolve => {
    msgbox.hidden = false;
    msgbox.textContent = text;
    waitingMsg = resolve;
  });
}

function advanceMsg() {
  const r = waitingMsg;
  waitingMsg = null;
  msgbox.hidden = true;
  if (r) r();
}

// ---- HUD / party bar -------------------------------------------------------
function refreshHud() {
  if (!shell) return;
  shell.hud.setScore(game.gold);
  shell.hud.setLives(game.party.filter(p => p.hp > 0).length);
  shell.hud.setExtra(game.map.name.toUpperCase());
  renderPartyBar();
}

function renderPartyBar() {
  partybar.innerHTML = game.party.map(p => {
    const hpf = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    const mpf = Math.max(0, Math.min(100, p.maxMp ? (p.mp / p.maxMp) * 100 : 0));
    return `<div class="pmember"><span class="pname">${esc(p.name)}</span>
      <div class="pbar"><div class="fill ${p.hp <= 0 ? "dead" : ""}" style="width:${hpf}%"></div><div class="txt">${p.hp}/${p.maxHp}</div></div>
      <div class="pbar" style="width:64px"><div class="fill mp" style="width:${mpf}%"></div><div class="txt">${p.mp}/${p.maxMp}</div></div></div>`;
  }).join("");
}

// ---- world rendering (the RPG's own 672×480 canvas) ------------------------
// The world map is 42×30 tiles (fits 1:1); smaller indoor maps are scaled up
// so a room fills the screen instead of sitting as a postage stamp of pixels.
function renderWorld() {
  const map = game.map;
  const W = map.w * TILE, H = map.h * TILE;
  const s = Math.min(canvas.width / W, canvas.height / H);
  const ox = Math.floor((canvas.width - W * s) / 2);
  const oy = Math.floor((canvas.height - H * s) / 2);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const img = TILES[map.grid[y][x]];
      if (img) ctx.drawImage(img, x * TILE, y * TILE);
    }
  }
  for (const n of map.npcs) {
    ctx.drawImage(heroCanvas(n.tunic || "#8a6a42", n.face != null ? n.face : 2), n.x * TILE, n.y * TILE);
  }
  const hero = heroCanvas(D.CLASSES[game.party[0].id].tunic, game.facing);
  ctx.drawImage(hero, game.pos.x * TILE, game.pos.y * TILE);
  ctx.restore();
}

// ---- battles ---------------------------------------------------------------
function startBattle() {
  const b = game.startEncounter();
  if (!b) return;
  battle = b;
  worldWrap.hidden = true;
  battleScreen.style.display = "flex";
  b.onLog = lines => { battleLog.textContent = lines.join("\n"); };
  b.onUi = renderBattleUi;
  if (shell) shell.audio.sfx("start");
  renderBattleCanvas();
  renderBattleUi();
}

function renderBattleUi() {
  const u = battle.uiCurrent();
  if (!u) { cmdTitle.textContent = ""; cmdOptions.innerHTML = ""; return; }
  cmdTitle.textContent = u.title;
  cmdOptions.innerHTML = u.opts.map((o, i) =>
    `<button class="btn ${i === u.index ? "sel" : ""} ${o.disabled ? "disabled" : ""}" data-i="${i}">${esc(o.label)}</button>`
  ).join("");
  cmdOptions.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const u2 = battle.uiCurrent();
      const i = +btn.dataset.i;
      if (u2 && !u2.opts[i].disabled) {
        u2.index = i;
        battle.choose();
        renderBattleUi();
        checkBattleEnd();
      }
    });
  });
}

function battleKey(k) {
  if (!battle) return;
  if (k === "ArrowUp" || k === "ArrowLeft" || k === "w" || k === "W" || k === "a" || k === "A") battle.uiMove(-1);
  else if (k === "ArrowDown" || k === "ArrowRight" || k === "s" || k === "S" || k === "d" || k === "D") battle.uiMove(1);
  else if (k === "Enter" || k === " ") battle.choose();
  else if (k === "Escape" || k === "x" || k === "X") battle.uiPop();
  else return;
  renderBattleUi();
  checkBattleEnd();
}

function renderBattleCanvas() {
  if (!battle) return;
  const W = battleCanvas.width, H = battleCanvas.height;
  bctx.fillStyle = "#17171f";
  bctx.fillRect(0, 0, W, H);
  bctx.fillStyle = "#223024";
  bctx.fillRect(0, Math.floor(H * 0.62), W, Math.floor(H * 0.38));
  bctx.fillStyle = "#151d16";
  bctx.fillRect(0, Math.floor(H * 0.62), W, 3);
  game.party.forEach((p, i) => {
    const px = 46 + i * 34;
    const py = Math.floor(H * 0.62) + 46;
    bctx.save();
    bctx.translate(px, py);
    bctx.scale(1.6, 1.6);
    drawPerson(bctx, D.CLASSES[p.id].tunic, 2);
    bctx.restore();
    if (p.hp <= 0) {
      bctx.fillStyle = "rgba(0,0,0,0.55)";
      bctx.fillRect(px - 10, py - 13, 20, 26);
    }
  });
  const es = battle.enemies;
  const n = es.length;
  const spacing = Math.min(92, (W - 190) / Math.max(1, n - 1));
  const startX = W - 40 - (n - 1) * spacing;
  es.forEach((e, i) => {
    const x = startX + i * spacing;
    const y = 92 + (i % 2) * 36;
    drawMonster(bctx, e.def.img, x, y, 44);
    bctx.fillStyle = "#ddd";
    bctx.font = "12px 'Courier New', monospace";
    bctx.textAlign = "center";
    bctx.fillText(e.def.name, x, y + 30);
    bctx.fillStyle = "#333";
    bctx.fillRect(x - 18, y + 34, 36, 4);
    bctx.fillStyle = "#e04f4f";
    bctx.fillRect(x - 18, y + 34, 36 * Math.max(0, e.hp / e.def.hp), 4);
  });
}

async function checkBattleEnd() {
  const b = battle;
  if (!b || !b.result) return;
  if (b.result === "win") {
    const tail = b.log.slice(-8).join("\n");
    if (shell) shell.audio.sfx("victory");
    await infoWindow("Victory!", tail);
    endBattleUi();
  } else if (b.result === "lose") {
    // Party wiped → the shell shows its GAME OVER screen. The CONTINUE button
    // sets `revive`, so the next reset() is an inn-revival, not a new game.
    endBattleUi();
    if (shell) {
      // The Input listener records the very keydown that killed the party
      // AFTER this handler runs — clear its edge on the next task so it can't
      // instantly trigger CONTINUE on the game-over screen.
      setTimeout(() => shell.input.clearEdges(), 0);
      shell.gameOver();
    }
  } else {
    endBattleUi();
  }
}

function endBattleUi() {
  game.mode = "world";
  game.battle = null;
  battle = null;
  battleScreen.style.display = "none";
  worldWrap.hidden = false;
  refreshHud();
  renderWorld();
}

// ---- the shell game-module hooks ------------------------------------------
async function init(gctx) {
  shell = gctx;
  const root = window.root;
  if (root && root.kv) {
    try { game.kvRoot = await root.kv.rpgSaves; } catch (e) {}
  }
  game.audio = gctx.audio;
  bindTouch();
  refreshHud();
  renderWorld();
}

function reset(gctx) {
  shell = gctx;
  const continuing = revive;
  if (continuing) {
    // CONTINUE after a party wipe: awaken at the inn, half HP/MP and gold.
    for (const p of game.party) { p.hp = Math.max(1, Math.floor(p.maxHp / 2)); p.mp = Math.floor(p.maxMp / 2); }
    game.gold = Math.floor(game.gold / 2);
    game.mapId = "inn";
    game.map = game.maps.inn;
    game.pos = { x: 3, y: 6 };
    game.facing = 2;
  } else {
    game.reset();
  }
  revive = false;
  game.audio = gctx.audio;
  endBattleUi();
  refreshHud();
  renderWorld();
  if (!continuing) {
    showMessage("Welcome, adventurer.\nExplore Greenfield, then head east — the forest is crawling with monsters.");
  }
}

function update(dt, gctx) {
  shell = gctx;
  if (shell) shell.hud.setTimer(shell.time());
}

// The shared 480×270 canvas. On the title / game-over screens the world map
// doubles as the attract backdrop; during play it just sits dark behind the
// RPG's own DOM canvas.
function render(g, dt, gctx) {
  shell = gctx;
  const st = gctx.state();
  rpgUi.style.display = (st === "PLAYING" || st === "PAUSED" || st === "GAME_OVER") ? "flex" : "none";
  if (st === "TITLE" || st === "GAME_OVER") {
    drawWorldScaled(g);
  } else {
    g.fillStyle = "#05010f";
    g.fillRect(0, 0, 480, 270);
  }
}

function drawWorldScaled(g) {
  const map = game.map;
  const W = map.w * TILE, H = map.h * TILE;
  const s = Math.max(480 / W, 270 / H);
  const oy = (270 - H * s) / 2;
  g.fillStyle = "#05010f";
  g.fillRect(0, 0, 480, 270);
  g.save();
  g.translate(0, oy);
  g.scale(s, s);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const img = TILES[map.grid[y][x]];
      if (img) g.drawImage(img, x * TILE, y * TILE);
    }
  }
  for (const n of map.npcs) {
    g.drawImage(heroCanvas(n.tunic || "#8a6a42", n.face != null ? n.face : 2), n.x * TILE, n.y * TILE);
  }
  g.drawImage(heroCanvas(D.CLASSES[game.party[0].id].tunic, game.facing), game.pos.x * TILE, game.pos.y * TILE);
  g.restore();
}

// ---- touch controls --------------------------------------------------------
function bindTouch() {
  const dirId = { bUp: 0, bRight: 1, bDown: 2, bLeft: 3 };
  for (const [id, d] of Object.entries(dirId)) {
    document.getElementById(id).addEventListener("pointerdown", e => {
      e.preventDefault();
      onKey({ key: DIRKEY[d], preventDefault() {} });
    });
  }
  document.getElementById("bConfirm").addEventListener("pointerdown", e => {
    e.preventDefault();
    onKey({ key: "Enter", preventDefault() {} });
  });
  document.getElementById("bCancel").addEventListener("pointerdown", e => {
    e.preventDefault();
    onKey({ key: "Escape", preventDefault() {} });
  });
}

export default {
  init, reset, update, render,
  get revive() { return revive; },
  set revive(v) { revive = !!v; },
};
