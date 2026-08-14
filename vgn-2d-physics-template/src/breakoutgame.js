// ============================================================================
//  BREAKOUT / ARKANOID — src/breakoutgame.js
//  ============================================================================
//  The first full game built on src/physics.js. It exists to prove the physics
//  engine end-to-end: a bouncy circle (ball) vs static boxes (bricks/walls), a
//  dynamic paddle with angle-dependent reflection, gravity-driven sensor power-
//  ups that only the paddle catches, and multiple balls colliding with each
//  other. It also shows the shell API in action (hud / audio / pointer / game
//  over). Fork this file, or write a new module and swap it in src/main.js.
//
//  CONTROLS: ARROWS / WASD / MOUSE move the paddle, SPACE / CLICK launches.
//  TUNING:   every number below can be overridden in main.pjs `config`
//            (breakoutPaddleSpeed, breakoutBallSpeed, breakoutRows, ...).
//  ============================================================================

import { World, WALL_LAYER } from './physics.js';
import { LOGICAL_W, LOGICAL_H } from './engine.js';

const W = LOGICAL_W;
const H = LOGICAL_H;

// Collision layers (bitmasks). The ball hits bricks/paddle/walls; power-up
// drops only ever touch the paddle — layer filtering does all of that.
const L = { BALL: 1, PADDLE: 2, BRICK: 4, DROP: 8 };

const $cfg = (window.root && window.root.config) || null;
function conf(name, fallback) {
  const v = $cfg && $cfg[name];
  if (v == null) return fallback;
  const s = typeof v.evaluateItem === 'function' ? v.evaluateItem : v;
  return s === '' || s == null ? fallback : s;
}

const PADDLE_SPEED = conf('breakoutPaddleSpeed', 380);
const BASE_BALL_SPEED = conf('breakoutBallSpeed', 260);
const ROWS = conf('breakoutRows', 7);
const COLS = conf('breakoutCols', 10);
const LIVES = conf('breakoutLives', 3);
const POWERUPS = conf('breakoutPowerups', true);
const PHYS_GRAVITY = conf('physicsGravity', 0);

const BRICK_W = 36, BRICK_H = 12, BRICK_GAP = 3;
const PADDLE_W = 66, PADDLE_H = 9;
const PADDLE_Y = H - 22;
const BALL_R = 4;

// Brick row styles — rows 0-1 are 2-hit steel, the rest 1-hit, scoring drops
// with height. [hp, points, body color, dark edge]
const BRICK_STYLE = [
  { hp: 2, score: 50, base: '#8d94ff', dark: '#3d47b0' },
  { hp: 2, score: 50, base: '#7ad4ff', dark: '#2a6fae' },
  { hp: 1, score: 30, base: '#39ff6e', dark: '#0f9d3c' },
  { hp: 1, score: 30, base: '#ffd23e', dark: '#a87c00' },
  { hp: 1, score: 20, base: '#ff9e3d', dark: '#a85700' },
  { hp: 1, score: 20, base: '#ff6b6b', dark: '#a82d2d' },
  { hp: 1, score: 10, base: '#ff2d95', dark: '#a00f58' },
];

const DROP_STYLE = { expand: '#39ff6e', slow: '#2de1ff', extra: '#ffd23e' };

// ---- module state (the shell keeps one instance alive across runs) ----------
let gctx = null;
let world = null;
let paddle = null;
let bricks = [];
let balls = [];
let drops = [];
let particles = [];
let state = 'serve';            // serve | play | clear
let lives = LIVES;
let level = 1;
let score = 0;
let levelSpeed = BASE_BALL_SPEED;
let slowUntil = 0;
let clearTimer = 0;
let shake = 0;

// ---- lifecycle hooks ----------------------------------------------------------

function init() { /* everything is built fresh in reset() */ }

function reset(ctx) {
  gctx = ctx;
  world = new World({ width: W, height: H, gravity: PHYS_GRAVITY, walls: ['top', 'left', 'right'] });
  bricks = [];
  balls = [];
  drops = [];
  particles = [];
  level = 1;
  lives = LIVES;
  score = 0;
  levelSpeed = BASE_BALL_SPEED;
  slowUntil = 0;
  clearTimer = 0;
  shake = 0;

  paddle = world.rect({
    x: W / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H,
    restitution: 0.25, friction: 0.2, layer: L.PADDLE,
    mask: L.BALL | L.DROP | WALL_LAYER,
    onCollide: onPaddleHit,
    data: { type: 'paddle', baseW: PADDLE_W },
  });

  buildLevel();
  serveBall();

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setTimerRaw('LEVEL 1');
  ctx.hud.setExtra('PRESS SPACE / CLICK TO LAUNCH');
}

