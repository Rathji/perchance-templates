import * as D from "./data.js";
import { buildMaps } from "./maps.js";
import { Battle } from "./battle.js";

const g = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

export class Game {
  constructor() {
    this.maps = buildMaps();
    this.kvRoot = null;
    this.reset();
  }

  reset() {
    this.mapId = "world";
    this.map = this.maps.world;
    this.pos = { x: 7, y: 18 };
    this.facing = 2;
    this.gold = 200;
    this.inventory = D.startingInventory();
    this.party = ["fighter", "thief", "blackMage", "whiteMage"].map(D.newMember);
    this.msgQueue = [];
    this.battle = null;
    this.mode = "world";
  }

  tile(x, y) {
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return "T";
    return this.map.grid[y][x];
  }

  isNpc(x, y) { return this.map.npcs.some(n => n.x === x && n.y === y); }
  npcAt(x, y) { return this.map.npcs.find(n => n.x === x && n.y === y); }

  blocked(x, y) {
    const t = this.tile(x, y);
    if (D.TILE_BLOCKED.includes(t)) return true;
    if (this.isNpc(x, y)) return true;
    return false;
  }

  zone(x, y) { return this.map.zoneOf(x, y); }

  teleportAt(x, y) {
    const d = this.map.doors.find(dd => dd.x === x && dd.y === y);
    if (!d) return null;
    this.mapId = d.toMap;
    this.map = this.maps[d.toMap];
    this.pos = { x: d.toX, y: d.toY };
    this.facing = d.toFacing;
    return this.map.name;
  }

  startEncounter() {
    const z = this.zone(this.pos.x, this.pos.y);
    const zoneDef = D.ZONES[z];
    if (!zoneDef) return null;
    const n = D.rand(zoneDef.count);
    const group = [];
    for (let i = 0; i < n; i++) {
      const def = D.ENEMIES[D.rand(zoneDef.pool)];
      group.push({ def, id: i, hp: def.hp, mp: def.mp, asleep: false, defend: false });
    }
    this.battle = new Battle(this, group);
    this.mode = "battle";
    return this.battle;
  }

  consume(id) {
    const slot = this.inventory.find(s => s.id === id);
    if (slot) {
      slot.qty--;
      if (slot.qty <= 0) this.inventory = this.inventory.filter(s => s !== slot);
    }
  }

  addItem(id, qty = 1) {
    const slot = this.inventory.find(s => s.id === id);
    if (slot) slot.qty += qty;
    else this.inventory.push({ id, qty });
  }

  useItemField(itemId, target) {
    const it = D.ITEMS[itemId];
    if (it.type === "hp") target.hp = Math.min(target.maxHp, target.hp + it.heal);
    else if (it.type === "mp") target.mp = Math.min(target.maxMp, target.mp + it.heal);
    else if (it.type === "revive") target.hp = Math.floor(target.maxHp / 2);
    else if (it.type === "rest") for (const p of this.party) { p.hp = p.maxHp; p.mp = p.maxMp; }
    this.consume(itemId);
  }

  castField(p, spellId, target) {
    const s = D.SPELLS[spellId];
    if (p.mp < s.mp) return;
    p.mp -= s.mp;
    if (s.targets === "ally") target.hp = Math.min(target.maxHp, target.hp + D.spellDamage(s.base, s.mult, p.int));
    else if (s.targets === "allAlly") for (const q of this.party) if (q.hp > 0) q.hp = Math.min(q.maxHp, q.hp + D.spellDamage(s.base, s.mult, p.int));
    else if (s.targets === "revive") target.hp = Math.floor(target.maxHp / 2);
  }

  equip(p, slot, itemId) {
    if (slot === "weapon" && D.WEAPONS[itemId]) {
      if (itemId !== p.weapon) this.addItem(p.weapon, 1);
      p.weapon = itemId;
    } else if (slot === "armor" && D.ARMORS[itemId]) {
      if (itemId !== p.armor) this.addItem(p.armor, 1);
      p.armor = itemId;
    }
    this.consume(itemId);
  }

  rest() { for (const p of this.party) { p.hp = p.maxHp; p.mp = p.maxMp; } }

  gainXp(amount) {
    const msgs = [];
    for (const p of this.party) {
      if (p.hp <= 0) continue;
      p.xp += amount;
      let lv = 0;
      while (p.xp >= D.xpToNext(p.level)) {
        p.xp -= D.xpToNext(p.level);
        p.level++;
        const gr = D.GROWTH[p.id];
        p.maxHp += g(gr.hp[0], gr.hp[1]);
        p.maxMp += g(gr.mp[0], gr.mp[1]);
        p.str += g(gr.str[0], gr.str[1]);
        p.agi += g(gr.agi[0], gr.agi[1]);
        p.vit += g(gr.vit[0], gr.vit[1]);
        p.int += g(gr.int[0], gr.int[1]);
        p.luk += g(gr.luk[0], gr.luk[1]);
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        lv++;
        const learn = D.SPELL_LEARN[p.id] && D.SPELL_LEARN[p.id][p.level];
        if (learn) for (const sid of learn) if (!p.spells.includes(sid)) { p.spells.push(sid); msgs.push(`${p.name} learned ${D.SPELLS[sid].name}!`); }
      }
      if (lv > 0) msgs.push(`${p.name} reached level ${p.level}!`);
    }
    return msgs;
  }

  serialize() {
    return {
      v: 1,
      party: this.party.map(p => ({
        id: p.id, level: p.level, xp: p.xp, hp: p.hp, maxHp: p.maxHp,
        mp: p.mp, maxMp: p.maxMp, str: p.str, agi: p.agi, vit: p.vit,
        int: p.int, luk: p.luk, weapon: p.weapon, armor: p.armor, spells: [...p.spells],
      })),
      gold: this.gold,
      inventory: this.inventory.map(s => ({ ...s })),
      mapId: this.mapId,
      pos: { ...this.pos },
      facing: this.facing,
    };
  }

  applySave(data) {
    this.party = data.party.map(rec => {
      const p = D.newMember(rec.id);
      for (const k of ["level","xp","hp","maxHp","mp","maxMp","str","agi","vit","int","luk","weapon","armor"]) p[k] = rec[k];
      p.spells = [...rec.spells];
      return p;
    });
    this.gold = data.gold;
    this.inventory = data.inventory.map(s => ({ ...s }));
    this.mapId = data.mapId;
    this.map = this.maps[data.mapId] || this.maps.world;
    this.pos = { ...data.pos };
    this.facing = data.facing;
    this.battle = null;
    this.mode = "world";
  }

  async saveGame(slot) {
    const data = this.serialize();
    if (this.kvRoot) { try { await this.kvRoot.set(slot, data); return true; } catch (e) {} }
    try { localStorage.setItem("rpg_save_" + slot, JSON.stringify(data)); return true; } catch (e) {}
    return false;
  }

  async loadGame(slot) {
    let data = null;
    if (this.kvRoot) { try { data = await this.kvRoot.get(slot); } catch (e) {} }
    if (!data) { try { data = JSON.parse(localStorage.getItem("rpg_save_" + slot)); } catch (e) {} }
    if (data && data.v) { this.applySave(data); return true; }
    return false;
  }

  async hasSave(slot) {
    if (this.kvRoot) { try { if (await this.kvRoot.get(slot)) return true; } catch (e) {} }
    return !!localStorage.getItem("rpg_save_" + slot);
  }
}
