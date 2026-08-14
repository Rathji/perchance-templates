const TILE = 16;

function tc(draw) {
  const c = document.createElement("canvas");
  c.width = TILE; c.height = TILE;
  const g = c.getContext("2d");
  draw(g);
  return c;
}

function speck(g, color, pts, size = 2) {
  g.fillStyle = color;
  for (const [x, y] of pts) g.fillRect(x, y, size, size);
}

const grassG = tc(g => {
  g.fillStyle = "#3f8f4f"; g.fillRect(0, 0, TILE, TILE);
  speck(g, "#367a43", [[2,3],[9,2],[13,6],[5,9],[11,12],[3,13],[14,11]]);
  speck(g, "#54a55f", [[0,6],[7,5],[12,8],[6,13]], 1);
});
const flowerG = tc(g => {
  g.drawImage(grassG, 0, 0);
  speck(g, "#d9534f", [[3,4],[10,8],[6,12]], 2);
  speck(g, "#f2c94c", [[3,4],[10,8],[6,12]], 1);
});
const treeG = tc(g => {
  g.fillStyle = "#3a8446"; g.fillRect(0, 0, TILE, 6);
  g.fillStyle = "#2e6b38"; g.fillRect(0, 5, TILE, TILE);
  g.fillStyle = "#27592f"; g.fillRect(0, 13, TILE, 3);
  g.fillStyle = "#1f4a26"; g.fillRect(0, 13, TILE, 1);
  g.fillStyle = "#6b4a2f"; g.fillRect(7, 12, 2, 4);
  g.fillStyle = "#84b04a"; g.fillRect(2, 1, 3, 2);
});
const waterG = tc(g => {
  g.fillStyle = "#2a6fb0"; g.fillRect(0, 0, TILE, TILE);
  speck(g, "#4f8fc4", [[1,2],[5,5],[9,1],[13,6],[2,9],[8,12],[12,10],[5,15]], 2);
  speck(g, "#1f5690", [[3,4],[7,3],[11,8],[4,12],[10,14],[14,4]], 1);
});
const pathG = tc(g => {
  g.fillStyle = "#c9a96b"; g.fillRect(0, 0, TILE, TILE);
  speck(g, "#a98a54", [[2,3],[8,2],[13,5],[5,9],[11,11],[3,14],[14,12],[9,7]]);
  speck(g, "#d8bd85", [[0,7],[7,4],[12,9],[6,15]], 1);
});
const dirtG = tc(g => {
  g.fillStyle = "#8a6a42"; g.fillRect(0, 0, TILE, TILE);
  speck(g, "#755735", [[3,2],[10,4],[14,8],[5,10],[11,13],[2,15],[8,7]]);
  speck(g, "#9a7a52", [[0,5],[7,3],[13,11],[6,14]], 1);
});
const wallG = tc(g => {
  g.fillStyle = "#9aa0a8"; g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = "#5f646c";
  g.fillRect(0, 3, TILE, 1); g.fillRect(0, 7, TILE, 1); g.fillRect(0, 11, TILE, 1);
  g.fillRect(3, 0, 1, 3); g.fillRect(11, 0, 1, 3);
  g.fillRect(7, 4, 1, 3); g.fillRect(15, 4, 1, 3);
  g.fillRect(3, 8, 1, 3); g.fillRect(11, 8, 1, 3);
  g.fillRect(7, 12, 1, 3); g.fillRect(15, 12, 1, 3);
  speck(g, "#b6bcc4", [[1,1],[5,1],[9,5],[13,5],[1,9],[5,9],[9,13],[13,13]], 1);
});
const roofG = tc(g => {
  g.fillStyle = "#a3452f"; g.fillRect(0, 0, TILE, TILE);
  g.strokeStyle = "#7c3320"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 15); g.lineTo(15, 0); g.moveTo(0, 7); g.lineTo(7, 0); g.moveTo(8, 15); g.lineTo(15, 8); g.stroke();
  g.fillStyle = "#c05a40"; g.fillRect(0, 0, TILE, 2); g.fillRect(0, 0, 2, TILE);
});
const doorG = tc(g => {
  g.fillStyle = "#3a2410"; g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = "#5a3a20"; g.fillRect(1, 1, 14, 14);
  g.fillStyle = "#6b4a2f"; g.fillRect(1, 8, 14, 2);
  g.fillStyle = "#c9a96b"; g.fillRect(12, 6, 2, 2);
});
const fenceG = tc(g => {
  g.fillStyle = "#8a6a42";
  g.fillRect(1, 0, 3, 10); g.fillRect(12, 0, 3, 10);
  g.fillRect(1, 2, 14, 2); g.fillRect(1, 6, 14, 2);
  g.fillStyle = "#a5855d"; g.fillRect(1, 0, 3, 1); g.fillRect(12, 0, 3, 1);
});
const floorG = tc(g => {
  g.fillStyle = "#c9a86b"; g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = "#a8864f";
  g.fillRect(0, 3, TILE, 1); g.fillRect(0, 7, TILE, 1); g.fillRect(0, 11, TILE, 1); g.fillRect(0, 15, TILE, 1);
  speck(g, "#d8b878", [[2,1],[7,5],[12,9],[5,13]], 1);
});
const xwallG = tc(g => {
  g.fillStyle = "#6f757d"; g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = "#565b62";
  g.fillRect(0, 5, TILE, 2); g.fillRect(0, 11, TILE, 2);
  g.fillRect(5, 0, 2, 5); g.fillRect(11, 0, 2, 5);
  g.fillRect(5, 7, 2, 4); g.fillRect(11, 7, 2, 4);
  speck(g, "#82888f", [[1,1],[7,3],[13,1],[3,8],[9,9],[7,14]], 1);
});
const exitG = tc(g => {
  g.drawImage(floorG, 0, 0);
  g.fillStyle = "#6a6f78"; g.fillRect(5, 5, 6, 6);
  g.fillStyle = "#3f444c"; g.fillRect(5, 5, 6, 2);
});

