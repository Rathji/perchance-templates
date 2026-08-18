import { FACTIONS, CREATURES, factionCreatures, buildingsFor, SPELLS, GUILD_SPELLS, SKILLS,
  TERRAIN, RESOURCES, RES_BY_ID, HERO_NAMES, TOWN_NAMES, ARTIFACTS, ARTIFACT_BY_ID,
  MOVEMENT_BASE, XP_PER_LEVEL, HERO_STATS_BASE, HERO_BUY_COST } from './data.js';
import { DIRS, hexDist, inBounds, key } from './hex.js';
import { parseMapRows } from './mapformat.js';

// ---------- RNG ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let uid = 1;
export function nextId(prefix) { return prefix + (uid++); }

// ---------- helpers ----------
export function armyValue(stacks) {
  return (stacks || []).reduce((s, st) => s + (st && CREATURES[st.id] ? CREATURES[st.id].cost.gold * st.count : 0), 0);
}
export function playerHas(game, pid, res) { return game.players[pid].resources[res] >= 0; }
export function spendRes(game, pid, cost) {
  const p = game.players[pid];
  for (const k in cost) { p.resources[k] -= cost[k]; if (p.resources[k] < 0) p.resources[k] = 0; }
}
export function canAfford(game, pid, cost) {
  const p = game.players[pid];
  return Object.entries(cost || {}).every(([k, v]) => p.resources[k] >= v);
}

export function findHero(game, id) { return game.heroes.find(h => h.id === id); }
export function findTown(game, id) { return game.towns.find(t => t.id === id); }
export function objAt(game, q, r) { return game.objects.find(o => o.q === q && o.r === r) || null; }
export function heroAt(game, q, r) { return game.heroes.find(h => h.q === q && h.r === r) || null; }
export function townAt(game, q, r) { return game.towns.find(t => t.q === q && t.r === r) || null; }

// ---------- terrain / movement ----------
export function terrainOf(game, q, r) { return game.map.terrain[r][q]; }
export function isPassable(game, q, r, hero) {
  if (!inBounds(q, r, game.w, game.h)) return false;
  const t = terrainOf(game, q, r);
  if (TERRAIN[t].cost >= 0) return true;
  return t === 'water' && hero?.boat === true;
}
export function moveCost(game, q, r, hero) {
  const t = TERRAIN[terrainOf(game, q, r)];
  let c = t.cost;
  if (c < 0) c = hero?.boat === true ? 100 : 9999;
  const pf = hero?.skills?.pathfinding;
  if (pf) c *= (1 - pf * 0.15);
  return Math.max(50, Math.round(c));
}

export function occupiedBy(game, q, r, selfHero = null) {
  const h = heroAt(game, q, r);
  if (h && h !== selfHero) return h;
  return null;
}

function isBlockingObj(game, o) {
  if (!o) return false;
  if (o.type === 'stack') return true;
  if (o.type === 'dwelling' && o.guard) return true;
  if (o.type === 'mine' && o.owner !== null && o.owner !== undefined && game.players[o.owner].isAI !== undefined) {
    // enemy-owned mines are capturable by walking on — not blocking
    return false;
  }
  return false;
}

export function isBlocked(game, q, r, selfHero = null) {
  if (!isPassable(game, q, r, selfHero)) return true;
  if (occupiedBy(game, q, r, selfHero)) return true;
  const town = townAt(game, q, r);
  if (town && town.owner !== null && town.owner !== undefined) {
    const townOwner = town.owner;
    const me = selfHero ? selfHero.pid : -1;
    if (townOwner !== me) return true; // enemy town blocks
  }
  const o = objAt(game, q, r);
  if (o && o.type === 'stack') return true;
  if (o && o.type === 'dwelling' && o.guard) return true;
  return false;
}

export function heroMaxMove(hero) {
  let m = MOVEMENT_BASE;
  const lvl = hero.skills?.logistics || 0;
  m *= (1 + lvl * 0.15);
  return Math.round(m) + artifactBonus(hero, 'move');
}

// ---------- artifacts ----------
export function equippedArtifacts(hero) {
  return Object.values(hero.artifacts || {}).filter(a => a);
}
export function artifactBonus(hero, stat) {
  return equippedArtifacts(hero).reduce((s, a) => s + (a[stat] || 0), 0);
}
export function heroEffAtk(hero) { return hero.atk + artifactBonus(hero, 'atk'); }
export function heroEffDef(hero) { return hero.def + artifactBonus(hero, 'def'); }
export function heroEffPow(hero) { return hero.pow + artifactBonus(hero, 'pow'); }
export function heroEffKnow(hero) { return hero.know + artifactBonus(hero, 'know'); }
export function heroLuckBonus(hero) { return artifactBonus(hero, 'luck'); }
export function equipArtifact(hero, artifactId) {
  const a = ARTIFACT_BY_ID[artifactId];
  if (!a) return false;
  if (hero.artifacts[a.slot]) return false;
  hero.artifacts[a.slot] = a;
  return true;
}

// Dijkstra reachable set + parents. Returns {costs: Map(key->{q,r,cost}), parent: Map(key->key)}
export function reachable(game, hero, maxCost) {
  const costs = new Map();
  const parent = new Map();
  const startKey = key(hero.q, hero.r);
  costs.set(startKey, { q: hero.q, r: hero.r, cost: 0 });
  const open = [{ q: hero.q, r: hero.r, cost: 0 }];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    for (const [dq, dr] of DIRS) {
      const nq = cur.q + dq, nr = cur.r + dr;
      if (!inBounds(nq, nr, game.w, game.h)) continue;
      if (isBlocked(game, nq, nr, hero)) continue;
      const nk = key(nq, nr);
      if (costs.has(nk)) continue;
      const nc = cur.cost + moveCost(game, nq, nr, hero);
      if (nc > maxCost) continue;
      costs.set(nk, { q: nq, r: nr, cost: nc });
      parent.set(nk, key(cur.q, cur.r));
      open.push({ q: nq, r: nr, cost: nc });
    }
  }
  return { costs, parent };
}

