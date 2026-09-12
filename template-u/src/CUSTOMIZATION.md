# Customization Guide

Everything a member generator changes lives in **four** places. Framework code in
`src/framework/` should not need editing — if it does, prefer asking the template
maintainer to upstream the change so the whole family benefits.

---

## 1. `main.pjs` — the `pu` config block

This is the primary surface. Edit values; never hard-code them in views.

| Key | Meaning |
| --- | --- |
| `appTitle` | Application / document title. |
| `appShortTitle` | Fallback logo mark. |
| `tagline` | Shown under the title and in metadata. |
| `companyName` | Owning company / organisation. |
| `version` | Member generator version (shown in the header badge). |
| `storageNamespace` | Prefix for all `localStorage` keys. **Change this on clone.** |
| `defaultTheme` | One of `navy`, `sky`, `sand`, `midnight`, `slate`. |
| `logoMark` | 1–3 character logo. |
| `copyright` | Footer text. |
| `branding.primary` | Brand colour (hex) → `--pu-primary` + derived tokens. |
| `branding.accent` | Accent colour (hex) → `--pu-accent` + derived tokens. |
| `branding.fontSans` | Interface font family name. |

### Rebranding example

```pjs
pu
  appTitle = Acme Tools
  tagline = Manage your service business
  storageNamespace = acme-tools
  branding
    primary = #0f766e
    accent = #b45309
    fontSans = Inter
```

Colours are converted to semantic tokens by `src/framework/branding.js`
(`--pu-primary`, `--pu-primary-hover/active/contrast/soft`, `--pu-ring`,
`--pu-accent`, `--pu-accent-soft`) so every component follows automatically.

## 2. `index.html` — the shell

Only change this to adjust the **static frame**:

- the theme boot script's storage key (must match `storageNamespace:theme:v1`);
- header contents (add account/help buttons);
- the font `<link>` when changing `fontSans`;
- `$meta.image` and other metadata live in `main.pjs`, not here.

Do **not** add application logic here — put it in `src/`.

## 3. `src/views/` — your screens

Each view exports `render(outlet, ctx)`. Register a new section in `src/app.js`:

```js
import * as invoicesView from "./views/invoices.js";
registerView("invoices", {
  label: "Invoices",
  icon: "table",              // any key from src/framework/dom.js ICONS
  group: "Framework",
  order: 40,
  optional: true,             // user-toggleable in Settings → Component registry
  description: "Create and send invoices.",
}, invoicesView);
```

- `optional: true` adds a toggle in Settings; `false`/omitted = required.
- `group` orders navigation: `Framework`, `Manage`, `Resources`, then custom.
- Routes are derived from the registry, so you never edit the router config.

## 4. `src/tests/` — your tests

Add a suite, export it from `src/tests/index.js`, and it runs with the rest.

```js
export function invoicesSuite() {
  return createSuite("invoices").test("totals line items", () => {
    assertEqual(total([{ amount: 2 }, { amount: 3 }]), 5);
  });
}
```

---

## Where NOT to change things

| Don't | Why |
| --- | --- |
| Edit `src/framework/*` per-generator | Divergence breaks the shared-family guarantee. Upstream it instead. |
| Put hex colours in components | Use `var(--pu-*)` tokens so themes/branding apply. |
| Read `localStorage` directly | Use `app.storage` (`createStorage`) for namespacing + fallbacks. |
| Duplicate input/table/toast markup | Use `PU.components.*`. |
| Hard-code the generator name/URL | Use `window.generatorName` for share links. |

## Sharing a view's state across components

```js
const store = PU.createStore({ query: "", rows: [] });
store.selectSubscribe((s) => s.query, (q) => table.setQuery(q));
bus.on("invoice:created", () => store.patch({ rows: [...], }));
```

See `src/API.md` for the full reference.
