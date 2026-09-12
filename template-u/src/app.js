// ============================================================================
//  Project U — application bootstrap
//  Wires the framework together and paints the shell: config → storage →
//  branding → theme → registry → toaster → router. Member generators normally
//  never edit this file — see src/CUSTOMIZATION.md.
// ============================================================================

import { PU } from "./framework/pu.js";
import { createStorage } from "./framework/storage.js";
import { createBranding } from "./framework/branding.js";
import { createTheme } from "./framework/theme.js";
import { createRegistry } from "./framework/registry.js";
import { createRouter } from "./framework/router.js";
import { createToaster } from "./components/toast.js";
import { h, mount, svgIcon, clear } from "./framework/dom.js";
import { runAll as runAllTests } from "./tests/index.js";
import * as homeView from "./views/home.js";
import * as componentsView from "./views/components.js";
import * as dataView from "./views/data.js";
import * as settingsView from "./views/settings.js";
import * as testsView from "./views/tests.js";
import * as aboutView from "./views/about.js";

const GROUP_ORDER = ["Framework", "Manage", "Resources", "General"];

function readNodeValue(value) {
  if (value == null) return undefined;
  if (typeof value === "object") {
    try {
      const evaluated = typeof value.evaluateItem === "boolean" || typeof value.evaluateItem === "number" || typeof value.evaluateItem === "string" ? value.evaluateItem : undefined;
      if (evaluated !== undefined && evaluated !== "") return String(evaluated);
      return undefined;
    } catch (_) {
      return undefined;
    }
  }
  const str = String(value).trim();
  return str || undefined;
}

function readConfig() {
  const fallback = {
    appTitle: "Template-U",
    appShortTitle: "TU",
    tagline: "The Project U shared framework",
    companyName: "Project U",
    version: PU.version,
    storageNamespace: "pu-template",
    defaultTheme: "navy",
    logoMark: "TU",
    copyright: "Project U",
    branding: { primary: "#1e3a8a", accent: "#0d9488", fontSans: "Inter" },
  };
  const root = globalThis.root;
  if (!root || !root.pu) return fallback;
  const node = root.pu;
  const config = { ...fallback, branding: { ...fallback.branding } };
  for (const key of Object.keys(config)) {
    if (key === "branding") continue;
    const value = readNodeValue(node[key]);
    if (value !== undefined) config[key] = value;
  }
  if (node.branding) {
    for (const key of ["primary", "accent", "fontSans", "logoUrl", "footer"]) {
      const value = readNodeValue(node.branding[key]);
      if (value !== undefined) config.branding[key] = value;
    }
  }
  return config;
}

const config = readConfig();

const storage = createStorage({ namespace: config.storageNamespace || "pu-template" });
const branding = createBranding({}, { config });
const theme = createTheme({
  storage,
  defaultTheme: config.defaultTheme || "navy",
  extraTokens: () => branding.tokens(),
});
const toaster = createToaster({ container: document.getElementById("puToastCtn") });

const app = {
  config,
  storage,
  branding,
  theme,
  toaster,
  registry: null,
  router: null,
  views: {},
  navigate: (path) => router.navigate(path),
  meta: PU.meta,
};

// ------------------------------------------------------------------ registry --
const registry = createRegistry({ storage, onChange: () => onRegistryChange() });
app.registry = registry;

function registerView(id, meta, module) {
  registry.register({
    ...meta,
    id,
    render: (outlet, ctx) => module.render(outlet, { ...ctx, app }),
  });
  app.views[id] = module;
}

registerView("home", { label: "Home", icon: "home", group: "Framework", order: 10, defaultEnabled: true }, homeView);
registerView("components", { label: "Components", icon: "layout", group: "Framework", order: 20, defaultEnabled: true }, componentsView);
registerView("data", { label: "Data", icon: "table", group: "Framework", order: 30, optional: true, defaultEnabled: true, description: "Sample business data table with sorting, search and pagination." }, dataView);
registerView("settings", { label: "Settings", icon: "settings", group: "Manage", order: 10, defaultEnabled: true }, settingsView);
registerView("tests", { label: "Tests", icon: "check", group: "Resources", order: 20, optional: true, defaultEnabled: true, description: "Run the in-browser validation suite." }, testsView);
registerView("about", { label: "About", icon: "book", group: "Resources", order: 30, defaultEnabled: true }, aboutView);

// ------------------------------------------------------------------- router --
const router = createRouter({
  routes: registry.enabledRoutes(),
  defaultRoute: "home",
  notFound: {
    path: "not-found",
    render: (outlet) => {
      mount(
        outlet,
        h(
          "div",
          { class: "pu-page" },
          h("h1", { class: "pu-page-title" }, "Section not found"),
          h("p", { class: "pu-page-subtitle" }, "That section does not exist — it may have been disabled, or the link is wrong."),
          h("a", { class: "pu-btn pu-btn--primary", href: "#/home" }, "Back to Home")
        )
      );
    },
  },
});
app.router = router;

function onRegistryChange() {
  router.setRoutes(registry.enabledRoutes());
  renderNav();
  const currentPath = router.current && router.current.path;
  if (currentPath && registry.get(currentPath) && !registry.isEnabled(currentPath)) router.navigate("home");
}

