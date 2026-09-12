# Clone / Instantiate Guide

How to spin up a new member generator from `template-u`.

---

## Option A — fork in the Perchance editor (recommended)

1. Open `https://perchance.org/template-u`.
2. Click **save** (fork). The platform creates a randomly-named copy you own.
3. Open **Settings → rename** and give it its final name (e.g. `acme-invoices`).
   - Rename **before** storing data: the name changes the iframe origin, so
     existing `localStorage` / `kv-plugin` data is not carried over.
4. Go through the customization checklist below.

## Option B — copy the source

1. Download both `main.pjs` and `index.html` for `template-u`.
2. Create a new generator and paste them in.
3. Recreate the `src/` tree (files panel → upload the `src/` folder).

---

## Customization checklist

- [ ] **`main.pjs` → `$meta.title` / `$meta.description` / `$meta.tags`** — describe
      the *new* generator, not the template.
- [ ] **`main.pjs` → `$meta.image`** — a representative thumbnail URL.
- [ ] **`main.pjs` → `pu.appTitle`, `tagline`, `companyName`, `version`.**
- [ ] **`main.pjs` → `pu.storageNamespace`** — change it (e.g. `acme-invoices`).
- [ ] **`index.html` boot script** — update the storage key to
      `<storageNamespace>:theme:v1`.
- [ ] **`main.pjs` → `pu.defaultTheme`** — keep `navy` unless the brand requires
      otherwise.
- [ ] **`main.pjs` → `pu.branding.primary` / `accent` / `fontSans`.**
- [ ] **`index.html`** — swap the Google Fonts `<link>` if `fontSans` changed.
- [ ] **`src/app.js`** — replace the demo `registerView(...)` calls with your own
      sections (keep `home`, `settings`, `about`; drop `components`, `data`,
      `tests` if not wanted).
- [ ] **`src/views/`** — replace the demo views with your screens.
- [ ] **`src/tests/`** — replace demo suites with tests for your logic.
- [ ] **Remove `kv-plugin`** from `main.pjs` if you do not persist anything.
- [ ] **`src/README.md`** — rewrite the purpose section for the new generator.
- [ ] Run **Tests** and confirm green; check phone + desktop widths.

---

## Keeping the family consistent

- Keep the `pu-` CSS prefix and `--pu-*` tokens.
- Keep the shell structure (header/sidebar/main) so users feel at home.
- Keep the light-navy default theme unless there is a brand reason not to.
- Contribute generic improvements back to `template-u` rather than forking the
  framework code, so every member generator benefits.

## Naming

- Generator slug: lowercase, hyphenated, no spaces (`acme-invoices`).
- Display title: the `pu.appTitle` value.
- Keep `storageNamespace` stable once users have data; renaming the generator or
  the namespace orphans saved data.
