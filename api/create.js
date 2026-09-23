// POST /api/create — tao link anti-raw moi.
// Body: { name, slug?, code, placeLock?, expireHours?, adminKey? }
// - slug = Script Key (s=), vd "apollo_main". De trong = tu sinh tu name.
// - Tra ve ca /api/r lan /api/payload (style sodium gon) + 2 loader.

const { saveScript, newId, newKey, cleanSlug, slugTaken } = require('../lib/store');

function getBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return proto + '://' + host;
}

function getHost(req) {
  return req.headers['x-forwarded-host'] || req.headers.host;
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

  // Script Key: uu tien slug nguoi dung nhap, fallback tu name.
  let slug = cleanSlug(body.slug) || cleanSlug(name).slice(0, 24) || 'script';
  if (await slugTaken(slug)) {
    return res.status(409).json({ error: 'Script Key "' + slug + '" da ton tai — chon key khac' });
  }

  const id = newId();
  const k = newKey();
  const expireHours = Number(body.expireHours || 0);
  const entry = {
    id,
    slug,
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
  const payloadUrl = base + '/api/payload?s=' + encodeURIComponent(slug) + '&k=' + encodeURIComponent(k);
  const loader =
    '-- ApolloHub loader\n'
    + 'local _h=(typeof(gethwid)=="function" and gethwid() or game:GetService("RbxAnalyticsService"):GetClientId())\n'
    + 'local _u="' + url + '&hwid="..tostring(_h or "unknown"):gsub("[^%w%-%.:]","").."&place="..tostring(game.PlaceId)\n'
    + 'loadstring(game:HttpGet(_u))()';
  // Loader gon kieu sodium: chi can Script Key + key.
  const payloadLoader =
    "-- ApolloHub [" + slug + "]\n"
    + "local _s='" + slug.replace(/'/g, '') + "'\n"
    + 'local _k="' + k + '"\n'
    + 'local _h=(typeof(gethwid)=="function" and gethwid() or game:GetService("RbxAnalyticsService"):GetClientId())\n'
    + 'local _u=("https://' + getHost(req) + '/api/payload?s=".._s.."&k=".._k.."&hwid="..tostring(_h or "unknown"):gsub("[^%w%-%.:]","").."&place="..tostring(game.PlaceId))\n'
    + 'loadstring(game:HttpGet(_u))()';

  return res.status(200).json({ id, slug, k, name, url, payloadUrl, loader, payloadLoader });
};