// ---- world construction ---------------------------------------------------------

function buildLevel() {
  const total = COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP;
  const x0 = (W - total) / 2;
  const y0 = 28;
  for (let r = 0; r < ROWS; r++) {
    const style = BRICK_STYLE[Math.min(r, BRICK_STYLE.length - 1)];
    for (let c = 0; c < COLS; c++) {
      const b = world.rect({
        x: x0 + c * (BRICK_W + BRICK_GAP) + BRICK_W / 2,
        y: y0 + r * (BRICK_H + BRICK_GAP) + BRICK_H / 2,
        w: BRICK_W, h: BRICK_H, static: true, restitution: 1,
        layer: L.BRICK, mask: L.BALL,
        onCollide: () => hitBrick(b),
        data: { type: 'brick', hp: style.hp, score: style.score, base: style.base, dark: style.dark, flash: 0 },
      });
      bricks.push(b);
    }
  }
}

function makeBall(x, y) {
  const b = world.circle({
    x, y, r: BALL_R, restitution: 1, gravityScale: 0, layer: L.BALL,
    mask: L.PADDLE | L.BRICK | WALL_LAYER,
    data: { type: 'ball' },
  });
  balls.push(b);
  return b;
}

function serveBall() {
  for (const b of balls) world.remove(b);
  balls = [];
  makeBall(paddle.x, paddle.y - PADDLE_H / 2 - BALL_R - 1)._serving = true;
  state = 'serve';
  gctx.hud.setExtra(lives === LIVES && level === 1 ? 'PRESS SPACE / CLICK TO LAUNCH' : 'BALL LOST — PRESS SPACE');
}

function launchBall(b) {
  const sp = targetSpeed();
  b.vx = (Math.random() < 0.5 ? -1 : 1) * sp * 0.55;
  b.vy = -Math.sqrt(sp * sp - b.vx * b.vx);      // keeps |v| exactly sp
  b._serving = false;
  state = 'play';
  gctx.audio.sfx('start');
}

function targetSpeed() {
  return levelSpeed * (slowUntil > gctx.time() ? 0.66 : 1);
}

// ---- collision callbacks ----------------------------------------------------------

// Paddle hit: angle the rebound off where the ball struck (classic breakout).
// The engine's generic reflection already ran — we override with a controlled
// launch so the ball can't leave the paddle at a boring 90°.
function onPaddleHit(self, contact) {
  const other = contact.other;
  if (!other || !other.data) return;
  if (other.data.type !== 'ball' || other._serving) return;
  const t = Math.max(-1, Math.min(1, (other.x - self.x) / (self.w / 2)));
  const ang = t * (Math.PI / 3);                 // up to ±60°
  const sp = targetSpeed();
  other.vx = Math.sin(ang) * sp;
  other.vy = -Math.cos(ang) * sp;
  if (other.vx === 0) other.vx = sp * 0.2 * (Math.random() < 0.5 ? -1 : 1);
  gctx.audio.sfx('paddle');
  spawnBurst(other.x, other.y, '#ffffff', 4, 70);
}

function hitBrick(b) {
  if (b.dead) return;
  const d = b.data;
  d.hp--;
  d.flash = 0.12;
  if (d.hp <= 0) {
    world.remove(b);
    spawnBurst(b.x, b.y, d.base, 12, 130);
    addScore(d.score);
    shake = Math.min(shake + 1.5, 5);
    gctx.audio.sfx('brick');
    if (POWERUPS && Math.random() < 0.16) spawnDrop(b.x, b.y);
    if (bricks.every(x => x.dead)) levelCleared();
  } else {
    gctx.audio.sfx('hit');
  }
}

