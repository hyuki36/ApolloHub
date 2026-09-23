// GET /raw/:slug[.lua][/ :key] — raw giong GitHub, KHONG can key.
// Browser mo -> NOT AUTHORIZED + ve #home, khong xem duoc source.
// Fetcher (.get/curl) -> loader 1 dong (load trong game van ra source goc).
// Game (Roblox UA) -> SOURCE GOC.
const { clientKind, sendBlank, sendLua, buildRawLoader, getHost } = require('../lib/detect');
const { getScript } = require('../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  const q = req.query || {};
  // Chap nhan .lua o cuoi cho giong file that: /raw/myscript.lua
  const id = String(q.slug || q.s || q.id || '').replace(/\.lua$/i, '');
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
  // Khong can key: game that -> source goc, fetcher -> loader 1 dong.
  if (kind === 'roblox') return sendLua(res, entry.code);
  return sendLua(res, buildRawLoader(getHost(req), entry));
};
