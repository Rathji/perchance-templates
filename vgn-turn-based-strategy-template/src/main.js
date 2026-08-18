import { S, setScreen } from './app.js';
import * as E from './engine.js';
import { runAITurn } from './ai.js';
import { drawMap, MAP_CW, MAP_CH } from './render.js';
import { setupMapCanvas } from './mapui.js';
import { showGameOver, refreshAll, openHeroScreen } from './screens.js';
import { updateTopbar, updateHeroStrip, toast, setMapRedraw, setStripClick, showModal, hideModal } from './hud.js';
import { MAP_SIZES } from './data.js';
import { initEditor, openEditor, setTestPlayHandler } from './editor.js';
import * as onlineMod from './online.js';

const SAVE_KEY = 'save';

function kv() {
  return (typeof window !== 'undefined' && window.kv) || null;
}

async function loadSave() {
  try {
    const k = kv();
    if (!k) return null;
    const str = await k.vgnTbs.get(SAVE_KEY);
    return str ? E.deserializeGame(str) : null;
  } catch (e) {
    console.warn('load save failed', e);
    return null;
  }
}

async function saveGame() {
  try {
    const k = kv();
    if (!k || !S.game || S.game.online) return;
    await k.vgnTbs.set(SAVE_KEY, E.serializeGame(S.game));
  } catch (e) {
    console.warn('save failed', e);
  }
}

function showSetupScreen() {
  const cfg = (window.root && root.gameConfig) || {};
  document.getElementById('setupScreen').hidden = false;
  const sizeSel = document.getElementById('setupSize');
  sizeSel.value = cfg.mapSize || 'medium';
  const humans = Math.max(1, cfg.humans || 1);
  document.getElementById('setupHumans').value = String(humans);
  document.getElementById('setupPlayers').value = String(Math.max(0, (cfg.players || 2) - humans));
  document.getElementById('setupFaction').value = cfg.faction || 'castle';
  document.getElementById('setupDifficulty').value = cfg.difficulty || 'normal';
}

function readSetup() {
  let humans = Math.max(1, +document.getElementById('setupHumans').value || 1);
  let ai = Math.max(0, +document.getElementById('setupPlayers').value || 0);
  let total = humans + ai;
  if (total < 2) { ai = 1; total = 2; }
  if (total > 4) { ai = 4 - humans; total = 4; }
  if (ai < 0) { ai = 0; total = 4; }
  return { humans, ai, total };
}

export function newGame(opts) {
  const cfg = (window.root && root.gameConfig) || {};
  const size = MAP_SIZES[opts?.size || cfg.mapSize || 'medium'] || MAP_SIZES.medium;
  const mapRows = opts?.mapRows ?? configMapRows(cfg);
  const humans = Math.max(1, opts?.humans ?? (cfg.humans || 1));
  const total = Math.max(2, opts?.players ?? (cfg.players || 2));
  S.game = E.newGame({
    w: size.w, h: size.h,
    humans,
    numPlayers: total,
    humanFaction: opts?.faction || cfg.faction || 'castle',
    difficulty: opts?.difficulty || cfg.difficulty || 'normal',
    mapRows,
  });
  S.selectedHeroId = null;
  E.startPlayerTurn(S.game, S.game.players[0]);
  E.autoLevelAI(S.game);
  refreshAll();
  setScreen('map');
  toast('New game started');
  saveGame();
  if (window.__game) window.__game.sync = () => S.game;
}

// gameConfig.map in main.pjs (array of strings, newline-joined string, or a pjs list) overrides random map gen.
function configMapRows(cfg) {
  const m = cfg.map;
  if (!m) return null;
  if (Array.isArray(m)) return m.map(String);
  if (typeof m === 'string') return m.split('\n');
  if (m.selectAll) return m.selectAll.map(i => String(i.evaluateItem));
  return null;
}

