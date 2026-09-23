// GET /api/r?id=<id>&k=<key>&hwid=<hwid>&place=<placeId>
// - Trinh duyet / tool (curl, python...): tra trang den + tu chuyen ve /#home, khong lo source.
// - Roblox / executor (game:HttpGet) + key dung: tra Lua text/plain de loadstring chay.

const { isBrowser, sendBlank, sendLua, safeEqual } = require('../lib/detect');
const { getScript } = require('../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  const q = req.query || {};
  const id = String(q.id || q.s || '');
  const k = String(q.k || q.key || '');

  // Khong co id -> gia vo nhu web chet, khong lo gi.
  if (!id) return sendBlank(res);

  const entry = await getScript(id);
  if (!entry) {
    if (isBrowser(req)) return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] invalid link');
  }

  // Het han?
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    if (isBrowser(req)) return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] link expired');
  }

  // Khoa theo PlaceId (neu co dat luc tao link).
  if (entry.placeLock && q.place && String(q.place) !== String(entry.placeLock)) {
    if (isBrowser(req)) return sendBlank(res);
    return sendLua(res, '-- [ApolloHub] wrong game');
  }

  // Trinh duyet vao thang link raw -> day ve Home, khong dua code.
  if (isBrowser(req)) return sendBlank(res);

  // Client (Roblox) nhung sai key -> khong dua code.
  if (!safeEqual(k, entry.k)) return sendLua(res, '-- [ApolloHub] invalid key');

  return sendLua(res, entry.code);
};
