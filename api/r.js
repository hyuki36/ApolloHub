// GET /api/r?id=<id|slug>&k=<key>&hwid=<hwid>&place=<placeId>
// 3 tang: browser -> trang den | roblox+key -> SOURCE GOC | fetcher+key -> SOURCE LOADER.

const { clientKind, sendBlank, sendLua, safeEqual, buildPayloadLoader, getHost } = require('../lib/detect');
const { getScript } = require('../lib/store');
const { verifyKey } = require('../lib/sonstudio');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  const q = req.query || {};
  const id = String(q.id || q.s || q.slug || '');
  const k = String(q.k || q.key || '');
  const kind = clientKind(req);

  // Khong co id -> gia vo nhu web chet, khong lo gi.
  if (!id) return sendBlank(res);

  const entry = await getScript(id);
  if (!entry) {
    if (kind === 'browser') return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] invalid link');
  }

  // Het han?
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    if (kind === 'browser') return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] link expired');
  }

  // Khoa theo PlaceId (neu co dat luc tao link).
  if (entry.placeLock && q.place && String(q.place) !== String(entry.placeLock)) {
    if (kind === 'browser') return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] wrong game');
  }

  // Trinh duyet vao thang link raw -> day ve Home, khong dua gi.
  // Public sources: ai cung doc duoc.
  if (entry.isPublic) return sendLua(res, entry.code);
  if (kind === 'browser') return sendBlank(res);

  // Sai key -> khong dua gi (ke ca loader, vi loader chua key that).
  // SonStudio gate: neu gan sonSlug thi key = key user ben SonStudio (thay cho k noi bo).
  if (entry.sonSlug) {
    const v = await verifyKey({ gameSlug: entry.sonSlug, key: k, hwid: q.hwid, placeId: q.place });
    if (!v.ok) return sendLua(res, '-- [ApolloHub] key rejected: ' + v.msg);
  } else if (!safeEqual(k, entry.k)) return sendLua(res, '-- [ApolloHub] invalid key');

  // Game that -> source goc. Fetcher (.get/curl) -> source loader gon.
  if (kind === 'roblox') return sendLua(res, entry.code);
  return sendLua(res, buildPayloadLoader(getHost(req), entry));
};
