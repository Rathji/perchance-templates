# Project U — `template-u`

The canonical shared **template and identity framework** for the Project U family
of small-business generators. Reference template: `it-u`.

A new member generator is created by cloning this template and changing only its
configuration, content and views — the identity, theme engine, component library
and framework plumbing are inherited unchanged.

---

## Purpose

`template-u` provides, once, the things every Project U generator needs:

- a responsive application shell (header, sidebar navigation, content frame) that
  works from a 390 px phone to a 1920 px desktop;
- a **token-based theme engine** with a **light-mode navy default** (`Navy`),
  a dark counterpart (`Midnight`) and three further palettes;
- a **branding layer** so member generators rebrand colours, naming and logos
  without touching CSS;
- an accessible **component library** (inputs, toasts, data table, badges, cards);
- small primitives for **state, events, persistence and routing**;
- a **component registry** so a member generator can enable/disable optional
  framework pieces;
- a **validation test suite** that runs in the browser.

## Architecture

```
main.pjs                     high-level config ($meta, the `pu` block, demo lists)
index.html                   static shell: header + sidebar + main + boot script
src/
  styles.css                 design tokens, base, layout, components, utilities
  app.js                     boot: config → storage → branding → theme → registry → router
  framework/
    pu.js                    the window.PU API namespace
    utils.js                 shared utility library
    dom.js                   element builders + icon set
    bus.js                   event bus
    store.js                 observable state store
    storage.js               namespaced persistence (localStorage + memory fallback)
    theme.js                 tokens, palettes, theme controller, boot script
    branding.js              branding config → theme tokens (colour math)
    router.js                hash router
    registry.js              component library registry
    meta.js                  template metadata + dependency tracking
  components/
    inputs.js                text / textarea / select / toggle / checkbox / radio / button
    toast.js                 global notification system
    datatable.js             responsive sortable table
  views/                     home · components · data · settings · tests · about (+ helpers)
  tests/                     harness + suites + registry
  README.md  CUSTOMIZATION.md  CLONE-GUIDE.md  API.md
```

Boot order matters: `app.js` reads config from `main.pjs` (`root.pu`), builds a
namespaced `storage`, then `branding`, then `theme` (which applies the saved
palette **before** navigation renders), then the `registry` (which seeds the
router routes), then the toaster and router.

## Conventions

| Concern | Convention |
| --- | --- |
| CSS prefix | `pu-` (tokens `--pu-*`) |
| Storage keys | `<storageNamespace>:*` (default `pu-template:*`) |
| Default theme | `navy` — a **light-mode** palette |
| Theme tokens | semantic (`--pu-bg`, `--pu-primary`, `--pu-danger-soft`, …) |
| IDs | suffix by type: `…Btn`, `…El`, `…Ctn`, `…Input`, `…Select` |
| Views | `export function render(outlet, ctx)`; `ctx.app` is the runtime |
| Config | edit the `pu` block in `main.pjs` (never hard-code in views) |

## Theming

Colours are **semantic tokens**, never raw hex in components. `theme.resolveTheme(id)`
merges a mode base palette (`LIGHT_BASE` / `DARK_BASE`) with the named theme's
overrides and any branding token overrides. `theme.js` also exposes `bootScript()`
— the inline script mirrored in `index.html` that paints the saved theme before
first render (no flash of the wrong theme).

**Light mode is the default and `navy` is the default palette.** Darks are one
toggle (or the header button) away and are remembered.

## Testing

Open the **Tests** section (or run from the console):

```js
await window.PU.tests.runAll(); // → { ok, passed, failed, total, suites }
```

Suites cover utilities, framework logic (bus/store/storage/router/registry/meta),
theming + branding, and the UI components. Keep them green when changing the
framework.

## Build notes

- No build step: plain ES modules served from `src/`. Add npm/CDN imports only
  when justified (prefer `esm.sh`).
- The only import in `main.pjs` is the optional `kv-plugin` (persistence
  adapter). Remove it if a member generator does not persist.
- Build checklists/roadmaps are intentionally **not** shipped: keep `src/`
  limited to framework code and real documentation.

## Related documents

- **CUSTOMIZATION.md** — the exact points to change when rebranding.
- **CLONE-GUIDE.md** — step-by-step: spin up a new member generator.
- **API.md** — developer reference for the framework modules.