export function pathTo(game, hero, targetQ, targetR, maxCost) {
  const { costs, parent } = reachable(game, hero, maxCost);
  const tk = key(targetQ, targetR);
  if (!costs.has(tk)) return null;
  const path = [];
  let k = tk;
  while (k !== key(hero.q, hero.r)) {
    const [q, r] = k.split(',').map(Number);
    path.push({ q, r });
    k = parent.get(k);
    if (k === undefined) break;
  }
  return path.reverse();
}

export function canAttack(game, hero, tq, tr) {
  const { costs } = reachable(game, hero, hero.move);
  for (const [dq, dr] of DIRS) {
    const nq = tq + dq, nr = tr + dr;
    if (key(nq, nr) === key(hero.q, hero.r)) return true;
    if (costs.has(key(nq, nr))) return true;
  }
  return false;
}

// Moves hero along a precomputed path, applying interactions en route.
export function moveHeroPath(game, hero, path, onEvent = null) {
  for (const step of path) {
    const cost = moveCost(game, step.q, step.r, hero);
    if (hero.move < cost) break;
    // sailing to land leaves the boat behind on the water hex
    if (hero.boat === true && terrainOf(game, hero.q, hero.r) === 'water' &&
        TERRAIN[terrainOf(game, step.q, step.r)].cost >= 0) {
      hero.boat = false;
      game.objects.push({ id: nextId('o'), type: 'boat', q: hero.q, r: hero.r });
      if (onEvent) onEvent({ type: 'disembark' });
    }
    hero.move -= cost;
    hero.q = step.q; hero.r = step.r;
    const ev = interactAt(game, hero, step.q, step.r);
    if (ev && onEvent) onEvent(ev);
    if (ev && ev.type === 'town') { hero.move = 0; break; }
    if (game.gameOver) break;
  }
}

// Board a moored boat (hero must be on a land hex adjacent to it).
export function embarkHero(game, hero, obj) {
  hero.q = obj.q; hero.r = obj.r;
  hero.boat = true;
  hero.move = Math.max(0, hero.move - 100);
  removeObj(game, obj);
}

// ---------- heroes ----------
export function makeHero(game, pid, faction, name, q, r, startArmy = null) {
  const hero = {
    id: nextId('h'), pid, name: name || 'Hero', q, r,
    atk: HERO_STATS_BASE.atk, def: HERO_STATS_BASE.def, pow: HERO_STATS_BASE.pow, know: HERO_STATS_BASE.know,
    xp: 0, level: 1, pendingLevels: 0, skills: {},
    artifacts: { weapon: null, head: null, body: null, neck: null, feet: null },
    army: new Array(7).fill(null), move: 0, mana: 0, spells: [], boat: false,
  };
  if (startArmy) placeArmy(hero, startArmy);
  hero.move = heroMaxMove(hero);
  hero.mana = maxMana(hero);
  game.heroes.push(hero);
  return hero;
}

export function startArmyFor(faction) {
  const cs = factionCreatures(faction);
  return [{ id: cs[0].id, count: 14 }, { id: cs[1].id, count: 9 }, { id: cs[2].id, count: 5 }];
}

export function placeArmy(hero, stacks) {
  for (const st of stacks) addToArmy(hero, st.id, st.count);
}

export function addToArmy(hero, id, count) {
  for (const slot of hero.army) {
    if (slot && slot.id === id) { slot.count += count; return; }
  }
  const empty = hero.army.findIndex(s => !s);
  if (empty >= 0) hero.army[empty] = { id, count };
  else return null; // no room
}

export function maxMana(hero) {
  const int = hero.skills?.intelligence || 0;
  return Math.round(heroEffKnow(hero) * 10 * (1 + int * 0.25)) + artifactBonus(hero, 'mana');
}

export function xpToNext(level) { return level * XP_PER_LEVEL; }
export function giveXp(game, hero, amt) {
  hero.xp += amt;
  while (hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    hero.pendingLevels++;
    const roll = Math.random();
    if (roll < 0.35) hero.atk++;
    else if (roll < 0.7) hero.def++;
    else if (roll < 0.85) hero.pow++;
    else hero.know++;
  }
}

export function availableSkills(hero, n) {
  const pool = Object.keys(SKILLS).filter(k => (hero.skills[k] || 0) < SKILLS[k].max);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}
export function applySkill(hero, skillId) {
  hero.skills[skillId] = (hero.skills[skillId] || 0) + 1;
}

// ---------- towns ----------
export function townIncome(town) {
  let inc = 0;
  for (const b of ['townhall', 'cityhall', 'capitol']) if (town.buildings.includes(b)) inc += { townhall: 500, cityhall: 1000, capitol: 2000 }[b];
  return inc;
}
export function townGrowthMult(town) {
  let m = 0;
  for (const b of ['fort', 'citadel', 'castle']) if (town.buildings.includes(b)) m += { fort: 0.25, citadel: 0.5, castle: 1.0 }[b];
  return m;
}

