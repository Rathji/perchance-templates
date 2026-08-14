import * as D from "./data.js";

const rnd = list => list[Math.floor(Math.random() * list.length)];

export class Battle {
  constructor(game, enemies) {
    this.game = game;
    this.enemies = enemies;
    this.party = game.party.map(p => ({ p, command: null, defend: false }));
    this.round = 0;
    this.result = null;
    this.uiStack = [];
    this.aliveIdx = 0;
    this.onLog = null;
    this.onUi = null;
    this.log = [];
    this.startRound();
    this.msg("The battle begins!");
  }

  msg(t) {
    this.log.push(t);
    if (this.log.length > 60) this.log.shift();
    if (this.onLog) this.onLog(this.log.slice(-7));
  }

  aliveParty() { return this.party.filter(x => x.p.hp > 0); }
  aliveEnemies() { return this.enemies.filter(e => e.hp > 0); }

  startRound() {
    this.round++;
    for (const x of this.party) { x.command = null; x.defend = false; }
    this.aliveIdx = 0;
    if (this.aliveParty().length === 0) { this.result = "lose"; this.syncUi(); return; }
    this.buildActionUI();
  }

  buildActionUI() {
    const alive = this.aliveParty();
    if (this.aliveIdx >= alive.length) { this.resolveRound(); return; }
    const x = alive[this.aliveIdx];
    const opts = [];
    opts.push({ label: "Attack", act: () => this.pickEnemyTarget(x, "attack") });
    if (x.p.mp > 0 && x.p.spells.length) opts.push({ label: `Magic (${x.p.mp}/${x.p.maxMp} MP)`, act: () => this.magicMenu(x) });
    if (this.game.inventory.some(s => ["potion","hiPotion","ether","phoenixDown"].includes(s.id) && s.qty > 0)) opts.push({ label: "Item", act: () => this.itemMenu(x) });
    opts.push({ label: "Defend", act: () => { x.command = { type: "defend" }; this.nextCmd(); } });
    if (this.aliveIdx === 0) opts.push({ label: "Flee", act: () => this.tryFlee() });
    this.uiStack = [{ opts, index: 0, title: `${x.p.name}'s command` }];
    this.syncUi();
  }

  nextCmd() {
    this.aliveIdx++;
    this.buildActionUI();
  }

  uiPush(opts, title) {
    this.uiStack.push({ opts, index: 0, title });
    this.syncUi();
  }

  uiPop() {
    if (this.uiStack.length > 1) this.uiStack.pop();
    this.syncUi();
  }

  uiCurrent() { return this.uiStack[this.uiStack.length - 1]; }

  uiMove(d) {
    const u = this.uiCurrent();
    if (!u) return;
    const opts = u.opts;
    let ni = u.index + d;
    for (let k = 0; k < opts.length; k++) {
      const cand = ((ni % opts.length) + opts.length) % opts.length;
      if (!opts[cand].disabled) { u.index = cand; break; }
      ni += d;
    }
    this.syncUi();
  }

  choose() {
    const o = this.uiCurrent().opts[this.uiCurrent().index];
    if (o && o.act && !o.disabled) o.act();
  }

  syncUi() { if (this.onUi) this.onUi(); }

  pickEnemyTarget(x, type) {
    const es = this.aliveEnemies();
    if (!es.length) return;
    const opts = es.map(e => ({ label: e.def.name, sub: `${e.hp}/${e.def.hp} HP`, act: () => {
      x.command = { type, targetIdx: e.id };
      this.nextCmd();
    }}));
    this.uiPush(opts, `Target — ${x.p.name}`);
  }

  pickEnemySpellTarget(x, sid) {
    const es = this.aliveEnemies();
    if (!es.length) return;
    const opts = es.map(e => ({ label: e.def.name, sub: `${e.hp}/${e.def.hp} HP`, act: () => {
      x.command = { type: "magic", spell: sid, targetIdx: e.id };
      this.nextCmd();
    }}));
    this.uiPush(opts, `Spell target — ${x.p.name}`);
  }

  pickAllyTarget(x, sid) {
    const s = D.SPELLS[sid];
    const opts = this.game.party.map((q, i) => {
      const disabled = s.targets === "revive" ? q.hp > 0 : q.hp <= 0;
      return { label: q.name, sub: `${q.hp}/${q.maxHp} HP`, disabled, act: () => {
        x.command = { type: "magic", spell: sid, targetIdx: i };
        this.nextCmd();
      }};
    });
    this.uiPush(opts, `Spell target — ${x.p.name}`);
  }