// --------------------------------------------------------------------- shell --
const menuBtn = document.getElementById("menuBtn");
const backdrop = document.getElementById("puBackdrop");
const sidebar = document.getElementById("puSidebar");
const navCtn = document.getElementById("puNav");
const themeBtn = document.getElementById("puThemeBtn");
const settingsBtn = document.getElementById("puSettingsBtn");
const logo = document.getElementById("puLogo");
const searchInput = document.getElementById("quickNavInput");
const searchResults = document.getElementById("quickNavResults");

function renderNav() {
  clear(navCtn);
  const items = registry.list({ enabledOnly: true });
  const groups = new Map();
  for (const item of items) {
    const group = item.group || "General";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => (GROUP_ORDER.indexOf(a[0]) + 1 || 99) - (GROUP_ORDER.indexOf(b[0]) + 1 || 99)
  );
  const current = router.current?.path;
  for (const [group, groupItems] of ordered) {
    const groupEl = h("div", { class: "pu-nav-group" }, h("div", { class: "pu-nav-label" }, group));
    for (const item of groupItems) {
      groupEl.appendChild(
        h(
          "a",
          {
            class: `pu-nav-link${item.id === current ? " is-active" : ""}`,
            href: router.href(item.id),
            dataset: { nav: item.id },
            onclick: () => closeSidebar(),
          },
          svgIcon(item.icon, { size: 17 }),
          h("span", {}, item.label)
        )
      );
    }
    navCtn.appendChild(groupEl);
  }
}
app.renderNav = renderNav;

function openSidebar() {
  sidebar?.classList.add("is-open");
  if (backdrop) backdrop.hidden = false;
  menuBtn?.setAttribute("aria-expanded", "true");
  document.body.classList.add("pu-nav-open");
}
function closeSidebar() {
  sidebar?.classList.remove("is-open");
  if (backdrop) backdrop.hidden = true;
  menuBtn?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("pu-nav-open");
}
function toggleSidebar() {
  if (sidebar?.classList.contains("is-open")) closeSidebar();
  else openSidebar();
}

menuBtn?.addEventListener("click", toggleSidebar);
backdrop?.addEventListener("click", closeSidebar);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
    hideSearchResults();
  }
  if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    searchInput?.focus();
  }
});

// ---------------------------------------------------------------- theme button --
function syncThemeButton() {
  if (!themeBtn) return;
  const mode = theme.get().mode;
  clear(themeBtn);
  themeBtn.appendChild(svgIcon(mode === "dark" ? "sun" : "moon", { size: 18 }));
  themeBtn.setAttribute("aria-label", mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
  themeBtn.title = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";
}
themeBtn?.addEventListener("click", () => {
  theme.toggleMode();
  toaster.info(`${theme.get().label} theme applied.`, { duration: 1800 });
});
theme.subscribe(syncThemeButton);
settingsBtn?.addEventListener("click", () => router.navigate("settings"));
logo?.addEventListener("click", () => closeSidebar());

// ------------------------------------------------------------- quick navigation --
function hideSearchResults() {
  if (searchResults) {
    searchResults.hidden = true;
    searchResults.replaceChildren();
  }
}

function showSearchResults(query) {
  if (!searchResults) return;
  const q = query.trim().toLowerCase();
  if (!q) {
    hideSearchResults();
    return;
  }
  const matches = registry
    .list({ enabledOnly: true })
    .filter((item) => `${item.label} ${item.description || ""} ${item.group}`.toLowerCase().includes(q));
  if (!matches.length) {
    mount(searchResults, h("div", { class: "pu-search-empty" }, "No matching sections"));
    searchResults.hidden = false;
    return;
  }
  mount(
    searchResults,
    matches.map((item) =>
      h(
        "button",
        {
          class: "pu-search-item",
          type: "button",
          onclick: () => {
            router.navigate(item.id);
            hideSearchResults();
            if (searchInput) searchInput.value = "";
          },
        },
        svgIcon(item.icon, { size: 16 }),
        h("span", {}, item.label),
        h("span", { class: "pu-search-group" }, item.group)
      )
    )
  );
  searchResults.hidden = false;
}

searchInput?.addEventListener("input", (event) => showSearchResults(event.target.value));
searchInput?.addEventListener("focus", (event) => showSearchResults(event.target.value));
searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const first = searchResults?.querySelector(".pu-search-item");
    if (first) first.click();
  }
});
document.addEventListener("click", (event) => {
  if (!searchResults) return;
  if (!searchResults.contains(event.target) && event.target !== searchInput) hideSearchResults();
});

// ---------------------------------------------------------------- route changes --
router.subscribe((ctx) => {
  closeSidebar();
  renderNav();
  const main = document.getElementById("puMain");
  if (main) main.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// --------------------------------------------------------------------- boot --
branding.applyTo(document);
theme.apply();
const versionBadge = document.getElementById("puVersionBadge");
if (versionBadge) versionBadge.textContent = `v${branding.get().version || config.version}`;
syncThemeButton();
renderNav();
router.start(document.getElementById("puMain"));

// Developer API surface (see src/API.md).
PU.app = app;
PU.tests = { runAll: runAllTests };
PU.config = config;
PU.version = branding.get().version || PU.version;
globalThis.PU = PU;

console.info(`[pu] ${config.appTitle} v${PU.version} ready — theme: ${theme.get().label} (${theme.get().mode})`);