// Fortification level used in siege battles: castle=3, citadel=2, fort=1, none=0.
export function townFortLevel(town) {
  if (town.buildings.includes('castle')) return 3;
  if (town.buildings.includes('citadel')) return 2;
  if (town.buildings.includes('fort')) return 1;
  return 0;
}
export function townCanBuild(town, building, game) {
  const def = buildingsFor(town.faction).find(b => b.id === building.id);
  if (town.buildings.includes(building.id)) return { ok: false, reason: 'Built' };
  if (!def) return { ok: false, reason: 'Unknown' };
  for (const req of def.requires || []) if (!town.buildings.includes(req)) return { ok: false, reason: 'Requires ' + req };
  return { ok: true };
}
export function buildInTown(game, town, bId) {
  const def = buildingsFor(town.faction).find(b => b.id === bId);
  if (!def || town.buildings.includes(bId)) return false;
  if (!canAfford(game, town.owner, def.cost)) return false;
  const chk = townCanBuild(town, def, game);
  if (!chk.ok) return false;
  spendRes(game, town.owner, def.cost);
  town.buildings.push(bId);
  if (def.provides) {
    if (!town.stock) town.stock = {};
    town.stock[def.tier] = town.stock[def.tier] || { base: 0, up: 0 };
  }
  return true;
}

export function townSpells(town) {
  const guildLevel = Math.max(0, town.buildings.filter(b => b.startsWith('mages')).length);
  const list = [];
  for (let i = 0; i < guildLevel; i++) for (const s of GUILD_SPELLS[i]) if (!list.includes(s)) list.push(s);
  return list.map(id => SPELLS[id]);
}

export function learnTownSpells(hero, town) {
  for (const s of townSpells(town)) if (!hero.spells.includes(s.id)) hero.spells.push(s.id);
}

export function townRecruitCosts(town) {
  const defs = buildingsFor(town.faction);
  const out = [];
  for (let tier = 1; tier <= 7; tier++) {
    const base = defs.find(d => d.id === `dwelling${tier}`);
    const up = defs.find(d => d.id === `dwelling${tier}u`);
    if (!base || !town.buildings.includes(base.id)) continue;
    const upgraded = up && town.buildings.includes(up.id);
    const id = upgraded ? CREATURES[base.provides].upgrade : base.provides;
    out.push({ tier, id, upgraded, growth: CREATURES[id].growth });
  }
  return out;
}

// ---------- calendar & turn ----------
export function newDay(game) {
  game.day++;
  if (game.day > 7) {
    game.day = 1;
    game.week++;
    if (game.week > 4) { game.week = 1; game.month++; }
    weeklyGrowth(game);
  }
}
export function weeklyGrowth(game) {
  for (const town of game.towns) {
    if (town.owner === null || town.owner === undefined) continue;
    const mult = 1 + townGrowthMult(town);
    for (const r of townRecruitCosts(town)) {
      if (!town.stock) town.stock = {};
      town.stock[r.tier] = town.stock[r.tier] || { base: 0, up: 0 };
      const key = r.upgraded ? 'up' : 'base';
      town.stock[r.tier][key] += Math.round(CREATURES[r.id].growth * mult);
    }
  }
  for (const o of game.objects) {
    if (o.type === 'dwelling' && o.owner !== null && o.owner !== undefined && !o.guard) {
      o.stock += CREATURES[o.creatureId].growth * 2;
    }
  }
}

export function startPlayerTurn(game, player) {
  const pid = player.id;
  // income
  let gold = 0, res = {};
  for (const o of game.objects) if (o.type === 'mine' && o.owner === pid) {
    const inc = MINE_INCOME[o.sub];
    if (inc.gold) gold += inc.gold; else for (const k in inc) res[k] = (res[k] || 0) + inc[k];
  }
  for (const t of game.towns) if (t.owner === pid) gold += townIncome(t);
  const estates = game.heroes.filter(h => h.pid === pid).reduce((s, h) => s + (h.skills?.estates || 0) * 200, 0);
  const artGold = game.heroes.filter(h => h.pid === pid).reduce((s, h) => s + artifactBonus(h, 'gold'), 0);
  gold += estates + artGold;
  player.resources.gold += gold;
  for (const k in res) player.resources[k] += res[k];
  if (gold) log(`${player.name} collects ${gold} gold/day income`);
  for (const h of game.heroes) if (h.pid === pid) {
    h.move = heroMaxMove(h);
    h.mana = maxMana(h);
  }
  autoLevelAI(game);
}
export const MINE_INCOME = {
  gold: { gold: 500 }, wood: { wood: 2 }, ore: { ore: 2 },
  gems: { gems: 1 }, crystal: { crystal: 1 }, sulfur: { sulfur: 1 }, mercury: { mercury: 1 },
};

