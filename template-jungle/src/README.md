# Template Jungle

A hub/directory that houses all of Rathji's Perchance templates — board games (bgn), video games (vgn), apps, art tools, and frameworks. Built on the look and structure of the `business-template` landing page.

## Architecture

- `main.pjs` — the `config` list is the single source of truth: branding, theme, colors, hero, categories, templates (name, title, category, description, views, icon, tag), how-it-works, FAQ, footer. **Edit this to add/remove templates.**
- `index.html` — static page skeleton (no content hardcoded; JS fills everything).
- `src/template.js` — render engine: reads `root.config` and builds every section (hero, stats, category grids, popular, steps, FAQ, footer), plus theme toggle, progress bar, mobile menu, reveal animations.
- `src/template.css` — the whole visual theme. Light palette is driven by config `colors` (injected as CSS vars); `[data-theme="dark"]` is a full dark override.

## How to add a template

In `config.templates` in main.pjs, copy any `t#` block, renumber it, and set:

- `name` — the perchance slug (also the URL: `perchance.org/<name>`)
- `title`, `description` — display text
- `category` — must match a `categories` `id` (apps | board-games | video-games | art-content | frameworks)
- `views` — snapshot view count (stats + "most popular" are computed automatically)
- `icon` — emoji shown on the card
- `tag` — optional: `Featured`, `Private`, `New` (empty to hide)

Stats band, hero status, and the "Most forked" section are all computed from the templates list — no manual totals.

## Notes

- View counts are static snapshots (editable in config).
- The default theme is dark ("jungle"); the toggle is persisted in localStorage.
- Theme mode/colors/font size/radius can all be set in `config.theme` / `config.colors`.

## Ask AI widget

There's a floating "Ask AI" chat button (bottom-right) that answers visitor
questions **only** from the `KNOWLEDGE` string in the script at the bottom of
index.html. It describes the hub + every template, so it doubles as a template
recommender ("I want to make a board game — where do I start?").

To reuse the widget in another template, lift three pieces:
1. the `{import:ai-text-plugin}` line at the top of main.pjs,
2. the `.ask-ai-btn` / `.ask-ai-shell` markup + the `<script>` block (with your
   own `KNOWLEDGE`/`SUGGESTIONS`) at the bottom of index.html,
3. the `.ask-ai-*` CSS block at the end of src/template.css
   (set `--ask-accent` / `--ask-accent-2` to match the target theme).

Accent colors: `--ask-accent: #10b981`, `--ask-accent-2: #34d399` in the CSS.

