// Read side of the open counter, for the studio's own computer only.
// GET /api/visits?since=YYYY-MM-DD with header x-tovizy-key: <key from agents\sdk\visits_key.txt>
// Returns {generated, store, pages: {slug: {views, reads, sessions, first_seen, last_seen, countries}}, events: [...]}
// Views from Russia are the studio's own checks: they are listed in events with internal=true and left out of pages.

const crypto = require("crypto");
const KEY_SHA256 = "2ec99af2ce72fd26f1565eed60ade71d0c71bb66d14f5be2dd22c2e10f449eb3";
const INTERNAL = new Set(["RU"]);

function authorized(key) {
  if (!key) return false;
  const h = Buffer.from(crypto.createHash("sha256").update(key).digest("hex"));
  const want = Buffer.from(KEY_SHA256);
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const q = req.query || {};
  const key = String(req.headers["x-tovizy-key"] || q.k || "").trim();
  if (!authorized(key)) return res.status(401).json({ error: "unauthorized" });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const hasStore = !!(token || process.env.BLOB_STORE_ID);
  const out = { generated: new Date().toISOString(), store: hasStore, pages: {}, events: [] };
  if (!hasStore) return res.status(200).json(out);

  let since = String(q.since || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const sinceCompact = since.replace(/-/g, "");
  const months = [];
  let d = new Date(since.slice(0, 7) + "-01T00:00:00Z");
  const end = new Date();
  while (d <= end && months.length < 24) {
    months.push(d.toISOString().slice(0, 7));
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }

  try {
    const { list } = await import("@vercel/blob");
    const sessions = new Set();
    for (const m of months) {
      let cursor;
      let pages = 0;
      do {
        const r = await list({ prefix: `v/${m}/`, cursor, limit: 1000, ...(token ? { token } : {}) });
        for (const b of r.blobs || []) {
          const parts = String(b.pathname || "").split("/");
          if (parts.length !== 4) continue;
          const slug = parts[2];
          const f = parts[3].replace(/\.txt$/, "").split("_");
          if (f.length < 7) continue;
          const [ts, k, ccRaw, dev, sid, src, ref] = f;
          if (ts.slice(0, 8) < sinceCompact) continue;
          const t = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`;
          const country = ccRaw === "x" ? "" : ccRaw.toUpperCase();
          const internal = INTERNAL.has(country);
          out.events.push({
            t, slug, kind: k === "r" ? "read" : "view", country,
            device: dev === "m" ? "mobile" : "desktop", session: sid === "x" ? "" : sid,
            src: src === "x" ? "" : src, ref: ref === "x" ? "" : ref, internal,
          });
          if (internal) continue;
          const p = out.pages[slug] || (out.pages[slug] = { views: 0, reads: 0, sessions: 0, first_seen: t, last_seen: t, countries: {} });
          if (k === "r") p.reads += 1; else p.views += 1;
          if (t < p.first_seen) p.first_seen = t;
          if (t > p.last_seen) p.last_seen = t;
          const sk = slug + "|" + sid;
          if (!sessions.has(sk)) { sessions.add(sk); p.sessions += 1; }
          if (country) p.countries[country] = (p.countries[country] || 0) + 1;
        }
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor && ++pages < 20);
    }
  } catch (e) {
    out.error = String((e && e.message) || e).slice(0, 200);
  }
  out.events.sort((a, b) => (a.t < b.t ? 1 : -1));
  out.events = out.events.slice(0, 500);
  return res.status(200).json(out);
};
