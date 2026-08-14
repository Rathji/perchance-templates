import { ITEMS, WEAPONS, ARMORS, SPELLS, SHOP_STOCK, SPELL_SHOP, xpToNext, atk, def } from "./data.js";

export let modalOpen = false;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

export function listChoice(title, items) {
  return new Promise(resolve => {
    modalOpen = true;
    const wrap = document.getElementById("menuWrap");
    const win = document.getElementById("menuWin");
    let index = items.findIndex(i => !i.disabled);
    if (index < 0) index = 0;
    const render = () => {
      win.innerHTML = `<h2>${escapeHtml(title)}</h2>` + items.map((it, i) =>
        `<div class="mopt ${i === index ? "sel" : ""} ${it.disabled ? "disabled" : ""}">${escapeHtml(it.label)}${it.sub ? ` <span class="sub">${escapeHtml(it.sub)}</span>` : ""}</div>`
      ).join("");
    };
    const close = val => { modalOpen = false; wrap.style.display = "none"; window.removeEventListener("keydown", onKey); resolve(val); };
    const move = d => {
      let ni = index + d;
      for (let k = 0; k < items.length; k++) {
        const cand = ((ni % items.length) + items.length) % items.length;
        if (!items[cand].disabled) { index = cand; break; }
        ni += d;
      }
      render();
    };
    const onKey = e => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "s" || e.key === "d") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "w" || e.key === "a") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const it = items[index]; if (it && !it.disabled) close(index); }
      else if (e.key === "Escape" || e.key === "x" || e.key === "X") { e.preventDefault(); close(-1); }
    };
    win.onclick = e => {
      const el = e.target.closest(".mopt");
      if (!el) return;
      const idx = [...win.querySelectorAll(".mopt")].indexOf(el);
      if (idx >= 0 && !items[idx].disabled) close(idx);
    };
    render();
    wrap.style.display = "flex";
    window.addEventListener("keydown", onKey);
  });
}

export function infoWindow(title, html) {
  return new Promise(resolve => {
    modalOpen = true;
    const wrap = document.getElementById("menuWrap");
    const win = document.getElementById("menuWin");
    win.innerHTML = `<h2>${escapeHtml(title)}</h2><div style="font-size:14px; white-space:pre-wrap; line-height:1.4;">${html}</div><br><div style="text-align:center;"><button class="btn" id="infoOk">OK</button></div>`;
    const ok = win.querySelector("#infoOk");
    const close = () => { modalOpen = false; wrap.style.display = "none"; window.removeEventListener("keydown", onKey); resolve(); };
    const onKey = e => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape" || e.key === "x") { e.preventDefault(); close(); }
    };
    ok.onclick = close;
    wrap.style.display = "flex";
    ok.focus();
    window.addEventListener("keydown", onKey);
  });
}

export async function openMenu(game) {
  for (;;) {
    const choice = await listChoice("Menu", [
      { label: "Status", sub: "View your party" },
      { label: "Items", sub: `${game.inventory.reduce((s, it) => s + it.qty, 0)} items in bag` },
      { label: "Magic", sub: "Cast field spells" },
      { label: "Equip", sub: "Change gear" },
      { label: "Save", sub: "Record progress" },
      { label: "Load", sub: "Restore a save" },
      { label: "Close" },
    ]);
    if (choice === -1) break;
    if (choice === 0) await statusMenu(game);
    else if (choice === 1) await itemMenuField(game);
    else if (choice === 2) await magicMenuField(game);
    else if (choice === 3) await equipMenu(game);
    else if (choice === 4) await saveMenu(game);
    else if (choice === 5) await loadMenu(game);
    else break;
  }
}