  magicMenu(x) {
    const opts = x.p.spells.map(sid => {
      const s = D.SPELLS[sid];
      const disabled = x.p.mp < s.mp;
      return { label: `${s.name} (${s.mp} MP)`, sub: s.desc, disabled, act: () => {
        if (disabled) return;
        if (s.targets === "enemy") this.pickEnemySpellTarget(x, sid);
        else if (s.targets === "ally" || s.targets === "revive") this.pickAllyTarget(x, sid);
        else { x.command = { type: "magic", spell: sid, targetIdx: null }; this.nextCmd(); }
      }};
    });
    this.uiPush(opts, `${x.p.name} — Magic`);
  }

  itemMenu(x) {
    const usable = ["potion","hiPotion","ether","phoenixDown"];
    const slots = this.game.inventory.filter(s => usable.includes(s.id) && s.qty > 0);
    if (!slots.length) { this.msg("No usable items."); return; }
    const opts = slots.map(s => {
      const it = D.ITEMS[s.id];
      return { label: `${it.name} x${s.qty}`, sub: it.desc, act: () => {
        if (it.type === "hp" || it.type === "mp") this.pickItemTarget(x, s.id, it.type);
        else if (it.type === "revive") this.pickItemTarget(x, s.id, "revive");
        else this.nextCmd();
      }};
    });
    this.uiPush(opts, `${x.p.name} — Items`);
  }

  pickItemTarget(x, itemId, kind) {
    const it = D.ITEMS[itemId];
    const opts = this.game.party.map((q, i) => {
      const disabled = kind === "revive" ? q.hp > 0 : kind === "hp" ? (q.hp <= 0 || q.hp >= q.maxHp) : q.mp >= q.maxMp;
      return { label: q.name, sub: `${q.hp}/${q.maxHp} HP`, disabled, act: () => {
        x.command = { type: "item", itemId, targetIdx: i };
        this.nextCmd();
      }};
    });
    this.uiPush(opts, `Item target — ${x.p.name}`);
  }

  tryFlee() {
    const pa = this.party.reduce((s, x) => s + x.p.agi, 0) / this.party.length;
    const ea = this.enemies.reduce((s, e) => s + e.def.agi, 0) / this.enemies.length;
    const chance = Math.min(0.95, Math.max(0.05, 0.5 + (pa - ea) * 0.03));
    if (Math.random() < chance) { this.msg("You fled the battle!"); this.result = "fled"; }
    else {
      this.msg("Couldn't escape!");
      this.aliveParty()[this.aliveIdx].command = { type: "defend" };
      this.nextCmd();
    }
    this.syncUi();
  }

  resolveRound() {
    const actors = [];
    for (const x of this.party) if (x.p.hp > 0) actors.push({ kind: "p", ref: x });
    for (const e of this.enemies) if (e.hp > 0) actors.push({ kind: "e", ref: e });
    actors.sort((a, b) => {
      const sa = a.kind === "p" ? a.ref.p.agi : a.ref.def.agi;
      const sb = b.kind === "p" ? b.ref.p.agi : b.ref.def.agi;
      if (sb !== sa) return sb - sa;
      return Math.random() < 0.5 ? -1 : 1;
    });
    for (const a of actors) {
      if (this.result) break;
      this.executeActor(a);
    }
    this.afterResolve();
  }

  executeActor(a) {
    if (a.kind === "e") { this.enemyAct(a.ref); return; }
    const x = a.ref;
    const cmd = x.command;
    if (!cmd) return;
    if (cmd.type === "attack") {
      const es = this.aliveEnemies();
      if (!es.length) return;
      const target = (cmd.targetIdx != null && this.enemies[cmd.targetIdx] && this.enemies[cmd.targetIdx].hp > 0)
        ? this.enemies[cmd.targetIdx] : rnd(es);
      this.msg(`${x.p.name} attacks ${target.def.name}!`);
      this.hitEnemy(target, D.physDamage(D.atk(x.p), target.def.def));
    } else if (cmd.type === "magic") {
      this.doCast(x, cmd.spell, cmd.targetIdx);
    } else if (cmd.type === "item") {
      this.doItem(x, cmd.itemId, cmd.targetIdx);
    } else if (cmd.type === "defend") {
      this.msg(`${x.p.name} guards against attacks.`);
    }
  }

