# perchance-templates

Template generators for [perchance.org](https://perchance.org), moved here from `generators`
(formerly `rathjis-generators`).

**15 directories, under two naming conventions.** The 9 moved here on 2026-08-11 use the original
capture naming, `lists.txt` + `html.txt`. The 6 captured on 2026-08-14 use perchance's own export
convention, `main.pjs` + `index.html`, which is what `fleet-backup.mjs` writes and what GitHub
renders and syntax-highlights; 5 of them also carry a `src/` directory of `srcManifest` files. That
is the same deliberate split `generators` has — new naming going forward, no migration of the old
directories — and not drift. See `SYNC-PROCESS.md` in
[generators](https://github.com/Rathji/generators) and **T-15** in `perchance-manager`.

The 6 added on 2026-08-14 (`rathji-plugin-template`, `vgn-turn-based-jrpg-template`,
`vgn-text-rpg-template`, `vgn-2d-physics-template`, `vgn-generic-template`,
`bgn-reference-template`) had no captured copy anywhere until that date. They are sorted here rather
than into `generators` by the split's rule: the name contains "template".

## ⚠ `top-down-rpg-template/` is the only copy that exists

The live generator is **gone from perchance** — `GET /api/getGeneratorHtml?generatorName=
top-down-rpg-template` returned **404** on 2026-08-14, while all 61 other slugs in the fleet
roster returned 200. The capture in this repo is therefore no longer a backup of anything; it is
the original and only record.

**Do not delete that directory, and do not include the slug in a capture scope** — a fetch against
it will fail, and `fleet-backup.mjs` handles a failed slug badly enough to be worth avoiding (see
`M-4` in `perchance-manager/docs/open-threads.md`). Nothing regenerates this one.

### …and that only copy is incomplete

Discovered 2026-08-14, by checking every file declared in a `srcManifest` against the file on disk.
`top-down-rpg-template/meta.json` declares **7 `src/` files that are not here** and never were:

    data.js  maps.js  render.js  game.js  battle.js  ui.js  main.js

They were missed because the directory was captured 2026-08-10, before `perchance-fetch.mjs` had
`--src` to download `srcManifest` entries at all. The same gap affected 32 directories across this
repo and `generators`; 79 of the 86 missing files were backfilled on 2026-08-14 from live
perchance. **These 7 could not be, because the generator is 404.** There is no source left to fetch
them from.

So what survives here is the generator's two panels and its `meta.json` — a manifest listing seven
files that no longer exist anywhere. That is a permanent, partial loss, recorded rather than
quietly left to be rediscovered. It is also the sharpest available argument for capturing a
generator *before* you need the backup.

The roster and the fleet accounting live in
[perchance-manager](https://github.com/Rathji/perchance-manager) — `fleet-roster.txt` for the slug
list and where each slug's copy lives, `docs/open-threads.md` for open work.