// ---------- interactions ----------
// Returns an event object for the UI to react to, or null.
export function interactAt(game, hero, q, r) {
  const o = objAt(game, q, r);
  const town = townAt(game, q, r);
  if (town) {
    if (town.owner === hero.pid) return { type: 'town', town };
    return null; // enemy town — handled by attack path
  }
  if (!o) return null;
  if (o.type === 'gold' || o.type === 'wood' || o.type === 'ore' || o.type === 'gems' ||
      o.type === 'crystal' || o.type === 'sulfur' || o.type === 'mercury') {
    game.players[hero.pid].resources[o.type] += o.amt;
    removeObj(game, o);
    return { type: 'collect', res: o.type, amt: o.amt };
  }
  if (o.type === 'chest') {
    removeObj(game, o);
    if (o.gold) { game.players[hero.pid].resources.gold += o.gold; return { type: 'chest', gold: o.gold }; }
    giveXp(game, hero, o.xp);
    return { type: 'chest', xp: o.xp };
  }
  if (o.type === 'artifact') {
    const a = ARTIFACT_BY_ID[o.artifactId];
    removeObj(game, o);
    if (hero.artifacts[a.slot]) {
      const replaced = hero.artifacts[a.slot];
      hero.artifacts[a.slot] = a;
      return { type: 'artifactSwap', name: a.name, replaced: replaced.name };
    }
    if (equipArtifact(hero, o.artifactId)) return { type: 'artifact', name: a.name };
    return { type: 'artifactFull', name: a.name };
  }
  if (o.type === 'mine') {
    const prev = o.owner;
    o.owner = hero.pid;
    return { type: 'mine', sub: o.sub, captured: prev !== hero.pid };
  }
  if (o.type === 'boat') {
    // Only reachable while already sailing — pick up the spare boat.
    removeObj(game, o);
    return null;
  }
  if (o.type === 'dwelling') {
    if (o.guard) return null; // must fight
    return { type: 'dwelling', obj: o };
  }
  if (o.type === 'shrine') {
    removeObj(game, o);
    const xp = 350 + hero.level * 150;
    giveXp(game, hero, xp);
    return { type: 'shrine', xp };
  }
  if (o.type === 'manaWell') {
    if (o.week === game.week) return { type: 'manaWell', recharged: false };
    o.week = game.week;
    hero.mana = maxMana(hero);
    return { type: 'manaWell', recharged: true };
  }
  if (o.type === 'windmill') {
    if (o.week === game.week) return { type: 'windmill', recharged: false };
    o.week = game.week;
    const gold = 500 + Math.floor(Math.random() * 400);
    const others = ['wood', 'ore', 'gems', 'crystal', 'sulfur', 'mercury'];
    const res = others[Math.floor(Math.random() * others.length)];
    const amt = 3 + Math.floor(Math.random() * 4);
    game.players[hero.pid].resources.gold += gold;
    game.players[hero.pid].resources[res] += amt;
    return { type: 'windmill', recharged: true, gold, res, amt };
  }
  if (o.type === 'tradePost') return { type: 'tradePost' };
  if (o.type === 'refugeeCamp') {
    if (o.week === game.week) return { type: 'refugeeCamp', recharged: false };
    o.week = game.week;
    const c = factionCreatures(game.factions[hero.pid])[0];
    const count = 4 + Math.floor(Math.random() * 5);
    addToArmy(hero, c.id, count);
    return { type: 'refugeeCamp', recharged: true, creature: c.id, count };
  }
  return null;
}

export function removeObj(game, o) {
  const i = game.objects.indexOf(o);
  if (i >= 0) game.objects.splice(i, 1);
}

// ---------- battle application ----------
// battle: from combat.js; meta: {kind, objId, attackerHeroId, defenderHeroId}
export function resolveBattle(game, battle, meta) {
  const att = battle.attacker, def = battle.defender;
  const attHero = meta.attackerHeroId ? findHero(game, meta.attackerHeroId) : null;
  const defHero = meta.defenderHeroId ? findHero(game, meta.defenderHeroId) : null;
  const attWon = battle.winner === 'att';

  if (attHero) {
    attHero.army = new Array(7).fill(null);
    placeArmy(attHero, battle.results.attStacks);
    if (!battle.results.attStacks.length) killHero(game, attHero);
    else {
      const gained = Math.floor(armyValue(def.stacksInput) / 20) + 200;
      giveXp(game, attHero, gained);
    }
  }
  if (defHero) {
    defHero.army = new Array(7).fill(null);
    placeArmy(defHero, battle.results.defStacks);
    if (!battle.results.defStacks.length) killHero(game, defHero);
    else {
      const gained = Math.floor(armyValue(att.stacksInput) / 20) + 200;
      giveXp(game, defHero, gained);
    }
  }

  if (meta.kind === 'stack') {
    const o = game.objects.find(x => x.id === meta.objId);
    if (o) {
      if (attWon) {
        const rewards = [];
        removeObj(game, o);
        if (o.gold) { game.players[att.pid].resources.gold += o.gold; rewards.push(`${o.gold} gold`); }
        if (o.xp && attHero) { giveXp(game, attHero, o.xp); rewards.push(`${o.xp} XP`); }
        if (o.prizeArtifact && attHero) {
          const a = ARTIFACTS[Math.floor(Math.random() * ARTIFACTS.length)];
          if (equipArtifact(attHero, a.id)) rewards.push(`Artifact: ${a.name}`);
          else { game.players[att.pid].resources.gold += 2000; rewards.push('2000 gold (artifact slots full)'); }
        }
        battle.results.rewards = rewards;
      }
    }
  } else if (meta.kind === 'dwelling') {
    const o = game.objects.find(x => x.id === meta.objId);
    if (o && attWon) { o.guard = null; o.owner = att.pid; o.stock = CREATURES[o.creatureId].growth * 2; }
  } else if (meta.kind === 'town') {
    const town = findTown(game, meta.objId);
    if (town && attWon) {
      town.owner = att.pid;
      town.guard = null;
    }
  } else if (meta.kind === 'hero') {
    // loser already killed above via killHero
  }

  autoLevelAI(game);
  checkGameOver(game);
}

export function killHero(game, hero) {
  const i = game.heroes.indexOf(hero);
  if (i >= 0) game.heroes.splice(i, 1);
}

