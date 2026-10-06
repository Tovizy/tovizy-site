(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* Header: solid after the hero, hides while scrolling down, returns on the way up */
  var hdr = document.querySelector(".site-header");
  if (hdr) {
    var lastY = window.scrollY, ticking = false;
    var hasHero = !!document.querySelector(".hero, .p-hero");
    var update = function () {
      var y = window.scrollY;
      hdr.classList.toggle("is-solid", !hasHero || y > 40);
      if (!document.body.classList.contains("menu-open")) hdr.classList.toggle("is-hidden", y > 400 && y > lastY + 4);
      if (y < lastY - 4 || y < 400) hdr.classList.remove("is-hidden");
      lastY = y; ticking = false;
    };
    update();
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  }

  /* Full-screen menu on small screens */
  var menuBtn = document.querySelector(".menu-btn");
  var menu = document.getElementById("menu");
  if (menuBtn && menu) {
    var setMenu = function (open) {
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.textContent = open ? "Close" : "Menu";
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) { var f = menu.querySelector("a"); if (f) f.focus(); }
    };
    menuBtn.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); menuBtn.focus(); } });
  }

  /* Hero: the drawing develops into the render, then a lens shows the drawing under the cursor */
  var hero = document.querySelector(".hero");
  if (hero) {
    var media = hero.querySelector(".hero-media");
    var sketch = hero.querySelector(".hero-sketch");
    var render = hero.querySelector(".hero-render");
    var develop = function () { hero.classList.add("is-developed"); };
    if (reduce) develop();
    else {
      var ready = function (img) { return img.decode ? img.decode().catch(function () {}) : Promise.resolve(); };
      var safety = setTimeout(develop, 3500);
      Promise.all([ready(sketch), ready(render)]).then(function () {
        clearTimeout(safety);
        setTimeout(function () { requestAnimationFrame(develop); }, 650);
      });
    }
    var setPos = function (e) {
      var r = media.getBoundingClientRect();
      media.style.setProperty("--lx", (e.clientX - r.left) + "px");
      media.style.setProperty("--ly", (e.clientY - r.top) + "px");
    };
    if (finePointer) {
      media.addEventListener("pointerenter", function (e) { if (hero.classList.contains("is-developed")) { setPos(e); media.classList.add("is-lensing"); } });
      media.addEventListener("pointermove", function (e) {
        setPos(e);
        if (hero.classList.contains("is-developed")) media.classList.add("is-lensing");
      });
      media.addEventListener("pointerleave", function () { media.classList.remove("is-lensing"); });
    } else {
      var holdTimer = null, startX = 0, startY = 0;
      media.addEventListener("pointerdown", function (e) {
        startX = e.clientX; startY = e.clientY;
        holdTimer = setTimeout(function () { media.classList.add("is-holding"); }, 160);
      });
      var end = function () { clearTimeout(holdTimer); media.classList.remove("is-holding"); };
      media.addEventListener("pointermove", function (e) { if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 12) end(); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { media.addEventListener(t, end); });
      media.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }
  }

  /* Gentle drift on the large work images while scrolling */
  var drifters = Array.prototype.slice.call(document.querySelectorAll("[data-drift] img"));
  if (drifters.length && !reduce && "IntersectionObserver" in window) {
    var live = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) live.add(en.target); else live.delete(en.target); });
    }, { rootMargin: "120px 0px" });
    drifters.forEach(function (img) { io.observe(img.parentNode); });
    var vh = window.innerHeight, pending = false;
    var frame = function () {
      pending = false;
      live.forEach(function (box) {
        var r = box.getBoundingClientRect();
        var p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        p = Math.max(-1, Math.min(1, p));
        box.firstElementChild.style.setProperty("--drift", (p * r.height * 0.05).toFixed(1) + "px");
      });
    };
    window.addEventListener("scroll", function () { if (!pending) { pending = true; requestAnimationFrame(frame); } }, { passive: true });
    window.addEventListener("resize", function () { vh = window.innerHeight; frame(); });
    frame();
  }

  /* Imagery develops once as it scrolls in; pictures that arrive together are staggered */
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var markIn = function (el, delay) {
    el.style.setProperty("--d", (delay || 0) + "ms");
    el.classList.add("is-in");
    var piece = el.closest(".piece");
    if (piece) { piece.style.setProperty("--d", (delay || 0) + "ms"); piece.classList.add("is-in"); }
  };
  if (reveals.length) {
    if (reduce || !("IntersectionObserver" in window)) reveals.forEach(function (el) { markIn(el, 0); });
    else {
      // watch each picture's parent: a fully clipped element never counts as visible
      var owner = new Map();
      var rio = new IntersectionObserver(function (entries) {
        var k = 0;
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          markIn(owner.get(en.target), k++ * 110);
          rio.unobserve(en.target);
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0 });
      reveals.forEach(function (el) { owner.set(el.parentElement, el); rio.observe(el.parentElement); });
    }
  }

  /* Page to page: the picture you click carries over and becomes the next page's hero
     (cross-document view transitions; browsers without them simply load the page) */
  if (!reduce && "onpagereveal" in window) {
    var clearNames = function () {
      document.querySelectorAll("[data-vt]").forEach(function (el) { el.style.viewTransitionName = ""; el.removeAttribute("data-vt"); });
    };
    var nameIt = function (el) { if (el) { el.style.viewTransitionName = "work"; el.setAttribute("data-vt", ""); } };
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest("a.piece, a.next-project, .index a");
      if (!a) return;
      clearNames();
      var heroImg = document.querySelector(".p-hero > img");
      if (heroImg) { heroImg.style.viewTransitionName = "none"; heroImg.setAttribute("data-vt", ""); }
      if (a.closest(".index")) {
        var pv = document.querySelector(".index-preview.is-on img");
        nameIt(pv);
      } else nameIt(a.querySelector(".frame img"));
    });
    // coming back to the home page: the project's card receives the picture
    window.addEventListener("pagereveal", function (e) {
      if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
      var from = navigation.activation.from.url || "";
      var m = /\/projects\/([^/?#.]+)/.exec(from);
      if (!m) return;
      var card = document.querySelector('a.piece[href*="projects/' + m[1] + '"] .frame img');
      if (!card) return;
      var r = card.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var box = card.closest(".reveal");
      if (box) markIn(box, 0);
      nameIt(card);
      e.viewTransition.finished.finally(clearNames);
    });
    window.addEventListener("pageshow", function (e) { if (e.persisted) clearNames(); });
  }

  /* Project index: a preview follows the cursor */
  var index = document.querySelector(".index");
  var prev = document.querySelector(".index-preview");
  if (index && prev && finePointer) {
    var pImg = prev.querySelector("img"), tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    var loop = function () {
      cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16;
      prev.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      raf = (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5) ? requestAnimationFrame(loop) : null;
    };
    var move = function (e) {
      tx = e.clientX + 28; ty = e.clientY - prev.offsetHeight / 2;
      if (tx + prev.offsetWidth > window.innerWidth - 16) tx = e.clientX - prev.offsetWidth - 28;
      if (reduce) { cx = tx; cy = ty; prev.style.transform = "translate3d(" + cx + "px," + cy + "px,0)"; return; }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    index.querySelectorAll("a[data-img]").forEach(function (a) {
      a.addEventListener("mouseenter", function (e) {
        if (!prev.classList.contains("is-on")) { cx = e.clientX + 28; cy = e.clientY - 120; }
        pImg.src = a.getAttribute("data-img"); prev.classList.add("is-on"); move(e);
      });
    });
    index.addEventListener("mousemove", move);
    index.addEventListener("mouseleave", function () { prev.classList.remove("is-on"); });
  }

  /* Film: load and play on request */
  document.querySelectorAll(".film").forEach(function (film) {
    var btn = film.querySelector(".play");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var frameBox = film.querySelector(".film-frame");
      var v = document.createElement("video");
      v.src = film.getAttribute("data-src"); v.poster = film.getAttribute("data-poster") || "";
      v.controls = true; v.playsInline = true; v.preload = "auto";
      frameBox.appendChild(v); film.classList.add("is-playing");
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      v.focus();
    });
  });

  /* Process: the image follows the step being read */
  var steps = Array.prototype.slice.call(document.querySelectorAll(".step"));
  var stack = Array.prototype.slice.call(document.querySelectorAll(".process-stack img"));
  if (steps.length && "IntersectionObserver" in window) {
    var activate = function (i) {
      steps.forEach(function (s, j) { s.classList.toggle("is-active", i === j); });
      stack.forEach(function (im, j) { im.classList.toggle("is-active", i === j); });
    };
    activate(0);
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) activate(steps.indexOf(en.target)); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(function (s) { so.observe(s); });
  }

  /* Palette viewer */
  var viewer = document.querySelector(".viewer");
  if (viewer) {
    var main = viewer.querySelector(".viewer-main"), cap = viewer.querySelector(".caption");
    var current = main.querySelector("img");
    viewer.querySelectorAll(".swatches button").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("aria-pressed") === "true") return;
        viewer.querySelectorAll(".swatches button").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        var next = new Image();
        next.alt = b.getAttribute("data-alt"); next.style.opacity = "0";
        next.src = b.getAttribute("data-src");
        next.sizes = "(max-width: 900px) 100vw, 60vw";
        if (b.getAttribute("data-srcset")) next.srcset = b.getAttribute("data-srcset");
        var show = function () {
          main.insertBefore(next, cap);
          requestAnimationFrame(function () { next.style.opacity = "1"; });
          var old = current; current = next;
          setTimeout(function () { if (old && old.parentNode) old.parentNode.removeChild(old); }, reduce ? 0 : 950);
          cap.textContent = b.getAttribute("data-alt");
        };
        if (next.decode) next.decode().then(show, show); else next.onload = show;
      });
    });
  }

  /* Drawing and render comparison slider */
  document.querySelectorAll(".compare").forEach(function (c) {
    var input = c.querySelector("input");
    var set = function () { c.style.setProperty("--pos", input.value + "%"); };
    input.addEventListener("input", set); set();
    // the first time it is seen, the divider sweeps once to show that it can be dragged
    if (reduce || !("IntersectionObserver" in window)) return;
    var touched = false, raf = 0;
    var stop = function () { touched = true; cancelAnimationFrame(raf); };
    ["pointerdown", "keydown", "focus"].forEach(function (t) { input.addEventListener(t, stop); });
    var cio = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      cio.disconnect();
      setTimeout(function () {
        if (touched) return;
        var t0 = performance.now(), D = 2200;
        var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
        var tick = function (now) {
          if (touched) return;
          var t = Math.min(1, (now - t0) / D);
          var v = 50 - 22 * Math.sin(ease(t) * Math.PI * 2);
          input.value = v.toFixed(1); set();
          if (t < 1) raf = requestAnimationFrame(tick); else { input.value = 50; set(); }
        };
        raf = requestAnimationFrame(tick);
      }, 900);
    }, { threshold: 0.6 });
    cio.observe(c);
  });

  /* Contact form */
  var form = document.getElementById("project-form");
  if (form) {
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      if (data._honey) return;
      if (form.getAttribute("data-mode") === "preview") {
        status.dataset.state = "ok";
        status.textContent = "Preview only. On the live site this sends your project details to " + form.getAttribute("data-email") + ".";
        return;
      }
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true; status.dataset.state = ""; status.textContent = "Sending…";
      data._subject = "New project inquiry from " + (data.name || "tovizy.com");
      data._template = "table";
      fetch(form.getAttribute("data-endpoint"), {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset(); status.dataset.state = "ok"; status.textContent = "Sent. We'll reply within 24 hours.";
      }).catch(function () {
        status.dataset.state = "error";
        status.textContent = "Your message didn't send. Email us at " + form.getAttribute("data-email") + " instead.";
      }).finally(function () { btn.disabled = false; });
    });
  }

  /* Lightbox on project pages */
  var dlg = document.querySelector(".lightbox");
  var thumbs = Array.prototype.slice.call(document.querySelectorAll(".gallery button[data-full]"));
  if (dlg && thumbs.length && typeof dlg.showModal === "function") {
    var big = dlg.querySelector("img"), lcap = dlg.querySelector(".lightbox-caption"), idx = 0;
    var show = function (i) {
      idx = (i + thumbs.length) % thumbs.length;
      var t = thumbs[idx];
      big.src = t.getAttribute("data-full"); big.alt = t.querySelector("img").alt;
      lcap.textContent = (idx + 1) + " of " + thumbs.length + ". " + big.alt;
    };
    thumbs.forEach(function (t, i) { t.addEventListener("click", function () { show(i); dlg.showModal(); }); });
    dlg.querySelector(".close").addEventListener("click", function () { dlg.close(); });
    dlg.querySelector(".prev").addEventListener("click", function () { show(idx - 1); });
    dlg.querySelector(".next-img").addEventListener("click", function () { show(idx + 1); });
    dlg.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }
})();