async function statusMenu(game) {
  const rows = [];
  for (const p of game.party) {
    rows.push(`<div style="font-size:14px; color:#ffd34d; margin-top:8px;">${escapeHtml(p.name)} — Lv ${p.level}</div>`);
    rows.push(`<div class="statrow"><span class="k">HP</span><span class="v">${p.hp} / ${p.maxHp}</span></div>`);
    rows.push(`<div class="statrow"><span class="k">MP</span><span class="v">${p.mp} / ${p.maxMp}</span></div>`);
    rows.push(`<div class="statrow"><span class="k">XP</span><span class="v">${p.xp} / ${xpToNext(p.level)}</span></div>`);
    rows.push(`<div class="statrow"><span class="k">STR AGI VIT</span><span class="v">${p.str} ${p.agi} ${p.vit}</span></div>`);
    rows.push(`<div class="statrow"><span class="k">INT LUK</span><span class="v">${p.int} ${p.luk}</span></div>`);
    rows.push(`<div class="statrow"><span class="k">ATK DEF</span><span class="v">${atk(p)} ${def(p)}</span></div>`);
    rows.push(`<div class="statrow"><span class="k">Weapon</span><span class="v">${WEAPONS[p.weapon].name}</span></div>`);
    rows.push(`<div class="statrow"><span class="k">Armor</span><span class="v">${ARMORS[p.armor].name}</span></div>`);
    rows.push(`<div class="statrow"><span class="k">Spells</span><span class="v">${p.spells.length ? p.spells.map(s => SPELLS[s].name).join(", ") : "—"}</span></div>`);
  }
  await infoWindow("Status", rows.join(""));
}

async function itemMenuField(game) {
  for (;;) {
    const slots = game.inventory.filter(s => s.qty > 0);
    if (!slots.length) { await infoWindow("Items", "Your bag is empty."); return; }
    const idx = await listChoice("Items", slots.map(s => ({
      label: `${ITEMS[s.id].name} x${s.qty}`,
      sub: ITEMS[s.id].desc,
    })).concat([{ label: "Close" }]));
    if (idx === -1 || idx >= slots.length) return;
    const slot = slots[idx];
    const it = ITEMS[slot.id];
    if (it.type === "hp" || it.type === "mp" || it.type === "revive" || it.fieldOnly) {
      const targets = game.party.map(q => ({
        label: q.name,
        sub: `${q.hp}/${q.maxHp} HP`,
        disabled: it.type === "revive" ? q.hp > 0 : it.type === "hp" ? (q.hp <= 0 || q.hp >= q.maxHp) : it.type === "mp" ? q.mp >= q.maxMp : false,
      }));
      const ti = await listChoice(`Use ${it.name} on?`, targets.concat([{ label: "Cancel" }]));
      if (ti === -1 || ti >= targets.length) continue;
      game.useItemField(slot.id, game.party[ti]);
    }
  }
}

async function magicMenuField(game) {
  for (;;) {
    const casters = game.party.filter(p => p.mp > 0 && p.spells.length);
    if (!casters.length) { await infoWindow("Magic", "No one knows any spells yet."); return; }
    const ci = await listChoice("Cast with whom?", casters.map(c => ({ label: c.name, sub: `${c.mp}/${c.maxMp} MP` })).concat([{ label: "Close" }]));
    if (ci === -1 || ci >= casters.length) return;
    const c = casters[ci];
    const spells = c.spells.map(sid => {
      const s = SPELLS[sid];
      return { label: `${s.name} (${s.mp} MP)`, sub: s.desc, disabled: c.mp < s.mp };
    });
    const si = await listChoice(`${c.name} — Spells`, spells.concat([{ label: "Back" }]));
    if (si === -1 || si >= spells.length) continue;
    const s = SPELLS[c.spells[si]];
    if (s.targets === "allAlly") {
      game.castField(c, c.spells[si], null);
    } else if (s.targets === "ally" || s.targets === "revive") {
      const tgts = game.party.map(q => ({
        label: q.name,
        sub: `${q.hp}/${q.maxHp} HP`,
        disabled: s.targets === "revive" ? q.hp > 0 : q.hp <= 0,
      }));
      const ti = await listChoice(`${s.name} on?`, tgts.concat([{ label: "Cancel" }]));
      if (ti === -1 || ti >= tgts.length) continue;
      game.castField(c, c.spells[si], game.party[ti]);
    } else {
      await infoWindow("Magic", "That spell can only be used in battle.");
    }
  }
}

