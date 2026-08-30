# LCG Template — src/

Generic, forkable card-game engine + tabletop UI. Rename `gameTitle` in `main.pjs`, swap the card data in `src/data/`, and rebuild the setup/kingdom logic in `ui.js` for your own game.

## Files
- `engine.js` — pure, DOM-free game logic: zones (draw/hand/discard/play/trash), turn state machine (Start → Action → Buy → Cleanup), resources (Cards/Actions/Buys/Coins/Potions), attack framework, end-game scoring, deterministic seeded RNG, move log. Exposed as `Dominion.engine`.
- `cards.js` — card schema + catalog registry, loads `src/data/*.json`. Exposed as `Dominion.cards`.
- `ai.js` — AI opponents (Easy/Normal/Hard/Brutal) that play and buy. Exposed as `Dominion.ai`.
- `ui.js` — the DOM table: setup screen, supply, hand, log, modal choices, encyclopedia, rules, tutorial, autosave via kv-plugin. Exposed as `Dominion.ui`.
- `net.js` — online multiplayer interface stubs (not yet implemented; `createServerSocket` is imported in `main.pjs`).
- `tests.js` — deterministic rule-assertion suite (`DominionTest.runAll()`), run via `?tests=1` or `#tests`.
- `data/*.json` — example card sets. Replace with your own.
- `roadmap.pjs` — historical build log; not read at runtime.

## Cards data schema
```json
{ "id": "smithy", "name": "Blacksmith", "cost": {"coins": 4}, "types": ["Action"],
  "text": "+3 Cards", "expansion": "base-kingdom" }
```
Piles: supply setup by player count lives in `engine.js` (`setup`); per-card supply count can be overridden with a `"pile"` field. Dynamic VP/treasure effects are registered in `engine.js`'s effects table, keyed by card id.

## Naming conventions (de-branded, forkable)
- Card **display names are fully generic** (Bronze Coin, Homestead, Hexer, Marketplace, ...) — this template is a forkable LCG, not a Dominion clone.
- **`id`s are stable keys — never change them.** Engine effects (`engine.js` effects table), `ai.js`, `tests.js`, saves, and URL kingdom params all key off ids. Rename display `name`/`text` freely; ids stay.
- Resource renames: the potion resource is **Elixir** (cost badge `E`, `p.potions` field, `costPotion()` stays as code), and the curse is the **Bane** card (`"Curse"` remains only as the internal type string in `CARD_TYPES`/card data `types`).
- User-facing strings (UI, glossary, tutorial, AI text, tests) use the display names; grep for old names before touching a string.
- The rename id→name mapping is preserved at `scratch/card-rename-maps.json` in the ephemeral workspace (not shipped).

## Testing
- Open `?tests=1` (or `#tests`) to run the whole suite, or click any UI you like in the live preview.
- Deterministic: pass a `seed` to `Dominion.engine.setup({seed})`; identical seeds → identical games.

## Multiplayer
`main.pjs` imports `createServerSocket` and `net.js` documents the intended `Dominion.net` interface. Implementation is a future phase — see `src/roadmap.pjs`.
