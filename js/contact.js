/* Contact form: sends the message through Web3Forms and shows the result on the page. */
(function () {
  var f = document.getElementById("contact"), status = document.getElementById("form-status");
  if (!f) return;
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (f.dataset.key.indexOf("YOUR_") === 0) { status.textContent = "The form is not set up yet. Please email us instead."; return; }
    var em = f.elements.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) {
      em.setAttribute("aria-invalid", "true");
      status.textContent = "Please enter a full email address, like name@example.com, so we can reply to you.";
      em.focus();
      return;
    }
    em.removeAttribute("aria-invalid");
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
