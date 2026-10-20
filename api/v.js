// Open counter for personal folios (/for/<slug>). Called by /assets/pv.js.
// Stores one empty marker file per event in Vercel Blob; everything is in the file name.
// Nothing personal is kept: no IP, no cookies, only country code and device type.

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|python|curl|wget|httpclient|scanner|proofpoint|mimecast|barracuda|safelinks|phantom|puppeteer|playwright/i;
let access = null; // "private" or "public", learned on the first write

function clean(s, n) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, n) || "x";
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  // Vercel connects the store through OIDC (BLOB_STORE_ID); an explicit read-write token also works.
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const hasStore = !!(token || process.env.BLOB_STORE_ID);
  if (req.method === "GET") return res.status(200).json({ ok: true, store: hasStore });
  if (req.method !== "POST") return res.status(405).end();
  try {
    let b = req.body;
    if (Buffer.isBuffer(b)) b = b.toString("utf8");
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    if (!b || typeof b !== "object") b = {};
    const slug = String(b.slug || "").toLowerCase();
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) return res.status(204).end();
    const ua = String(req.headers["user-agent"] || "");
    if (!ua || BOT.test(ua)) return res.status(204).end();

    const kind = b.k === "r" ? "r" : "v";
    const now = new Date();
    const ts = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "z").toLowerCase(); // 20261020t175600z
    const month = now.toISOString().slice(0, 7);
    const cc = clean(req.headers["x-vercel-ip-country"], 2);
    const dev = /mobi|iphone|ipad|android/i.test(ua) ? "m" : "d";
    const name = [ts, kind, cc, dev, clean(b.sid, 8), clean(b.src, 12), clean(b.ref, 12), Math.random().toString(36).slice(2, 6)].join("_");
    const path = `v/${month}/${slug}/${name}.txt`;

    if (!hasStore) { console.log("pv (no store yet)", path); return res.status(204).end(); }
    const { put } = await import("@vercel/blob");
    const opts = (a) => ({ access: a, addRandomSuffix: false, contentType: "text/plain", ...(token ? { token } : {}) });
    if (access) {
      await put(path, "1", opts(access));
    } else {
      try { await put(path, "1", opts("private")); access = "private"; }
      catch (e) { await put(path, "1", opts("public")); access = "public"; }
    }
    return res.status(204).end();
  } catch (e) {
    console.error("pv error", e && e.message);
    return res.status(204).end();
  }
};
