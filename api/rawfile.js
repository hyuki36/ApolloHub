// GET /raw/:slug/:key — raw giong GitHub (rewrite tu vercel.json).
// Browser mo -> NOT AUTHORIZED + ve #home, khong xem duoc source.
// Fetcher (.get/curl) + key dung -> loader 1 dong.
// Game (Roblox UA) + key dung -> SOURCE GOC.
const { clientKind, sendBlank, sendLua, safeEqual, buildRawLoader, getHost } = require('../lib/detect');
const { getScript } = require('../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  const q = req.query || {};
  const id = String(q.slug || q.s || q.id || '');
  const k = String(q.key || q.k || '');
  const kind = clientKind(req);
  if (!id) return sendBlank(res);

  const entry = await getScript(id);
  if (!entry) {
    if (kind === 'browser') return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] invalid link');
  }
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    if (kind === 'browser') return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] link expired');
  }
  if (entry.placeLock && q.place && String(q.place) !== String(entry.placeLock)) {
    if (kind === 'browser') return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] wrong game');
  }
  if (kind === 'browser') return sendBlank(res);
  if (!safeEqual(k, entry.k)) return sendLua(res, '-- [ApolloHub] invalid key');
  if (kind === 'roblox') return sendLua(res, entry.code);
  return sendLua(res, buildRawLoader(getHost(req), entry));
};
