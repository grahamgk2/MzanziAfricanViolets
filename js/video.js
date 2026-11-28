/* Click-to-play YouTube videos: the player (privacy-enhanced domain) only loads when a visitor clicks. */
(function () {
  [].slice.call(document.querySelectorAll(".video")).forEach(function (box) {
    var link = box.querySelector(".vthumb");
    if (!link) return;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + box.dataset.id + "?autoplay=1&rel=0";
      f.title = box.dataset.title;
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      f.referrerPolicy = "strict-origin-when-cross-origin";
      box.innerHTML = "";
      box.appendChild(f);
    });
  });
})();
