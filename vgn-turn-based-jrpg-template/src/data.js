export const CLASSES = {
  fighter:  { name:"Fighter",   tunic:"#c0392b", hp:34, mp:0,  str:7, agi:5, vit:7, int:1, luk:4, weapon:"shortSword", armor:"cloth", spells:[] },
  thief:    { name:"Thief",     tunic:"#27ae60", hp:26, mp:0,  str:5, agi:9, vit:5, int:2, luk:8, weapon:"dagger",    armor:"cloth", spells:[] },
  blackMage:{ name:"Black Mage",tunic:"#33415c", hp:18, mp:16, str:3, agi:4, vit:3, int:9, luk:5, weapon:"staff",     armor:"cloth", spells:["fire","blizzard","sleep"] },
  whiteMage:{ name:"White Mage",tunic:"#e8e8ea", hp:20, mp:16, str:3, agi:5, vit:4, int:8, luk:5, weapon:"staff",     armor:"cloth", spells:["cure","heal"] },
};

export const WEAPONS = {
  dagger:     { name:"Dagger",      atk:3,  price:30 },
  staff:      { name:"Staff",       atk:3,  price:40 },
  shortSword: { name:"Short Sword", atk:6,  price:80 },
  rapier:     { name:"Rapier",      atk:10, price:220 },
  ironSword:  { name:"Iron Sword",  atk:16, price:600 },
  silverSword:{ name:"Silver Sword",atk:22, price:1500 },
  flameSword: { name:"Flame Sword", atk:30, price:4000 },
};

export const ARMORS = {
  cloth:      { name:"Cloth",        def:1,  price:20 },
  leather:    { name:"Leather",      def:4,  price:120 },
  chain:      { name:"Chain Mail",   def:8,  price:400 },
  plate:      { name:"Plate",        def:13, price:1200 },
  dragonArmor:{ name:"Dragon Armor", def:18, price:3000 },
};

export const ITEMS = {
  potion:     { name:"Potion",       price:40,  desc:"Restores 30 HP", heal:30, type:"hp" },
  hiPotion:   { name:"Hi-Potion",    price:160, desc:"Restores 80 HP", heal:80, type:"hp" },
  ether:      { name:"Ether",        price:120, desc:"Restores 20 MP", heal:20, type:"mp" },
  phoenixDown:{ name:"Phoenix Down", price:320, desc:"Revives an ally",       type:"revive" },
  tent:       { name:"Tent",         price:120, desc:"Fully rests the party", type:"rest", fieldOnly:true },
};

export const SPELLS = {
  fire:    { name:"Fire",     mp:5,  school:"black", desc:"Flame on one enemy",       base:16, mult:2,   targets:"enemy" },
  blizzard:{ name:"Blizzard", mp:7,  school:"black", desc:"Ice on one enemy",         base:22, mult:2.5, targets:"enemy" },
  thunder: { name:"Thunder",  mp:11, school:"black", desc:"Lightning on all enemies",  base:26, mult:3,   targets:"allEnemy" },
  fira:    { name:"Fira",     mp:20, school:"black", desc:"Flame on all enemies",      base:40, mult:3.5, targets:"allEnemy" },
  sleep:   { name:"Sleep",    mp:5,  school:"black", desc:"Puts enemies to sleep",                       targets:"sleep" },
  cure:    { name:"Cure",     mp:4,  school:"white", desc:"Heals one ally",             base:20, mult:2,   targets:"ally" },
  heal:    { name:"Heal",     mp:8,  school:"white", desc:"Heals one ally",             base:45, mult:2.5, targets:"ally" },
  cura:    { name:"Cura",     mp:14, school:"white", desc:"Heals the whole party",      base:60, mult:3,   targets:"allAlly" },
  life:    { name:"Life",     mp:20, school:"white", desc:"Revives with half HP",                          targets:"revive" },
};

