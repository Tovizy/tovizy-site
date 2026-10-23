// Read side of the visit counter, for the studio's own computer only.
// GET /api/visits?since=YYYY-MM-DD with header x-tovizy-key: <key from agents\sdk\visits_key.txt>
// Returns:
//   pages:    {slug: {views, reads, sessions, first_seen, last_seen, countries}}  personal folios since `since`
//   events:   last 500 folio events, newest first
//   site:     whole-site page views: today / 7 / 30 days, by day (New York dates), top pages, sources, countries, devices
//   personal: folio summary: today / 7 / 30 days, top folios of the week
// Visits from Russia (the studio itself) are never stored. Pages starting with zz-test are checks and are skipped.
// Since 23.10.2026 a view needs a real action on the page (pv.js v3); earlier views are ignored, earlier reads kept.

const crypto = require("crypto");
const KEY_SHA256 = "2ec99af2ce72fd26f1565eed60ade71d0c71bb66d14f5be2dd22c2e10f449eb3";
const TZ = "America/New_York";
// Before this moment views were counted without a human check, and mail link scanners looked like visitors.
// Views ("p", "v") from before it are ignored; reads ("r") are kept.
const HUMAN_CHECK_FROM = "20261023t103000z";

function authorized(key) {
  if (!key) return false;
  const h = Buffer.from(crypto.createHash("sha256").update(key).digest("hex"));
  const want = Buffer.from(KEY_SHA256);
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}

const nyDate = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const q = req.query || {};
  const key = String(req.headers["x-tovizy-key"] || q.k || "").trim();
  if (!authorized(key)) return res.status(401).json({ error: "unauthorized" });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const hasStore = !!(token || process.env.BLOB_STORE_ID);
  const now = new Date();
  const out = { generated: now.toISOString(), store: hasStore, pages: {}, events: [], site: null, personal: null };
  if (!hasStore) return res.status(200).json(out);

  let since = String(q.since || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  // the site summary always needs the last 30 days
  const from30 = new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10);
  const listFrom = since < from30 ? since : from30;
  const months = [];
  let d = new Date(listFrom.slice(0, 7) + "-01T00:00:00Z");
  while (d <= now && months.length < 24) {
    months.push(d.toISOString().slice(0, 7));
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }

  const today = nyDate(now);
  const dayAgo = (n) => nyDate(new Date(now.getTime() - n * 864e5));
  const d7 = dayAgo(6), d30 = dayAgo(29);
  const site = { today: { views: 0, visitors: 0 }, d7: { views: 0, visitors: 0 }, d30: { views: 0, visitors: 0 }, by_day: [], pages_7d: {}, sources_7d: {}, utm_7d: {}, countries_7d: {}, devices_7d: {} };
  const personal = { today: { views: 0, reads: 0, firms: 0 }, d7: { views: 0, reads: 0, firms: 0 }, d30: { views: 0, reads: 0, firms: 0 }, top_7d: [] };
  const sv = { today: new Set(), d7: new Set(), d30: new Set() }, byDay = {}, byDayV = {};
  const pf = { today: new Set(), d7: new Set(), d30: new Set() }, week = {};
  const sessions = new Set();

  try {
    const { list } = await import("@vercel/blob");
    for (const m of months) {
      let cursor, pagesRead = 0;
      do {
        const r = await list({ prefix: `e/${m}/`, cursor, limit: 1000, ...(token ? { token } : {}) });
        for (const b of r.blobs || []) {
          const file = String(b.pathname || "").split("/").pop().replace(/\.txt$/, "");
          const f = file.split("_");
          if (f.length < 9) continue;
          const [ts, k, ccRaw, dev, sid, src, ref, target] = f;
          if (target.startsWith("zz-test")) continue;
          if (k !== "r" && ts < HUMAN_CHECK_FROM) continue;
          const t = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`;
          const day = nyDate(new Date(t));
          const cc = ccRaw === "x" ? "" : ccRaw.toUpperCase();
          const inToday = day === today, in7 = day >= d7, in30 = day >= d30;
          if (k === "p") {
            if (!in30) continue;
            const visitor = day + "|" + sid;
            site.d30.views++; sv.d30.add(sid);
            inc(byDay, day); (byDayV[day] = byDayV[day] || new Set()).add(sid);
            if (in7) {
              site.d7.views++; sv.d7.add(sid);
              inc(site.pages_7d, target === "home" ? "/" : "/" + target.replace(/\./g, "/"));
              inc(site.sources_7d, ref === "x" ? "direct" : ref);
              if (src !== "x") inc(site.utm_7d, src);
              if (cc) inc(site.countries_7d, cc);
              inc(site.devices_7d, dev === "m" ? "mobile" : "desktop");
            }
            if (inToday) { site.today.views++; sv.today.add(visitor); }
            continue;
          }
          // personal folio view / read
          if (in30) {
            const bucket = k === "r" ? "reads" : "views";
            personal.d30[bucket]++; if (k !== "r") pf.d30.add(target);
            if (in7) {
              personal.d7[bucket]++; if (k !== "r") pf.d7.add(target);
              const w = week[target] || (week[target] = { slug: target, views: 0, reads: 0, last_seen: t });
              w[bucket]++; if (t > w.last_seen) w.last_seen = t;
            }
            if (inToday) { personal.today[bucket]++; if (k !== "r") pf.today.add(target); }
          }
          if (ts.slice(0, 8) < since.replace(/-/g, "")) continue;
          out.events.push({ t, slug: target, kind: k === "r" ? "read" : "view", country: cc, device: dev === "m" ? "mobile" : "desktop",
                            session: sid === "x" ? "" : sid, src: src === "x" ? "" : src, ref: ref === "x" ? "" : ref, internal: false });
          const p = out.pages[target] || (out.pages[target] = { views: 0, reads: 0, sessions: 0, first_seen: t, last_seen: t, countries: {} });
          if (k === "r") p.reads += 1; else p.views += 1;
          if (t < p.first_seen) p.first_seen = t;
          if (t > p.last_seen) p.last_seen = t;
          const sk = target + "|" + sid;
          if (!sessions.has(sk)) { sessions.add(sk); p.sessions += 1; }
          if (cc) p.countries[cc] = (p.countries[cc] || 0) + 1;
        }
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor && ++pagesRead < 20);
    }
  } catch (e) {
    out.error = String((e && e.message) || e).slice(0, 200);
  }

  site.today.visitors = sv.today.size; site.d7.visitors = sv.d7.size; site.d30.visitors = sv.d30.size;
  for (let i = 29; i >= 0; i--) { const day = dayAgo(i); site.by_day.push({ date: day, views: byDay[day] || 0, visitors: (byDayV[day] || new Set()).size }); }
  site.pages_7d = top(site.pages_7d, 10); site.sources_7d = top(site.sources_7d, 10); site.utm_7d = top(site.utm_7d, 10);
  site.countries_7d = top(site.countries_7d, 8); site.devices_7d = top(site.devices_7d, 2);
  personal.today.firms = pf.today.size; personal.d7.firms = pf.d7.size; personal.d30.firms = pf.d30.size;
  personal.top_7d = Object.values(week).sort((a, b) => (b.last_seen > a.last_seen ? 1 : -1)).slice(0, 15);
  out.site = site; out.personal = personal;
  out.events.sort((a, b) => (a.t < b.t ? 1 : -1));
  out.events = out.events.slice(0, 500);
  return res.status(200).json(out);
};
