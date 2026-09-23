// POST /api/create — tao link anti-raw moi.
// Body: { name, code, placeLock?, expireHours?, adminKey? }
// Neu set ADMIN_KEY tren Vercel thi phai gui dung adminKey (header x-admin-key hoac body).

const { saveScript, newId, newKey } = require('../lib/store');

function getBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return proto + '://' + host;
}

function cleanCode(s) {
  return String(s || '').slice(0, 200000); // gioi han 200KB / script
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const required = process.env.ADMIN_KEY || '';
  const given = String(req.headers['x-admin-key'] || (req.body && req.body.adminKey) || '');
  if (required && given !== required) {
    return res.status(401).json({ error: 'Unauthorized: sai admin key' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const name = String(body.name || 'untitled').slice(0, 60) || 'untitled';
  const code = cleanCode(body.code);
  if (code.trim().length < 4) {
    return res.status(400).json({ error: 'Code qua ngan' });
  }

  const id = newId();
  const k = newKey();
  const expireHours = Number(body.expireHours || 0);
  const entry = {
    id,
    k,
    name,
    code,
    createdAt: Date.now(),
    placeLock: String(body.placeLock || '').trim() || null,
    expiresAt: expireHours > 0 ? Date.now() + expireHours * 3600 * 1000 : null
  };
  await saveScript(entry);

  const base = getBaseUrl(req);
  const url = base + '/api/r?id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(k);
  const loader =
    '-- ApolloHub loader\n'
    + 'local _h=(typeof(gethwid)=="function" and gethwid() or game:GetService("RbxAnalyticsService"):GetClientId())\n'
    + 'local _u="' + url + '&hwid="..tostring(_h or "unknown"):gsub("[^%w%-%.:]","").."&place="..tostring(game.PlaceId)\n'
    + 'loadstring(game:HttpGet(_u))()';

  return res.status(200).json({ id, k, name, url, loader });
};
