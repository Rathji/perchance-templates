// Shared mutable singleton for UI modules.
export const S = {
  game: null,
  screen: 'title', // 'title' | 'map' | 'town' | 'hero' | 'combat'
  selectedHeroId: null,
  hover: null,      // {q, r}
  pathPreview: null, // [{q,r}, ...]
  battle: null,
  battleMeta: null,
};

export function setScreen(name) {
  S.screen = name;
  const screens = {
    title: document.getElementById('titleScreen'),
    map: document.getElementById('gameScreen'),
    combat: document.getElementById('combatScreen'),
    editor: document.getElementById('editorScreen'),
  };
  for (const k in screens) screens[k].hidden = k !== name;
  for (const id of ['townScreen', 'heroScreen']) {
    document.getElementById(id).hidden = true;
  }
}
