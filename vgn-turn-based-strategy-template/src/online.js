// Online multiplayer client: hosts the socket, lobby join/create, and the
// state-passing protocol. The server (see the <script type="text/x-server-plugin">
// block in index.html) stores each match's serialized game and relays turn
// updates between the two players over a per-match pubsub topic.
import { S, setScreen } from './app.js';
import * as E from './engine.js';
import { refreshAll, showGameOver } from './screens.js';
import { toast, updateTopbar } from './hud.js';

const LS_KEY = 'vgnTbsOnline';

export const online = {
  socket: null,
  code: null,
  seat: 0,           // 1 = host (pid 0), 2 = guest (pid 1)
  phase: 0,          // 0 = lobby, 1 = started
  waiting: false,
  reconnectAttempts: 0,
  lastNonce: 0,
};

export function isMyTurn(game) {
  return !game.online || game.online.myPid === game.turn;
}

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ code: online.code, seat: online.seat })); } catch (e) {}
}
export function persistedSession() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; }
}
export function clearPersistedSession() {
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
}

function closeSocket() {
  if (online.socket) {
    try { online.socket.close(1000); } catch (e) {}
    online.socket = null;
  }
}

async function openSocket() {
  if (online.socket && online.socket.readyState === 1) return;
  const s = root.createServerSocket();
  s.binaryType = 'arraybuffer';
  s.addEventListener('message', onMessage);
  s.addEventListener('close', onClose);
  online.socket = s;
  await s.opened;
}

async function rpc(method, data) {
  if (!online.socket) throw new Error('not connected');
  return await online.socket.rpc[method](data);
}

function parseReply(reply) {
  try { return JSON.parse(reply); } catch (e) { return null; }
}

export async function createLobby() {
  closeSocket();
  try {
    await openSocket();
    const r = parseReply(await rpc('createLobby', '{}'));
    if (!r || !r.ok) { toast('Could not create lobby'); return false; }
    online.code = r.code;
    online.seat = 1;
    online.phase = 0;
    online.reconnectAttempts = 0;
    persist();
    return true;
  } catch (e) {
    toast('Could not reach the match server');
    return false;
  }
}

export async function joinLobby(code) {
  closeSocket();
  try {
    await openSocket();
    const r = parseReply(await rpc('joinLobby', JSON.stringify({ code: String(code).toUpperCase().trim() })));
    if (!r || !r.ok) {
      toast('Could not join: ' + (r && r.err ? r.err : 'unknown'));
      return false;
    }
    online.code = r.code;
    online.seat = r.seat;
    online.phase = r.phase || 0;
    online.reconnectAttempts = 0;
    persist();
    if (online.phase === 1 && r.state) applyState(r.state);
    return true;
  } catch (e) {
    toast('Could not reach the match server');
    return false;
  }
}

// Host publishes the freshly-built game (first publish starts the match).
export function publishState() {
  const game = S.game;
  if (!game || !online.code) return;
  online.lastNonce++;
  const payload = JSON.stringify({
    state: E.serializeGame(game),
    turn: game.turn,
    lastActed: online.seat - 1,
    nonce: online.lastNonce,
  });
  online.waiting = true;
  rpc('sendState', payload).then(() => {}).catch(() => {});
  updateTopbar(game);
}

function applyState(stateJson) {
  const g = E.deserializeGame(stateJson);
  g.online = { myPid: online.seat - 1, code: online.code };
  S.game = g;
  S.selectedHeroId = null;
  online.waiting = false;
  setScreen('map');
  refreshAll();
  if (g.gameOver) {
    showGameOver(g);
  } else if (g.online.myPid === g.turn) {
    toast('Your turn!', 'news');
  } else {
    toast('Waiting for the other player…', 'news');
  }
}

function onMessage(ev) {
  let msg = null;
  try { msg = JSON.parse(ev.data); } catch (e) { return; }
  if (!msg || !msg.t) return;
  if (msg.t === 'started' || msg.t === 'state') {
    if (msg.nonce !== undefined && msg.nonce === online.lastNonce) return;
    if (msg.nonce !== undefined) online.lastNonce = msg.nonce;
    applyState(msg.state);
  } else if (msg.t === 'join') {
    online.phase = 1;
    const startBtn = document.getElementById('mpStartBtn');
    if (startBtn) { startBtn.disabled = false; startBtn.hidden = false; }
    const st = document.getElementById('mpStatus');
    if (st) st.textContent = 'Opponent joined! Start the match when ready.';
  } else if (msg.t === 'left') {
    toast('The other player left the match', 'badnews');
    online.phase = 0;
  }
}

function onClose(ev) {
  const code = online.code;
  if (!code) return;
  online.socket = null;
  if (ev && (ev.code === 4403 || ev.code === 4429)) {
    toast('Match server refused the connection');
    return;
  }
  if (online.reconnectAttempts >= 6) {
    toast('Lost connection to the match server', 'badnews');
    return;
  }
  const delay = Math.min(10000, 1500 * Math.pow(1.6, online.reconnectAttempts++));
  setTimeout(reconnect, delay);
}

async function reconnect() {
  if (!online.code) return;
  try {
    await openSocket();
    const r = parseReply(await rpc('joinLobby', JSON.stringify({ code: online.code })));
    if (r && r.ok) {
      online.seat = r.seat;
      online.phase = r.phase || 0;
      online.reconnectAttempts = 0;
      persist();
      if (online.phase === 1 && r.state) applyState(r.state);
      else if (online.phase === 0) toast('Reconnected to lobby');
    }
  } catch (e) {
    online.socket = null;
    if (online.reconnectAttempts < 6) {
      setTimeout(reconnect, Math.min(10000, 1500 * Math.pow(1.6, online.reconnectAttempts++)));
    }
  }
}

export async function leaveMatch() {
  if (online.socket) {
    try { await rpc('leaveLobby', '{}'); } catch (e) {}
  }
  closeSocket();
  online.code = null;
  online.seat = 0;
  online.phase = 0;
  online.waiting = false;
  online.reconnectAttempts = 0;
  clearPersistedSession();
  if (S.game) S.game.online = null;
  S.game = null;
  document.getElementById('leaveMatchBtn').hidden = true;
  setScreen('title');
}
