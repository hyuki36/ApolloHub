// GET /api/whoami — chan doan: tra ve User-Agent + phan loai client.
// Khong lo source, khong can key. Dung de xem bot/tool gui UA gi.
const { clientKind, getUa } = require('../lib/detect');

module.exports = async function handler(req, res) {
  const ua = getUa(req);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ua, kind: clientKind(req) });
};
