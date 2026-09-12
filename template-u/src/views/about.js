// ============================================================================
//  View — About & user guide (Phase 6, task 27 — in-app instructions)
// ============================================================================

import { h } from "../framework/dom.js";
import { PU } from "../framework/pu.js";
import { pageHeader, card, grid, badge, codeBlock } from "./helpers.js";

const SCREENS = [
  { id: "home", title: "Home", text: "A one-screen tour of the framework: what it contains, the active theme, and shortcuts into the other sections." },
  { id: "components", title: "Components", text: "Live examples of every shared UI component — buttons, form fields, toasts and badges. Use this page as the visual reference when building member generators." },
  { id: "data", title: "Data", text: "A working data table with sorting, searching and pagination over sample invoice records. Click a column header to sort, click a row for a detail toast." },
  { id: "settings", title: "Settings", text: "Switch theme and colour mode, rebrand the palette and naming, enable or disable optional components, and manage stored preferences." },
  { id: "tests", title: "Tests", text: "Runs the framework's validation suite in the browser and reports pass/fail with timings and error messages." },
  { id: "about", title: "About", text: "This page — what everything does and where the developer documentation lives." },
];

export function render(outlet, ctx) {
  const { app } = ctx;

  outlet.replaceChildren(
    pageHeader({
      title: "About & user guide",
      subtitle: `How to use ${PU.name} — the ${PU.family} base framework.`,
      icon: "book",
    }),

    grid(
      [
        card({
          title: "What this is",
          body: h(
            "div",
            { class: "pu-prose" },
            h("p", {}, `${PU.name} is the canonical shared template and identity framework for the ${PU.family} family of small-business generators. Every member generator (for example the IT documentation system) is created by cloning this template and changing only its configuration, content and views.`),
            h("p", {}, "It ships a responsive shell, a token-based theme engine with a light-navy default, an accessible component library, and small primitives for state, events, storage and routing — so member generators start consistent instead of starting from scratch.")
          ),
        }),
        card({
          title: "Getting around",
          body: h(
            "div",
            { class: "pu-prose" },
            h("ul", { class: "pu-list" }, [
              h("li", {}, "Use the sidebar (or the menu button on a phone) to move between sections."),
              h("li", {}, "Use the header search box to jump straight to a section by name."),
              h("li", {}, "The sun/moon button in the header switches between light and dark mode instantly."),
              h("li", {}, "Every section has a deep link — e.g. share the URL ending in #/settings."),
            ]),
            h(
              "div",
              { class: "pu-btn-row pu-btn-row--wrap" },
              h("button", { class: "pu-btn pu-btn--secondary pu-btn--sm", type: "button", onclick: () => app.navigate("settings") }, "Open Settings"),
              h("button", { class: "pu-btn pu-btn--ghost pu-btn--sm", type: "button", onclick: () => app.navigate("tests") }, "Open Tests")
            )
          ),
        }),
      ],
      { cols: 2 }
    ),

    card({
      title: "Sections",
      subtitle: "What each screen is for.",
      body: h(
        "div",
        { class: "pu-def-list" },
        SCREENS.map((screen) =>
          h(
            "div",
            { class: "pu-def-row" },
            h("div", { class: "pu-def-term" }, h("a", { href: app.router.href(screen.id), class: "pu-def-link" }, screen.title)),
            h("div", { class: "pu-def-desc" }, screen.text)
          )
        )
      ),
    }),

    grid(
      [
        card({
          title: "Changing the look",
          body: h(
            "ol",
            { class: "pu-steps" },
            [
              "Open Settings → Appearance and pick a palette. Navy is the Project U default and is a light-mode theme.",
              "Use “Switch to dark mode” (or the header button) for the Midnight dark palette.",
              "To rebrand, edit the colours, title, tagline and logo in Settings → Branding, then press Apply.",
              "Colour changes are applied as theme tokens, so they propagate everywhere automatically.",
            ].map((step, index) => h("li", {}, h("span", { class: "pu-step-num" }, String(index + 1)), h("span", {}, step)))
          ),
        }),
        card({
          title: "For developers",
          body: h(
            "div",
            { class: "pu-prose" },
            h("p", {}, "The framework API is exposed on window.PU (utilities, store, bus, storage, theme, router, registry, metadata and components). The documentation files live next to this template's source:"),
            codeBlock("src/README.md\nsrc/CUSTOMIZATION.md\nsrc/CLONE-GUIDE.md\nsrc/API.md"),
            h("div", { class: "pu-btn-row pu-btn-row--wrap" }, badge("window.PU", "info"), badge(`v${PU.version}`, "neutral"))
          ),
        }),
      ],
      { cols: 2 }
    )
  );
}
