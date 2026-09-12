// ============================================================================
//  View — Settings (appearance · branding · components · storage · metadata)
// ============================================================================

import { h } from "../framework/dom.js";
import { PU } from "../framework/pu.js";
import { pageHeader, card, grid, badge, demoRow } from "./helpers.js";
import { textField } from "../components/inputs.js";
import { dependencyReport } from "../framework/meta.js";
import { formatBytes } from "../framework/utils.js";

function colorField({ name, label, hint, value }) {
  const swatch = h("input", {
    type: "color",
    class: "pu-color-input",
    value: /^#[0-9a-f]{6}$/i.test(value) ? value : "#1e3a8a",
    "aria-label": `${label} colour picker`,
    tabindex: "-1",
  });
  const field = textField({ name, label, hint, value, placeholder: "#1e3a8a", prefix: swatch });
  swatch.addEventListener("input", () => {
    field.input.value = swatch.value;
  });
  field.input.addEventListener("input", () => {
    if (/^#[0-9a-f]{6}$/i.test(field.input.value.trim())) swatch.value = field.input.value.trim();
  });
  field.swatch = swatch;
  return field;
}

export function render(outlet, ctx) {
  const { app } = ctx;
  const { theme, branding, registry, storage, toaster, config } = app;

  // ------------------------------------------------------------------ theme --
  const themeCards = new Map();
  const modeBtn = h("button", {
    class: "pu-btn pu-btn--secondary pu-btn--sm",
    type: "button",
    onclick: () => {
      theme.toggleMode();
      syncThemeState();
      toaster.success(`${theme.get().label} theme applied.`, { duration: 2000 });
    },
  });

  function syncThemeState() {
    const active = theme.get();
    for (const [id, el] of themeCards) {
      const isActive = id === active.themeId;
      el.classList.toggle("is-active", isActive);
      el.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
    modeBtn.textContent = `Switch to ${active.mode === "dark" ? "light" : "dark"} mode`;
  }

  const themeGrid = h(
    "div",
    { class: "pu-theme-grid" },
    theme.list().map((item) => {
      const el = h(
        "button",
        {
          class: "pu-theme-card",
          type: "button",
          onclick: () => {
            theme.set(item.id);
            syncThemeState();
            toaster.success(`${item.label} theme applied.`, { duration: 2000 });
          },
        },
        h("span", { class: "pu-theme-swatches" }, item.swatch.map((color) => h("span", { class: "pu-theme-swatch", style: { background: color } }))),
        h("span", { class: "pu-theme-meta" }, h("span", { class: "pu-theme-name" }, item.label), badge(item.mode, item.mode === "dark" ? "neutral" : "info")),
        h("span", { class: "pu-theme-desc" }, item.description),
        item.id === "navy" ? h("span", { class: "pu-theme-default" }, "Default") : null
      );
      themeCards.set(item.id, el);
      return el;
    })
  );

  const appearance = card({
    title: "Appearance",
    subtitle: "Theme and colour mode. Light mode is the default; the light navy palette (“Navy”) ships as the Project U default.",
    actions: modeBtn,
    body: themeGrid,
  });

  // --------------------------------------------------------------- branding --
  const brandFields = {
    appTitle: textField({ name: "appTitle", label: "Application title" }),
    tagline: textField({ name: "tagline", label: "Tagline" }),
    logoMark: textField({ name: "logoMark", label: "Logo mark", hint: "1–3 characters, or a logo image URL below.", maxlength: 3 }),
    fontSans: textField({ name: "fontSans", label: "Interface font", hint: "Load the font via a <link> in index.html." }),
    primary: colorField({ name: "primary", label: "Primary colour", hint: "Brand colour, applied to both modes." }),
    accent: colorField({ name: "accent", label: "Accent colour", hint: "Secondary highlight colour." }),
    footer: textField({ name: "footer", label: "Sidebar footer" }),
  };

  function fillBrandingForm(data) {
    for (const [key, field] of Object.entries(brandFields)) {
      if (data[key] != null) field.input.value = data[key];
      if (field.swatch && /^#[0-9a-f]{6}$/i.test(field.input.value.trim())) field.swatch.value = field.input.value.trim();
    }
  }

  function readBrandingForm() {
    const patch = {};
    for (const [key, field] of Object.entries(brandFields)) patch[key] = field.value;
    return patch;
  }

  const applyBranding = () => {
    const patch = readBrandingForm();
    branding.update(patch);
    theme.apply();
    fillBrandingForm(branding.get());
    toaster.success("Branding applied.");
  };

  const resetBranding = () => {
    branding.update({
      appTitle: config.appTitle,
      appShortTitle: config.appShortTitle,
      tagline: config.tagline,
      logoMark: config.logoMark,
      companyName: config.companyName,
      footer: config.copyright || config.companyName,
      primary: config.branding?.primary || "#1e3a8a",
      accent: config.branding?.accent || "#0d9488",
      fontSans: config.branding?.fontSans || "Inter",
      logoUrl: "",
    });
    theme.apply();
    fillBrandingForm(branding.get());
    toaster.info("Branding reset to the Project U defaults.");
  };

  const brandingCard = card({
    title: "Branding",
    subtitle: "Member generators override colours, naming and logo here — no CSS edits needed.",
    actions: h(
      "div",
      { class: "pu-btn-row" },
      h("button", { class: "pu-btn pu-btn--ghost pu-btn--sm", type: "button", onclick: resetBranding }, "Reset"),
      h("button", { class: "pu-btn pu-btn--primary pu-btn--sm", type: "button", onclick: applyBranding }, "Apply branding")
    ),
    body: h(
      "div",
      { class: "pu-form-grid" },
      brandFields.appTitle.el,
      brandFields.tagline.el,
      brandFields.logoMark.el,
      brandFields.fontSans.el,
      brandFields.primary.el,
      brandFields.accent.el,
      h("div", { class: "pu-form-span" }, brandFields.footer.el),
      h(
        "div",
        { class: "pu-brand-preview pu-form-span" },
        h("span", { class: "pu-brand-preview-label" }, "Live preview"),
        h(
          "div",
          { class: "pu-brand-bar" },
          h("span", { class: "pu-brand-dot" }),
          h("span", { class: "pu-brand-pill" }, "Primary"),
          h("span", { class: "pu-brand-pill pu-brand-pill--accent" }, "Accent")
        ),
        h("p", { class: "pu-muted" }, "The preview above uses the current theme tokens. Press Apply to commit colour changes to the whole app.")
      )
    ),
  });

  // ----------------------------------------------------------------- registry --
  const registryCard = card({
    title: "Component registry",
    subtitle: "Enable or disable optional components per member generator. Disabled components are hidden from navigation and routing.",
    body: h(
      "div",
      { class: "pu-reg-list" },
      registry.list().map((component) =>
        h(
          "div",
          { class: "pu-reg-row" },
          h("div", { class: "pu-reg-text" }, h("span", { class: "pu-reg-name" }, component.label), h("span", { class: "pu-reg-desc" }, component.description || "")),
          component.optional
            ? h(
                "label",
                { class: "pu-reg-toggle" },
                h("input", {
                  type: "checkbox",
                  checked: registry.isEnabled(component.id) || undefined,
                  onchange: (event) => {
                    registry.setEnabled(component.id, event.target.checked);
                    app.renderNav();
                    toaster.info(`${component.label} ${event.target.checked ? "enabled" : "disabled"}.`);
                  },
                }),
                h("span", { class: "pu-toggle-track pu-toggle-track--sm" }, h("span", { class: "pu-toggle-thumb" }))
              )
            : badge("Required", "neutral")
        )
      )
    ),
  });

  // ------------------------------------------------------------------ storage --
  const keys = storage.keys();
  const storageCard = card({
    title: "Persistence",
    subtitle: `Namespaced ${storage.namespace}:* — stored via ${storage.isPersistent ? "localStorage" : "an in-memory fallback"}.`,
    body: h(
      "div",
      { class: "pu-stack-2" },
      demoRow({
        label: "Stored keys",
        control: h("div", { class: "pu-btn-row pu-btn-row--wrap" }, keys.length ? keys.map((k) => badge(k, "neutral")) : badge("none yet", "neutral")),
      }),
      demoRow({
        label: "Export settings",
        hint: "Download theme, registry and branding as JSON.",
        control: h("button", { class: "pu-btn pu-btn--secondary pu-btn--sm", type: "button", onclick: () => exportSettings(app) }, "Download JSON"),
      }),
      demoRow({
        label: "Reset preferences",
        hint: "Restores the default theme and re-enables every component.",
        control: h(
          "button",
          {
            class: "pu-btn pu-btn--danger pu-btn--sm",
            type: "button",
            onclick: () => {
              theme.reset();
              registry.reset();
              storage.clear();
              toaster.warning("Preferences cleared — reloading…", { duration: 1600 });
              setTimeout(() => location.reload(), 900);
            },
          },
          "Clear & reload"
        ),
      })
    ),
  });

  // ----------------------------------------------------------------- metadata --
  const deps = dependencyReport(globalThis.root || {});
  const metaCard = card({
    title: "Template metadata",
    subtitle: "Version and dependency tracking for the Project U family.",
    body: h(
      "div",
      { class: "pu-stack-2" },
      demoRow({ label: "Template", control: h("div", { class: "pu-btn-row" }, badge(PU.name, "info"), badge(`v${PU.version}`, "neutral")) }),
      demoRow({ label: "Family", control: badge(PU.family, "neutral") }),
      demoRow({
        label: "Plugins",
        control: h(
          "div",
          { class: "pu-btn-row pu-btn-row--wrap" },
          deps.map((dep) => badge(`${dep.name}${dep.required ? "" : " (optional)"}`, dep.present ? "success" : "neutral", { icon: dep.present ? "check" : "info" }))
        ),
      }),
      demoRow({ label: "Docs", control: h("span", { class: "pu-muted" }, "src/README.md · CUSTOMIZATION.md · CLONE-GUIDE.md · API.md") })
    ),
  });

  outlet.replaceChildren(
    pageHeader({ title: "Settings", subtitle: "Appearance, branding, components, persistence and metadata.", icon: "settings" }),
    appearance,
    brandingCard,
    grid([registryCard, storageCard], { cols: 2 }),
    metaCard
  );

  fillBrandingForm(branding.get());
  syncThemeState();
}

function exportSettings(app) {
  const payload = {
    template: PU.name,
    version: PU.version,
    exportedAt: new Date().toISOString(),
    theme: app.storage.get("theme:v1", null),
    registry: app.storage.get("registry:v1", null),
    branding: app.branding.get(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = h("a", { href: url, download: `${PU.name}-settings.json` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  app.toaster.success(`Exported ${formatBytes(blob.size)} of settings.`);
}
