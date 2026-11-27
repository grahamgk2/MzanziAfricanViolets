/* Order basket: builds a plain-text order the customer can email or paste into WhatsApp/Messenger.
   No data is sent anywhere by this page. */
(function () {
  var cfg = window.ORDER, cards = [].slice.call(document.querySelectorAll(".card"));
  var basket = document.getElementById("basket"), lines = document.getElementById("lines");
  var summary = document.getElementById("summary"), warn = document.getElementById("warn");
  var mail = document.getElementById("mail"), copy = document.getElementById("copy");

  function qty(c) { return c.classList.contains("on") ? 1 : 0; }
  function set(c, on) {
    var b = c.querySelector(".toggle");
    c.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.textContent = on ? "✓ Added (tap to remove)" : "Add 1 set of 2 leaves";
  }

  function text() {
    var rows = cards.filter(function (c) { return qty(c) > 0; });
    var sets = rows.reduce(function (n, c) { return n + qty(c); }, 0);
    var t = "Hello, I would like to order leaves (" + cfg.label + "):\n\n";
    rows.forEach(function (c) { t += "1 set of 2 leaves - " + c.dataset.name + "\n"; });
    t += "\nTotal: " + sets + " sets (R" + sets * cfg.setPrice + " excluding postage)\n\nMy name:\nMy delivery address / town:\n";
    return t;
  }

  function update() {
    var rows = cards.filter(function (c) { return qty(c) > 0; });
    var sets = rows.reduce(function (n, c) { return n + qty(c); }, 0);
    basket.hidden = sets === 0;
    lines.innerHTML = "";
    rows.forEach(function (c) {
      var li = document.createElement("li");
      li.textContent = c.dataset.name;
      lines.appendChild(li);
    });
    summary.textContent = sets + " set" + (sets === 1 ? "" : "s") + " (" + sets * 2 + " leaves) = R" + sets * cfg.setPrice + " plus postage";
    var short = cfg.minSets - sets;
    warn.hidden = short <= 0;
    warn.textContent = short > 0 ? "The minimum order is " + cfg.minSets + " sets (one per cultivar). Please choose " + short + " more." : "";
    mail.href = "mailto:" + cfg.email + "?subject=" + encodeURIComponent("Leaf order") + "&body=" + encodeURIComponent(text());
    try { sessionStorage.setItem("order:" + location.pathname, JSON.stringify(rows.map(function (c) { return [c.dataset.name, qty(c)]; }))); } catch (e) {}
  }

  cards.forEach(function (c) {
    c.querySelector(".toggle").addEventListener("click", function () { set(c, !qty(c)); update(); });
  });

  try {
    JSON.parse(sessionStorage.getItem("order:" + location.pathname) || "[]").forEach(function (p) {
      cards.forEach(function (c) { if (c.dataset.name === p[0]) set(c, true); });
    });
  } catch (e) {}

  copy.addEventListener("click", function () {
    var t = text();
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
      copy.textContent = "Copied!";
    }, function () {
      window.prompt("Copy your order:", t);
    });
    setTimeout(function () { copy.textContent = "Copy order text"; }, 2500);
  });

  document.getElementById("find").addEventListener("input", function (e) {
    var q = e.target.value.toLowerCase().trim();
    cards.forEach(function (c) { c.hidden = q && c.dataset.search.indexOf(q) === -1; });
  });

  update();
})();
