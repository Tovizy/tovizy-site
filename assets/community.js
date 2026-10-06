/* Cedar Hollow: interactive community demo. Map -> lot -> home -> rooms -> views. */
(function () {
  var dataEl = document.getElementById("cm-data");
  if (!dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var plans = {}, lots = {};
  D.plans.forEach(function (p) { plans[p.id] = p; });
  D.lots.forEach(function (l) { lots[l.n] = l; });

  var svg = document.querySelector(".plat");
  var lotEls = {};
  svg.querySelectorAll(".lot").forEach(function (g) { lotEls[g.getAttribute("data-lot")] = g; });
  var panel = document.querySelector(".cm-panel");
  var tip = document.querySelector(".cm-tip");
  var mapBox = document.querySelector(".cm-map");
  var grid = document.querySelector(".cm-grid");
  var list = document.querySelector(".cm-list");
  var planSel = document.getElementById("cm-plan");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var state = { filter: "all", plan: "", selected: null };

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
  var spaces = function (p) { return p.rooms.length === 1 ? p.rooms[0].name : plural(p.rooms.length, "space"); };

  /* ---------- filters ---------- */
  var matches = function (l) {
    if (state.filter !== "all" && l.status !== state.filter) return false;
    if (state.plan) return l.plan ? l.plan === state.plan : l.fits.indexOf(state.plan) > -1;
    return true;
  };
  var applyFilter = function () {
    D.lots.forEach(function (l) {
      var on = matches(l);
      lotEls[l.n].classList.toggle("is-dim", !on);
      var row = list.querySelector('tr[data-lot="' + l.n + '"]');
      if (row) row.hidden = !on;
    });
  };
  document.querySelectorAll("[data-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.filter = b.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      applyFilter();
    });
  });
  planSel.addEventListener("change", function () { state.plan = planSel.value; applyFilter(); });

  var setMode = function (m) {
    document.querySelectorAll("[data-mode]").forEach(function (o) { o.setAttribute("aria-pressed", o.getAttribute("data-mode") === m ? "true" : "false"); });
    grid.hidden = m !== "map";
    list.hidden = m !== "list";
  };
  document.querySelectorAll("[data-mode]").forEach(function (b) {
    b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
  });
  list.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open-lot]");
    if (!b) return;
    setMode("map");
    select(+b.getAttribute("data-open-lot"), true);
  });

  /* ---------- tooltip ---------- */
  svg.addEventListener("pointermove", function (e) {
    var g = e.target.closest(".lot");
    if (!g || e.pointerType !== "mouse") { tip.hidden = true; return; }
    var l = lots[g.getAttribute("data-lot")];
    tip.innerHTML = "<strong>Lot " + l.n + "</strong><span>" + esc(D.status[l.status]) + (l.plan ? ", " + esc(plans[l.plan].name) : "") +
      "</span><span>" + l.acres.toFixed(2) + " acres</span>";
    var r = mapBox.getBoundingClientRect();
    var x = e.clientX - r.left + 16, y = e.clientY - r.top + 16;
    if (x + 190 > r.width) x = e.clientX - r.left - 190;
    tip.style.transform = "translate(" + x + "px," + y + "px)";
    tip.hidden = false;
  });
  svg.addEventListener("pointerleave", function () { tip.hidden = true; });

  /* ---------- lot panel ---------- */
  var homeCard = function (p, label) {
    var v = p.rooms[0].views[0];
    return '<h3 class="cm-sub">' + label + '</h3><button class="cm-home" type="button" data-tour="' + p.id + '">' +
      '<span class="ph"><img src="' + v.src + '" srcset="' + v.srcset + '" sizes="(max-width: 900px) 100vw, 360px" alt="' + esc(v.alt) + '"></span>' +
      '<span class="nm">' + esc(p.name) + '</span><span class="bl">' + esc(p.blurb) + '</span>' +
      '<span class="go">Walk through the home, ' + plural(p.views, "view") + '</span></button>';
  };
  var render = function (l) {
    var h = '<div class="cm-lot"><p class="cm-status s-' + l.status + '"><span class="dot" aria-hidden="true"></span>' + esc(D.status[l.status]) + '</p>' +
      '<h2>Lot ' + l.n + '</h2><dl class="cm-facts"><dt>Lot size</dt><dd>' + l.acres.toFixed(2) + ' acres</dd><dt>Frontage</dt><dd>' + l.frontage +
      ' ft</dd><dt>Rear faces</dt><dd>' + cap(l.faces) + '</dd></dl>';
    if (l.plan) {
      h += homeCard(plans[l.plan], l.status === "model" ? "The model home, open for tours" : l.status === "sold" ? "The home sold on this lot" : "The home reserved on this lot");
    } else {
      h += '<h3 class="cm-sub">' + plural(l.fits.length, "home") + ' fit this lot</h3><ul class="cm-plans">' + l.fits.map(function (id) {
        var p = plans[id];
        return '<li><button type="button" data-tour="' + id + '"><img src="' + p.cover + '" alt="" width="88" height="62" loading="lazy">' +
          '<span><span class="nm">' + esc(p.name) + '</span><span class="mt">' + spaces(p) + ', ' + plural(p.views, "view") + '</span></span></button></li>';
      }).join("") + '</ul>';
    }
    h += '<div class="cm-actions"><button class="btn btn-solid" type="button" data-ask>Ask about Lot ' + l.n + '</button>' +
      '<p>The inquiry form below will name this lot' + (l.plan ? " and its home" : "") + '.</p></div></div>';
    panel.innerHTML = h;
  };
  var select = function (n, scroll) {
    if (state.selected && lotEls[state.selected]) {
      lotEls[state.selected].classList.remove("is-selected");
      lotEls[state.selected].removeAttribute("aria-pressed");
    }
    state.selected = n;
    var g = lotEls[n];
    g.classList.add("is-selected");
    g.setAttribute("aria-pressed", "true");
    g.parentNode.appendChild(g); // draw the selected outline above its neighbours
    render(lots[n]);
    try { history.replaceState(null, "", "#lot-" + n); } catch (err) {}
    if (scroll && window.innerWidth < 900) panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  svg.addEventListener("click", function (e) {
    var g = e.target.closest(".lot");
    if (g) select(+g.getAttribute("data-lot"), true);
  });
  svg.addEventListener("keydown", function (e) {
    var g = e.target.closest(".lot");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(+g.getAttribute("data-lot"), true); }
  });
  panel.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tour]");
    if (t) openTour(t.getAttribute("data-tour"), state.selected, t);
    if (e.target.closest("[data-ask]")) ask(state.selected, lots[state.selected].plan);
  });

  /* ---------- inquiry that names the lot ---------- */
  var ask = function (n, planId) {
    var form = document.getElementById("project-form");
    if (!form) return;
    var sel = form.querySelector("select[name=service]");
    Array.prototype.forEach.call(sel.options, function (o) { if (o.text === "Interactive community") sel.value = o.value; });
    var msg = form.querySelector("textarea[name=message]");
    var line = "Asked from the Cedar Hollow demo about Lot " + n + (planId ? " and " + plans[planId].name : "") + ".";
    if (msg.value.indexOf("Asked from the Cedar Hollow demo") === 0) msg.value = msg.value.replace(/^.*\n?\n?/, "");
    msg.value = line + "\n\n" + msg.value;
    document.getElementById("contact").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setTimeout(function () { msg.focus({ preventScroll: true }); msg.setSelectionRange(msg.value.length, msg.value.length); }, reduce ? 0 : 700);
  };

  /* ---------- tour ---------- */
  var dlg = document.querySelector(".tour");
  var frame = dlg.querySelector(".tour-frame");
  var roomsNav = dlg.querySelector(".tour-rooms");
  var thumbs = dlg.querySelector(".tour-thumbs");
  var capEl = dlg.querySelector(".tour-cap");
  var tools = dlg.querySelector(".tour-tools");
  var srcLink = dlg.querySelector(".tour-src");
  var T = { plan: null, lot: null, room: 0, view: 0, light: 0, compare: false, opener: null };
  var pic = document.createElement("div");
  pic.className = "tour-pic";
  pic.innerHTML = '<div class="tour-draw"><img alt=""></div><span class="bar" aria-hidden="true"></span>' +
    '<input type="range" min="0" max="100" value="50" aria-label="Slide between the drawing and the render">';
  frame.appendChild(pic);
  var drawImg = pic.querySelector(".tour-draw img");
  var range = pic.querySelector("input");
  range.addEventListener("input", function () { pic.style.setProperty("--pos", range.value + "%"); });
  var ar = 16 / 9;

  var fit = function () {
    var fw = frame.clientWidth, fh = frame.clientHeight;
    if (!fw || !fh) return;
    var w = Math.min(fw, fh * ar);
    pic.style.width = Math.round(w) + "px";
    pic.style.height = Math.round(w / ar) + "px";
  };
  window.addEventListener("resize", function () { if (dlg.open) fit(); });

  var cur = function () { return T.plan.rooms[T.room].views[T.view]; };
  var setImage = function (s) {
    var old = pic.querySelector("img.shot");
    var im = new Image();
    im.className = "shot";
    im.alt = s.alt;
    im.sizes = "(max-width: 900px) 100vw, 75vw";
    im.srcset = s.srcset;
    im.src = s.src;
    im.style.opacity = "0";
    pic.insertBefore(im, pic.querySelector(".tour-draw"));
    var show = function () {
      requestAnimationFrame(function () { im.style.opacity = "1"; });
      if (old) setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, reduce ? 0 : 750);
    };
    if (im.decode) im.decode().then(show, show); else im.onload = show;
  };

  var drawRooms = function () {
    roomsNav.innerHTML = T.plan.rooms.map(function (r, i) {
      return '<button type="button" data-room="' + i + '"' + (i === T.room ? ' aria-current="true"' : "") + '>' + esc(r.name) +
        '<span>' + plural(r.views.length, "view") + '</span></button>';
    }).join("");
  };
  var drawThumbs = function () {
    var r = T.plan.rooms[T.room];
    thumbs.innerHTML = r.views.length < 2 ? "" : r.views.map(function (v, i) {
      return '<button type="button" data-view="' + i + '" aria-label="View ' + (i + 1) + ': ' + esc(v.alt) + '"' +
        (i === T.view ? ' aria-current="true"' : "") + '><img src="' + v.thumb + '" alt="" loading="lazy"></button>';
    }).join("");
  };
  var drawTools = function (v) {
    var h = "";
    if (v.light) {
      h += '<div class="seg" role="group" aria-label="Light">' + v.light.map(function (L, i) {
        return '<button type="button" data-light="' + i + '" aria-pressed="' + (i === T.light) + '">' + esc(L.label) + '</button>';
      }).join("") + '</div>';
    }
    if (v.drawing) {
      h += '<button class="tog" type="button" data-compare aria-pressed="' + T.compare + '">' +
        (T.compare ? "Hide the drawing" : "Compare with the drawing") + '</button>';
    }
    tools.innerHTML = h;
  };

  var show = function () {
    var v = cur();
    var s = v.light ? v.light[T.light] : v;
    ar = v.w / v.h;
    fit();
    setImage({ src: s.src, srcset: s.srcset, alt: s.alt });
    if (v.drawing) { drawImg.srcset = v.drawing.srcset; drawImg.src = v.drawing.src; drawImg.alt = v.drawing.alt; }
    pic.classList.toggle("is-compare", !!(T.compare && v.drawing));
    var r = T.plan.rooms[T.room];
    capEl.innerHTML = "<strong>" + esc(r.name) + (r.views.length > 1 ? ", view " + (T.view + 1) + " of " + r.views.length : "") + "</strong>" + esc(s.alt);
    drawRooms(); drawThumbs(); drawTools(v);
    // warm the next view
    var nx = step(1, true);
    if (nx) { var pre = new Image(); pre.sizes = "75vw"; pre.srcset = nx.srcset; }
  };
  var step = function (d, peek) {
    var seq = [];
    T.plan.rooms.forEach(function (r, i) { r.views.forEach(function (v, j) { seq.push([i, j]); }); });
    var at = 0;
    seq.forEach(function (p, k) { if (p[0] === T.room && p[1] === T.view) at = k; });
    var n = seq[(at + d + seq.length) % seq.length];
    if (peek) return T.plan.rooms[n[0]].views[n[1]];
    T.room = n[0]; T.view = n[1]; T.light = 0; T.compare = false;
    show();
  };

  var openTour = function (pid, n, opener) {
    T.plan = plans[pid]; T.lot = n; T.room = 0; T.view = 0; T.light = 0; T.compare = false; T.opener = opener || null;
    dlg.querySelector(".tour-lot").textContent = "Lot " + n + ", " + (lots[n].plan ? D.status[lots[n].status].toLowerCase() : "available");
    dlg.querySelector("#tour-title").textContent = T.plan.name;
    srcLink.textContent = "Rendered for our " + T.plan.project + " project";
    srcLink.href = T.plan.url;
    dlg.querySelector(".tour-ask").textContent = "Ask about Lot " + n;
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { show(); });
  };
  dlg.addEventListener("close", function () {
    document.body.style.overflow = "";
    var g = T.lot && lotEls[T.lot];
    if (T.opener && document.body.contains(T.opener)) T.opener.focus({ preventScroll: true });
    else if (g) g.focus({ preventScroll: true });
  });
  dlg.querySelector(".tour-close").addEventListener("click", function () { dlg.close(); });
  dlg.querySelector(".tour-prev").addEventListener("click", function () { step(-1); });
  dlg.querySelector(".tour-next").addEventListener("click", function () { step(1); });
  dlg.querySelector(".tour-ask").addEventListener("click", function () {
    var n = T.lot, pid = T.plan.id;
    dlg.close();
    ask(n, pid);
  });
  roomsNav.addEventListener("click", function (e) {
    var b = e.target.closest("[data-room]");
    if (!b) return;
    T.room = +b.getAttribute("data-room"); T.view = 0; T.light = 0; T.compare = false;
    show();
  });
  thumbs.addEventListener("click", function (e) {
    var b = e.target.closest("[data-view]");
    if (!b) return;
    T.view = +b.getAttribute("data-view"); T.light = 0; T.compare = false;
    show();
  });
  tools.addEventListener("click", function (e) {
    var b = e.target.closest("[data-light]");
    if (b) { T.light = +b.getAttribute("data-light"); show(); return; }
    if (e.target.closest("[data-compare]")) {
      T.compare = !T.compare;
      if (T.compare) { range.value = 50; pic.style.setProperty("--pos", "50%"); }
      pic.classList.toggle("is-compare", T.compare);
      drawTools(cur());
      var t = tools.querySelector("[data-compare]");
      if (t) t.focus();
    }
  });
  dlg.addEventListener("keydown", function (e) {
    if (e.target === range) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
  });
  // swipe between views on touch screens
  var sx = null, sy = null;
  frame.addEventListener("touchstart", function (e) { if (pic.classList.contains("is-compare")) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  frame.addEventListener("touchend", function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    sx = null;
  });

  /* keep the panel as tall as the plan on wide screens; it scrolls inside */
  var sync = function () {
    panel.style.maxHeight = window.innerWidth > 900 ? mapBox.offsetHeight + "px" : "";
  };
  window.addEventListener("resize", sync);
  sync();

  /* on narrow screens start the plan scrolled to its centre */
  var sc = document.querySelector(".cm-scroll");
  if (sc && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;

  /* ---------- deep link: #lot-12 ---------- */
  var m = /^#lot-(\d+)$/.exec(location.hash);
  if (m && lots[m[1]]) select(+m[1], false);
})();
