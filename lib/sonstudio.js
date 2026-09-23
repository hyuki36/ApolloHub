// SonStudio key gate — endpoint public, khong can secret.
// Script nao gan sonSlug (game_slug ben SonStudio) thi:
//   game/fetcher phai dua ?key=<key SonStudio cua user> + hwid,
//   server verify qua SonStudio, hop le moi tra source goc.
// Khong gan sonSlug -> giu nguyen behavior cu.

const BASE = process.env.SONSTUDIO_BASE || 'https://loader-sonstudio.up.railway.app';
const TTL = 60 * 1000;
const MAX_CACHE = 500;
const verdicts = new Map();

function cleanSlug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60);
}

function cacheGet(ck) {
  const hit = verdicts.get(ck);
  if (hit && Date.now() - hit.at < TTL) return { ok: hit.ok, msg: hit.msg };
  if (hit) verdicts.delete(ck);
  return null;
}

function cacheSet(ck, out) {
  if (verdicts.size >= MAX_CACHE) {
    const first = verdicts.keys().next();
    if (!first.done) verdicts.delete(first.value);
  }
  verdicts.set(ck, { ok: out.ok, msg: out.msg, at: Date.now() });
}

async function verifyKey({ gameSlug, key, hwid, placeId }) {
  // -> { ok, msg }. Loi mang/timeout -> fail-open (Railway free hay sleep),
  // con SonStudio tra invalid ro rang -> chan.
  key = String(key || '');
  hwid = String(hwid || '');
  gameSlug = String(gameSlug || '');
  if (!gameSlug || !key) return { ok: false, msg: 'missing key' };
  const ck = gameSlug + '' + key + '' + hwid;
  const hit = cacheGet(ck);
  if (hit) return hit;
  try {
    const u = BASE + '/api/v1/key/status'
      + '?key=' + encodeURIComponent(key)
      + '&hwid=' + encodeURIComponent(hwid)
      + '&place_id=' + encodeURIComponent(Number(placeId) || 0)
      + '&game_slug=' + encodeURIComponent(gameSlug);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    let r;
    try {
      r = await fetch(u, { headers: { 'User-Agent': 'ApolloHub' }, signal: ctrl.signal });
    } finally { clearTimeout(t); }
    if (!r.ok) return { ok: true, msg: 'verify-unreachable (fail-open)' };
    const j = await r.json();
    const data = (j && j.data) || {};
    const ok = Boolean(j && j.success && data.valid === true);
    const msg = String(data.message || (ok ? 'ok' : 'invalid')).slice(0, 120).replace(/[\r\n]+/g, ' ');
    const out = { ok, msg };
    cacheSet(ck, out);
    return out;
  } catch {
    return { ok: true, msg: 'verify-unreachable (fail-open)' };
  }
}

module.exports = { cleanSlug, verifyKey };
