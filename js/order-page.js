/* Order page: review the shared basket, send the order through Web3Forms, copy it, or download a PDF summary.
   Nothing is stored or sent until the customer presses "Send order". */
(function () {
  var B = window.Basket;
  if (!B) return;
  var $ = function (id) { return document.getElementById(id); };
  var empty = $("op-empty"), main = $("op-main"), done = $("op-done"), lines = $("op-lines"), totalEl = $("op-total"), warn = $("op-warn");
  var form = $("orderform"), status = $("op-status"), sendBtn = $("op-send");
  var snapshot = null; /* the order as sent, kept so the PDF and copy still work after the basket is cleared */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function cust() {
    return {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      town: form.elements.town.value.trim(),
      delivery: (form.querySelector("input[name=delivery]:checked") || {}).value || "",
      extra: form.elements.extra.value.trim(),
      notes: form.elements.notes.value.trim()
    };
  }

  /* The extra line asks for a street address (door) or a locker (locker) */
  [].slice.call(form.querySelectorAll("input[name=delivery]")).forEach(function (r) {
    r.addEventListener("change", function () {
      var locker = /locker/.test(r.value);
      $("dl-extra-row").hidden = false;
      $("dl-extra-label").textContent = locker ? "Locker name or location (optional)" : "Street address and suburb (optional)";
    });
  });

  function current() {
    return { groups: B.groups(), total: B.total(), count: B.count(), cust: cust() };
  }

  function orderText(s) {
    var t = "Hello, I would like to order the following leaves:\n\n";
    s.groups.forEach(function (g) {
      t += g.lab + "\n";
      g.items.forEach(function (it) { t += "- " + it.n + " (" + B.money(it.p) + ")\n"; });
      t += "\n";
    });
    t += "Total: " + B.money(s.total) + " (" + s.count + " item" + (s.count === 1 ? "" : "s") + ", excluding postage)\n\n";
    t += "Name: " + (s.cust.name || "") + "\nEmail: " + (s.cust.email || "") + "\nPhone: " + (s.cust.phone || "") + "\nDelivery town: " + (s.cust.town || "") + "\n";
    t += "Courier delivery: " + (s.cust.delivery || "") + "\n";
    if (s.cust.extra) t += (/locker/.test(s.cust.delivery) ? "Locker: " : "Street address: ") + s.cust.extra + "\n";
    if (s.cust.notes) t += "Notes: " + s.cust.notes + "\n";
    return t;
  }

  function drawLines(into, s, removable) {
    into.innerHTML = "";
    s.groups.forEach(function (g) {
      into.appendChild(el("h3", "", g.lab));
      var ul = el("ul", "lines");
      g.items.forEach(function (it) {
        var li = el("li");
        li.appendChild(el("span", "n", it.n));
        li.appendChild(el("span", "p", B.money(it.p)));
        if (removable) {
          var b = el("button", "rm", "×");
          b.type = "button";
          b.setAttribute("aria-label", "Remove " + it.n);
          b.addEventListener("click", function () { B.remove(it.l, it.n); });
          li.appendChild(b);
        }
        ul.appendChild(li);
      });
      into.appendChild(ul);
    });
  }

  function render() {
    if (snapshot) return; /* order already sent */
    var n = B.count();
    empty.hidden = n > 0;
    main.hidden = n === 0;
    if (!n) return;
    drawLines(lines, current(), true);
    var tot = B.total();
    totalEl.textContent = "Total: " + B.money(tot) + " (excluding postage)";
    warn.hidden = tot >= B.MIN;
    warn.textContent = tot < B.MIN ? "The minimum order is " + B.money(B.MIN) + ". Please add " + B.money(B.MIN - tot) + " more." : "";
  }

  /* ---- copy ---- */
  function copyText(s, btn) {
    var t = orderText(s);
    var p = navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject();
    p.then(function () { btn.textContent = "Copied!"; }, function () { window.prompt("Copy your order:", t); });
    setTimeout(function () { btn.textContent = "Copy order text"; }, 2500);
  }

  /* ---- PDF ---- */
  function latin(s) { return String(s).replace(/[^\x00-\xff]/g, "").replace(/\s+/g, " ").trim(); }

  function pdf(s) {
    var J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { window.print(); return; }
    var d = new J({ unit: "mm", format: "a4" }), W = 210, M = 18, y = 22;
    function need(h) { if (y + h > 277) { d.addPage(); y = 22; } }
    function text(str, size, bold, x, align) {
      d.setFont("helvetica", bold ? "bold" : "normal");
      d.setFontSize(size);
      d.text(str, x == null ? M : x, y, align ? { align: align } : undefined);
    }
    text("Mzanzi African Violets", 18, true); y += 7;
    text("Order summary", 13, false); y += 6;
    text("Pringle Bay, Western Cape, South Africa  |  mzanziafricanviolets@gmail.com", 9, false); y += 5;
    text("Date: " + new Date().toLocaleDateString("en-ZA"), 9, false); y += 9;
    var c = s.cust, any = false;
    [["Name", c.name], ["Email", c.email], ["Phone", c.phone], ["Delivery town", c.town], ["Courier delivery", c.delivery],
     [/locker/.test(c.delivery) ? "Locker" : "Street address", c.extra], ["Notes", c.notes]].forEach(function (r) {
      if (!r[1]) return;
      any = true;
      var wrapped = d.splitTextToSize(latin(r[1]), W - 2 * M - 30);
      need(5 * wrapped.length);
      text(r[0] + ":", 10, true);
      d.setFont("helvetica", "normal");
      d.text(wrapped, M + 30, y);
      y += 5 * wrapped.length;
    });
    if (any) y += 4;
    s.groups.forEach(function (g) {
      need(14);
      text(latin(g.lab), 12, true); y += 2;
      d.setDrawColor(150); d.line(M, y, W - M, y); y += 5;
      g.items.forEach(function (it) {
        var wrapped = d.splitTextToSize(latin(it.n) || "(name)", W - 2 * M - 25);
        need(5 * wrapped.length + 1);
        d.setFont("helvetica", "normal"); d.setFontSize(10);
        d.text(wrapped, M, y);
        d.text(B.money(it.p), W - M, y, { align: "right" });
        y += 5 * wrapped.length + 1;
      });
      y += 4;
    });
    need(30);
    d.setDrawColor(0); d.line(M, y, W - M, y); y += 6;
    text("Total (excluding postage)", 11, true);
    text(B.money(s.total), 11, true, W - M, "right"); y += 10;
    var note = "This is an order summary, not an invoice. We will reply with an invoice that lists the leaves available from your order, the postage quote, the total, and our banking details. Payment is by EFT.";
    d.setFont("helvetica", "normal"); d.setFontSize(9);
    var nl = d.splitTextToSize(note, W - 2 * M);
    need(5 * nl.length);
    d.text(nl, M, y);
    d.save("Mzanzi-order-summary-" + new Date().toISOString().slice(0, 10) + ".pdf");
  }

  /* ---- buttons ---- */
  $("op-copy").addEventListener("click", function () { copyText(current(), this); });
  $("op-pdf").addEventListener("click", function () { pdf(current()); });
  $("op-cancel").addEventListener("click", function () {
    if (!window.confirm("Cancel your order and remove all items?")) return;
    form.reset();
    $("dl-extra-row").hidden = true;
    status.textContent = "";
    B.clear();
  });
  $("done-copy").addEventListener("click", function () { copyText(snapshot, this); });
  $("done-pdf").addEventListener("click", function () { pdf(snapshot); });
  $("done-print").addEventListener("click", function () { window.print(); });

  /* ---- send ---- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var em = form.elements.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) {
      em.setAttribute("aria-invalid", "true");
      status.textContent = "Please enter a full email address, like name@example.com, so we can reply to you.";
      em.focus();
      return;
    }
    em.removeAttribute("aria-invalid");
    if (B.total() < B.MIN) { status.textContent = "The minimum order is " + B.money(B.MIN) + ". Please add more leaves first."; return; }
    var s = current();
    sendBtn.disabled = true;
    status.textContent = "Sending...";
    var data = {
      access_key: form.elements.access_key.value,
      subject: "New leaf order: " + B.money(s.total) + " from " + s.cust.name,
      from_name: "Mzanzi African Violets website",
      name: s.cust.name,
      email: s.cust.email,
      phone: s.cust.phone,
      delivery_town: s.cust.town,
      courier_delivery: s.cust.delivery,
      address_or_locker: s.cust.extra,
      notes: s.cust.notes,
      message: orderText(s),
      botcheck: form.elements.botcheck.checked
    };
    fetch(form.action, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.success) throw new Error(j.message || "failed");
        snapshot = s;
        B.clear();
        main.hidden = true;
        empty.hidden = true;
        done.hidden = false;
        drawLines($("done-lines"), snapshot, false);
        $("done-total").textContent = "Total: " + B.money(snapshot.total) + " (excluding postage)";
        window.scrollTo(0, 0);
      })
      .catch(function () {
        status.textContent = "Sorry, your order could not be sent. Please use Copy order text and send it to mzanziafricanviolets@gmail.com, or message us on Facebook or WhatsApp.";
      })
      .then(function () { sendBtn.disabled = false; });
  });

  B.onChange(render);
  render();
})();