export function autoLevelAI(game) {
  for (const h of game.heroes) {
    if (!game.players[h.pid]?.isAI || h.pendingLevels <= 0) continue;
    while (h.pendingLevels > 0) {
      const opts = availableSkills(h, 1);
      if (!opts.length) { h.pendingLevels = 0; break; }
      applySkill(h, opts[0]);
      h.pendingLevels--;
    }
  }
}

export function isAlive(game, pid) {
  return game.heroes.some(h => h.pid === pid) || game.towns.some(t => t.owner === pid);
}

export function checkGameOver(game) {
  if (game.gameOver) return game.gameOver;
  const survivors = game.players.filter(p => isAlive(game, p.id));
  if (survivors.length <= 1) {
    const last = survivors[0];
    game.gameOver = last ? (last.isAI ? 'lose' : 'win') : 'lose';
    return game.gameOver;
  }
  return null;
}

// ---------- map generation ----------
const BASE_RES = { gold: 6000, wood: 10, ore: 10, gems: 3, crystal: 3, sulfur: 3, mercury: 3 };

export function newGame(opts = {}) {
  const w = opts.w || 24, h = opts.h || 16;
  const seed = opts.seed ?? ((Math.random() * 1e9) | 0);
  const numHumans = Math.max(1, Math.min(4, opts.humans ?? 1));
  const numPlayers = Math.max(2, Math.min(4, opts.numPlayers || 2));
  const humanFaction = opts.humanFaction || 'castle';
  const difficulty = opts.difficulty || 'normal';
  const rng = mulberry32(seed);
  const humans = Math.min(numHumans, numPlayers);

  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({ id: i, name: i === 0 ? 'You' : `Player ${i + 1}`, isAI: i >= humans, resources: { ...BASE_RES } });
  }
  if (difficulty === 'easy') for (let i = 0; i < humans; i++) players[i].resources.gold += 2500;
  if (difficulty === 'hard') for (let i = humans; i < numPlayers; i++) players[i].resources.gold += 2000;

  // faction assignment: human picks, AI get the rest (random order)
  const factions = [humanFaction];
  const others = Object.keys(FACTIONS).filter(f => f !== humanFaction);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  for (let i = 1; i < numPlayers; i++) factions.push(others[(i - 1) % others.length]);

  const startPos = startPositionsFor(w, h, numPlayers);
  const game = {
    version: 2, seed, w, h, difficulty, numPlayers, humans, factions,
    map: { terrain: null },
    players,
    towns: [], heroes: [], objects: [],
    day: 1, week: 1, month: 1, turn: 0, gameOver: null,
  };
  if (opts.mapRows) {
    applyMapRows(game, opts.mapRows, rng);
  } else {
    game.map.terrain = genTerrain(w, h, rng, startPos);
    genObjects(game, rng, startPos, factions);
  }
  return game;
}

// Build a game from an authored text map (rows of chars — see mapformat.js).
// Player-town digits become player start towns with a hero next to each;
// object characters become real objects. Returns false if rows are invalid.
export function applyMapRows(game, rows, rng) {
  const parsed = parseMapRows(rows);
  if (!parsed) return false;
  game.map.terrain = parsed.terrain;
  game.w = parsed.w;
  game.h = parsed.h;
  const factions = game.factions;
  const factionsSet = [...new Set(factions)];
  const addObj = (o) => { o.id = nextId('o'); game.objects.push(o); return o; };

  for (const t of parsed.towns) {
    const isPlayer = t.player !== null && t.player < game.players.length;
    if (isPlayer) {
      const faction = factions[t.player];
      const town = makeTown(faction, t.q, t.r, t.player, pickTownName(rng, faction));
      game.towns.push(town);
      const hs = neighborSpot(game, t);
      const army = startArmyFor(faction);
      makeHero(game, t.player, faction, pickName(rng, faction), hs.q, hs.r, army);
    } else {
      const f = factionsSet.length ? factionsSet[Math.floor(rng() * factionsSet.length)] : 'rampart';
      const town = makeTown(f, t.q, t.r, null, pickTownName(rng, f));
      town.guard = makeNeutralArmy(rng, f, 3, 6000, 9000);
      game.towns.push(town);
    }
  }
  if (game.difficulty === 'hard') {
    for (const hero of game.heroes) {
      if (!game.players[hero.pid]?.isAI) continue;
      const cs = factionCreatures(factions[hero.pid]);
      addToArmy(hero, cs[2].id, 4);
      addToArmy(hero, cs[3].id, 2);
    }
  }

  const pileAmts = {
    gold: () => 600 + Math.floor(rng() * 900),
    wood: () => 4 + Math.floor(rng() * 5),
    ore: () => 4 + Math.floor(rng() * 5),
    gems: () => 2 + Math.floor(rng() * 3),
    crystal: () => 2 + Math.floor(rng() * 3),
    sulfur: () => 2 + Math.floor(rng() * 2),
    mercury: () => 2 + Math.floor(rng() * 2),
  };
  for (const o of parsed.objects) {
    const { q, r, type } = o;
    if (type === 'mine') addObj({ type: 'mine', sub: 'gold', owner: null, q, r });
    else if (pileAmts[type]) addObj({ type, amt: pileAmts[type](), q, r });
    else if (type === 'chest') {
      const chest = { type: 'chest', q, r };
      if (rng() < 0.5) chest.gold = 1000 + Math.floor(rng() * 2000);
      else chest.xp = 600 + Math.floor(rng() * 1000);
      addObj(chest);
    } else if (type === 'artifact') {
      const roll = rng();
      const tier = roll < 0.6 ? 1 : roll < 0.9 ? 2 : 3;
      const pool = ARTIFACTS.filter(a => a.tier === tier);
      if (!pool.length) continue;
      const a = pool[Math.floor(rng() * pool.length)];
      addObj({ type: 'artifact', artifactId: a.id, q, r });
    } else if (type === 'dwelling') {
      const f = factionsSet[Math.floor(rng() * factionsSet.length)];
      const tier = 1 + Math.floor(rng() * 5);
      const creature = factionCreatures(f)[tier - 1];
      addObj({ type: 'dwelling', creatureId: creature.id, tier, guard: makeGuard(rng, creature.id), owner: null, stock: 0, q, r });
    } else if (type === 'stack') {
      const f = factionsSet[Math.floor(rng() * factionsSet.length)];
      const band = [[1, 10, 25], [2, 6, 14], [3, 4, 9]][Math.floor(rng() * 3)];
      const c = factionCreatures(f)[band[0] - 1];
      const count = band[1] + Math.floor(rng() * (band[2] - band[1]));
      addObj({ type: 'stack', army: [{ id: c.id, count }], q, r });
    } else if (type === 'shrine' || type === 'manaWell' || type === 'windmill' || type === 'tradePost' || type === 'refugeeCamp') {
      addObj({ type, week: -1, q, r });
    } else if (type === 'boat') {
      addObj({ type, q, r });
    } else if (type === 'graveyard' || type === 'tower' || type === 'bank') {
      const o = { type, q, r };
      if (type === 'graveyard') {
        o.guard = makeNeutralArmy(rng, 'necropolis', 3, 4500, 6500);
        o.gold = 3000 + Math.floor(rng() * 2000);
        o.prizeArtifact = true;
      } else if (type === 'tower') {
        o.guard = makeNeutralArmy(rng, factionsSet[Math.floor(rng() * factionsSet.length)], 4, 7000, 9500);
        o.xp = 3000 + Math.floor(rng() * 2000);
      } else {
        o.guard = makeNeutralArmy(rng, factionsSet[Math.floor(rng() * factionsSet.length)], 4, 9000, 12000);
        o.gold = 6000 + Math.floor(rng() * 3000);
      }
      addObj(o);
    }
  }
  return true;
}

