function makeGrid(w, h, fill) {
  return Array.from({length:h}, () => new Array(w).fill(fill));
}

function gridToStr(g) {
  return g.map(r => r.join(""));
}

function setTile(m, x, y, t) {
  const row = m.grid[y].split("");
  row[x] = t;
  m.grid[y] = row.join("");
}

function layoutMap(id, name, w, h, grid, npcs, doors, zoneOf) {
  return { id, name, w, h, grid: gridToStr(grid), npcs, doors, zoneOf };
}

function interior(w, h, zoneOf) {
  const g = makeGrid(w, h, "-");
  for (let x = 0; x < w; x++) { g[0][x] = "X"; g[h-1][x] = "X"; }
  for (let y = 0; y < h; y++) { g[y][0] = "X"; g[y][w-1] = "X"; }
  return g;
}

export function buildMaps() {
  const W = 42, H = 30;
  const g = makeGrid(W, H, ".");
  const rect = (x, y, w, h, t) => {
    for (let yy = Math.max(0,y); yy < Math.min(H, y+h); yy++)
      for (let xx = Math.max(0,x); xx < Math.min(W, x+w); xx++)
        g[yy][xx] = t;
  };
  const hline = (y, x0, x1, t) => { for (let x = x0; x <= x1; x++) g[y][x] = t; };
  const vline = (x, y0, y1, t) => { for (let y = y0; y <= y1; y++) g[y][x] = t; };

  rect(0, 0, W, 2, "T");
  rect(0, H-2, W, 2, "T");
  rect(0, 0, 2, H, "T");
  rect(W-2, 0, 2, H, "T");

  vline(28, 2, H-3, "~");
  vline(29, 2, H-3, "~");
  g[15][28] = "P";
  g[15][29] = "P";

  rect(31, 2, 9, H-4, ",");
  rect(31, 2, 2, 5, "T");
  rect(38, 2, 2, 5, "T");
  rect(31, 9, 2, 3, "T");
  rect(38, 8, 2, 3, "T");
  rect(31, 21, 2, 5, "T");
  rect(38, 21, 2, 5, "T");
  rect(32, 16, 3, 2, "T");
  rect(36, 16, 3, 2, "T");
  rect(32, 5, 2, 1, "T");
  rect(38, 13, 2, 1, "T");
  rect(32, 6, 4, 2, ".");
  rect(33, 13, 3, 2, ".");
  rect(31, 19, 5, 2, ".");
  rect(34, 25, 3, 2, ",");
  rect(33, 24, 7, 4, "~");

  rect(12, 2, 14, 9, "H");
  rect(13, 3, 12, 7, "R");
  g[10][18] = "D";

  rect(4, 12, 22, 13, "#");

  hline(12, 5, 24, "F");
  hline(24, 5, 24, "F");
  vline(4, 13, 17, "F"); vline(4, 19, 23, "F");
  vline(25, 13, 17, "F"); vline(25, 19, 23, "F");

  rect(6, 13, 5, 4, "H");  g[16][8]  = "D";
  rect(13, 13, 5, 4, "H"); g[16][15] = "D";
  rect(20, 13, 5, 4, "H"); g[16][22] = "D";
  rect(6, 19, 5, 4, "H");  g[22][8]  = "D";
  rect(13, 19, 5, 4, "H"); g[22][15] = "D";

  hline(18, 2, 28, "P");
  vline(18, 11, 18, "P");
  vline(28, 16, 18, "P");
  hline(15, 30, 37, "P");

  const flowers = [[9,9],[10,9],[3,10],[7,26],[16,25],[23,26],[20,6],[5,5],[24,26],[17,8],[8,27]];
  for (const [x, y] of flowers) if (g[y][x] === ".") g[y][x] = ",";

  const npcs = [{ x:9, y:18, kind:"npc", face:1, msg:"The forest east of the river is crawling with monsters.\nGain some levels before you go too deep." }];

  const worldDoors = [
    { x:8,  y:16, toMap:"inn",     toX:4,  toY:6,  toFacing:0 },
    { x:15, y:16, toMap:"weapon",  toX:4,  toY:6,  toFacing:0 },
    { x:22, y:16, toMap:"item",    toX:4,  toY:6,  toFacing:0 },
    { x:8,  y:22, toMap:"spells",  toX:4,  toY:6,  toFacing:0 },
    { x:15, y:22, toMap:"house",   toX:4,  toY:6,  toFacing:0 },
    { x:18, y:10, toMap:"castle",  toX:7,  toY:8,  toFacing:0 },
  ];

  const world = layoutMap("world", "Greenfield", W, H, g, npcs, worldDoors, (x, y) => {
    if (x >= 31) return "forest";
    if (x >= 28 && y >= 22) return "field";
    if (x >= 4 && x <= 25 && y >= 12 && y <= 24) return "town";
    if (y <= 11 && x >= 12 && x <= 25) return "castle";
    return "field";
  });

  const inn = layoutMap("inn", "Inn", 9, 8, interior(9, 8, () => null),
    [{ x:2, y:2, kind:"inn", face:2, msg:"Welcome to the Inn. A good night's rest for 30 gold — the party fully recovers." }],
    [{ x:4, y:6, toMap:"world", toX:8,  toY:17, toFacing:0 }], () => null);
  setTile(inn, 4, 6, "+");

  const weapon = layoutMap("weapon", "Armory", 9, 8, interior(9, 8, () => null),
    [{ x:2, y:2, kind:"shop", shop:"weapon", face:2, msg:"Welcome! The finest steel this side of the river." }],
    [{ x:4, y:6, toMap:"world", toX:15, toY:17, toFacing:0 }], () => null);
  setTile(weapon, 4, 6, "+");

  const item = layoutMap("item", "Item Shop", 9, 8, interior(9, 8, () => null),
    [{ x:2, y:2, kind:"shop", shop:"item", face:2, msg:"Potions, ethers, tents — all you need for the road." }],
    [{ x:4, y:6, toMap:"world", toX:22, toY:17, toFacing:0 }], () => null);
  setTile(item, 4, 6, "+");

  const spells = layoutMap("spells", "Arcane Library", 9, 8, interior(9, 8, () => null),
    [{ x:2, y:2, kind:"shop", shop:"spells", face:2, msg:"Knowledge is power. Which spell shall you learn?" }],
    [{ x:4, y:6, toMap:"world", toX:8,  toY:23, toFacing:0 }], () => null);
  setTile(spells, 4, 6, "+");

  const house = layoutMap("house", "Old Man's Cottage", 9, 8, interior(9, 8, () => null),
    [{ x:2, y:2, kind:"npc", face:2, msg:"I was an adventurer once. Sold my sword for a rocking chair.\nThe shops in town will outfit you for the road." }],
    [{ x:4, y:6, toMap:"world", toX:15, toY:23, toFacing:0 }], () => null);
  setTile(house, 4, 6, "+");

  const castleGrid = interior(14, 10, () => "castle");
  const castle = layoutMap("castle", "Castle Valen", 14, 10, castleGrid,
    [
      { x:7,  y:3, kind:"npc", face:2, msg:"I am King Valen. Beyond the river lies the Demon's wood.\nSlay the Demon, and I shall reward you handsomely." },
      { x:3,  y:5, kind:"npc", face:1, msg:"The castle halls are not safe either. The darkness has seeped in." },
    ],
    [{ x:7, y:8, toMap:"world", toX:18, toY:11, toFacing:0 }],
    () => "castle");
  setTile(castle, 7, 8, "+");

  return { world, inn, weapon, item, spells, house, castle };
}
