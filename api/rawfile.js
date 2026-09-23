// GET /raw/:slug[.lua][?key=USERKEY] — raw giong GitHub.
// Mac dinh KHONG can key. Neu script gan sonSlug (game_slug SonStudio)
// thi user phai dua ?key=<key SonStudio> hop le moi duoc phuc vu.
const { clientKind, sendBlank, sendLua, buildRawLoader, getHost } = require('../lib/detect');
const { getScript } = require('../lib/store');
const { verifyKey } = require('../lib/sonstudio');

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
  // Public sources (giong SonStudio public): ai cung doc duoc source goc.
  // Chu script tu obfuscate truoc khi gan.
  if (entry.isPublic) return sendLua(res, entry.code);
  if (kind === 'browser') return sendBlank(res);
  // SonStudio gate: chi kich hoat khi script gan sonSlug.
  if (entry.sonSlug) {
    const v = await verifyKey({ gameSlug: entry.sonSlug, key: q.key || q.k, hwid: q.hwid, placeId: q.place });
    if (!v.ok) return sendLua(res, '-- [ApolloHub] key rejected: ' + v.msg);
  }
  if (kind === 'roblox') return sendLua(res, entry.code);
  return sendLua(res, buildRawLoader(getHost(req), entry));
};