  doCast(x, sid, targetIdx) {
    const s = D.SPELLS[sid];
    const p = x.p;
    if (p.mp < s.mp) { this.msg(`${p.name} lacks the MP for ${s.name}!`); return; }
    p.mp -= s.mp;
    if (s.targets === "enemy") {
      const e = this.enemies.find(e2 => e2.id === targetIdx);
      if (e && e.hp > 0) { this.msg(`${p.name} casts ${s.name}!`); this.hitEnemy(e, D.spellDamage(s.base, s.mult, p.int)); }
      else {
        const es = this.aliveEnemies();
        if (es.length) { this.msg(`${p.name} casts ${s.name}!`); this.hitEnemy(rnd(es), D.spellDamage(s.base, s.mult, p.int)); }
      }
    } else if (s.targets === "allEnemy" || s.targets === "sleep") {
      this.msg(`${p.name} casts ${s.name}!`);
      if (s.targets === "sleep") {
        for (const e of this.aliveEnemies()) if (Math.random() < 0.7) { e.asleep = true; this.msg(`${e.def.name} falls asleep.`); }
      } else {
        for (const e of this.aliveEnemies()) this.hitEnemy(e, D.spellDamage(s.base, s.mult, p.int));
      }
    } else if (s.targets === "ally") {
      const t = this.game.party[targetIdx] || this.game.party.find(q => q.hp > 0);
      if (!t) return;
      const h = D.spellDamage(s.base, s.mult, p.int);
      t.hp = Math.min(t.maxHp, t.hp + h);
      this.msg(`${p.name} casts ${s.name}! ${t.name} recovers ${h} HP.`);
    } else if (s.targets === "allAlly") {
      this.msg(`${p.name} casts ${s.name}!`);
      for (const q of this.game.party) if (q.hp > 0) q.hp = Math.min(q.maxHp, q.hp + D.spellDamage(s.base, s.mult, p.int));
    } else if (s.targets === "revive") {
      const t = this.game.party[targetIdx];
      if (t) {
        t.hp = t.hp > 0 ? Math.min(t.maxHp, t.hp + Math.floor(t.maxHp / 2)) : Math.floor(t.maxHp / 2);
        this.msg(`${p.name} casts ${s.name}! ${t.name} returns!`);
      }
    }
  }

  doItem(x, itemId, targetIdx) {
    const it = D.ITEMS[itemId];
    const t = this.game.party[targetIdx];
    let used = false;
    if (it.type === "hp") { if (t && t.hp > 0) { t.hp = Math.min(t.maxHp, t.hp + it.heal); this.msg(`${x.p.name} uses ${it.name} on ${t.name} (+${it.heal} HP).`); used = true; } }
    else if (it.type === "mp") { if (t) { t.mp = Math.min(t.maxMp, t.mp + it.heal); this.msg(`${x.p.name} uses ${it.name} on ${t.name} (+${it.heal} MP).`); used = true; } }
    else if (it.type === "revive") { if (t && t.hp <= 0) { t.hp = Math.floor(t.maxHp / 2); this.msg(`${x.p.name} uses ${it.name}! ${t.name} returns!`); used = true; } }
    if (used) this.game.consume(itemId);
    else this.msg("That item had no effect.");
  }

  enemyAct(e) {
    if (e.hp <= 0) return;
    if (e.asleep) {
      if (Math.random() < 0.4) { e.asleep = false; this.msg(`${e.def.name} wakes up!`); }
      else { this.msg(`${e.def.name} is fast asleep...`); return; }
    }
    const alive = this.aliveParty();
    if (!alive.length) return;
    if (e.def.ai === "caster" && e.mp > 0 && Math.random() < 0.45) {
      const s = D.SPELLS[e.def.spell];
      e.mp--;
      const t = rnd(alive);
      this.msg(`${e.def.name} casts ${s.name}!`);
      this.hitParty(t, Math.round(D.spellDamage(s.base, 1.2, 0) * 1.4));
    } else {
      const t = rnd(alive);
      this.msg(`${e.def.name} attacks ${t.p.name}!`);
      this.hitParty(t, D.physDamage(e.def.atk, D.def(t.p)));
    }
  }

  hitParty(x, dmg) {
    let d = dmg;
    if (x.defend) d = Math.floor(d / 2);
    x.p.hp -= d;
    this.msg(`${x.p.name} takes ${d} damage.`);
    if (x.p.hp <= 0) { x.p.hp = 0; this.msg(`${x.p.name} has fallen!`); }
  }

  hitEnemy(e, dmg) {
    e.hp -= dmg;
    this.msg(`${e.def.name} takes ${dmg} damage.`);
    if (e.hp <= 0) { e.hp = 0; this.msg(`${e.def.name} is defeated!`); }
  }

  afterResolve() {
    if (this.aliveEnemies().length === 0) { this.victory(); return; }
    if (this.aliveParty().length === 0) { this.result = "lose"; this.syncUi(); return; }
    this.startRound();
  }

  victory() {
    this.result = "win";
    const xp = this.enemies.reduce((s, e) => s + e.def.xp, 0);
    const gold = this.enemies.reduce((s, e) => s + e.def.gold, 0);
    this.game.gold += gold;
    this.msg(`Victory! Gained ${xp} XP and ${gold} gold.`);
    for (const m of this.game.gainXp(xp)) this.msg(m);
    this.syncUi();
  }
}
