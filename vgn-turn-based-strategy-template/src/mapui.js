import { S } from './app.js';
import { MAP_CW, MAP_CH, drawMap, mapLayout } from './render.js';
import { pixelToHex, hexDist } from './hex.js';
import * as E from './engine.js';
import { toast, renderMapNow, updateHeroStrip, updateTopbar } from './hud.js';
import { openTownScreen, openDwellingModal, startCombat, handleHeroEvent } from './screens.js';
import { isMyTurn } from './online.js';

let canvas = null;

export function fitMapCanvas() {
  if (!canvas) return;
  const wrap = document.getElementById('mapWrap');
  const availW = Math.max(100, wrap.clientWidth || 600);
  const availH = Math.max(100, wrap.clientHeight || 400);
  const ar = MAP_CW / MAP_CH;
  let w = availW, h = w / ar;
  if (h > availH) { h = availH; w = h * ar; }
  canvas.style.width = Math.floor(w) + 'px';
  canvas.style.height = Math.floor(h) + 'px';
}

export function setupMapCanvas() {
  canvas = document.getElementById('mapCanvas');
  canvas.width = MAP_CW;
  canvas.height = MAP_CH;
  fitMapCanvas();
  window.addEventListener('resize', fitMapCanvas);
  setTimeout(fitMapCanvas, 50);
  canvas.addEventListener('pointerdown', onMapClick);
  canvas.addEventListener('pointermove', onMapHover);
  canvas.addEventListener('pointerleave', () => { S.hover = null; S.pathPreview = null; renderMapNow(); });
}

function hexFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * (canvas.width / rect.width);
  const y = (evt.clientY - rect.top) * (canvas.height / rect.height);
  const L = mapLayout(S.game);
  const h = pixelToHex(x - L.ox, y - L.oy, L.size);
  return h;
}

function onMapHover(evt) {
  if (S.screen !== 'map' || !S.game) return;
  const h = hexFromEvent(evt);
  S.hover = h;
  S.pathPreview = null;
  const hero = getSelectedHero();
  if (hero) {
    const path = E.pathTo(S.game, hero, h.q, h.r, hero.move);
    if (path && path.length) S.pathPreview = path;
  }
  renderMapNow();
}

function getSelectedHero() {
  const game = S.game;
  if (!game || game.players[game.turn].isAI) return null;
  if (!isMyTurn(game)) return null;
  const hero = S.selectedHeroId ? game.heroes.find(h => h.id === S.selectedHeroId) : null;
  return hero && hero.pid === game.players[game.turn].id ? hero : null;
}

function onMapClick(evt) {
  if (S.screen !== 'map' || !S.game) return;
  const game = S.game;
  if (game.gameOver) return;
  if (!isMyTurn(game)) return;
  const h = hexFromEvent(evt);
  if (h.q < 0 || h.q >= game.w || h.r < 0 || h.r >= game.h) return;
  const hero = getSelectedHero();
  const town = E.townAt(game, h.q, h.r);
  const obj = E.objAt(game, h.q, h.r);
  const heroHere = E.heroAt(game, h.q, h.r);
  const cur = game.players[game.turn];
  const curPid = cur.id;
  const ownTurn = !cur.isAI;

  // select own hero (unless they're standing on their own town — then open the town)
  if (heroHere && heroHere.pid === curPid && ownTurn) {
    if (town && town.owner === curPid) {
      openTownScreen(game, town, heroHere);
      return;
    }
    S.selectedHeroId = heroHere.id;
    updateHeroStrip(game);
    renderMapNow();
    return;
  }

  if (hero && ownTurn) {
    // attackable targets
    const target = targetForHex(game, h.q, h.r, curPid);
    if (target) {
      if (E.canAttack(game, hero, h.q, h.r)) {
        S.selectedHeroId = hero.id;
        startCombat(hero, h.q, h.r);
      } else {
        toast('Move closer to attack that target');
      }
      return;
    }
    // friendly/own town
    if (town && town.owner === hero.pid) {
      const path = E.pathTo(game, hero, h.q, h.r, hero.move);
      if (path) {
        moveAndHandle(hero, h.q, h.r, ev => {
          if (ev && ev.type === 'town') openTownScreen(game, ev.town, hero);
        });
      } else {
        openTownScreen(game, town, hero);
      }
      return;
    }
    if (town && town.owner === null) { toast('Enemy town — attack it to capture'); return; }
    if (obj && obj.type === 'boat') {
      if (hexDist({ q: hero.q, r: hero.r }, { q: obj.q, r: obj.r }) === 1) {
        E.embarkHero(game, hero, obj);
        toast('You board the boat — sail to a shore to disembark', 'news');
        updateTopbar(game);
        updateHeroStrip(game);
        renderMapNow();
      } else {
        toast('Walk next to the boat to board it');
      }
      return;
    }
    if (obj && obj.type === 'dwelling' && obj.guard) {
      if (E.canAttack(game, hero, h.q, h.r)) startCombat(hero, h.q, h.r);
      else toast('Move closer to attack the guardians');
      return;
    }
    // movable object or empty
    moveAndHandle(hero, h.q, h.r, ev => handleHeroEvent(game, hero, ev));
  } else {
    // not a hero-move context: clicking own town opens it
    if (town && town.owner === curPid && ownTurn) {
      openTownScreen(game, town, null);
    }
  }
}

