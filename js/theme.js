/* Light/dark theme. Follows the visitor's system setting; the header button overrides it and remembers the choice. */
(function () {
  var r = document.documentElement, key = "theme";
  function saved() { try { return localStorage.getItem(key); } catch (e) { return null; } }
  var s = saved();
  if (s === "dark" || s === "light") r.setAttribute("data-theme", s);
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function isDark() {
    var t = r.getAttribute("data-theme");
    return t ? t === "dark" : !!(mq && mq.matches);
  }
  document.addEventListener("DOMContentLoaded", function () {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "theme-toggle";
    function label() {
      var d = isDark();
      b.textContent = d ? "☀ Light" : "☾ Dark";
      b.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode");
    }
    b.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      r.setAttribute("data-theme", next);
      try { localStorage.setItem(key, next); } catch (e) {}
      label();
    });
    label();
    header.appendChild(b);
    if (mq && mq.addEventListener) mq.addEventListener("change", label);
  });
})();
