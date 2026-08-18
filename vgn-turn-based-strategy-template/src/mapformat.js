// Text-map format: the map is authored as rows of characters (one row per line),
// exported from the in-game Map Editor, or written by hand into gameConfig.map.
import { TERRAIN } from './data.js';

export const CHAR_TERRAIN = {
  '.': 'grass', d: 'dirt', s: 'sand', n: 'snow', '~': 'water', r: 'rock', f: 'trees',
};
export const TERRAIN_CHAR = Object.fromEntries(Object.entries(CHAR_TERRAIN).map(([c, t]) => [t, c]));

export const OBJ_CHARS = {
  '0': { type: 'town', player: 0 }, '1': { type: 'town', player: 1 },
  '2': { type: 'town', player: 2 }, '3': { type: 'town', player: 3 },
  T: { type: 'town', player: null },
  G: { type: 'gold' }, W: { type: 'wood' }, O: { type: 'ore' },
  E: { type: 'gems' }, C: { type: 'crystal' }, S: { type: 'sulfur' }, M: { type: 'mercury' },
  '$': { type: 'chest' }, A: { type: 'artifact' }, D: { type: 'dwelling' },
  X: { type: 'stack' }, '*': { type: 'mine' },
  H: { type: 'shrine' }, v: { type: 'manaWell' }, m: { type: 'windmill' },
  P: { type: 'tradePost' }, g: { type: 'graveyard' }, t: { type: 'tower' },
  B: { type: 'bank' }, R: { type: 'refugeeCamp' }, b: { type: 'boat' },
};
const OBJ_CHAR = {
  gold: 'G', wood: 'W', ore: 'O', gems: 'E', crystal: 'C', sulfur: 'S', mercury: 'M',
  chest: '$', artifact: 'A', dwelling: 'D', stack: 'X', mine: '*',
  shrine: 'H', manaWell: 'v', windmill: 'm', tradePost: 'P',
  graveyard: 'g', tower: 't', bank: 'B', refugeeCamp: 'R', boat: 'b',
};

export const LEGEND =
  'Terrain: . grass | d dirt | s sand | n snow | ~ water | r rock | f forest\n' +
  'Towns: 0-3 player starts (a hero spawns next to each) | T neutral town\n' +
  'Resources: G gold  W wood  O ore  E gems  C crystal  S sulfur  M mercury  $ chest\n' +
  'A artifact  D dwelling  X monsters  * gold mine\n' +
  'H shrine  v mana well  m windmill  P trade post  R refugee camp  b boat\n' +
  'g graveyard (guarded)  t watchtower (guarded)  B bank (guarded)';

export function parseMapRows(rows) {
  if (!rows || !rows.length) return null;
  const terrain = [];
  const towns = [];
  const objects = [];
  const w = String(rows[0]).length;
  for (let r = 0; r < rows.length; r++) {
    const row = String(rows[r]);
    if (row.length !== w) return null;
    terrain.push(new Array(w));
    for (let q = 0; q < w; q++) {
      const ch = row[q];
      const t = CHAR_TERRAIN[ch];
      if (t) { terrain[r][q] = t; continue; }
      const o = OBJ_CHARS[ch];
      if (o) {
        terrain[r][q] = 'grass';
        if (o.type === 'town') towns.push({ q, r, player: o.player });
        else objects.push({ q, r, type: o.type });
      } else {
        return null; // unknown character
      }
    }
  }
  return { terrain, towns, objects, w, h: rows.length };
}

export function serializeMapRows(game) {
  const rows = [];
  for (let r = 0; r < game.h; r++) {
    let row = '';
    for (let q = 0; q < game.w; q++) {
      const t = game.map.terrain[r][q];
      row += TERRAIN_CHAR[t] || '.';
    }
    rows.push(row);
  }
  for (const town of game.towns) {
    const ch = town.owner === null || town.owner === undefined ? 'T' : String(town.owner);
    if (!(ch in OBJ_CHARS)) continue;
    rows[town.r] = rows[town.r].slice(0, town.q) + ch + rows[town.r].slice(town.q + 1);
  }
  for (const o of game.objects) {
    const ch = OBJ_CHAR[o.type];
    if (!ch) continue;
    rows[o.r] = rows[o.r].slice(0, o.q) + ch + rows[o.r].slice(o.q + 1);
  }
  return rows;
}