function targetForHex(game, q, r, curPid) {
  const town = E.townAt(game, q, r);
  if (town && town.owner !== curPid && town.owner !== null) return { kind: 'town', objId: town.id };
  const hero = E.heroAt(game, q, r);
  if (hero && hero.pid !== curPid) return { kind: 'hero', objId: hero.id, heroId: hero.id };
  const obj = E.objAt(game, q, r);
  if (obj && (obj.type === 'stack' || obj.guard)) return { kind: 'stack', objId: obj.id };
  return null;
}

function objectEventToast(ev) {
  if (ev.type === 'disembark') toast('You reach the shore — the boat stays behind', 'news');
  else if (ev.type === 'shrine') toast(`Shrine of Wisdom: +${ev.xp} XP`, 'news');
  else if (ev.type === 'manaWell') toast(ev.recharged ? 'Mana restored at the well' : 'Mana Well — already drained this week');
  else if (ev.type === 'windmill') toast(ev.recharged ? `Windmill: +${ev.gold} gold, +${ev.amt} ${ev.res}` : 'Windmill — already ground this week');
  else if (ev.type === 'refugeeCamp') toast(ev.recharged ? `${ev.count} refugees joined your army!` : 'Refugee Camp — empty this week');
  else if (ev.type === 'collect') toast(`Found ${ev.amt} ${ev.res === 'gold' ? 'gold' : ev.res}`);
  else if (ev.type === 'chest') toast(ev.gold ? `Found ${ev.gold} gold in a chest!` : `Chest! +${ev.xp} XP`);
  else if (ev.type === 'mine') toast(ev.captured ? `Captured the ${ev.sub} mine!` : `Visited your ${ev.sub} mine`);
  else if (ev.type === 'artifact') toast(`Found artifact: ${ev.name}!`, 'news');
  else if (ev.type === 'artifactSwap') toast(`Equipped ${ev.name} (replaced ${ev.replaced})`, 'news');
  else if (ev.type === 'artifactFull') toast(`${ev.name} — that slot is already equipped`);
}

function moveAndHandle(hero, q, r, onEvent) {
  const game = S.game;
  const path = E.pathTo(game, hero, q, r, hero.move);
  if (!path) {
    toast('Cannot reach that hex (out of movement)');
    return;
  }
  const events = [];
  E.moveHeroPath(game, hero, path, ev => { events.push(ev); if (onEvent) onEvent(ev); });
  for (const ev of events) objectEventToast(ev);
  if (hero.pendingLevels > 0) handleHeroEvent(game, hero, { type: 'levelup' });
  updateTopbar(game);
  updateHeroStrip(game);
  renderMapNow();
}

export function playerMoveTo(hero, q, r) {
  const game = S.game;
  const path = E.pathTo(game, hero, q, r, hero.move);
  if (!path) return false;
  const events = [];
  E.moveHeroPath(game, hero, path, ev => events.push(ev));
  for (const ev of events) {
    objectEventToast(ev);
    if (ev.type === 'town') openTownScreen(game, ev.town, hero);
    else if (ev.type === 'dwelling') openDwellingModal(game, ev.obj, hero);
    else if (ev.type === 'tradePost') handleHeroEvent(game, hero, ev);
  }
  if (hero.pendingLevels > 0) handleHeroEvent(game, hero, { type: 'levelup' });
  updateTopbar(game);
  updateHeroStrip(game);
  renderMapNow();
  return true;
}
