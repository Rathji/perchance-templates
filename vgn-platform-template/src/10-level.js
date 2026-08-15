
// 10-level.js -- the `Level` namespace: the example level's tile map.
//
// This is the level data for the template's built-in example stage. It is a
// hand-tuned overworld-style map designed to show off every mechanic the
// engine supports: bricks, ? blocks, coin bricks, hidden blocks, pipes,
// staircases, enemies, pits, a goal flag and a finish gate.
//
// COORDINATES. The playfield is ROWS = 15 tile rows tall (row 0 at the top),
// with the 2-row ground band occupying rows 13-14, exactly where 00-core.js
// expects it. Every row below is stored as one string, one char per tile.
//
// HOW TO MAKE YOUR OWN LEVEL: edit the MAP strings below. The LEGEND maps
// each char to a tile type. Keep every row exactly WIDTH_COLS chars long
// (the column ruler above MAP marks every 5 columns) — Level.init() rebuilds
// the collision grid straight from these strings. Add enemies and block
// contents via SPAWNS_MASTER and CONTENTS_MASTER (keys are "col,row").
//
// WIDTH_COLS = 212 is the example level's length; shrink or grow it freely
// as long as MAP rows and WIDTH_COLS agree.
(function () {

  var TILE = {
    EMPTY: 0,
    GROUND: 1,
    BRICK: 2,
    QUESTION: 3,
    USED: 4,
    SOLID: 5,
    PIPE_TL: 6,
    PIPE_TR: 7,
    PIPE_BL: 8,
    PIPE_BR: 9,
    STAIR: 10,
    FLAGPOLE: 11,
    FLAGTOP: 12,
    COIN_BRICK: 13,
    INVIS_1UP: 14
  };

  // char -> TILE. The level below is one string per row, one char per tile,
  // so it is readable in source and reviewable in a diff.
  var LEGEND = {
    '.': TILE.EMPTY,
    '#': TILE.GROUND,      // floor, grid rows 13-14
    'B': TILE.BRICK,
    '?': TILE.QUESTION,
    'U': TILE.USED,
    'S': TILE.SOLID,       // goal-flag base block
    '[': TILE.PIPE_TL, ']': TILE.PIPE_TR,
    '{': TILE.PIPE_BL, '}': TILE.PIPE_BR,
    'X': TILE.STAIR,       // staircases + solid-block columns
    '|': TILE.FLAGPOLE, 'T': TILE.FLAGTOP,
    'C': TILE.COIN_BRICK,  // the ~10-coin brick
    'H': TILE.INVIS_1UP    // hidden extra-life block: solid, must not be drawn
  };

  var WIDTH_COLS = 212;
  var ROWS = 15;         // must equal Game.LEVEL_ROWS; checked in init()

  // Column ruler for the map below (marks every 10 columns, + every 5):
  // 0         10        20        30        40        50        60        70        80        90        100       110       120       130       140       150       160       170       180       190       200       210
  // |----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|----+----|-
  var MAP = [
    '....................................................................................................................................................................................................................', // row  0  sky
    '....................................................................................................................................................................................................................', // row  1  sky
    '......................................................................................................................................................................................................T.............', // row  2  goal-flag ball (col 198)
    '......................................................................................................................................................................................................|.............', // row  3  flagpole shaft
    '......................................................................................................................................................................................................|.............', // row  4  flagpole shaft
    '......................?.........................................................BBBBBBBB...BBB?..............?...........BBB....B??B........................................................XX........|.............', // row  5  high blocks; 8-brick row 80-87; final-staircase top 188-189
    '...........................................................................................................................................................................................XXX........|.............', // row  6
    '..........................................................................................................................................................................................XXXX........|.............', // row  7
    '................................................................H........................................................................................................................XXXXX........|.............', // row  8  hidden extra-life block (col 64, invisible)
    '................?...B?B?B.....................[].........[]..................B?B..............C.....BB....?..?..?.....B..........BB......X..X..........XX..X............BB?B............XXXXXX........|.............', // row  9  low block row; pipe tops; multi-coin brick 94; star brick 101
    '......................................[]......{}.........{}.............................................................................XX..XX........XXX..XX..........................XXXXXXX........|.............', // row 10
    '............................[]........{}......{}.........{}............................................................................XXX..XXX......XXXX..XXX.....[]..............[].XXXXXXXX........|.............', // row 11
    '............................{}........{}......{}.........{}...........................................................................XXXX..XXXX....XXXXX..XXXX....{}..............{}XXXXXXXXX........S.............', // row 12  goal-flag base block at col 198
    '#####################################################################..###############...################################################################..#########################################################', // row 13  floor  (gaps = the three bottomless pits)
    '#####################################################################..###############...################################################################..#########################################################' // row 14  floor
  ];

  // ---- item contents, one entry per strikeable block that holds something.
  // Kinds: 'coin', 'coin10' (a brick that pays out ~10 coins), 'mushroom'
  // (grow big / score), 'flower' (powered state — a mushroom block upgrades
  // to a flower for an already-big hero), 'star' (invincibility), '1up'
  // (extra life).
  var CONTENTS_MASTER = {
    '16,9': 'coin',   // first ? block (isolated, low)
    '21,9': 'mushroom',   // first power-up in the example level
    '22,5': 'coin',   // the lone high ? block above the first row
    '23,9': 'coin',
    '64,8': '1up',   // HIDDEN extra-life block (invisible, still solid)
    '78,9': 'mushroom',   // second power-up ? block
    '94,5': 'coin',
    '94,9': 'coin10',   // MULTI-COIN BRICK (~10 coins)
    '101,9': 'star',   // STAR brick
    '106,9': 'coin',
    '109,5': 'mushroom',   // third power-up ? block
    '109,9': 'coin',
    '112,9': 'coin',
    '129,5': 'coin',   // two-high row of ? blocks
    '130,5': 'coin',   // two-high row of ? blocks
    '170,9': 'coin'
  };

  // ---- enemies + the two end-of-level anchors 20-tiles.js draws from.
  // Kinds: 'blob' (a slow walker, stompable) and 'turtle' (a shelled walker
  // that becomes a kickable shell when stomped). Rows are the tile each
  // enemy settles on; spawns drop them a little higher and let them fall.
  var SPAWNS_MASTER = [
    { kind: 'blob', col: 22, row: 12 },
    { kind: 'blob', col: 40, row: 12 },
    { kind: 'blob', col: 54, row: 12 },
    { kind: 'blob', col: 55, row: 12 },
    { kind: 'blob', col: 80, row: 4 },
    { kind: 'blob', col: 82, row: 4 },
    { kind: 'blob', col: 100, row: 12 },
    { kind: 'blob', col: 101, row: 12 },
    { kind: 'turtle', col: 107, row: 12 },
    { kind: 'blob', col: 117, row: 12 },
    { kind: 'blob', col: 118, row: 12 },
    { kind: 'blob', col: 127, row: 12 },
    { kind: 'blob', col: 128, row: 12 },
    { kind: 'blob', col: 131, row: 12 },
    { kind: 'blob', col: 132, row: 12 },
    { kind: 'blob', col: 177, row: 12 },
    { kind: 'blob', col: 178, row: 12 },
    { kind: 'flagpole', col: 198, row: 2 },
    { kind: 'castle', col: 202, row: 8 }
  ];

  // ---- solidity. The single source of truth for collision.
  var SOLID_TYPES = [];
  (function () {
    var i;
    for (i = 0; i <= 14; i++) SOLID_TYPES[i] = false;
    SOLID_TYPES[TILE.GROUND] = true;
    SOLID_TYPES[TILE.BRICK] = true;
    SOLID_TYPES[TILE.QUESTION] = true;
    SOLID_TYPES[TILE.USED] = true;
    SOLID_TYPES[TILE.SOLID] = true;
    SOLID_TYPES[TILE.PIPE_TL] = true;
    SOLID_TYPES[TILE.PIPE_TR] = true;
    SOLID_TYPES[TILE.PIPE_BL] = true;
    SOLID_TYPES[TILE.PIPE_BR] = true;
    SOLID_TYPES[TILE.STAIR] = true;
    SOLID_TYPES[TILE.COIN_BRICK] = true;
    SOLID_TYPES[TILE.INVIS_1UP] = true;   // solid but invisible -- see header
    // EMPTY / FLAGPOLE / FLAGTOP are not solid.
  })();

  // ---- runtime grid: one Uint8Array per row, materialised once.
  var grid = [];

  function buildGrid() {
    var row, col, line, ch, t;
    for (row = 0; row < ROWS; row++) {
      if (!grid[row]) grid[row] = new Uint8Array(WIDTH_COLS);
      line = MAP[row];
      for (col = 0; col < WIDTH_COLS; col++) {
        ch = line.charAt(col);
        t = LEGEND[ch];
        grid[row][col] = (t === undefined) ? TILE.EMPTY : t;
      }
    }
  }

  var Level = {
    TILE: TILE,
    WIDTH_COLS: WIDTH_COLS,
    ROWS: ROWS,
    SPAWNS: [],
    CONTENTS: {}
  };
  window.Level = Level;

  // Restore SPAWNS / CONTENTS in place -- Actors may hold a reference to
  // either object, so they are mutated, never replaced.
  function resetTables() {
    var k, i;
    for (k in Level.CONTENTS) {
      if (Object.prototype.hasOwnProperty.call(Level.CONTENTS, k)) delete Level.CONTENTS[k];
    }
    for (k in CONTENTS_MASTER) {
      if (Object.prototype.hasOwnProperty.call(CONTENTS_MASTER, k)) Level.CONTENTS[k] = CONTENTS_MASTER[k];
    }
    Level.SPAWNS.length = 0;
    for (i = 0; i < SPAWNS_MASTER.length; i++) {
      Level.SPAWNS.push({
        kind: SPAWNS_MASTER[i].kind,
        col: SPAWNS_MASTER[i].col,
        row: SPAWNS_MASTER[i].row
      });
    }
  }

  // Built eagerly so tileAt/solidAt are correct even if init() is never
  // called (script load order must not be able to break collision).
  buildGrid();
  resetTables();

  // Idempotent: also the "restart the level" hook -- rebuilding from MAP
  // restores broken bricks, used ? blocks and consumed contents.
  Level.init = function () {
    buildGrid();
    resetTables();
    if (window.Game && window.Game.LEVEL_ROWS && window.Game.LEVEL_ROWS !== ROWS) {
      // Loud, but non-fatal: every row index in MAP assumes 15.
      if (window.console) console.warn('Level: Game.LEVEL_ROWS=' + window.Game.LEVEL_ROWS + ' but MAP has ' + ROWS + ' rows');
    }
  };

  Level.tileAt = function (col, row) {
    if (col < 0 || col >= WIDTH_COLS) return TILE.EMPTY;
    if (row < 0 || row >= ROWS) return TILE.EMPTY;   // below row 14 -> EMPTY (pits are bottomless)
    return grid[row][col];
  };

  Level.setTile = function (col, row, t) {
    if (col < 0 || col >= WIDTH_COLS || row < 0 || row >= ROWS) return;
    grid[row][col] = t;
  };

  Level.solidAt = function (col, row) {
    if (col < 0 || col >= WIDTH_COLS || row < 0 || row >= ROWS) return false;
    return SOLID_TYPES[grid[row][col]] === true;
  };

  // Whole level at 1px/tile -- the accuracy check.
  Level.debugMinimap = function (ctx) {
    if (!ctx) return;
    var row, col, t;
    for (row = 0; row < ROWS; row++) {
      for (col = 0; col < WIDTH_COLS; col++) {
        t = grid[row][col];
        if (t === TILE.EMPTY) continue;
        if (t === TILE.INVIS_1UP) ctx.fillStyle = "#ff00ff";
        else if (t === TILE.FLAGPOLE || t === TILE.FLAGTOP) ctx.fillStyle = "#00a800";
        else if (t === TILE.QUESTION || t === TILE.COIN_BRICK) ctx.fillStyle = "#ffd800";
        else if (t === TILE.BRICK) ctx.fillStyle = "#c84c0c";
        else if (SOLID_TYPES[t]) ctx.fillStyle = "#ffffff";
        else ctx.fillStyle = "#888888";
        ctx.fillRect(col, row, 1, 1);
      }
    }
  };

})();
