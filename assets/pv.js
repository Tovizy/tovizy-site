/* Tovizy: quiet open counter for personal folios (/for/<slug>).
   No cookies, nothing personal: the page name, a random per-tab id and the kind of link that led here.
   Skips automated browsers, link scanners and our own visits (open any page once with #staff). */
(function () {
  try {
    var m = location.pathname.match(/^\/for\/([a-z0-9-]+?)(?:\.html)?\/?$/);
    if (!m) return;
    var slug = m[1];
    var ls = null;
    try { ls = window.localStorage; } catch (e) {}
    if (/(^|[#&?])staff\b/.test(location.hash + "&" + location.search.slice(1))) {
      try { ls && ls.setItem("tz_staff", "1"); } catch (e) {}
    }
    try { if (ls && ls.getItem("tz_staff")) return; } catch (e) {}
    if (navigator.webdriver) return;

    var sid = "";
    try {
      sid = sessionStorage.getItem("tz_sid") || "";
      if (!sid) { sid = Math.random().toString(36).slice(2, 8); sessionStorage.setItem("tz_sid", sid); }
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
          : /pinterest/.test(host) ? "pinterest"
          : /google|bing|duckduckgo/.test(host) ? "search"
          : "web";
      }
    } catch (e) {}

    function send(kind) {
      var body = JSON.stringify({ slug: slug, k: kind, sid: sid, src: src, ref: ref });
      try {
        if (navigator.sendBeacon && navigator.sendBeacon("/api/v", new Blob([body], { type: "text/plain" }))) return;
      } catch (e) {}
      try { fetch("/api/v", { method: "POST", body: body, keepalive: true, headers: { "content-type": "text/plain" } }); } catch (e) {}
    }

    // "view" after 3 s on screen, "read" after 25 s on screen or half the page scrolled
    var seen = 0, sentV = false, sentR = false;
    function tick() {
      if (document.visibilityState === "visible") {
        seen += 1;
        if (!sentV && seen >= 3) { sentV = true; send("v"); }
        if (sentV && !sentR && seen >= 25) { sentR = true; send("r"); }
      }
      if (!sentR) setTimeout(tick, 1000);
    }
    setTimeout(tick, 1000);
    addEventListener("scroll", function () {
      if (!sentV || sentR) return;
      var h = document.documentElement;
      if ((h.scrollTop + innerHeight) / Math.max(1, h.scrollHeight) > 0.5) { sentR = true; send("r"); }
    }, { passive: true });
  } catch (e) {}
})();