export const ENEMIES = {
  slime:    { name:"Slime",     hp:14, mp:0,  atk:4,  def:1,  agi:2,  xp:4,  gold:4,   img:"slime",   ai:"basic" },
  rat:      { name:"Dire Rat",  hp:9,  mp:0,  atk:5,  def:0,  agi:7,  xp:3,  gold:2,   img:"rat",     ai:"basic" },
  goblin:   { name:"Goblin",    hp:18, mp:0,  atk:7,  def:2,  agi:5,  xp:7,  gold:8,   img:"goblin",  ai:"basic" },
  wolf:     { name:"Wolf",      hp:26, mp:0,  atk:10, def:2,  agi:9,  xp:12, gold:10,  img:"wolf",    ai:"basic" },
  skeleton: { name:"Skeleton",  hp:32, mp:0,  atk:11, def:5,  agi:6,  xp:17, gold:15,  img:"skeleton",ai:"basic" },
  imp:      { name:"Imp",       hp:24, mp:0,  atk:9,  def:3,  agi:11, xp:14, gold:12,  img:"imp",     ai:"basic" },
  darkMage: { name:"Dark Mage", hp:42, mp:20, atk:12, def:3,  agi:7,  xp:45, gold:40,  img:"mage",    ai:"caster", spell:"fire" },
  wraith:   { name:"Wraith",    hp:38, mp:0,  atk:14, def:4,  agi:12, xp:38, gold:32,  img:"wraith",  ai:"basic" },
  ogre:     { name:"Ogre",      hp:64, mp:0,  atk:17, def:7,  agi:3,  xp:60, gold:55,  img:"ogre",    ai:"basic" },
  knight:   { name:"Dark Knight",hp:72, mp:0,  atk:19, def:12, agi:8,  xp:95, gold:85,  img:"knight",  ai:"basic" },
  dragon:   { name:"Dragon",    hp:130,mp:40, atk:23, def:12, agi:6,  xp:190, gold:160, img:"dragon",  ai:"caster", spell:"fire" },
  demon:    { name:"Demon",     hp:160,mp:50, atk:27, def:15, agi:11, xp:280, gold:240, img:"demon",   ai:"caster", spell:"blizzard" },
};

export const ZONES = {
  field:  { pool:["slime","rat","slime","goblin"], count:[1,2,2,3] },
  forest: { pool:["goblin","wolf","skeleton","imp"], count:[1,2,2,3] },
  castle: { pool:["skeleton","darkMage","wraith","ogre"], count:[2,2,3] },
};

export const TILE_BLOCKED = ["T", "~", "H", "R", "F", "X"];

export const GROWTH = {
  fighter:  { hp:[9,14], mp:[0,0],  str:[2,4], agi:[1,2], vit:[2,3], int:[0,1], luk:[1,2] },
  thief:    { hp:[6,10], mp:[0,1],  str:[1,3], agi:[2,4], vit:[1,2], int:[0,1], luk:[2,3] },
  blackMage:{ hp:[3,6],  mp:[3,6],  str:[0,1], agi:[1,2], vit:[0,1], int:[2,4], luk:[1,2] },
  whiteMage:{ hp:[4,7],  mp:[3,6],  str:[0,1], agi:[1,2], vit:[1,2], int:[2,3], luk:[1,2] },
};

export const SPELL_LEARN = {
  blackMage: { 4:["thunder"], 7:["fira"] },
  whiteMage: { 4:["cura"],    8:["life"] },
};

export const SHOP_STOCK = {
  weapon: ["shortSword","rapier","ironSword","silverSword","flameSword","leather","chain","plate","dragonArmor"],
  item:   ["potion","hiPotion","ether","tent","phoenixDown"],
};

export const SPELL_SHOP = {
  blackMage: ["fire","blizzard","thunder","fira"],
  whiteMage: ["cure","heal","cura","life"],
};

export function xpToNext(level) { return Math.floor(8*level*level + 6*level); }

export function newMember(id) {
  const c = CLASSES[id];
  return {
    id, name:c.name, cls:c, level:1, xp:0,
    hp:c.hp, maxHp:c.hp, mp:c.mp, maxMp:c.mp,
    str:c.str, agi:c.agi, vit:c.vit, int:c.int, luk:c.luk,
    weapon:c.weapon, armor:c.armor, spells:[...c.spells],
  };
}

export function atk(p) { return p.str + WEAPONS[p.weapon].atk; }
export function def(p) { return p.vit + ARMORS[p.armor].def; }

export function physDamage(atkVal, defVal) {
  const r = 0.85 + Math.random()*0.35;
  return Math.max(1, Math.round(atkVal * r * (100 - Math.min(defVal, 80)) / 100));
}

export function spellDamage(base, mult, intVal) {
  return Math.max(1, Math.round((base + intVal*mult) * (0.9 + Math.random()*0.2)));
}

export function rand(list) { return list[Math.floor(Math.random()*list.length)]; }

export function startingInventory() {
  return [{id:"potion", qty:3}, {id:"ether", qty:1}, {id:"tent", qty:1}];
}
