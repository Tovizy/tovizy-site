/* Tovizy: quiet visit counter (v3).
   Counts only people: a view is sent after 3 s on screen AND a real action on the page
   (mouse move, tap, wheel or key). Mail link scanners open the page but never act, so they are not counted.
   Every page: one "page" event (once per page per tab session).
   Personal folios (/for/<slug>): "view" as above, "read" after 25 s on screen or half the page scrolled.
   No cookies, nothing personal: page name, a random per-tab id and the kind of link that led here.
   Skips automated browsers and our own visits (open any page once with #staff). */
(function () {
  try {
    if (window.__tzpv) return;
    window.__tzpv = 1;
    var path = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "") || "/";
    var m = path.match(/^\/for\/([a-z0-9-]+)$/);
    var slug = m ? m[1] : "";
    var ls = null;
    try { ls = window.localStorage; } catch (e) {}
    if (/(^|[#&?])staff\b/.test(location.hash + "&" + location.search.slice(1))) {
      try { ls && ls.setItem("tz_staff", "1"); } catch (e) {}
    }
    try { if (ls && ls.getItem("tz_staff")) return; } catch (e) {}
    if (navigator.webdriver) return;

    var ss = null;
    try { ss = window.sessionStorage; } catch (e) {}
    var sid = "";
    try {
      sid = (ss && ss.getItem("tz_sid")) || "";
      if (!sid) { sid = Math.random().toString(36).slice(2, 8); ss && ss.setItem("tz_sid", sid); }
    } catch (e) { sid = Math.random().toString(36).slice(2, 8); }

    var q = new URLSearchParams(location.search);
    var src = (q.get("utm_source") || q.get("s") || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
    var ref = "";
    try {
      var host = document.referrer ? new URL(document.referrer).hostname : "";
      if (host && host !== location.hostname) {
        ref = /mail|outlook|yahoo|proton|aol|icloud/.test(host) ? "mail"
          : /linkedin|lnkd/.test(host) ? "linkedin"
          : /instagram/.test(host) ? "instagram"
          : /facebook|fb\./.test(host) ? "facebook"
          : /houzz/.test(host) ? "houzz"
          : /pinterest|pin\.it/.test(host) ? "pinterest"
          : /youtube|youtu\.be/.test(host) ? "youtube"
          : /tiktok/.test(host) ? "tiktok"
          : /google|bing|duckduckgo|yandex/.test(host) ? "search"
          : "web";
      }
    } catch (e) {}

    function send(kind) {
      var body = JSON.stringify({ slug: slug, page: path, k: kind, sid: sid, src: src, ref: ref, h: 1 });
      try {
        if (navigator.sendBeacon && navigator.sendBeacon("/api/v", new Blob([body], { type: "text/plain" }))) return;
      } catch (e) {}
      try { fetch("/api/v", { method: "POST", body: body, keepalive: true, headers: { "content-type": "text/plain" } }); } catch (e) {}
    }

    // A person moves the mouse, taps, turns the wheel or presses a key. Scanners do none of these.
    var human = false, lastXY = "";
    function mark() { if (!human) { human = true; check(); } }
    addEventListener("pointermove", function (e) {
      var xy = e.screenX + "," + e.screenY;
      if (lastXY && xy !== lastXY) mark();
      lastXY = xy;
    }, { passive: true });
    ["pointerdown", "touchstart", "wheel", "keydown"].forEach(function (t) {
      addEventListener(t, mark, { passive: true });
    });

    var seenKey = "tz_p_" + path, seenPage = false;
    try { seenPage = !!(ss && ss.getItem(seenKey)); } catch (e) {}
    var seen = 0, sentV = false, sentR = false;
    function check() {
      if (!human) return;
      if (seen >= 3 && !sentV) {
        sentV = true;
        if (slug) send("v");
        else if (!seenPage) { send("p"); try { ss && ss.setItem(seenKey, "1"); } catch (e) {} }
      }
      if (slug && sentV && !sentR && seen >= 25) { sentR = true; send("r"); }
    }
    function tick() {
      if (document.visibilityState === "visible") { seen += 1; check(); }
      if (!sentV || (slug && !sentR)) setTimeout(tick, 1000);
    }
    setTimeout(tick, 1000);
    if (slug) addEventListener("scroll", function () {
      if (!human || !sentV || sentR) return;
      var h = document.documentElement;
      if ((h.scrollTop + innerHeight) / Math.max(1, h.scrollHeight) > 0.5) { sentR = true; send("r"); }
    }, { passive: true });
  } catch (e) {}
})();
