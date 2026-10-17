(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var dataEl = document.getElementById("es-data");
  if (!dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var A = "assets/estate/";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- the map: settle in, pins drop, a card follows the homesite under the pointer ---------------- */
  var map = $(".es-map"), scroller = $(".es-scroll"), tip = $(".es-tip");
  var aerial = $(".es-aerial");
  var settle = function () { requestAnimationFrame(function () { map.classList.add("es-ready"); }); };
  if (aerial.complete) settle(); else { aerial.addEventListener("load", settle); setTimeout(settle, 2500); }
  // on phones the aerial scrolls sideways: start with the model home in view
  var centreMap = function () {
    if (scroller.scrollWidth > scroller.clientWidth + 4) scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) * 0.62;
  };
  centreMap(); window.addEventListener("load", centreMap);

  var lotBy = {}; D.lots.forEach(function (L) { lotBy[L.n] = L; });
  var showTip = function (pin) {
    var L = lotBy[pin.getAttribute("data-lot")];
    tip.innerHTML = '<h3>Homesite ' + L.n + '</h3><p>' + L.acres.toFixed(2) + ' acres · ' + D.home + '</p>' +
      '<p class="st s-' + L.status + '"><span class="sw"></span>' + D.status[L.status] + '</p><p class="go">' + (fine ? "Click" : "Tap") + ' to see the home</p>';
    tip.hidden = false;
    var r = pin.getBoundingClientRect(), m = map.getBoundingClientRect();
    var x = r.left + r.width / 2 - m.left, y = r.top - m.top;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.max(12, Math.min(m.width - w - 12, x - w / 2));
    var top = y - h - 14; if (top < 80) top = y + r.height + 40;
    tip.style.left = left + "px"; tip.style.top = top + "px";
  };
  var hideTip = function () { tip.hidden = true; };
  $$(".es-pin").forEach(function (pin) {
    if (fine) { pin.addEventListener("mouseenter", function () { showTip(pin); }); pin.addEventListener("mouseleave", hideTip); }
    pin.addEventListener("focus", function () { showTip(pin); });
    pin.addEventListener("blur", hideTip);
    pin.addEventListener("click", function () { hideTip(); choose(+pin.getAttribute("data-lot"), true); });
  });
  // a slow drift toward the pointer, like leaning over the site model
  if (fine && !reduce) {
    var canvas = $(".es-canvas");
    map.addEventListener("pointermove", function (e) {
      var r = map.getBoundingClientRect();
      canvas.style.setProperty("--ox", (50 + ((e.clientX - r.left) / r.width - .5) * 30).toFixed(1) + "%");
      canvas.style.setProperty("--oy", (50 + ((e.clientY - r.top) / r.height - .5) * 30).toFixed(1) + "%");
      canvas.style.setProperty("--zoom", "1.025");
    });
    map.addEventListener("pointerleave", function () { canvas.style.setProperty("--zoom", "1"); });
  }

  /* ---------------- the home ---------------- */
  var lotLabel = $(".es-lot-label"), pill = $(".es-status-pill"), acres = $(".es-acres");
  var current = 6;
  var choose = function (n, go) {
    var L = lotBy[n]; current = n;
    lotLabel.textContent = "Homesite " + n;
    pill.className = "es-status-pill s-" + L.status; pill.textContent = D.status[L.status];
    acres.textContent = L.acres.toFixed(2) + " acres";
    $$(".es-pin").forEach(function (p) { p.setAttribute("aria-current", +p.getAttribute("data-lot") === n ? "true" : "false"); });
    if (go) document.getElementById("home").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  var stage = $(".es-stage"), range = $("#es-t");
  var capDesign = $(".es-cap-design"), capTime = $(".es-cap-time");
  var S = { facade: "limestone", outdoor: "garden", t: 0 };
  var NAMES = {}; $$(".es-sw").forEach(function (b) { NAMES[b.getAttribute("data-facade") || b.getAttribute("data-outdoor")] = b.querySelector("b").textContent; });
  var keyOf = function () { return S.outdoor !== "garden" ? S.outdoor : S.facade; };
  var big = function () { return (stage.clientWidth * (window.devicePixelRatio || 1)) > 1400 ? 2560 : 1280; };
  var makeStack = function (key) {
    var st = document.createElement("div");
    st.className = "es-stack"; st.setAttribute("data-key", key);
    ["day", "dusk", "night"].forEach(function (t) {
      var im = new Image(); im.alt = ""; im.className = "l-" + t; im.decoding = "async";
      im.src = A + "house-" + key + "-" + t + "-" + big() + ".webp?v=" + (D.v || 1);
      st.appendChild(im);
    });
    return st;
  };
  var applyTime = function (stack) {
    var t = S.t, ims = stack.querySelectorAll("img");
    ims[1].style.opacity = Math.max(0, Math.min(1, t)).toFixed(3);
    ims[2].style.opacity = Math.max(0, Math.min(1, t - 1)).toFixed(3);
  };
  var clock = function (t) {   // 0 -> 2:00 pm, 1 -> 7:45 pm, 2 -> 9:30 pm
    var m = t <= 1 ? 840 + t * 345 : 1185 + (t - 1) * 105;
    m = Math.round(m / 5) * 5;
    var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return h + ":" + (mm < 10 ? "0" : "") + mm + " " + ap;
  };
  var phase = function (t) { return t < 0.5 ? "Day" : t < 1.5 ? "Dusk" : "Night"; };
  var setT = function (t) {
    S.t = t;
    $$(".es-stack", stage).forEach(applyTime);
    capTime.textContent = phase(t) + " · " + clock(t);
    range.value = Math.round(t * 100);
    range.setAttribute("aria-valuetext", phase(t) + ", " + clock(t));
  };
  var caption = function () { capDesign.textContent = NAMES[S.facade] + " · " + NAMES[S.outdoor]; };
  // first stack, rendered on the server as an empty div
  var first = $(".es-stack", stage), init = makeStack(keyOf());
  stage.replaceChild(init, first);
  // each change gets a number; only the newest one may land, and a landing stack removes only what lies under it
  var gen = 0, wanted = keyOf(), cap = $(".es-cap", stage);
  var line = document.createElement("span"); line.className = "es-line"; line.setAttribute("aria-hidden", "true"); stage.insertBefore(line, cap);
  var swap = function () {
    var key = keyOf();
    if (key === wanted) return;
    wanted = key;
    var my = ++gen;
    var nx = makeStack(key);
    applyTime(nx);
    var imgs = Array.prototype.slice.call(nx.querySelectorAll("img"));
    var ready = Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }));
    ready.then(function () {
      if (my !== gen) return;                       // a newer choice arrived while this one was loading
      var under = $$(".es-stack", stage);
      if (!reduce) nx.classList.add("is-entering");
      stage.insertBefore(nx, cap);
      var clear = function () { under.forEach(function (s) { if (s.parentNode) s.remove(); }); nx.classList.remove("is-entering", "go"); line.classList.remove("go"); };
      if (reduce) { clear(); return; }
      line.classList.remove("go"); void line.offsetWidth;
      requestAnimationFrame(function () { requestAnimationFrame(function () { nx.classList.add("go"); line.classList.add("go"); }); });
      setTimeout(clear, 1250);
    });
  };
  var press = function (group, val) {
    $$("[data-" + group + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + group) === val ? "true" : "false"); });
  };
  var note = $(".es-note");
  $$("[data-facade]").forEach(function (b) {
    b.addEventListener("click", function () {
      S.facade = b.getAttribute("data-facade");
      if (S.facade !== "limestone" && S.outdoor !== "garden") { S.outdoor = "garden"; press("outdoor", "garden"); note.hidden = false; }
      press("facade", S.facade); caption(); swap();
    });
  });
  $$("[data-outdoor]").forEach(function (b) {
    b.addEventListener("click", function () {
      S.outdoor = b.getAttribute("data-outdoor");
      if (S.outdoor !== "garden" && S.facade !== "limestone") { S.facade = "limestone"; press("facade", "limestone"); note.hidden = false; }
      press("outdoor", S.outdoor); caption(); swap();
    });
  });
  range.addEventListener("input", function () { stopPlay(); setT(range.value / 100); });

  // play the light from noon to night (and once, on its own, the first time the house comes into view)
  var playRaf = 0;
  var stopPlay = function () { if (playRaf) cancelAnimationFrame(playRaf); playRaf = 0; };
  var play = function (from, to, ms) {
    stopPlay();
    var t0 = performance.now();
    var step = function (now) {
      var k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setT(from + (to - from) * e);
      playRaf = k < 1 ? requestAnimationFrame(step) : 0;
    };
    playRaf = requestAnimationFrame(step);
  };
  $(".es-play").addEventListener("click", function () { play(S.t >= 1.95 ? 0 : S.t, 2, reduce ? 1 : 4200 * (2 - (S.t >= 1.95 ? 0 : S.t)) / 2); });
  if (!reduce && "IntersectionObserver" in window) {
    var once = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { once.disconnect(); setTimeout(function () { if (S.t === 0) play(0, 1, 2600); }, 500); }
    }, { threshold: 0.55 });
    once.observe(stage);
  }
  $(".es-full").addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen().catch(function () {});
  });

  // the inquiry carries the homesite and the choices
  $(".es-ask").addEventListener("click", function () {
    var msg = document.querySelector("#project-form textarea[name=message]");
    if (msg) {
      msg.value = D.name + " demo: Homesite " + current + ", " + D.home + ", " + NAMES[S.facade] + " facade, " + NAMES[S.outdoor].toLowerCase() +
        ", seen at " + phase(S.t).toLowerCase() + ".\n\nWe would like the same for our community: ";
    }
    var c = document.getElementById("contact");
    c.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    if (msg) setTimeout(function () { msg.focus({ preventScroll: true }); msg.setSelectionRange(msg.value.length, msg.value.length); }, reduce ? 0 : 900);
  });
  caption(); setT(0); choose(6, false);

  /* ---------------- inside: rooms and the 360° view ---------------- */
  var room = $(".es-room"), panoBox = $(".es-pano"), tabs = $$(".es-tabs [role=tab]");
  var hotBed = $('.es-hot[data-go="bedroom"]'), hotPano = $('.es-hot[data-go="pano"]');
  var Pano = null;
  var show = function (which) {
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-room") === which ? "true" : "false"); });
    $$(".es-room-img", room).forEach(function (im) { im.classList.toggle("is-on", im.getAttribute("data-room") === which || (which === "pano" && im.getAttribute("data-room") === "bedroom")); });
    hotBed.hidden = which !== "living"; hotPano.hidden = which !== "bedroom";
    panoBox.hidden = which !== "pano";
    if (which === "pano") { if (!Pano) Pano = makePano(panoBox); if (Pano) Pano.load(); }
  };
  tabs.forEach(function (t) {
    t.addEventListener("click", function () { show(t.getAttribute("data-room")); });
    t.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(t), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); var n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); n.click(); }
    });
  });
  $$(".es-hot").forEach(function (h) { h.addEventListener("click", function () { show(h.getAttribute("data-go")); }); });

  function makePano(box) {
    var cv = box.querySelector("canvas");
    var gl = cv.getContext("webgl", { antialias: false }) || cv.getContext("experimental-webgl");
    if (!gl) return null;
    var sh = function (type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,
      "precision highp float;varying vec2 v;uniform sampler2D t;uniform float yaw,pitch,f,asp;" +
      "void main(){vec3 d=normalize(vec3(v.x*f*asp,v.y*f,-1.));" +
      "float c=cos(pitch),s=sin(pitch);d=vec3(d.x,d.y*c-d.z*s,d.y*s+d.z*c);" +
      "c=cos(yaw);s=sin(yaw);d=vec3(d.x*c-d.z*s,d.y,d.x*s+d.z*c);" +
      "gl_FragColor=texture2D(t,vec2(atan(d.x,-d.z)/6.2831853+.5,acos(clamp(d.y,-1.,1.))/3.1415927));}"));
    gl.linkProgram(prog); gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ["yaw", "pitch", "f", "asp"].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    var tex = gl.createTexture();
    var st = { yaw: 0.35, pitch: -0.06, fov: 82, ready: false, idle: true, raf: 0, loaded: false, spin: 0 };
    var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    var draw = function () {
      st.raf = 0;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (!w || !h) return;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
      if (!st.ready) { gl.clearColor(0.05, 0.08, 0.07, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
      // arrive with a quick turn, then drift until touched
      if (st.spin > 0) { st.yaw += st.spin; st.spin *= 0.94; if (st.spin < 0.0008) st.spin = 0; }
      gl.uniform1f(U.yaw, st.yaw); gl.uniform1f(U.pitch, st.pitch);
      gl.uniform1f(U.f, Math.tan(st.fov * Math.PI / 360)); gl.uniform1f(U.asp, w / h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!box.hidden && (st.spin > 0 || (st.idle && !reduce))) { if (!st.spin) st.yaw += 0.0007; kick(); }
    };
    var kick = function () { if (!st.raf) st.raf = requestAnimationFrame(draw); };
    var load = function () {
      if (st.loaded) { kick(); return; }
      st.loaded = true;
      var url = maxTex >= 8192 && window.innerWidth > 900 ? box.getAttribute("data-src8") : box.getAttribute("data-src4");
      box.classList.add("is-loading"); kick();
      var im = new Image();
      im.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        st.ready = true; st.spin = reduce ? 0 : 0.045;
        box.classList.remove("is-loading"); kick();
      };
      im.src = url;
    };
    var ptrs = {}, pinch = 0;
    var look = function (dx, dy) {
      var hf = st.fov * Math.PI / 180, asp = cv.clientWidth / Math.max(cv.clientHeight, 1);
      st.yaw -= dx / Math.max(cv.clientWidth, 1) * hf * asp;
      st.pitch = Math.max(-1.45, Math.min(1.45, st.pitch + dy / Math.max(cv.clientHeight, 1) * hf));
      kick();
    };
    var zoom = function (k) { st.fov = Math.max(35, Math.min(100, st.fov * k)); kick(); };
    cv.addEventListener("pointerdown", function (e) { st.idle = false; st.spin = 0; ptrs[e.pointerId] = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); box.classList.add("is-touched"); });
    cv.addEventListener("pointermove", function (e) {
      if (!ptrs[e.pointerId]) return;
      var ids = Object.keys(ptrs);
      if (ids.length === 2) {
        ptrs[e.pointerId] = [e.clientX, e.clientY];
        var a = ptrs[ids[0]], b = ptrs[ids[1]], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) zoom(pinch / dist); pinch = dist; return;
      }
      var p = ptrs[e.pointerId]; look(e.clientX - p[0], e.clientY - p[1]); ptrs[e.pointerId] = [e.clientX, e.clientY];
    });
    var up = function (e) { delete ptrs[e.pointerId]; pinch = 0; };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", function (e) { e.preventDefault(); st.idle = false; zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
    cv.addEventListener("keydown", function (e) {
      var k = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] }[e.key];
      if (k) { e.preventDefault(); st.idle = false; st.spin = 0; look(k[0], k[1]); }
    });
    window.addEventListener("resize", kick);
    return { load: load };
  }
})();
