
// 30-player.js — the player character: movement feel, procedural sprites, state.
//
// Owns: the hero's physics/feel, his pixel-art sprite table, power state
// (small/big/powered), damage + death + respawn, and the *triggers* for two
// things other files own — Actors.strikeBlock() on a block headed from
// below, and Finish.trigger() on touching the goal flag.
//
// The whole game loop is fixed 1/60s: vx/vy are PIXELS PER FIXED TICK and
// Physics.moveBody does not multiply by dt. Every motion constant below is a
// flat per-frame amount. Timers (invuln, star, animation phases) are in
// SECONDS and use dt, because they are wall-clock things, not motion.
//
// This is the character you'll most likely replace when you fork the
// template: the sprite grids below are one char per pixel (see the legend in
// buildLegends), and every "feel" constant lives in the Tuning section.
(function () {
  'use strict';

  // ==========================================================================
  // Tuning constants — the whole "feel" of the game is these fourteen numbers.
  // ==========================================================================
  var WALK_MAX = 1.6;        // px/tick top speed, no run button      (96 px/s)
  var RUN_MAX = 2.6;         // px/tick top speed, run held          (156 px/s)
  var ACCEL = 0.08;          // px/tick^2 ground acceleration
  var AIR_ACCEL = 0.05;      // px/tick^2 mid-air steering (partial control)
  var FRICTION = 0.09;       // px/tick^2 ground decel, no input held
  var SKID_DECEL = 0.20;     // px/tick^2 decel when reversing at speed
  var AIR_TURN = 0.10;       // px/tick^2 decel when reversing mid-air

  var JUMP_V = 5.0;          // px/tick initial upward speed, standing
  var JUMP_V_RUN_BONUS = 0.6;// px/tick extra at full run -> run jumps go higher
  var G_RISE = 0.18;         // px/tick^2 gravity while rising WITH jump held
  var G_FALL = 0.45;         // px/tick^2 gravity falling, or after jump release
  var MAX_FALL = 8.0;        // px/tick terminal velocity (< 16 so no tunneling)

  var BOUNCE_V = 3.6;        // px/tick stomp recoil, jump not held
  var BOUNCE_V_HELD = 5.2;   // px/tick stomp recoil, jump held

  // Arithmetic sanity check on the above (verified numerically in the harness):
  //   standing apex = sum(JUMP_V - G_RISE*k) for k=1..27  ~= 67 px  ~= 4.2 tiles
  //   jump cut after 3 ticks                              ~= 34 px  ~= 2.1 tiles
  //   full-run jump: ~51 ticks airborne * 2.6 px          ~= 132 px ~= 8.2 tiles

  var DEATH_FREEZE = 0.4;    // s of hang time before the death pop-up
  var DEATH_POP_V = 8.0;     // px/tick upward pop when the death anim starts
  var DEATH_GRAV = 0.4;      // px/tick^2 during the death fall
  var INVULN_TIME = 2.0;     // s of post-damage flicker
  var STAR_TIME = 10.0;      // s of star invincibility
  var TRANSFORM_TIME = 0.6;  // s of frozen grow/shrink animation

  var SMALL_H = 16, BIG_H = 32;
  var BODY_W = 12;           // narrower than the 16px sprite so the hero does
                             // not jam in a 16px-wide corridor; sprite is drawn
                             // centred over the body via SPRITE_INSET.
  var SPRITE_W = 16;
  var SPRITE_INSET = (SPRITE_W - BODY_W) / 2;

  var WALK_FRAME_PX = 6;     // px of travel per walk-cycle frame

  // ==========================================================================
  // Sprite table — procedurally blitted pixel art. One char per pixel, every
  // row exactly SPRITE_W chars. Legend is resolved from Palette at init().
  //
  //   .  transparent      R  tunic (teal)      B  pants + belt (brown)
  //   S  skin             K  hair              Y  boots
  //   N  belt buckle (gold)      W  white accent      D  dark (eyes/pupils)
  //
  // A generic adventurer: hair, no cap, no facial hair. The three-frame walk
  // cycle is assembled as UPPER ++ LEGS so the walk cycle is three small leg
  // blocks rather than three near-duplicate sprites.
  // ==========================================================================
  var SMALL_UPPER = [
    '.....KKKKKK.....',
    '....KKKKKKKKK...',
    '...KSSSSSSSSK...',
    '...KSSSSSSSSSK..',
    '...KSKSSSSSKSS..',
    '...KSSSSSSSSSK..',
    '....SSSSSSSSS...',
    '.....RRRRRRRR...',
    '....RRRRRRRRR...',
    '...RRRRRRRRRRR..',
    '..SSRRRRRRRRRSS.',
    '..SSRRRRRRRRRSS.',
    '..SSRBBBNBBBRSS.'
  ];
  var SMALL_LEGS_IDLE = [
    '....BBB...BBB...',
    '...YYYY...YYYY..',
    '..YYYYY...YYYYY.'
  ];
  var SMALL_LEGS_W0 = [
    '...BBB....BBB...',
    '..YYYY.....YYYY.',
    '.YYYYY.....YYYY.'
  ];
  var SMALL_LEGS_W1 = [
    '.....BBBBBB.....',
    '....YYYYYYYY....',
    '...YYYYYYYYYY...'
  ];
  var SMALL_LEGS_W2 = [
    '....BBBB..BB....',
    '...YYYYY..YYY...',
    '..YYYYY....YY...'
  ];

  var SMALL_SKID = [
    '......KKKKKK....',
    '.....KKKKKKKKK..',
    '....KSSSSSSSSK..',
    '....KSSSSSSSSSK.',
    '....KSKSSSSSKSS.',
    '....KSSSSSSSSSK.',
    '.....SSSSSSSSS..',
    '..SS..RRRRRRR...',
    '.SSSSRRRRRRRR...',
    '..SSRRRRRRRRR...',
    '.....RRRRRRRR...',
    '....SSRRRRRRSS..',
    '...SSRRRRRRRSS..',
    '.....BBB..BB....',
    '....YYYY..YYY...',
    '...YYYY....YY...'
  ];
  var SMALL_JUMP = [
    '.....KKKKKK.....',
    '....KKKKKKKKK...',
    '...KSSSSSSSSK...',
    '...KSSSSSSSSSK..',
    '...KSKSSSSSKSS..',
    '...KSSSSSSSSSK..',
    '....SSSSSSSSS...',
    '..RR.RRRRRR..SS.',
    '.RRRRRRRRRRRSSS.',
    '.RRRRRRRRRRRRS..',
    '..SSRRRRRRRRR...',
    '..SSSRRRRRRR....',
    '....RRRRRRRRR...',
    '...BBB....BBB...',
    '..YYYY.....YYY..',
    '.YYYY.......YY..'
  ];
  var SMALL_DEATH = [
    '.....KKKKKK.....',
    '....KKKKKKKKK...',
    '...KSSSSSSSSK...',
    '...KSSSSSSSSSK..',
    '...KSKSSSSSKSS..',
    '...KSSSSSSSSSK..',
    'SS....SSSSSS..SS',
    'SSS..RRRRRR..SSS',
    '.SS.RRRRRRRR.SS.',
    '....RRRRRRRR....',
    '....RRRRRRRR....',
    '....RRRRRRRR....',
    '...BBBBBBBBBB...',
    '...BBB....BBB...',
    '..YYYY....YYYY..',
    '.YYYYY....YYYYY.'
  ];
  var SMALL_CLIMB = [
    '.....KKKKKK.....',
    '....KKKKKKKKK...',
    '...KSSSSSSSSK...',
    '...KSSSSSSSSSK..',
    '...KSKSSSSSKSS..',
    '...KSSSSSSSSSK..',
    '..SS..SSSSSSS...',
    '..SSSRRRRRRR....',
    '...SRRRRRRRRR...',
    '....RRRRRRRRR...',
    '....RRRRRRRR....',
    '...SSRRRRRRR....',
    '..SSSRRRRRRRR...',
    '.....BBB.BBB....',
    '....YYYY.YYY....',
    '...YYYY...YY....'
  ];

  var BIG_UPPER = [
    '......KKKKKK....',
    '.....KKKKKKKKK..',
    '.....KSSSSSSSK..',
    '....KSSSSSSSSSK.',
    '....KSSDSSSSDSS.',
    '....KSSSSSSSSSK.',
    '....KKSSSSSSKK..',
    '......SSSSSSS...',
    '.......SSSSS....',
    '......RSSSSSR...',
    '....RRRRRRRRRR..',
    '...RRRRRRRRRRRR.',
    '..SSRRRRRRRRRRSS',
    '..SSRRRRRRRRRRSS',
    '..SSRRRRRRRRRRSS',
    '..SSRRRRRRRRRRSS',
    '..SSRBBBNBBBRSS.',
    '..SSBBBBBBBBBBSS',
    '...BBBBBBBBBBBB.',
    '...BBBBBBBBBBBB.'
  ];
  var BIG_LEGS_IDLE = [
    '....BBBB..BBBB..',
    '....BBBB..BBBB..',
    '....BBBB..BBBB..',
    '....BBBB..BBBB..',
    '....BBBB..BBBB..',
    '....BBBB..BBBB..',
    '...BBBBB..BBBBB.',
    '...BBBB....BBBB.',
    '..YYYYY....YYYYY',
    '..YYYYYY..YYYYYY',
    '..YYYYYY..YYYYYY',
    '...YYYY....YYYY.'
  ];
  var BIG_LEGS_W0 = [
    '...BBBB...BBBB..',
    '...BBBB...BBBB..',
    '..BBBB.....BBBB.',
    '..BBBB.....BBBB.',
    '..BBB.......BBB.',
    '..BBB.......BBB.',
    '.BBBB.......BBBB',
    '.BBB.........BBB',
    'YYYYY.......YYYY',
    'YYYYYY.....YYYYY',
    'YYYYY.......YYYY',
    '.YYY.........YY.'
  ];
  var BIG_LEGS_W1 = [
    '.....BBBBBB.....',
    '.....BBBBBB.....',
    '.....BBBBBB.....',
    '.....BBBBBB.....',
    '....BBBBBBBB....',
    '....BBBBBBBB....',
    '....BBB..BBB....',
    '....BBB..BBB....',
    '...YYYY..YYYY...',
    '..YYYYY..YYYYY..',
    '..YYYYY..YYYYY..',
    '...YYY....YYY...'
  ];
  var BIG_LEGS_W2 = [
    '....BBBB..BBB...',
    '....BBBB..BBB...',
    '...BBBB....BBB..',
    '...BBBB....BBB..',
    '..BBBB......BB..',
    '..BBB.......BB..',
    '.BBBB.......BB..',
    '.BBB........BB..',
    'YYYYY......YYY..',
    'YYYYYY....YYYY..',
    'YYYYY......YYY..',
    '.YYY........YY..'
  ];

  var BIG_SKID_UPPER = [
    '........KKKKKK..',
    '.......KKKKKKKKK',
    '.......KSSSSSSSK',
    '......KSSSSSSSSK',
    '......KSSDSSSDSS',
    '......KSSSSSSSSK',
    '......KKSSSSSSKK',
    '.......SSSSSSS..',
    '........SSSSS...',
    '..SS...RSSSSSR..',
    '.SSSSRRRRRRRRR..',
    '..SSRRRRRRRRRR..',
    '...RRRRRRRRRRR..',
    '...RRRRRRRRRRR..',
    '....RRRRRRRRRS..',
    '.....RRRRRRR....',
    '.....RBNBNBR....',
    '.....BBBBBBB....',
    '....BBBBBBBBB...',
    '...BBBBBBBBBBB..'
  ];
  var BIG_SKID_LEGS = [
    '...BBBB..BBBB...',
    '...BBBB..BBBB...',
    '...BBBB...BBB...',
    '...BBBB...BBB...',
    '..BBBB....BBB...',
    '..BBBB....BBB...',
    '.BBBB.....BBB...',
    '.BBB......BBB...',
    'YYYYY....YYYY...',
    'YYYYYY...YYYY...',
    'YYYYY.....YY....',
    '.YYY.......Y....'
  ];

  var BIG_JUMP_UPPER = [
    '......KKKKKK....',
    '.....KKKKKKKKK..',
    '.....KSSSSSSSK..',
    '....KSSSSSSSSSK.',
    '....KSSDSSSSDSS.',
    '....KSSSSSSSSSK.',
    '....KKSSSSSSKK..',
    '......SSSSSSS...',
    '..RR...SSSSS..SS',
    '.RRRR.RSSSSSRSSS',
    '.RRRRRRRRRRRRSS.',
    '..RRRRRRRRRRRR..',
    '..SSRRRRRRRRRRS.',
    '..SSRRRRRRRRRRS.',
    '..SSRRRRRRRRR...',
    '......RRRRRRR...',
    '......RBNBNBR...',
    '.....BBBBBBBBB..',
    '....BBBBBBBBBBB.',
    '....BBBBBBBBBBB.'
  ];
  var BIG_JUMP_LEGS = [
    '....BBBB..BBBB..',
    '....BBBB..BBBB..',
    '...BBBB....BBBB.',
    '...BBBB....BBBB.',
    '..BBBB......BBB.',
    '..BBB.......BBB.',
    '.BBBB.......BB..',
    '.BBB.........B..',
    'YYYYY......YYY..',
    'YYYYYY....YYYY..',
    'YYYY.......YY...',
    '.YY.............'
  ];

  var BIG_CLIMB_UPPER = [
    '......KKKKKK....',
    '.....KKKKKKKKK..',
    '.....KSSSSSSSK..',
    '....KSSSSSSSSSK.',
    '....KSSDSSSSDSS.',
    '....KSSSSSSSSSK.',
    '....KKSSSSSSKK..',
    '......SSSSSSS...',
    '..SS...SSSSS....',
    '..SSS.RSSSSSR...',
    '..SSRRRRRRRRR...',
    '...RRRRRRRRRR...',
    '...RRRRRRRRRR...',
    '...RRRRRRRRRSS..',
    '....RRRRRRRRSS..',
    '......RRRRRRR...',
    '......RBNBNBR...',
    '.....BBBBBBBBB..',
    '....BBBBBBBBBB..',
    '....BBBBBBBBBB..'
  ];
  var BIG_CLIMB_LEGS = [
    '....BBBB.BBBB...',
    '....BBBB.BBBB...',
    '....BBBB.BBB....',
    '....BBBB.BBB....',
    '....BBB..BBB....',
    '....BBB..BBB....',
    '...BBBB..BBBB...',
    '...BBB....BBB...',
    '..YYYY....YYYY..',
    '..YYYYY..YYYYY..',
    '..YYYYY..YYYYY..',
    '...YYY....YYY...'
  ];

  // Crouch is drawn feet-anchored, so a short frame is all it needs.
  var BIG_CROUCH = [
    '......KKKKKK....',
    '.....KKKKKKKKK..',
    '.....KSSSSSSSK..',
    '....KSSSSSSSSSK.',
    '....KSSDSSSSDSS.',
    '....KSSSSSSSSSK.',
    '....KKSSSSSSKK..',
    '......SSSSSSS...',
    '.....RRSSSSRR...',
    '..SSRRRRRRRRRSS.',
    '..SSRRRRRRRRRSS.',
    '...RRRNBNNRRR...',
    '..YYYYYYYYYYYY..',
    '..YYYY....YYYY..'
  ];

  var SMALL = null, BIG = null;   // built in init()
  var LEGEND = null;              // { normal: {...}, powered: {...} }
  var STAR_LEGENDS = null;        // array of legends cycled during star

  // ==========================================================================
  // Player namespace
  // ==========================================================================
  var Player = {
    x: 32, y: 0,
    vx: 0, vy: 0,
    w: BODY_W, h: SMALL_H,
    facing: 1,                 // 1 right, -1 left
    power: 'small',            // 'small' | 'big' | 'powered'
    onGround: false,
    invuln: 0,                 // seconds of post-damage flicker remaining
    star: 0,                   // seconds of star invincibility remaining
    dying: false,              // true for the whole death animation
    climbing: false,           // true once the goal flag has been grabbed
    // moveBody writes these:
    hitLeft: false, hitRight: false, hitCeil: false, hitTiles: []
  };
  window.Player = Player;

  // Internal animation phase. NOT a parallel state machine: core's tick()
  // only calls Player.update() while Game.state === 'play', so a death
  // animation driven off Game.setState('dying') would never advance a single
  // frame. The animation therefore runs under 'play' and only hands control
  // to core's state machine when it finishes.
  var phase = 'normal';        // 'normal' | 'grow' | 'shrink' | 'dying' | 'clear'
  var phaseT = 0;              // seconds inside the current phase
  var deathStage = 'freeze';   // 'freeze' | 'fall'
  var jumpHeld = false;        // latched at takeoff, cleared on jump release
  var skidding = false;
  var walkAnim = 0;            // accumulated px of travel
  var walkFrame = 0;
  var finishLatched = false;
  var spawnX = 32, spawnY = 0;

  function ns(name) { return window[name]; }

  function sfx(name) {
    var S = ns('Sfx');
    if (S && typeof S.play === 'function') S.play(name);
  }

  function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }

  // ---------- sprite table assembly + audit ----------
  function pad16(row) {
    var s = String(row);
    if (s.length > SPRITE_W) return s.slice(0, SPRITE_W);
    while (s.length < SPRITE_W) s += '.';
    return s;
  }

  // Normalise every row to exactly SPRITE_W chars AND warn about any row that
  // was not already the right width. Normalising keeps a typo from corrupting
  // the render; the warning keeps the typo from going unnoticed.
  function auditFrame(name, rows) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].length !== SPRITE_W && typeof console !== 'undefined' && console.warn) {
        console.warn('[Player] sprite "' + name + '" row ' + i + ' is ' +
          rows[i].length + ' px wide, expected ' + SPRITE_W);
      }
      out.push(pad16(rows[i]));
    }
    if (out.length === 0 || out.length > BIG_H) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Player] sprite "' + name + '" has ' + out.length +
          ' rows, expected 1..' + BIG_H);
      }
    }
    return out;
  }

  function buildSprites() {
    SMALL = {
      idle: auditFrame('small.idle', SMALL_UPPER.concat(SMALL_LEGS_IDLE)),
      walk: [
        auditFrame('small.walk0', SMALL_UPPER.concat(SMALL_LEGS_W0)),
        auditFrame('small.walk1', SMALL_UPPER.concat(SMALL_LEGS_W1)),
        auditFrame('small.walk2', SMALL_UPPER.concat(SMALL_LEGS_W2))
      ],
      skid: auditFrame('small.skid', SMALL_SKID),
      jump: auditFrame('small.jump', SMALL_JUMP),
      death: auditFrame('small.death', SMALL_DEATH),
      climb: auditFrame('small.climb', SMALL_CLIMB),
      crouch: auditFrame('small.crouch', SMALL_UPPER.concat(SMALL_LEGS_IDLE))
    };
    BIG = {
      idle: auditFrame('big.idle', BIG_UPPER.concat(BIG_LEGS_IDLE)),
      walk: [
        auditFrame('big.walk0', BIG_UPPER.concat(BIG_LEGS_W0)),
        auditFrame('big.walk1', BIG_UPPER.concat(BIG_LEGS_W1)),
        auditFrame('big.walk2', BIG_UPPER.concat(BIG_LEGS_W2))
      ],
      skid: auditFrame('big.skid', BIG_SKID_UPPER.concat(BIG_SKID_LEGS)),
      jump: auditFrame('big.jump', BIG_JUMP_UPPER.concat(BIG_JUMP_LEGS)),
      death: auditFrame('small.death', SMALL_DEATH),
      climb: auditFrame('big.climb', BIG_CLIMB_UPPER.concat(BIG_CLIMB_LEGS)),
      crouch: auditFrame('big.crouch', BIG_CROUCH)
    };
  }

  function buildLegends() {
    var P = ns('Palette') || {};
    var hair = '#6b3e0a';
    LEGEND = {
      // normal adventurer: teal tunic, brown pants, tan skin
      normal: {
        R: P.heroShirt || '#00a8a0',
        B: P.heroPants || '#6b3e0a',
        S: P.heroSkin || '#fcbcac',
        K: hair,
        Y: '#3a2010',
        N: P.question || '#fcbc3c',
        W: P.white || '#fcfcfc',
        D: '#2a1203'
      },
      // powered-up: white tunic with gold pants
      powered: {
        R: P.white || '#fcfcfc',
        B: P.question || '#fcbc3c',
        S: P.heroSkin || '#fcbcac',
        K: hair,
        Y: P.castleRed || '#a83c1c',
        N: P.white || '#fcfcfc',
        W: P.white || '#fcfcfc',
        D: '#2a1203'
      }
    };
    // Star invincibility cycles the suit colours.
    STAR_LEGENDS = [
      LEGEND.normal,
      { R: P.white || '#fcfcfc', B: P.question || '#fcbc3c', S: P.white || '#fcfcfc', K: hair, Y: P.question || '#fcbc3c', N: P.white || '#fcfcfc', W: P.white || '#fcfcfc', D: '#2a1203' },
      { R: P.question || '#fcbc3c', B: P.enemyGreen || '#00ac00', S: P.white || '#fcfcfc', K: hair, Y: P.enemyGreen || '#00ac00', N: P.white || '#fcfcfc', W: P.white || '#fcfcfc', D: '#2a1203' },
      { R: P.enemyGreen || '#00ac00', B: P.heroShirt || '#00a8a0', S: P.question || '#fcbc3c', K: hair, Y: P.heroShirt || '#00a8a0', N: P.white || '#fcfcfc', W: P.white || '#fcfcfc', D: '#2a1203' }
    ];
  }

  // ---------- geometry helpers ----------
  Player.bbox = function () {
    return { x: Player.x, y: Player.y, w: Player.w, h: Player.h };
  };

  function tilePx() { var G = ns('Game'); return (G && G.TILE_PX) || 16; }

  function overlapsSolid() {
    var L = ns('Level');
    if (!L || typeof L.solidAt !== 'function') return false;
    var T = tilePx();
    var c0 = Math.floor(Player.x / T);
    var c1 = Math.floor((Player.x + Player.w - 0.01) / T);
    var r0 = Math.floor(Player.y / T);
    var r1 = Math.floor((Player.y + Player.h - 0.01) / T);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (L.solidAt(c, r)) return true;
      }
    }
    return false;
  }

  // After growing, the hero's new head may be inside a block. Nudge him DOWN
  // (never up — up would push him through the floor) until he is clear.
  function unstick() {
    for (var i = 0; i < BIG_H && overlapsSolid(); i++) Player.y += 1;
  }

  function setPower(p) {
    var newH = (p === 'small') ? SMALL_H : BIG_H;
    var oldH = Player.h;
    Player.power = p;
    if (newH !== oldH) {
      Player.y -= (newH - oldH);   // keep the feet planted
      Player.h = newH;
      if (newH > oldH) unstick();
    }
  }

  // ==========================================================================
  // Public state transitions
  // ==========================================================================
  Player.hurt = function () {
    if (phase !== 'normal') return;
    if (Player.invuln > 0 || Player.star > 0) return;   // single guarded entry point
    if (Player.power === 'powered' || Player.power === 'big') {
      // One hit drops a powered/big hero straight back to small.
      setPower('small');
      Player.invuln = INVULN_TIME;
      phase = 'shrink';
      phaseT = 0;
      sfx('powerdown');
    } else {
      startDeath(false);
    }
  };

  Player.powerUp = function (kind) {
    if (phase === 'dying') return;
    var G = ns('Game');
    if (kind === '1up') {
      if (G) G.lives += 1;
      sfx('1up');
      return;
    }
    if (kind === 'star') {
      Player.star = STAR_TIME;
      sfx('powerup');
      return;
    }
    if (kind === 'flower') {
      if (Player.power === 'small') { setPower('powered'); phase = 'grow'; phaseT = 0; }
      else { Player.power = 'powered'; }
      sfx('powerup');
      return;
    }
    if (kind === 'mushroom') {
      if (Player.power === 'small') {
        setPower('big');
        phase = 'grow';
        phaseT = 0;
        sfx('powerup');
      } else if (G && G.addScore) {
        G.addScore(1000, Player.x, Player.y);
      }
    }
  };

  Player.bounce = function () {
    var I = ns('Input');
    var held = !!(I && I.jump);
    Player.vy = -(held ? BOUNCE_V_HELD : BOUNCE_V);
    jumpHeld = held;
    Player.onGround = false;
  };

  function startDeath(fromPit) {
    if (phase === 'dying') return;
    phase = 'dying';
    phaseT = 0;
    Player.dying = true;
    Player.climbing = false;
    Player.vx = 0;
    Player.invuln = 0;
    Player.star = 0;
    if (fromPit) {
      deathStage = 'fall';           // already falling; don't pop back up
    } else {
      deathStage = 'freeze';
      Player.vy = 0;
    }
    sfx('die');
  }

  function respawn() {
    var G = ns('Game');
    // Game.resetLevel() rebuilds tiles + block contents (Level.init) and
    // rearms every enemy spawn (Actors.init, in that order), resets the
    // clock, and puts the camera back to 0 so the level restarts from the
    // left — that is what lets us respawn at the real start point instead
    // of at the current screen edge.
    var levelReset = !!(G && typeof G.resetLevel === 'function');
    if (levelReset) G.resetLevel();
    phase = 'normal';
    phaseT = 0;
    Player.dying = false;
    Player.climbing = false;
    finishLatched = false;
    Player.power = 'small';
    Player.w = BODY_W;
    Player.h = SMALL_H;
    if (levelReset) {
      // Camera is back at 0, level is back to its shipped state: restart from
      // the real spawn point, feet on the ground.
      Player.x = spawnX;
      Player.y = spawnY;
    } else {
      // Fallback for a build without core's resetLevel (file run standalone):
      // resume at the left edge of the current view, dropped in from above so
      // whatever geometry is there resolves under gravity instead of wedging
      // the hero inside it.
      Player.x = (G ? G.camera.x : 0) + 32;
      Player.y = 0;
    }
    Player.vx = 0;
    Player.vy = 0;
    Player.facing = 1;
    Player.invuln = INVULN_TIME;
    Player.star = 0;
    jumpHeld = false;
    if (G && G.state !== 'play') G.setState('play');
  }

  function finishDeath() {
    var G = ns('Game');
    if (G) G.lives -= 1;
    if (!G || G.lives <= 0) {
      phase = 'normal';
      Player.dying = false;
      if (G) { G.lives = 0; G.setState('gameover'); }
    } else {
      respawn();
    }
  }

  // ==========================================================================
  // Movement
  // ==========================================================================
  function horizontal(I) {
    var dir = 0;
    if (I.left) dir -= 1;
    if (I.right) dir += 1;
    var maxSpeed = I.run ? RUN_MAX : WALK_MAX;
    var spd = Math.abs(Player.vx);
    skidding = false;

    if (Player.onGround) {
      if (dir !== 0) {
        if (spd > 0.01 && sign(Player.vx) !== dir) {
          // Skid: distinct, slower-than-instant reversal.
          skidding = true;
          Player.vx += dir * SKID_DECEL;
        } else if (spd > maxSpeed) {
          // Was running, run released: bleed down to the walk cap gradually
          // rather than snapping, which would read as a dead stop.
          Player.vx -= sign(Player.vx) * FRICTION;
          if (Math.abs(Player.vx) < maxSpeed) Player.vx = dir * maxSpeed;
        } else {
          Player.vx += dir * ACCEL;
          if (Math.abs(Player.vx) > maxSpeed) Player.vx = dir * maxSpeed;
        }
      } else {
        if (Player.vx > 0) Player.vx = Math.max(0, Player.vx - FRICTION);
        else if (Player.vx < 0) Player.vx = Math.min(0, Player.vx + FRICTION);
      }
    } else {
      // Air: momentum is preserved (no friction, no cap-down), steering is
      // partial. Reversing mid-air bleeds speed instead of flipping.
      if (dir !== 0) {
        if (spd > 0.01 && sign(Player.vx) !== dir) {
          Player.vx += dir * AIR_TURN;
        } else if (spd < maxSpeed) {
          Player.vx += dir * AIR_ACCEL;
          if (Math.abs(Player.vx) > maxSpeed) Player.vx = dir * maxSpeed;
        }
      }
    }

    if (dir !== 0 && !skidding) Player.facing = dir;
    else if (skidding) Player.facing = -dir;   // still facing the old direction
  }

  function vertical(I) {
    if (I.jumpTapped && Player.onGround && phase === 'normal') {
      var boost = JUMP_V_RUN_BONUS * Math.min(1, Math.abs(Player.vx) / RUN_MAX);
      Player.vy = -(JUMP_V + boost);
      jumpHeld = true;
      Player.onGround = false;
      sfx('jump');
    }
    if (!I.jump) jumpHeld = false;

    var g = (Player.vy < 0 && jumpHeld) ? G_RISE : G_FALL;
    Player.vy += g;
    if (Player.vy > MAX_FALL) Player.vy = MAX_FALL;
  }

  // A block headed from below produces one or two side:'bottom' entries (two
  // when the hero straddles a seam). One block is struck: the one nearest the
  // hero's centre. Firing on every entry would double-call Actors.
  function reportStrikes() {
    var hits = Player.hitTiles;
    if (!hits || hits.length === 0) return;
    var T = tilePx();
    var cx = Player.x + Player.w / 2;
    var best = null, bestD = Infinity;
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].side !== 'bottom') continue;
      var d = Math.abs((hits[i].col * T + T / 2) - cx);
      if (d < bestD) { bestD = d; best = hits[i]; }
    }
    if (!best) return;
    var A = ns('Actors');
    if (A && typeof A.strikeBlock === 'function') {
      A.strikeBlock(best.col, best.row, Player.power);
    }
  }

  function checkGoalFlag() {
    if (finishLatched) return;
    var L = ns('Level');
    var F = ns('Finish');
    if (!L || !L.TILE || typeof L.tileAt !== 'function') return;
    if (!F || typeof F.trigger !== 'function') return;   // no ending layer: skip
    var T = tilePx();
    var c0 = Math.floor(Player.x / T);
    var c1 = Math.floor((Player.x + Player.w - 0.01) / T);
    var r0 = Math.floor(Player.y / T);
    var r1 = Math.floor((Player.y + Player.h - 0.01) / T);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var t = L.tileAt(c, r);
        if (t === L.TILE.FLAGPOLE || t === L.TILE.FLAGTOP) {
          finishLatched = true;
          Player.climbing = true;
          phase = 'clear';
          phaseT = 0;
          Player.vx = 0;
          Player.vy = 0;
          F.trigger();
          return;
        }
      }
    }
  }

  function clampToCamera() {
    var G = ns('Game');
    if (!G) return;
    if (Player.x < G.camera.x) {
      Player.x = G.camera.x;
      if (Player.vx < 0) Player.vx = 0;
    }
  }

  function pitFloor() {
    var G = ns('Game');
    var rows = (G && G.LEVEL_ROWS) || 15;
    return rows * tilePx();
  }

  // Grow/shrink freezes CONTROL, not physics. If we froze gravity too, a hero
  // hit by an enemy mid-jump (the common case — Actors calls hurt() on side
  // contact) would hang motionless in the air for TRANSFORM_TIME and then
  // resume falling. Horizontal momentum is kept for the same reason.
  function frozenPhysics() {
    var g = (Player.vy < 0 && jumpHeld) ? G_RISE : G_FALL;
    Player.vy += g;
    if (Player.vy > MAX_FALL) Player.vy = MAX_FALL;
    var Ph = ns('Physics');
    if (Ph && typeof Ph.moveBody === 'function') Ph.moveBody(Player);
    clampToCamera();
    if (Player.y > pitFloor()) startDeath(true);
  }

  // Distance-driven walk cycle: one frame per WALK_FRAME_PX of travel, so it
  // speeds up with the hero instead of running on a fixed clock. Called from
  // the normal ground path AND from the clear phase, where Finish moves the
  // hero for us.
  function advanceWalkAnim() {
    if (Math.abs(Player.vx) > 0.08) {
      walkAnim += Math.abs(Player.vx);
      while (walkAnim >= WALK_FRAME_PX) {
        walkAnim -= WALK_FRAME_PX;
        walkFrame = (walkFrame + 1) % 3;
      }
    } else {
      walkAnim = 0;
      walkFrame = 0;
    }
  }

  function updateDying(dt) {
    phaseT += dt;
    if (deathStage === 'freeze') {
      if (phaseT >= DEATH_FREEZE) {
        deathStage = 'fall';
        Player.vy = -DEATH_POP_V;
      }
      return;
    }
    Player.vy += DEATH_GRAV;
    if (Player.vy > 10) Player.vy = 10;
    Player.y += Player.vy;                   // no collision during the death fall
    var G = ns('Game');
    var bottom = ((G && G.NES_H) || 240) + 48;
    if (Player.y > bottom) finishDeath();
  }

  // ==========================================================================
  Player.init = function () {
    var G = ns('Game');
    var L = ns('Level');
    buildSprites();
    buildLegends();

    spawnX = 32;
    spawnY = (G ? G.onGroundY : 208) - SMALL_H;
    // Honour an explicit start marker if the level ships one; not required,
    // so this is opportunistic only.
    if (L && L.SPAWNS) {
      for (var i = 0; i < L.SPAWNS.length; i++) {
        var s = L.SPAWNS[i];
        if (s && (s.kind === 'player' || s.kind === 'start')) {
          spawnX = (G ? G.col2px(s.col) : s.col * 16);
          spawnY = (G ? G.col2px(s.row) : s.row * 16);
        }
      }
    }

    phase = 'normal';
    phaseT = 0;
    Player.power = 'small';
    Player.w = BODY_W;
    Player.h = SMALL_H;
    Player.x = spawnX;
    Player.y = spawnY;
    Player.vx = 0;
    Player.vy = 0;
    Player.facing = 1;
    Player.onGround = false;
    Player.invuln = 0;
    Player.star = 0;
    Player.dying = false;
    Player.climbing = false;
    Player.hitTiles = [];
    jumpHeld = false;
    skidding = false;
    walkAnim = 0;
    walkFrame = 0;
    finishLatched = false;
    unstick();
  };

  Player.update = function (dt) {
    var G = ns('Game');
    var I = ns('Input');
    if (!G || !I) return;

    // Core only drives us during 'play'. We also accept 'dying' so this file
    // keeps working if core is ever changed to tick during that state.
    if (G.state !== 'play' && G.state !== 'dying') return;

    if (Player.invuln > 0) Player.invuln = Math.max(0, Player.invuln - dt);
    if (Player.star > 0) Player.star = Math.max(0, Player.star - dt);

    if (phase === 'dying') { updateDying(dt); return; }
    if (phase === 'clear') {
      // Finish owns the hero's position for the whole ending. It can set
      // Player.vx, but the walk-cycle frame index is private to this file
      // and used to only advance in the normal-movement path below — so the
      // walk to the goal played with the hero's legs frozen. Keep animating
      // once he is off the pole (climbing false).
      phaseT += dt;
      if (!Player.climbing) advanceWalkAnim();
      return;
    }

    if (phase === 'grow' || phase === 'shrink') {
      phaseT += dt;
      if (phaseT >= TRANSFORM_TIME) { phase = 'normal'; phaseT = 0; }
      frozenPhysics();                                 // control frozen, not gravity
      return;
    }

    horizontal(I);
    vertical(I);

    var Ph = ns('Physics');
    if (Ph && typeof Ph.moveBody === 'function') Ph.moveBody(Player);

    clampToCamera();
    reportStrikes();
    checkGoalFlag();

    // Walk-cycle animation is distance-driven, so it speeds up with the hero.
    if (Player.onGround) advanceWalkAnim();

    if (Player.y > pitFloor()) startDeath(true);
  };

  // ==========================================================================
  // Drawing
  // ==========================================================================
  function pickFrame() {
    var set = (Player.power === 'small') ? SMALL : BIG;
    if (phase === 'dying') return SMALL.death;
    if (Player.climbing) return set.climb;
    if (phase === 'clear') {
      return (Math.abs(Player.vx) > 0.08) ? set.walk[walkFrame] : set.idle;
    }
    if (phase === 'grow' || phase === 'shrink') {
      // Flicker between the two sizes for the transition.
      return (Math.floor(phaseT * 20) % 2 === 0 ? SMALL : BIG).idle;
    }
    if (!Player.onGround) return set.jump;
    if (skidding) return set.skid;
    if (Math.abs(Player.vx) > 0.08) return set.walk[walkFrame];
    return set.idle;
  }

  function pickLegend() {
    if (Player.star > 0) {
      return STAR_LEGENDS[Math.floor(Player.star * 16) % STAR_LEGENDS.length];
    }
    return (Player.power === 'powered') ? LEGEND.powered : LEGEND.normal;
  }

  // Run-length blit: one fillRect per horizontal run of identical pixels.
  function blit(ctx, rows, dx, dy, flip, legend) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var c = 0;
      while (c < row.length) {
        var ch = row.charAt(c);
        if (ch === '.') { c++; continue; }
        var len = 1;
        while (c + len < row.length && row.charAt(c + len) === ch) len++;
        var color = legend[ch];
        if (color) {
          ctx.fillStyle = color;
          var px = flip ? (SPRITE_W - (c + len)) : c;
          ctx.fillRect(dx + px, dy + r, len, 1);
        }
        c += len;
      }
    }
  }

  Player.draw = function () {
    var G = ns('Game');
    if (!G || !G.ctx || !SMALL) return;
    if (G.state === 'title' || G.state === 'gameover') return;

    // Damage flicker: ~15 blinks/sec while invuln is counting down. Star
    // invincibility recolours instead of blinking, so the hero stays visible.
    if (Player.invuln > 0 && Player.star <= 0 &&
        Math.floor(Player.invuln * 30) % 2 === 0) return;

    var frame = pickFrame();
    var legend = pickLegend();
    // Integer positions only, or the sprite shimmers against the tilemap.
    var dx = Math.round(Player.x - G.camera.x - SPRITE_INSET);
    var dy = Math.round(Player.y + Player.h - frame.length);   // feet-anchored
    blit(G.ctx, frame, dx, dy, Player.facing < 0, legend);
  };

  // ---- verification-only hooks (read-only, not part of the contract) ----
  Player._phase = function () { return phase; };
  Player._walkFrame = function () { return walkFrame; };
  Player._sprites = function () { return { small: SMALL, big: BIG }; };

})();