function startPositionsFor(w, h, n) {
  if (n <= 2) return [{ q: 3, r: 3 }, { q: w - 4, r: h - 4 }];
  if (n === 3) return [{ q: 3, r: 3 }, { q: w - 4, r: 3 }, { q: w - 4, r: h - 4 }];
  return [{ q: 3, r: 3 }, { q: w - 4, r: 3 }, { q: 3, r: h - 4 }, { q: w - 4, r: h - 4 }];
}

function genTerrain(w, h, rng, startPos) {
  const g = Array.from({ length: h }, () => new Array(w).fill('grass'));
  const set = (q, r, t) => { if (q >= 0 && q < w && r >= 0 && r < h) g[r][q] = t; };
  const blobs = [
    { t: 'water', n: 5, len: 12 },
    { t: 'rock', n: 8, len: 9 },
    { t: 'trees', n: 8, len: 22 },
    { t: 'dirt', n: 4, len: 20 },
    { t: 'sand', n: 3, len: 18 },
    { t: 'snow', n: 2, len: 8 },
  ];
  for (const b of blobs) {
    for (let i = 0; i < b.n; i++) {
      let q = Math.floor(rng() * w), r = Math.floor(rng() * h);
      for (let s = 0; s < b.len; s++) {
        set(q, r, b.t);
        const [dq, dr] = DIRS[Math.floor(rng() * 6)];
        q += dq; r += dr;
        if (q < 0) q = 0; if (q >= w) q = w - 1;
        if (r < 0) r = 0; if (r >= h) r = h - 1;
      }
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const ng = g.map(row => [...row]);
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
      if (g[r][q] !== 'grass') continue;
      const counts = {};
      for (const [dq, dr] of DIRS) {
        const nq = q + dq, nr = r + dr;
        if (nq < 0 || nq >= w || nr < 0 || nr >= h) continue;
        const t = g[nr][nq];
        if (t !== 'grass') counts[t] = (counts[t] || 0) + 1;
      }
      for (const t in counts) if (counts[t] >= 4) ng[r][q] = t;
    }
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) g[r][q] = ng[r][q];
  }
  // ensure spawn points clear
  for (const p of startPos) {
    for (let dq = -1; dq <= 1; dq++) for (let dr = -1; dr <= 1; dr++) {
      set(p.q + dq, p.r + dr, 'grass');
    }
  }
  return g;
}