export const TILES = {
  ".": grassG, ",": flowerG, T: treeG, "~": waterG, P: pathG, "#": dirtG,
  H: wallG, R: roofG, D: doorG, F: fenceG, "-": floorG, X: xwallG, "+": exitG,
};

export function drawPerson(g, tunic, dir, faceColor) {
  const skin = faceColor || "#e8b98a";
  const hair = "#5a3a20";
  const legs = "#2f2f33";
  g.fillStyle = hair; g.fillRect(5, 1, 6, 2);
  g.fillStyle = skin; g.fillRect(5, 1, 6, 5);
  g.fillStyle = hair; g.fillRect(5, 1, 6, 1);
  g.fillStyle = skin; g.fillRect(4, 6, 8, 2);
  g.fillStyle = tunic; g.fillRect(4, 7, 8, 5);
  g.fillStyle = skin; g.fillRect(3, 7, 2, 3); g.fillRect(11, 7, 2, 3);
  g.fillStyle = "#d8a86b"; g.fillRect(3, 10, 2, 1); g.fillRect(11, 10, 2, 1);
  g.fillStyle = legs; g.fillRect(5, 12, 2, 3); g.fillRect(9, 12, 2, 3);
  g.fillStyle = "#1d1d22"; g.fillRect(5, 14, 2, 1); g.fillRect(9, 14, 2, 1);
  if (dir === 0) { g.fillStyle = "#2b2b30"; g.fillRect(6, 2, 4, 1); }
  else if (dir === 2) { g.fillStyle = "#2b2b30"; g.fillRect(6, 4, 1, 1); g.fillRect(9, 4, 1, 1); }
  else if (dir === 1) { g.fillStyle = "#2b2b30"; g.fillRect(9, 3, 1, 1); }
  else { g.fillStyle = "#2b2b30"; g.fillRect(6, 3, 1, 1); }
}

export function heroCanvas(tunic, dir) {
  const c = document.createElement("canvas");
  c.width = TILE; c.height = TILE;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(2, 13, 12, 3);
  drawPerson(g, tunic, dir);
  return c;
}