async function equipMenu(game) {
  for (;;) {
    const pi = await listChoice("Equip for whom?", game.party.map(p => ({
      label: p.name,
      sub: `${WEAPONS[p.weapon].name} / ${ARMORS[p.armor].name}`,
    })).concat([{ label: "Back" }]));
    if (pi === -1 || pi >= game.party.length) return;
    const p = game.party[pi];
    for (;;) {
      const weapons = game.inventory.filter(s => WEAPONS[s.id] && s.qty > 0);
      const armors = game.inventory.filter(s => ARMORS[s.id] && s.qty > 0);
      const ci = await listChoice(`${p.name} — Equip`, [
        { label: `Weapon: ${WEAPONS[p.weapon].name}`, sub: weapons.length ? "Choose a new weapon" : "No weapons in bag", disabled: !weapons.length },
        { label: `Armor: ${ARMORS[p.armor].name}`, sub: armors.length ? "Choose new armor" : "No armor in bag", disabled: !armors.length },
        { label: "Back" },
      ]);
      if (ci === -1 || ci === 2) break;
      const isWeapon = ci === 0;
      const slots = isWeapon ? weapons : armors;
      const itemList = slots.map(s => {
        const w = WEAPONS[s.id] || ARMORS[s.id];
        const cur = isWeapon ? WEAPONS[p.weapon] : ARMORS[p.armor];
        const val = isWeapon ? w.atk : w.def;
        const diff = val - (isWeapon ? cur.atk : cur.def);
        return { label: `${w.name} x${s.qty}`, sub: `${isWeapon ? "ATK" : "DEF"} ${val}${diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : ""}` };
      }).concat([{ label: "Cancel" }]);
      const si = await listChoice(isWeapon ? "Choose weapon" : "Choose armor", itemList);
      if (si === -1 || si >= slots.length) continue;
      game.equip(p, isWeapon ? "weapon" : "armor", slots[si].id);
    }
  }
}

async function saveMenu(game) {
  for (;;) {
    const slots = [];
    for (let i = 1; i <= 3; i++) {
      const has = await game.hasSave(i);
      slots.push({ label: `Slot ${i}`, sub: has ? "Overwrite this save" : "Empty" });
    }
    const si = await listChoice("Save to which slot?", slots.concat([{ label: "Back" }]));
    if (si === -1 || si >= 3) return;
    if (await game.saveGame(si + 1)) await infoWindow("Save", `Game saved to slot ${si + 1}.`);
    else await infoWindow("Save", "Could not save (storage unavailable).");
  }
}

async function loadMenu(game) {
  const slots = [];
  for (let i = 1; i <= 3; i++) slots.push(await game.hasSave(i));
  if (!slots.some(Boolean)) { await infoWindow("Load", "No saved games found."); return; }
  const si = await listChoice("Load which save?", slots.map((has, i) => ({
    label: `Slot ${i + 1}`, sub: has ? "Load this save" : "Empty", disabled: !has,
  })).concat([{ label: "Back" }]));
  if (si === -1 || si >= 3) return;
  const ok = await listChoice("Load?", [{ label: "Yes" }, { label: "No" }]);
  if (ok !== 0) return;
  if (await game.loadGame(si + 1)) await infoWindow("Load", "Save loaded.");
  else await infoWindow("Load", "Could not load that save.");
}

export async function shopMenu(game, kind) {
  for (;;) {
    const ci = await listChoice("Shop", [
      { label: "Buy", sub: kind === "spells" ? "Learn new spells" : "Purchase goods" },
      { label: "Sell", sub: "Sell for half price", disabled: kind === "spells" },
      { label: "Leave" },
    ]);
    if (ci === -1 || ci === 2) return;
    if (ci === 1) { await sellMenu(game); continue; }
    await buyMenu(game, kind);
  }
}

