/* Contact form: sends the message through Web3Forms and shows the result on the page. */
(function () {
  var f = document.getElementById("contact"), status = document.getElementById("form-status");
  if (!f) return;
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (f.dataset.key.indexOf("YOUR_") === 0) { status.textContent = "The form is not set up yet. Please email us instead."; return; }
    var btn = f.querySelector("button[type=submit]");
    btn.disabled = true; status.textContent = "Sending...";
    var data = {};
    new FormData(f).forEach(function (v, k) { data[k] = v; });
    fetch(f.action, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.success) { f.reset(); status.textContent = "Thank you! Your message has been sent. We will reply by email."; }
        else { throw new Error(j.message || "failed"); }
      })
      .catch(function () { status.textContent = "Sorry, your message could not be sent. Please email mzanziafricanviolets@gmail.com instead."; })
      .then(function () { btn.disabled = false; });
  });
})();
