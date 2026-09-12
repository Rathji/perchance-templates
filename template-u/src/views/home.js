// ============================================================================
//  View — Home / overview
// ============================================================================

import { h } from "../framework/dom.js";
import { PU } from "../framework/pu.js";
import { pageHeader, card, statTile, grid, badge, banner } from "./helpers.js";

export function render(outlet, ctx) {
  const { app } = ctx;
  const { branding, theme, registry, storage, config } = app;
  const name = branding.get().appTitle;
  const enabled = registry.list({ enabledOnly: true });

  const features = [
    { id: "layout", icon: "layout", title: "Responsive shell", text: "Header, sidebar navigation and content frame that work from phone to desktop.", route: "components" },
    { id: "theme", icon: "palette", title: "Theme engine", text: "Five named palettes driven by semantic tokens, with a light-navy default and no flash of wrong theme.", route: "settings" },
    { id: "inputs", icon: "sliders", title: "Input suite", text: "Accessible text, select, toggle, checkbox and radio controls with error + hint states.", route: "components" },
    { id: "table", icon: "table", title: "Data table", text: "Sortable, searchable, paginated tables that reflow into cards on small screens.", route: "data" },
    { id: "state", icon: "box", title: "State & events", text: "A tiny observable store and a decoupled event bus shared by every component.", route: "settings" },
    { id: "registry", icon: "check", title: "Component registry", text: "Enable or disable whole components per member generator without deleting code.", route: "settings" },
  ];

  const quickStart = [
    "Skim each section from the sidebar — every screen documents itself.",
    "Open Settings to switch themes, rebrand the palette, and toggle optional components.",
    "Run the validation suite from the Tests section to confirm the framework is healthy.",
    "Read src/CUSTOMIZATION.md to learn the exact points to change in a member generator.",
  ];

  outlet.replaceChildren(
    pageHeader({
      title: name,
      subtitle: branding.get().tagline,
      icon: "home",
      actions: [
        h("button", { class: "pu-btn pu-btn--primary", type: "button", onclick: () => app.navigate("settings") }, "Customise"),
        h("button", { class: "pu-btn pu-btn--ghost", type: "button", onclick: () => app.navigate("tests") }, "Run tests"),
      ],
    }),

    banner({
      tone: "info",
      title: `${PU.family} — ${PU.name}`,
      children: `${config.tagline || ""} This template is the shared identity, theme and component foundation that every Project U generator clones.`,
    }),

    grid(
      [
        statTile({ label: "Template version", value: `v${branding.get().version || config.version || PU.version}`, icon: "sparkle", hint: "src/framework/meta.js" }),
        statTile({ label: "Active theme", value: theme.get().label, icon: "palette", hint: `${theme.get().mode} mode` }),
        statTile({ label: "Components enabled", value: `${enabled.length}/${registry.list().length}`, icon: "check", hint: "toggle in Settings" }),
        statTile({ label: "Persistence", value: storage.isPersistent ? "localStorage" : "memory", icon: "box", hint: storage.namespace, tone: storage.isPersistent ? "success" : "warning" }),
      ],
      { cols: 4 }
    ),

    card({
      title: "Framework at a glance",
      subtitle: "The pieces a member generator inherits.",
      body: h(
        "div",
        { class: "pu-grid pu-grid--3 pu-gap-md" },
        features.map((feature) =>
          h(
            "button",
            { class: "pu-feature", type: "button", onclick: () => app.navigate(feature.route) },
            h("span", { class: "pu-feature-head" }, h("span", { class: `pu-feature-icon pu-tone-${feature.icon}` }, ""), h("span", { class: "pu-feature-title" }, feature.title)),
            h("span", { class: "pu-feature-text" }, feature.text),
            h("span", { class: "pu-feature-link" }, `Open ${feature.route} →`)
          )
        )
      ),
    }),

    grid(
      [
        card({
          title: "Quick start",
          subtitle: "Four steps to a working member generator.",
          body: h(
            "ol",
            { class: "pu-steps" },
            quickStart.map((step, index) => h("li", {}, h("span", { class: "pu-step-num" }, String(index + 1)), h("span", {}, step)))
          ),
        }),
        card({
          title: "Conventions",
          subtitle: "What stays consistent across Project U.",
          body: h(
            "ul",
            { class: "pu-list" },
            [
              ["CSS prefix", "pu-"],
              ["Storage keys", `${storage.namespace}:*`],
              ["Theme tokens", "--pu-*"],
              ["Default theme", "navy (light mode)"],
              ["Docs", "src/README.md"],
            ].map(([label, value]) => h("li", { class: "pu-list-row" }, h("span", { class: "pu-list-label" }, label), badge(value, "neutral")))
          ),
        }),
      ],
      { cols: 2 }
    )
  );
}