function catchDrop(d) {
  if (d.dead) return;
  world.remove(d);
  const eff = d.data.effect;
  gctx.audio.sfx('power');
  spawnBurst(d.x, d.y, d.data.color, 10, 120);
  if (eff === 'expand') {
    paddle.w = Math.min(paddle.data.baseW * 1.5, 100);
    gctx.hud.setExtra('PADDLE EXPANDED!');
  } else if (eff === 'slow') {
    slowUntil = gctx.time() + 10;
    gctx.hud.setExtra('SLOW MOTION!');
  } else if (eff === 'extra') {
    if (balls.length < 4) {
      const nb = makeBall(paddle.x, paddle.y - PADDLE_H / 2 - BALL_R - 1);
      launchBall(nb);
      gctx.hud.setExtra('EXTRA BALL!');
    } else {
      addScore(100);
      gctx.hud.setExtra('+100 BONUS');
    }
  }
}

function levelCleared() {
  state = 'clear';
  clearTimer = 1.4;
  const bonus = 500 + level * 100;
  addScore(bonus);
  gctx.audio.sfx('levelup');
  gctx.hud.setExtra('LEVEL ' + level + ' CLEAR!  +' + bonus);
  for (const b of balls) world.remove(b);
  balls = [];
}

// ---- helpers -------------------------------------------------------------------------

function addScore(n) {
  score += n;
  gctx.hud.setScore(score);
}

function spawnDrop(x, y) {
  const keys = Object.keys(DROP_STYLE);
  const effect = keys[Math.floor(Math.random() * keys.length)];
  const d = world.circle({
    x, y, r: 6, vy: 80, gravityScale: 0, sensor: true,  // constant fall speed
    layer: L.DROP, mask: L.PADDLE,           // falls THROUGH bricks & balls
    onCollide: () => catchDrop(d),           // only ever overlaps the paddle
    data: { type: 'drop', effect, color: DROP_STYLE[effect] },
  });
  drops.push(d);
}

function spawnBurst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    const life = 0.3 + Math.random() * 0.35;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life, max: life, color });
  }
}

// ---- the run ---------------------------------------------------------------------------

function update(dt, ctx) {
  const input = ctx.input;

  // --- paddle: mouse position wins, else keyboard ---------------------------
  if (ctx.pointer && ctx.pointer.active) {
    const half = paddle.w / 2;
    const target = Math.max(half + 4, Math.min(W - half - 4, ctx.pointer.x));
    paddle.vx = Math.max(-PADDLE_SPEED, Math.min(PADDLE_SPEED, (target - paddle.x) * 16));
  } else {
    const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    paddle.vx = dir * PADDLE_SPEED;
  }
  paddle.vy = 0;

  // --- serve / launch / level transitions ------------------------------------
  if (state === 'serve') {
    for (const b of balls) {
      if (!b._serving) continue;
      b.x = paddle.x;                                    // glued to the paddle
      b.y = paddle.y - PADDLE_H / 2 - BALL_R - 1;
      if (input.pressed('jump') || input.pressed('confirm') || (ctx.pointer && ctx.pointer.down)) {
        launchBall(b);
      }
    }
  } else if (state === 'clear') {
    clearTimer -= dt;
    if (clearTimer <= 0) {
      level++;
      levelSpeed = BASE_BALL_SPEED + (level - 1) * 30;
      buildLevel();
      serveBall();
      gctx.hud.setTimerRaw('LEVEL ' + level);
      gctx.hud.setExtra('LEVEL ' + level);
    }
  }

  // --- the physics simulation (the engine does the real work) ----------------
  world.step(dt);

  // --- cosmetic bookkeeping ----------------------------------------------------
  for (const b of bricks) if (!b.dead && b.data.flash > 0) b.data.flash -= dt;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  shake = Math.max(0, shake - dt * 10);

  // --- balls lost / stuck -------------------------------------------------------
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.dead) { balls.splice(i, 1); continue; }
    if (b.y - BALL_R > H + 40) {
      world.remove(b);
      balls.splice(i, 1);
    } else if (Math.abs(b.vy) < 30 && state === 'play') {
      b.vy = -60;                                      // never let it stall flat
    }
  }
  if (balls.length === 0) {
    lives--;
    gctx.hud.setLives(lives);
    gctx.audio.sfx('die');
    if (lives <= 0) {
      ctx.hud.setExtra('GAME OVER');
      ctx.gameOver();
      return;
    }
    serveBall();
  }

  // --- drops that fell past the paddle ------------------------------------------
  for (let i = drops.length - 1; i >= 0; i--) {
    if (drops[i].dead || drops[i].y > H + 40) {
      world.remove(drops[i]);
      drops.splice(i, 1);
    }
  }
}

