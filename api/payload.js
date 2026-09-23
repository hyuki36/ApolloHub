// GET /api/payload?s=<slug|id>&k=<key>&hwid=..&place=..
// Style sodium gon: moi script 1 Script Key (s=) + key (k=) rieng, khong load nham.
const { isBrowser, sendBlank, sendLua, safeEqual } = require('../lib/detect');
const { getScript } = require('../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  const q = req.query || {};
  const id = String(q.s || q.id || q.slug || '');
  const k = String(q.k || '');
  if (!id) return sendBlank(res);

  const entry = await getScript(id);
  if (!entry) {
    if (isBrowser(req)) return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] invalid link');
  }
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    if (isBrowser(req)) return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] link expired');
  }
  if (entry.placeLock && q.place && String(q.place) !== String(entry.placeLock)) {
    if (isBrowser(req)) return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] wrong game');
  }
  if (isBrowser(req)) return sendBlank(res);
  if (!safeEqual(k, entry.k)) return sendLua(res, '-- [ApolloHub] invalid key');
  return sendLua(res, entry.code);
};