function endTurn() {
  const game = S.game;
  if (!game || game.gameOver) return;
  if (game.players[game.turn].isAI) return;
  if (game.online) {
    if (game.online.myPid !== game.turn) return;
    S.selectedHeroId = null;
    game.turn = (game.turn + 1) % game.players.length;
    if (game.turn === 0) E.newDay(game);
    E.startPlayerTurn(game, game.players[game.turn]);
    refreshAll();
    onlineMod.publishState();
    toast('Turn passed — waiting for the other player', 'news');
    return;
  }
  S.selectedHeroId = null;
  game.turn = (game.turn + 1) % game.players.length;
  if (game.turn === 0) E.newDay(game);
  let guard = 0;
  while (guard++ < 24) {
    if (game.gameOver) break;
    const p = game.players[game.turn];
    if (!E.isAlive(game, p.id)) {
      game.turn = (game.turn + 1) % game.players.length;
      if (game.turn === 0) E.newDay(game);
      continue;
    }
    E.startPlayerTurn(game, p);
    if (!p.isAI) break;
    runAITurn(game, p);
    game.turn = (game.turn + 1) % game.players.length;
    if (game.turn === 0) E.newDay(game);
  }
  if (game.gameOver) {
    refreshAll();
    showGameOver(game);
    return;
  }
  saveGame();
  refreshAll();
  const p = game.players[game.turn];
  toast(`Day ${game.day}, week ${game.week} — ${p.id === 0 ? 'your' : `${p.name}'s`} turn`, 'news');
}

// Host starts the match once both players are in the lobby.
function startOnlineGame() {
  const code = onlineMod.online.code;
  if (!code) return;
  newGame({
    size: document.getElementById('mpSize').value,
    humans: 2,
    players: 2,
    faction: document.getElementById('mpFaction').value,
  });
  S.game.online = { myPid: 0, code };
  document.getElementById('multiplayerScreen').hidden = true;
  onlineMod.publishState();
  toast('Match started — waiting for the other player', 'news');
}

function init() {
  E.setLogSink(msg => console.log('[game]', msg));
  setupMapCanvas();
  initEditor();

  setMapRedraw(() => {
    const cvs = document.getElementById('mapCanvas');
    const ctx = cvs.getContext('2d');
    if (S.game) drawMap(ctx, S.game, S);
  });
  setStripClick(hero => openHeroScreen(S.game, hero));

  document.getElementById('newGameBtn').addEventListener('click', showSetupScreen);
  document.getElementById('editorBtn').addEventListener('click', openEditor);
  setTestPlayHandler(rows => {
    const { humans, total } = readSetup();
    const f = document.getElementById('setupFaction');
    const d = document.getElementById('setupDifficulty');
    newGame({
      humans, players: total,
      faction: f ? f.value : 'castle',
      difficulty: d ? d.value : 'normal',
      mapRows: rows,
    });
  });
  document.getElementById('setupCancelBtn').addEventListener('click', () => { document.getElementById('setupScreen').hidden = true; });
  document.getElementById('setupStartBtn').addEventListener('click', () => {
    document.getElementById('setupScreen').hidden = true;
    const { humans, total } = readSetup();
    newGame({
      size: document.getElementById('setupSize').value,
      humans, players: total,
      faction: document.getElementById('setupFaction').value,
      difficulty: document.getElementById('setupDifficulty').value,
    });
  });
  document.getElementById('endTurnBtn').addEventListener('click', endTurn);
  S.onNewGame = () => {
    hideModal();
    if (S.game && S.game.online) {
      onlineMod.leaveMatch();
    } else {
      newGame();
    }
  };

  // ---- online multiplayer ----
  const mpScreen = document.getElementById('multiplayerScreen');
  document.getElementById('multiplayerBtn').addEventListener('click', () => { mpScreen.hidden = false; });
  document.getElementById('mpCancelBtn').addEventListener('click', async () => {
    mpScreen.hidden = true;
    if (onlineMod.online.code) await onlineMod.leaveMatch();
  });
  document.getElementById('mpCreateBtn').addEventListener('click', async () => {
    if (!await onlineMod.createLobby()) return;
    document.getElementById('mpCodeCtn').hidden = false;
    document.getElementById('mpCode').textContent = onlineMod.online.code;
    document.getElementById('mpStatus').textContent = 'Waiting for opponent to join…';
    document.getElementById('mpStartBtn').disabled = true;
    document.getElementById('mpStartBtn').hidden = false;
  });
  document.getElementById('mpJoinBtn').addEventListener('click', async () => {
    const ok = await onlineMod.joinLobby(document.getElementById('mpCodeInput').value);
    if (!ok) return;
    if (onlineMod.online.phase === 1) {
      mpScreen.hidden = true;
    } else {
      document.getElementById('mpJoinStatus').textContent = 'Joined — waiting for the host to start the match…';
    }
  });
  document.getElementById('mpStartBtn').addEventListener('click', startOnlineGame);
  document.getElementById('leaveMatchBtn').addEventListener('click', async () => { await onlineMod.leaveMatch(); });
  const persisted = onlineMod.persistedSession();
  if (persisted) document.getElementById('rejoinBtn').hidden = false;
  document.getElementById('rejoinBtn').addEventListener('click', async () => {
    const p = onlineMod.persistedSession();
    if (!p) return;
    const ok = await onlineMod.joinLobby(p.code);
    if (!ok) { document.getElementById('rejoinBtn').hidden = true; return; }
    if (onlineMod.online.phase === 1) {
      mpScreen.hidden = true;
    } else {
      mpScreen.hidden = false;
      document.getElementById('mpCodeCtn').hidden = false;
      document.getElementById('mpCode').textContent = p.code;
      document.getElementById('mpStatus').textContent = 'Reconnected to lobby — waiting for the opponent…';
    }
  });

  // continue button if a save exists
  loadSave().then(save => {
    if (save && !save.gameOver) document.getElementById('continueBtn').hidden = false;
  });
  document.getElementById('continueBtn').addEventListener('click', async () => {
    const save = await loadSave();
    if (save) {
      if (save.gameOver) { toast('That game is over — start a new one'); return; }
      S.game = save;
      S.selectedHeroId = null;
      refreshAll();
      setScreen('map');
      toast('Game loaded');
    }
  });

  // debug hook
  window.__game = {
    get state() { return S.game; },
    get battle() { return S.battle; },
    get meta() { return S.battleMeta; },
    get spell() { return S.combatSpell; },
    checkWin: () => E.checkGameOver(S.game),
    newGame,
    endTurn,
  };
}

init();
