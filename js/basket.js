/* Shared order basket, used on every page.
   Items live in this browser only (localStorage) until the customer sends the order. They expire after 30 days.
   Each item: {l: list key, lab: list label, n: name, p: price in rand}. */
(function () {
  var KEY = "mzanzi-order-v1", MIN = 150, TTL = 30 * 24 * 3600 * 1000;
  var items = [], listeners = [];

  function read() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (d && d.items && Date.now() - d.t < TTL) return d.items;
    } catch (e) {}
    return null;
  }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), items: items })); } catch (e) {}
  }
  function fire() { listeners.forEach(function (f) { f(); }); }
  function money(n) { return "R" + n; }

  items = read() || [];

  function find(l, n) {
    for (var i = 0; i < items.length; i++) if (items[i].l === l && items[i].n === n) return i;
    return -1;
  }
  function total() { return items.reduce(function (s, it) { return s + it.p; }, 0); }

  function groups() {
    var order = [], by = {};
    items.forEach(function (it) {
      if (!by[it.l]) { by[it.l] = { l: it.l, lab: it.lab, items: [], sub: 0 }; order.push(it.l); }
      by[it.l].items.push(it);
      by[it.l].sub += it.p;
    });
    return order.map(function (k) {
      by[k].items.sort(function (a, b) { return a.n.localeCompare(b.n, "en", { numeric: true }); });
      return by[k];
    });
  }

  var Basket = {
    MIN: MIN,
    money: money,
    count: function () { return items.length; },
    total: total,
    groups: groups,
    has: function (l, n) { return find(l, n) >= 0; },
    add: function (l, lab, n, p) { if (find(l, n) < 0) { items.push({ l: l, lab: lab, n: n, p: p }); write(); fire(); } },
    remove: function (l, n) { var i = find(l, n); if (i >= 0) { items.splice(i, 1); write(); fire(); } },
    clear: function () { items = []; write(); fire(); },
    onChange: function (f) { listeners.push(f); }
  };
  window.Basket = Basket;

  window.addEventListener("storage", function (e) {
    if (e.key === KEY) { items = read() || []; fire(); }
  });

  /* "Your order (n)" link in the main menu */
  function badge() {
    var nav = document.querySelector("nav[aria-label=Main]");
    if (!nav) return;
    var a = document.getElementById("order-link"), n = items.length;
    if (!n) { if (a) a.parentNode.removeChild(a); return; }
    if (!a) {
      a = document.createElement("a");
      a.id = "order-link";
      a.className = "order-link";
      a.href = "order.html";
      nav.appendChild(a);
    }
    a.textContent = "Your order (" + n + ")";
    if (/order\.html$/.test(location.pathname)) a.setAttribute("aria-current", "page");
  }

  /* The order box at the bottom of the list pages (collapsed by default on phones) */
  function box() {
    var el = document.getElementById("basket");
    if (!el) return;
    var head = document.getElementById("basket-head"), sum = document.getElementById("basket-summary"), body = document.getElementById("basket-body");
    var small = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
    var open = !(small && small.matches);

    function apply() {
      el.classList.toggle("collapsed", !open);
      head.setAttribute("aria-expanded", open ? "true" : "false");
    }
    head.addEventListener("click", function () { open = !open; apply(); });

    function el2(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text) e.textContent = text;
      return e;
    }

    function render() {
      var n = items.length, tot = total();
      el.hidden = n === 0;
      if (!n) return;
      sum.textContent = "Your order: " + n + " item" + (n === 1 ? "" : "s") + " · " + money(tot);
      body.innerHTML = "";
      groups().forEach(function (g) {
        body.appendChild(el2("h3", "", g.lab));
        var ul = el2("ul", "lines");
        g.items.forEach(function (it) {
          var li = el2("li");
          li.appendChild(el2("span", "n", it.n));
          li.appendChild(el2("span", "p", money(it.p)));
          var b = el2("button", "rm", "×");
          b.type = "button";
          b.setAttribute("aria-label", "Remove " + it.n);
          b.addEventListener("click", function () { Basket.remove(it.l, it.n); });
          li.appendChild(b);
          ul.appendChild(li);
        });
        body.appendChild(ul);
      });
      body.appendChild(el2("p", "tot", "Total: " + money(tot) + " (excluding postage)"));
      if (tot < MIN) body.appendChild(el2("p", "warn", "The minimum order is " + money(MIN) + ". Please add " + money(MIN - tot) + " more."));
      else body.appendChild(el2("p", "ok", "Minimum order reached."));
      var go = el2("a", "btn", "Review and send order");
      go.href = "order.html";
      var cancel = el2("button", "btn alt cancel", "Cancel order");
      cancel.type = "button";
      cancel.addEventListener("click", function () {
        if (window.confirm("Cancel your order and remove all items?")) Basket.clear();
      });
      var p = el2("p", "actions btns");
      p.appendChild(go);
      p.appendChild(cancel);
      body.appendChild(p);
    }
    apply();
    Basket.onChange(render);
    render();
  }

  document.addEventListener("DOMContentLoaded", function () {
    badge();
    Basket.onChange(badge);
    box();
  });
})();
