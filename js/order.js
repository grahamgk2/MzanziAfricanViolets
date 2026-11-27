/* Order basket: builds a plain-text order the customer can email or paste into WhatsApp/Messenger.
   No data is sent anywhere by this page. */
(function () {
  var cfg = window.ORDER, cards = [].slice.call(document.querySelectorAll(".card"));
  var basket = document.getElementById("basket"), lines = document.getElementById("lines");
  var summary = document.getElementById("summary"), warn = document.getElementById("warn");
  var mail = document.getElementById("mail"), copy = document.getElementById("copy");

  function qty(c) { return parseInt(c.querySelector("output").textContent, 10) || 0; }

  function text() {
    var rows = cards.filter(function (c) { return qty(c) > 0; });
    var sets = rows.reduce(function (n, c) { return n + qty(c); }, 0);
    var t = "Hello, I would like to order leaves (" + cfg.label + "):\n\n";
    rows.forEach(function (c) { t += qty(c) + " x set of 2 leaves - " + c.dataset.name + "\n"; });
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
      li.textContent = qty(c) + " × " + c.dataset.name;
      lines.appendChild(li);
    });
    summary.textContent = sets + " set" + (sets === 1 ? "" : "s") + " (" + sets * 2 + " leaves) = R" + sets * cfg.setPrice + " plus postage";
    var short = cfg.minSets - sets;
    warn.hidden = short <= 0;
    warn.textContent = short > 0 ? "The minimum order is " + cfg.minSets + " sets. Please add " + short + " more." : "";
    mail.href = "mailto:" + cfg.email + "?subject=" + encodeURIComponent("Leaf order") + "&body=" + encodeURIComponent(text());
    try { sessionStorage.setItem("order:" + location.pathname, JSON.stringify(rows.map(function (c) { return [c.dataset.name, qty(c)]; }))); } catch (e) {}
  }

  cards.forEach(function (c) {
    var out = c.querySelector("output");
    c.querySelector(".plus").addEventListener("click", function () { out.textContent = qty(c) + 1; update(); });
    c.querySelector(".minus").addEventListener("click", function () { out.textContent = Math.max(0, qty(c) - 1); update(); });
  });

  try {
    JSON.parse(sessionStorage.getItem("order:" + location.pathname) || "[]").forEach(function (p) {
      cards.forEach(function (c) { if (c.dataset.name === p[0]) c.querySelector("output").textContent = p[1]; });
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
