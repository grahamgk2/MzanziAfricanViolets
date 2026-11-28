/* List pages: each card's button adds or removes that cultivar in the shared basket (see basket.js). */
(function () {
  var cfg = window.ORDER, B = window.Basket;
  var cards = [].slice.call(document.querySelectorAll(".card"));
  if (!cfg || !B) return;

  function paint(c) {
    var on = B.has(cfg.listKey, c.dataset.name), b = c.querySelector(".toggle");
    c.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.textContent = on ? "✓ Added (tap to remove)" : "Add to order · R" + cfg.price;
  }
  function sync() { cards.forEach(paint); }

  cards.forEach(function (c) {
    c.querySelector(".toggle").addEventListener("click", function () {
      if (B.has(cfg.listKey, c.dataset.name)) B.remove(cfg.listKey, c.dataset.name);
      else B.add(cfg.listKey, cfg.label, c.dataset.name, cfg.price);
    });
  });
  B.onChange(sync);
  sync();

  var find = document.getElementById("find");
  if (find) find.addEventListener("input", function (e) {
    var q = e.target.value.toLowerCase().trim();
    cards.forEach(function (c) { c.hidden = q && c.dataset.search.indexOf(q) === -1; });
    [].slice.call(document.querySelectorAll(".grp-sec")).forEach(function (sec) {
      sec.hidden = !sec.querySelector(".card:not([hidden])");
    });
  });
})();