function genObjects(game, rng, startPos, factions) {
  const { w, h } = game;
  const spots = [];
  const addObj = (o) => { o.q = Math.floor(o.q); o.r = Math.floor(o.r); game.objects.push(o); return o; };
  const findSpot = (minDist, avoid, tries = 1000) => {
    for (let i = 0; i < tries; i++) {
      const q = Math.floor(rng() * w), r = Math.floor(rng() * h);
      if (!isPassable(game, q, r)) continue;
      if (townAt(game, q, r) || heroAt(game, q, r) || objAt(game, q, r)) continue;
      if (avoid && spots.some(s => hexDist(s, { q, r }) < minDist)) continue;
      return { q, r };
    }
    return null;
  };

  // player towns + heroes
  const n = game.players.length;
  for (let i = 0; i < n; i++) {
    const sp = startPos[i];
    spots.push(sp);
    const townName = pickTownName(rng, factions[i]);
    game.towns.push(makeTown(factions[i], sp.q, sp.r, i, townName));
    const heroStart = neighborSpot(game, sp);
    const army = startArmyFor(factions[i]);
    if (game.difficulty === 'hard' && i > 0) {
      const cs = factionCreatures(factions[i]);
      army.push({ id: cs[2].id, count: 4 });
      army.push({ id: cs[3].id, count: 2 });
    }
    makeHero(game, i, factions[i], pickName(rng, factions[i]), heroStart.q, heroStart.r, army);
  }

  // neutral towns
  const neutralFactions = Object.keys(FACTIONS).filter(f => !factions.includes(f));
  const nTowns = [
    { f: neutralFactions[0] || 'rampart', name: 'Fernmire' },
    { f: neutralFactions[1] || 'necropolis', name: 'Gravehall' },
  ];
  for (const t of nTowns) {
    const sp = findSpot(6, spots);
    if (!sp) continue;
    spots.push(sp);
    const town = makeTown(t.f, sp.q, sp.r, null, t.name);
    town.guard = makeNeutralArmy(rng, t.f, 3, 6000, 9000);
    game.towns.push(town);
  }

  // mines (a few near each player's start, rest scattered)
  const mineTypes = ['gold', 'wood', 'ore', 'gems', 'crystal', 'sulfur', 'mercury'];
  for (let i = 0; i < 13; i++) {
    const sub = mineTypes[i % mineTypes.length];
    const near = i < n * 4 ? startPos[i % n] : null;
    const sp = findSpot(near ? 2 : 2, spots);
    if (!sp) continue;
    spots.push(sp);
    addObj({ id: nextId('o'), type: 'mine', sub, owner: null, q: sp.q, r: sp.r });
  }

  // resource piles
  const piles = [
    { type: 'gold', amt: () => 600 + Math.floor(rng() * 900) },
    { type: 'wood', amt: () => 4 + Math.floor(rng() * 5) },
    { type: 'ore', amt: () => 4 + Math.floor(rng() * 5) },
    { type: 'gems', amt: () => 2 + Math.floor(rng() * 3) },
    { type: 'crystal', amt: () => 2 + Math.floor(rng() * 3) },
    { type: 'sulfur', amt: () => 2 + Math.floor(rng() * 2) },
    { type: 'mercury', amt: () => 2 + Math.floor(rng() * 2) },
  ];
  for (let i = 0; i < 24; i++) {
    const p = piles[i % piles.length];
    const sp = findSpot(1, spots);
    if (!sp) continue;
    spots.push(sp);
    addObj({ id: nextId('o'), type: p.type, amt: p.amt(), q: sp.q, r: sp.r });
  }

  // chests
  for (let i = 0; i < 6; i++) {
    const sp = findSpot(2, spots);
    if (!sp) continue;
    spots.push(sp);
    const chest = { id: nextId('o'), type: 'chest', q: sp.q, r: sp.r };
    if (rng() < 0.5) chest.gold = 1000 + Math.floor(rng() * 2000);
    else chest.xp = 600 + Math.floor(rng() * 1000);
    addObj(chest);
  }

  // artifacts (tier 1 common, tier 3 rare)
  const artifactPool = { 1: ARTIFACTS.filter(a => a.tier === 1), 2: ARTIFACTS.filter(a => a.tier === 2), 3: ARTIFACTS.filter(a => a.tier === 3) };
  for (let i = 0; i < 10; i++) {
    const roll = rng();
    const tier = roll < 0.6 ? 1 : roll < 0.9 ? 2 : 3;
    const pool = artifactPool[tier];
    if (!pool.length) continue;
    const a = pool[Math.floor(rng() * pool.length)];
    const sp = findSpot(2, spots);
    if (!sp) continue;
    spots.push(sp);
    addObj({ id: nextId('o'), type: 'artifact', artifactId: a.id, q: sp.q, r: sp.r });
  }

  // dwellings
  for (let i = 0; i < 8; i++) {
    const f = factions[Math.floor(rng() * factions.length)];
    const tier = 1 + Math.floor(rng() * 5);
    const sp = findSpot(1, spots);
    if (!sp) continue;
    spots.push(sp);
    const creature = factionCreatures(f)[tier - 1];
    addObj({
      id: nextId('o'), type: 'dwelling', creatureId: creature.id, tier,
      guard: makeGuard(rng, creature.id), owner: null, stock: 0,
      q: sp.q, r: sp.r,
    });
  }

  // wandering neutral stacks
  const tierCounts = [
    { t: 1, n: [10, 25] }, { t: 2, n: [6, 14] }, { t: 3, n: [4, 9] },
  ];
  for (let i = 0; i < 10; i++) {
    const sp = findSpot(1, spots);
    if (!sp) continue;
    spots.push(sp);
    const tcf = tierCounts[Math.floor(rng() * tierCounts.length)];
    const f = factions[Math.floor(rng() * factions.length)];
    const base = factionCreatures(f)[tcf.t - 1];
    const army = [{ id: base.id, count: tcf.n[0] + Math.floor(rng() * (tcf.n[1] - tcf.n[0] + 1)) }];
    if (rng() < 0.35) {
      const f2 = factions[Math.floor(rng() * factions.length)];
      const t2 = Math.min(3, tcf.t + 1);
      army.push({ id: factionCreatures(f2)[t2 - 1].id, count: Math.max(2, Math.floor(army[0].count / 3)) });
    }
    addObj({
      id: nextId('o'), type: 'stack', army, gold: 300 + Math.floor(rng() * 800), xp: 150 + Math.floor(rng() * 300),
      q: sp.q, r: sp.r,
    });
  }

  // map object variety — free visitables
  const freeObjects = [
    { type: 'shrine', n: 2, min: 2 },
    { type: 'manaWell', n: 2, min: 2 },
    { type: 'windmill', n: 2, min: 1 },
    { type: 'tradePost', n: 2, min: 2 },
    { type: 'refugeeCamp', n: 2, min: 1 },
  ];
  for (const fo of freeObjects) {
    for (let i = 0; i < fo.n; i++) {
      const sp = findSpot(fo.min, spots);
      if (!sp) continue;
      spots.push(sp);
      addObj({ id: nextId('o'), type: fo.type, week: -1, q: sp.q, r: sp.r });
    }
  }

  // boats — on water hexes with at least one usable land neighbor
  const nBoats = Math.min(8, Math.max(3, Math.floor(w * h / 80)));
  let boatsPlaced = 0, boatGuard = 0;
  while (boatsPlaced < nBoats && boatGuard++ < 600) {
    const q = Math.floor(rng() * w), r = Math.floor(rng() * h);
    if (terrainOf(game, q, r) !== 'water') continue;
    if (objAt(game, q, r) || townAt(game, q, r)) continue;
    let landOk = false;
    for (const [dq, dr] of DIRS) {
      const nq = q + dq, nr = r + dr;
      if (nq < 0 || nq >= w || nr < 0 || nr >= h) continue;
      if (isPassable(game, nq, nr) && !objAt(game, nq, nr) && !townAt(game, nq, nr)) { landOk = true; break; }
    }
    if (!landOk) continue;
    addObj({ id: nextId('o'), type: 'boat', q, r });
    boatsPlaced++;
  }

  // guarded prize objects (placed early-ish to guarantee they fit)
  const guardedObjects = [
    { type: 'graveyard', min: 1, faction: 'necropolis', maxTier: 3, minVal: 4500, maxVal: 6500, gold: () => 3000 + Math.floor(rng() * 2000), prizeArtifact: true },
    { type: 'tower', min: 1, faction: null, maxTier: 4, minVal: 7000, maxVal: 9500, xp: () => 3000 + Math.floor(rng() * 2000) },
    { type: 'bank', min: 1, faction: null, maxTier: 4, minVal: 9000, maxVal: 12000, gold: () => 6000 + Math.floor(rng() * 3000) },
  ];
  for (const go of guardedObjects) {
    const sp = findSpot(go.min, spots);
    if (!sp) continue;
    spots.push(sp);
    const f = go.faction || factions[Math.floor(rng() * factions.length)];
    const o = { id: nextId('o'), type: go.type, guard: makeNeutralArmy(rng, f, go.maxTier, go.minVal, go.maxVal), q: sp.q, r: sp.r };
    if (go.gold) o.gold = go.gold();
    if (go.xp) o.xp = go.xp();
    if (go.prizeArtifact) o.prizeArtifact = true;
    addObj(o);
  }
}

