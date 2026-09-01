/* ====================================================================
   TEMPLATE JUNGLE — render engine
   Reads the `config` list from main.pjs and renders every section.
   ==================================================================== */
(function () {
  "use strict";

  var root = window.root || {};
  var config = root.config;
  if (!config) { console.warn("Template Jungle: no config found"); return; }

  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function scalar(node, key, fallback) {
    if (!node) return fallback;
    var v = node[key];
    if (v === undefined || v === null) return fallback;
    if (typeof v === "object" && v !== null && "evaluateItem" in v) return v.evaluateItem == null ? fallback : v.evaluateItem;
    return v;
  }

  function childList(node, key) {
    if (!node) return [];
    var v = node[key];
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v.selectAll) return v.selectAll;
    return [v];
  }

  var ICONS = {
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/><circle cx="9" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/><circle cx="12" cy="12" r="1.5"/>',
    gamepad: '<path d="M6 12h4"/><path d="M8 10v4"/><path d="M15 13h.01"/><path d="M18 11h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1.2a2.2 2.2 0 0 0 1.5-3.8 1.9 1.9 0 0 1 1.5-3.2H17A4 4 0 0 0 21 10c0-4-4-7-9-7z"/><circle cx="8" cy="10" r="1.2"/><circle cx="12.5" cy="7" r="1.2"/><circle cx="16.5" cy="10" r="1.2"/><circle cx="13.5" cy="14.5" r="1.2"/>',
    puzzle: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
  };

  var branding = config.branding;
  var theme = config.theme;
  var colors = config.colors;
  var hero = config.hero;

  /* ---------- theme ---------- */
  var savedMode = null;
  try { savedMode = localStorage.getItem("tj-mode"); } catch (e) {}
  var mode = savedMode || scalar(theme, "mode", "dark") || "dark";

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return "16, 185, 129";
    return ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255);
  }

  function applyTheme() {
    var el = document.documentElement;
    el.setAttribute("data-theme", mode);
    var s = el.style;
    s.setProperty("--primary", scalar(colors, "primary", "#10b981"));
    s.setProperty("--secondary", scalar(colors, "secondary", "#34d399"));
    s.setProperty("--accent", scalar(colors, "accent", "#047857"));
    s.setProperty("--primary-rgb", hexToRgb(scalar(colors, "primary", "#10b981")));
    if (mode === "light") {
      s.setProperty("--background", scalar(colors, "background", "#f8fafc"));
      s.setProperty("--surface", scalar(colors, "surface", "#ffffff"));
      s.setProperty("--text", scalar(colors, "text", "#0f172a"));
      s.setProperty("--text-muted", scalar(colors, "textMuted", "#64748b"));
    } else {
      s.removeProperty("--background");
      s.removeProperty("--surface");
      s.removeProperty("--text");
      s.removeProperty("--text-muted");
    }
    s.setProperty("--radius", Number(scalar(theme, "radius", 16)) + "px");
    s.setProperty("--font-size", Number(scalar(theme, "fontSize", 16)) + "px");
    var toggleIcon = $("#themeToggleIcon");
    if (toggleIcon) toggleIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (mode === "dark" ? ICONS.sun : ICONS.moon) + "</svg>";
  }
  applyTheme();

  $("#themeToggle").addEventListener("click", function () {
    mode = mode === "dark" ? "light" : "dark";
    try { localStorage.setItem("tj-mode", mode); } catch (e) {}
    applyTheme();
  });

  /* ---------- header ---------- */
  var companyName = scalar(branding, "companyName", "Template Jungle");
  var logoGlyph = scalar(branding, "logoGlyph", "J");
  var logoUrl = scalar(branding, "logoUrl", "");

  function setLogo(markSel, textSel) {
    var mark = $(markSel), text = $(textSel);
    if (!mark || !text) return;
    if (logoUrl) {
      mark.innerHTML = '<img src="' + esc(logoUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
    } else {
      mark.textContent = logoGlyph;
    }
    text.textContent = companyName;
  }
  setLogo("#logoMark", "#logoText");
  setLogo("#footerLogoMark", "#footerLogoText");

  var header = $("#siteHeader");
  function onScroll() {
    var y = window.scrollY || 0;
    if (header) header.classList.toggle("scrolled", y > 8);
    var bar = $("#progressBar");
    if (bar) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var hamburger = $("#hamburgerBtn");
  var mobileMenu = $("#mobileMenu");
  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", function () {
      var open = mobileMenu.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileMenu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        mobileMenu.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (scalar(theme, "reduceMotion", false) !== true) {
    document.documentElement.style.scrollBehavior = "smooth";
  }

  /* ---------- data-field filler ---------- */
  document.querySelectorAll("[data-field]").forEach(function (el) {
    var path = el.getAttribute("data-field").split(".");
    var node = config;
    for (var i = 0; i < path.length; i++) {
      node = node ? node[path[i]] : null;
      if (node && typeof node === "object" && "evaluateItem" in node) node = node.evaluateItem;
      if (node === undefined || node === null) break;
    }
    if (node !== null && node !== undefined) el.textContent = node;
  });

  /* ---------- hero ---------- */
  var templates = childList(config, "templates");
  var categories = childList(config, "categories");
  var totalViews = 0;
  templates.forEach(function (t) { totalViews += Number(scalar(t, "views", 0)) || 0; });

  var headline = scalar(hero, "headline", "");
  var accent = scalar(hero, "headlineAccent", "");
  var heroTitle = $("#heroTitle");
  if (heroTitle) {
    if (accent && headline.indexOf(accent) !== -1) {
      var idx = headline.indexOf(accent);
      heroTitle.innerHTML = esc(headline.slice(0, idx)) + '<span class="accent">' + esc(accent) + "</span>" + esc(headline.slice(idx + accent.length));
    } else {
      heroTitle.textContent = headline;
    }
  }
  var sub = $("#heroSubhead");
  if (sub) sub.textContent = scalar(hero, "subheadline", "");
  var status = $("#heroStatus .status-chip span");
  if (status) status.textContent = scalar(hero, "status", "") + "  ·  " + templates.length + " templates · " + categories.length + " categories";
  var fcTemplates = $("#fcTemplates");
  if (fcTemplates) fcTemplates.firstChild.textContent = templates.length + " templates";

  /* ---------- quick links ---------- */
  var quickWrap = $("#quickLinks");
  if (quickWrap) {
    quickWrap.innerHTML = childList(config, "quickLinks").map(function (q) {
      return '<li><a class="trust-chip" href="' + esc(scalar(q, "url", "#")) + '">' + esc(scalar(q, "label", "")) +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ICONS.arrow + "</svg></a></li>";
    }).join("");
  }

  /* ---------- stats ---------- */
  var statsBand = $("#statsBand");
  if (statsBand) {
    var top = templates.reduce(function (m, t) { return Math.max(m, Number(scalar(t, "views", 0)) || 0); }, 0);
    var stats = [
      { value: templates.length, label: "Templates" },
      { value: totalViews, label: "Total views" },
      { value: categories.length, label: "Categories" },
      { value: top, label: "Most-viewed template" }
    ];
    statsBand.innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="stat-value">' + esc(s.value) + '</div><div class="stat-label">' + esc(s.label) + "</div></div>";
    }).join("");
  }

  /* ---------- template sections ---------- */
  var tplRoot = $("#templateSections");
  if (tplRoot) {
    var tagClass = { Featured: "tag-featured", Private: "tag-private", New: "tag-new" };
    var sections = categories.map(function (cat) {
      var catId = scalar(cat, "id", "");
      var catTpls = templates.filter(function (t) { return scalar(t, "category", "") === catId; });
      var count = catTpls.length;
      var iconName = scalar(cat, "icon", "rocket");
      var cards = catTpls.map(function (t) {
        var name = scalar(t, "name", "");
        var tag = String(scalar(t, "tag", "") || "").trim();
        var tagHtml = tag ? '<span class="tag ' + (tagClass[tag] || "") + '">' + esc(tag) + "</span>" : "";
        return '<a class="tpl-card" href="https://perchance.org/' + esc(name) + '" target="_blank" rel="noopener">' +
          '<div class="tpl-top"><span class="tpl-icon">' + esc(scalar(t, "icon", "🌿")) + "</span>" +
          '<span class="tpl-tags">' + tagHtml + "</span></div>" +
          '<div class="tpl-title">' + esc(scalar(t, "title", name)) + "</div>" +
          '<div class="tpl-name">' + esc(name) + "</div>" +
          '<p class="tpl-desc">' + esc(scalar(t, "description", "")) + "</p>" +
          '<div class="tpl-meta"><span class="tpl-views"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS.eye + "</svg>" + (Number(scalar(t, "views", 0)) || 0) + " views</span>" +
          '<span class="tpl-link">Open<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ICONS.arrow + "</svg></span></div>" +
          "</a>";
      }).join("");
      return '<div class="cat" id="cat-' + esc(catId) + '">' +
        '<div class="cat-head"><span class="cat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[iconName] || ICONS.rocket) + "</svg></span>" +
        '<div class="cat-meta"><h3 class="cat-title">' + esc(scalar(cat, "label", "")) + "</h3>" +
        '<span class="cat-count">' + count + " template" + (count === 1 ? "" : "s") + "</span></div></div>" +
        (scalar(cat, "blurb", "") ? '<p class="cat-blurb" style="margin-bottom:18px">' + esc(scalar(cat, "blurb", "")) + "</p>" : "") +
        '<div class="tpl-grid">' + cards + "</div></div>";
    });
    tplRoot.innerHTML = sections.join("");
  }

  /* ---------- popular ---------- */
  var popularGrid = $("#popularGrid");
  if (popularGrid) {
    var ranked = templates.slice().sort(function (a, b) {
      return (Number(scalar(b, "views", 0)) || 0) - (Number(scalar(a, "views", 0)) || 0);
    }).filter(function (t) { return (Number(scalar(t, "views", 0)) || 0) > 0; }).slice(0, 6);
    popularGrid.innerHTML = ranked.map(function (t, i) {
      var name = scalar(t, "name", "");
      return '<a class="pop-card" href="https://perchance.org/' + esc(name) + '" target="_blank" rel="noopener">' +
        '<span class="pop-rank">' + (i + 1) + "</span>" +
        '<div class="pop-info"><div class="pop-title">' + esc(scalar(t, "title", name)) + '</div><div class="pop-sub">' + esc(name) + "</div></div>" +
        '<span class="pop-view">' + (Number(scalar(t, "views", 0)) || 0) + " views</span></a>";
    }).join("");
  }

  /* ---------- steps ---------- */
  var stepsWrap = $("#stepsWrap");
  if (stepsWrap) {
    stepsWrap.innerHTML = childList(config, "how").map(function (s, i) {
      return '<div class="step"><span class="step-num">' + (i + 1) + '</span><h3 class="step-title">' + esc(scalar(s, "title", "")) + "</h3><p>" + esc(scalar(s, "description", "")) + "</p></div>";
    }).join("");
  }

  /* ---------- FAQ ---------- */
  var faqList = $("#faqList");
  if (faqList) {
    faqList.innerHTML = childList(config, "faq").map(function (f) {
      return '<div class="faq-item"><div class="faq-q"><span>' + esc(scalar(f, "question", "")) + '</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div><div class="faq-a"><div class="faq-a-inner">' + esc(scalar(f, "answer", "")) + "</div></div></div>";
    }).join("");
    faqList.querySelectorAll(".faq-q").forEach(function (q) {
      q.addEventListener("click", function () {
        var item = q.parentElement;
        var ans = item.querySelector(".faq-a");
        var open = item.classList.toggle("open");
        ans.style.maxHeight = open ? ans.scrollHeight + "px" : "0px";
      });
    });
  }

  /* ---------- footer ---------- */
  var footerCols = $("#footerCols");
  if (footerCols) {
    footerCols.innerHTML = childList(config.footer, "columns").map(function (col) {
      var links = childList(col, "links").map(function (l) {
        return '<a href="' + esc(scalar(l, "url", "#")) + '"' + (scalar(l, "url", "").indexOf("http") === 0 ? ' target="_blank" rel="noopener"' : "") + ">" + esc(scalar(l, "label", "")) + "</a>";
      }).join("");
      return '<div class="footer-col"><h4>' + esc(scalar(col, "heading", "")) + "</h4>" + links + "</div>";
    }).join("");
  }
  var taglineEl = $("#footerTagline");
  if (taglineEl) taglineEl.textContent = scalar(branding, "tagline", "");
  var yearEl = $("#yearEl");
  if (yearEl) {
    yearEl.textContent = scalar(branding, "footerText", "").replace(/\{year\}/g, String(new Date().getFullYear())).replace(/\{companyName\}/g, companyName);
  }

  /* ---------- reveal on scroll ---------- */
  var reduceMotion = scalar(theme, "reduceMotion", false) === true;
  if (!reduceMotion && "IntersectionObserver" in window) {
    var reveals = document.querySelectorAll(".section-head, .tpl-card, .pop-card, .step, .stat");
    reveals.forEach(function (el) { el.classList.add("reveal"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
    setTimeout(function () { reveals.forEach(function (el) { el.classList.add("in"); }); }, 2500);
  }
})();
