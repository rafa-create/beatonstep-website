(function () {
  var KEY = "bos-lang";
  var THEME_KEY = "bos-theme";

  function readLang() {
    var q = /(?:\?|&)lang=(en|fr)\b/.exec(location.search);
    if (q) return q[1];
    try {
      var s = localStorage.getItem(KEY);
      if (s === "en" || s === "fr") return s;
    } catch (e) {}
    var n = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return n === "en" ? "en" : "fr";
  }

  function readTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark") return t;
    } catch (e) {}
    return "dark";
  }

  function withLang(href, lang) {
    var u = new URL(href, location.href);
    if (u.origin !== location.origin) return href;
    u.searchParams.set("lang", lang);
    return u.pathname.replace(/\/index\.html$/, "/") + u.search + u.hash;
  }

  function applyTheme(theme) {
    if (theme !== "light" && theme !== "dark") theme = "dark";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-theme-set") === theme ? "true" : "false"
      );
    });
  }

  function apply(lang) {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(KEY, lang);
    } catch (e) {}
    var titles = window.BOS_TITLES || {};
    if (titles[lang]) document.title = titles[lang];
    var desc = window.BOS_DESC || {};
    var meta = document.querySelector('meta[name="description"]');
    if (meta && desc[lang]) meta.setAttribute("content", desc[lang]);
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-set") === lang ? "true" : "false");
    });
    document.querySelectorAll("a[data-keep-lang]").forEach(function (a) {
      var base = a.getAttribute("data-href") || a.getAttribute("href");
      a.setAttribute("href", withLang(base, lang));
    });
  }

  var lang = readLang();
  var theme = readTheme();
  document.documentElement.lang = lang;
  document.documentElement.setAttribute("data-theme", theme);
  if (window.BOS_TITLES && window.BOS_TITLES[lang]) {
    document.title = window.BOS_TITLES[lang];
  }

  document.addEventListener("DOMContentLoaded", function () {
    apply(lang);
    applyTheme(theme);
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.addEventListener("click", function () {
        apply(b.getAttribute("data-set"));
      });
    });
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.addEventListener("click", function () {
        applyTheme(b.getAttribute("data-theme-set"));
      });
    });
  });
})();