export function drawMonster(g, type, cx, cy, s) {
  const u = s / 32;
  const E = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const B = (x, y, w, h, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill(); };
  g.save();
  g.translate(cx, cy);
  g.scale(u, u);
  const face = (x, y, flip) => {
    E(-4 + (flip ? 2 : 0) - 6, y - 5, 2, "#fff");
    E(4 + (flip ? 2 : 0) - 6, y - 5, 2, "#fff");
    E(-4 + (flip ? 2 : 0) - 6, y - 5, 1, "#111");
    E(4 + (flip ? 2 : 0) - 6, y - 5, 1, "#111");
  };
  switch (type) {
    case "slime":
      E(0, 0, 22, "#3fae4a"); E(-10, -4, 10, "#57c963"); E(10, -4, 10, "#57c963");
      face(0, 0, false); E(0, 8, 3, "#2e7d38");
      break;
    case "rat":
      B(0, 4, 18, 10, "#8a6a42"); B(-14, 0, 10, 7, "#8a6a42"); B(-16, -2, 4, 4, "#8a6a42");
      E(-12, -3, 2, "#111"); E(12, 0, 2, "#111"); E(0, 2, 2, "#111");
      g.strokeStyle = "#6b4a2f"; g.lineWidth = 2; g.beginPath(); g.moveTo(12, 10); g.quadraticCurveTo(22, 8, 24, 14); g.stroke();
      break;
    case "goblin":
      E(0, 0, 20, "#5fae3a"); E(0, -12, 8, "#5fae3a");
      face(0, 0, false); E(0, 8, 3, "#3a7d24");
      break;
    case "wolf":
      B(-2, 0, 20, 12, "#8d8d93"); B(-18, -4, 12, 9, "#8d8d93");
      E(-20, -8, 3, "#8d8d93"); E(14, -4, 3, "#8d8d93");
      E(-12, -6, 2, "#ffd34d"); E(8, 0, 2, "#111");
      break;
    case "skeleton":
      E(0, -8, 8, "#e8e8ea"); face(0, -8, false);
      R(-2, 0, 4, 14, "#e8e8ea"); R(-8, 2, 6, 3, "#e8e8ea"); R(2, 2, 6, 3, "#e8e8ea"); R(-8, 8, 6, 3, "#e8e8ea"); R(2, 8, 6, 3, "#e8e8ea");
      break;
    case "imp":
      E(0, 2, 14, "#c0392b"); E(0, -12, 6, "#c0392b"); E(-10, -8, 5, "#c0392b"); E(10, -8, 5, "#c0392b");
      face(0, 0, false);
      break;
    case "mage":
      g.fillStyle = "#2c2c3f"; g.beginPath(); g.moveTo(0, -20); g.lineTo(18, 18); g.lineTo(-18, 18); g.closePath(); g.fill();
      E(0, 6, 6, "#e8b98a"); face(0, 6, false); E(0, 14, 2, "#111");
      break;
    case "wraith":
      g.fillStyle = "#7a4fb0"; g.beginPath(); g.moveTo(0, -20); g.quadraticCurveTo(20, -6, 16, 16); g.lineTo(-16, 16); g.quadraticCurveTo(-20, -6, 0, -20); g.fill();
      E(-5, -2, 3, "#f0e0ff"); E(5, -2, 3, "#f0e0ff"); E(-5, -2, 1.5, "#3a1f5c"); E(5, -2, 1.5, "#3a1f5c");
      break;
    case "ogre":
      E(0, 0, 24, "#8a6a42"); E(0, -8, 10, "#8a6a42");
      E(-10, -6, 3, "#e8e8ea"); E(10, -6, 3, "#e8e8ea"); E(-10, -6, 1.5, "#111"); E(10, -6, 1.5, "#111");
      R(-4, 4, 3, 4, "#f2f2ee"); R(1, 4, 3, 4, "#f2f2ee");
      break;
    case "knight":
      g.fillStyle = "#8f969e"; g.beginPath(); g.moveTo(0, -22); g.lineTo(16, 16); g.lineTo(-16, 16); g.closePath(); g.fill();
      g.fillStyle = "#6f757d"; g.fillRect(-2, -22, 4, 6); g.fillRect(-14, 2, 28, 3);
      face(0, 6, false); R(10, 4, 4, 12, "#8f969e"); R(13, 0, 2, 6, "#c9d0d8");
      break;
    case "dragon":
      E(0, 0, 26, "#c0392b"); E(-6, -14, 9, "#c0392b"); E(6, -14, 9, "#c0392b");
      E(0, -18, 5, "#c0392b"); face(0, -2, false);
      E(-8, 6, 2, "#f2f2ee"); E(8, 6, 2, "#f2f2ee");
      g.strokeStyle = "#7c1f1f"; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, 14); g.lineTo(-30, 8); g.moveTo(18, 14); g.lineTo(30, 8); g.stroke();
      break;
    case "demon":
      E(0, 0, 26, "#5c1f4a"); E(-8, -16, 8, "#5c1f4a"); E(8, -16, 8, "#5c1f4a");
      face(0, -4, false); E(-5, -16, 2, "#f2c94c"); E(5, -16, 2, "#f2c94c");
      break;
    default:
      E(0, 0, 20, "#ff00ff");
  }
  g.restore();
}

export const MONSTER_TYPES = ["slime","rat","goblin","wolf","skeleton","imp","mage","wraith","ogre","knight","dragon","demon"];