function render(g, dt, ctx) {
  const t = ctx.wallTime();
  g.save();
  g.translate(shake ? (Math.random() - 0.5) * shake : 0, shake ? (Math.random() - 0.5) * shake : 0);

  // background
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#160b38');
  grad.addColorStop(0.6, '#0a0420');
  grad.addColorStop(1, '#05010f');
  g.fillStyle = grad;
  g.fillRect(-8, -8, W + 16, H + 16);

  // faint grid
  g.strokeStyle = 'rgba(45, 225, 255, 0.06)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 24; x < W; x += 24) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 24; y < H; y += 24) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();

  // bricks
  for (const b of bricks) {
    if (b.dead) continue;
    const d = b.data;
    const x = b.x - BRICK_W / 2, y = b.y - BRICK_H / 2;
    g.fillStyle = d.base;
    g.fillRect(x, y, BRICK_W, BRICK_H);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(x, y, BRICK_W, 2);
    g.fillStyle = d.dark;
    g.fillRect(x, y + BRICK_H - 3, BRICK_W, 3);
    if (d.hp > 1) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x, y + 3, BRICK_W, 2);              // steel rivet
    }
    if (d.flash > 0) {
      g.fillStyle = 'rgba(255,255,255,' + Math.min(1, d.flash * 10) + ')';
      g.fillRect(x, y, BRICK_W, BRICK_H);
    }
  }

  // power-up drops (rotating diamonds)
  for (const d of drops) {
    if (d.dead) continue;
    const s = 3.5 + 2.5 * (0.5 + 0.5 * Math.sin(t * 6 + d.x));
    g.save();
    g.translate(d.x, d.y);
    g.rotate(t * 2);
    g.fillStyle = d.data.color;
    g.globalAlpha = 0.9;
    g.fillRect(-s, -s, s * 2, s * 2);
    g.globalAlpha = 1;
    g.restore();
  }

  // balls
  for (const b of balls) {
    if (b.dead) continue;
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.arc(b.x, b.y, BALL_R + 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cfe8ff';
    g.beginPath(); g.arc(b.x - 1, b.y - 1, BALL_R * 0.45, 0, Math.PI * 2); g.fill();
  }

  // dotted aim guide while serving
  if (state === 'serve' && balls[0] && !balls[0].dead) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = 30; y < balls[0].y; y += 8) g.fillRect(balls[0].x - 1, y, 2, 2);
  }

  // particles
  for (const p of particles) {
    g.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
    g.fillStyle = p.color;
    g.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
  g.globalAlpha = 1;

  // paddle
  g.fillStyle = 'rgba(255, 210, 62, 0.15)';
  g.fillRect(paddle.x - paddle.w / 2 - 2, paddle.y - paddle.h / 2 - 2, paddle.w + 4, paddle.h + 4);
  g.fillStyle = '#7a4f00';
  g.fillRect(paddle.x - paddle.w / 2, paddle.y - paddle.h / 2, paddle.w, paddle.h);
  g.fillStyle = '#ffd23e';
  g.fillRect(paddle.x - paddle.w / 2, paddle.y - paddle.h / 2, paddle.w, 4);
  g.fillStyle = '#fff3c4';
  g.fillRect(paddle.x - paddle.w / 2 + 3, paddle.y - paddle.h / 2 + 1, paddle.w - 6, 2);

  g.restore();
}

// ---- module the shell imports ----------------------------------------------------------
const howToPlay = [
  'Move — ARROWS / WASD / MOUSE',
  'Launch — SPACE / CLICK',
  'Pause — P / ESC',
  'Break every brick. Don\'t drop the ball.',
  'Catch falling power-ups — expand, slow, extra ball.',
].join('\n');

const controls = [
  ['ARROWS / WASD / MOUSE', 'MOVE PADDLE'],
  ['SPACE / CLICK', 'LAUNCH BALL'],
  ['P / ESC', 'PAUSE'],
];

export default { init, reset, update, render, howToPlay, controls };