function neighborSpot(game, sp) {
  for (const [dq, dr] of DIRS) {
    const q = sp.q + dq, r = sp.r + dr;
    if (isPassable(game, q, r) && !townAt(game, q, r) && !objAt(game, q, r)) return { q, r };
  }
  return { q: Math.max(0, sp.q - 1), r: sp.r };
}

function pickTownName(rng, faction) {
  const names = TOWN_NAMES[faction] || ['Town'];
  return names[Math.floor(rng() * names.length)];
}

function pickName(rng, faction) {
  const names = HERO_NAMES[faction];
  return names[Math.floor(rng() * names.length)];
}

function makeTown(faction, q, r, owner, name) {
  return {
    id: nextId('t'), name, faction, q, r, owner,
    buildings: ['townhall'], guard: null, stock: {},
  };
}

function makeGuard(rng, creatureId) {
  const c = CREATURES[creatureId];
  const count = Math.round(c.growth * (1.2 + rng() * 1.3));
  return [{ id: creatureId, count }];
}

function makeNeutralArmy(rng, faction, maxTier, minVal, maxVal) {
  const cs = factionCreatures(faction);
  const val = minVal + rng() * (maxVal - minVal);
  const army = [];
  let total = 0;
  for (let tier = 1; tier <= maxTier && total < val; tier++) {
    const c = cs[tier - 1];
    const count = Math.max(1, Math.floor((val / maxTier) / c.cost.gold) + (rng() < 0.5 ? 1 : 0));
    if (count > 0) { army.push({ id: c.id, count }); total += count * c.cost.gold; }
  }
  if (!army.length) army.push({ id: cs[0].id, count: 1 });
  return army;
}

// ---------- save / load ----------
export function serializeGame(game) {
  return JSON.stringify(game);
}
export function deserializeGame(str) {
  const game = JSON.parse(str);
  if (!game || !game.map) throw new Error('bad save');
  return game;
}

// ---------- misc ----------
export function hexesInRadius(game, q, r, radius) {
  const out = [];
  for (let dq = -radius; dq <= radius; dq++) for (let dr = -radius; dr <= radius; dr++) {
    if (Math.abs(dq + dr) > radius) continue;
    const nq = q + dq, nr = r + dr;
    if (inBounds(nq, nr, game.w, game.h)) out.push({ q: nq, r: nr });
  }
  return out;
}

let _logSink = null;
export function setLogSink(fn) { _logSink = fn; }
export function log(msg) { if (_logSink) _logSink(msg); }