function priceOf(id) {
  if (WEAPONS[id]) return WEAPONS[id].price;
  if (ARMORS[id]) return ARMORS[id].price;
  if (ITEMS[id]) return ITEMS[id].price;
  const s = SPELLS[id];
  return s ? 60 + s.mp * 25 : 0;
}

function nameOf(id) {
  return (WEAPONS[id] || ARMORS[id] || ITEMS[id] || SPELLS[id]).name;
}

async function buyMenu(game, kind) {
  if (kind === "spells") { await spellBuyMenu(game); return; }
  const stock = SHOP_STOCK[kind];
  for (;;) {
    const opts = stock.map(id => {
      const w = WEAPONS[id] || ARMORS[id] || ITEMS[id];
      return { label: `${w.name} — ${w.price} G`, sub: w.desc || (w.atk != null ? `ATK ${w.atk}` : `DEF ${w.def}`), disabled: game.gold < w.price };
    });
    const bi = await listChoice("Buy", opts.concat([{ label: "Back" }]));
    if (bi === -1 || bi >= stock.length) return;
    const id = stock[bi];
    const pr = priceOf(id);
    if (game.gold >= pr) {
      game.gold -= pr;
      game.addItem(id, 1);
      await infoWindow("Buy", `Bought ${nameOf(id)} for ${pr} G.`);
    }
  }
}

async function sellMenu(game) {
  for (;;) {
    const slots = game.inventory.filter(s => s.qty > 0 && (WEAPONS[s.id] || ARMORS[s.id] || ITEMS[s.id]));
    if (!slots.length) { await infoWindow("Sell", "Nothing to sell."); return; }
    const opts = slots.map(s => {
      const pr = Math.floor(priceOf(s.id) / 2);
      return { label: `${nameOf(s.id)} x${s.qty} — ${pr} G each`, sub: ITEMS[s.id] ? ITEMS[s.id].desc : "" };
    });
    const si = await listChoice("Sell what?", opts.concat([{ label: "Back" }]));
    if (si === -1 || si >= slots.length) return;
    const slot = slots[si];
    const pr = Math.floor(priceOf(slot.id) / 2);
    game.gold += pr;
    game.consume(slot.id);
    await infoWindow("Sell", `Sold ${nameOf(slot.id)} for ${pr} G.`);
  }
}

async function spellBuyMenu(game) {
  const learners = game.party.filter(p => SPELL_SHOP[p.id]);
  if (!learners.length) { await infoWindow("Spells", "No one here can learn spells."); return; }
  for (;;) {
    const li = await listChoice("For whom?", learners.map(p => ({
      label: p.name, sub: `${p.spells.length} spells known`,
    })).concat([{ label: "Back" }]));
    if (li === -1 || li >= learners.length) return;
    const p = learners[li];
    const shop = SPELL_SHOP[p.id];
    const opts = shop.map(sid => {
      const s = SPELLS[sid];
      const pr = priceOf(sid);
      const has = p.spells.includes(sid);
      return { label: has ? `${s.name} (known)` : `${s.name} — ${pr} G`, sub: s.desc, disabled: has || game.gold < pr };
    }).concat([{ label: "Back" }]);
    const si = await listChoice(`${p.name} — Spells`, opts);
    if (si === -1 || si >= shop.length) return;
    const sid = shop[si];
    const pr = priceOf(sid);
    if (!p.spells.includes(sid) && game.gold >= pr) {
      game.gold -= pr;
      p.spells.push(sid);
      await infoWindow("Spells", `${p.name} learned ${SPELLS[sid].name}!`);
    }
  }
}

export async function innMenu(game) {
  const cost = 30;
  if (game.gold < cost) { await infoWindow("Inn", "You don't have enough gold to rent a room."); return; }
  const ok = await listChoice("Inn", [
    { label: `Rest for ${cost} G`, sub: "Fully restore the party" },
    { label: "Leave" },
  ]);
  if (ok !== 0) return;
  game.gold -= cost;
  game.rest();
  await infoWindow("Inn", "You rest for the night...\nThe party is fully restored.");
}
