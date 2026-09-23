// Scripts Storage API (can dang nhap):
// - GET /api/scripts -> script cua minh (owner thay TAT CA, gom code + owner email)
// - GET /api/scripts?id=<id|slug> -> 1 script (minh hoac owner)
// - POST {name, slug?, code, placeLock?, expireHours?} -> tao moi, gan owner = minh
// - PUT ?id= {name?, code?, placeLock?, expireHours?} -> sua (minh hoac owner; slug khong doi)
// - DELETE ?id= -> xoa (minh hoac owner)
// Load trong game (/api/payload, /api/r) khong doi: s+k dung -> source goc.

const { getViewer } = require('../lib/auth');
const { getScript, getAllEntries, saveScript, updateScript, deleteScript, newId, newKey, cleanSlug, slugTaken } = require('../lib/store');
const { buildPayloadLoader, buildRawLoader } = require('../lib/detect');

function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  return b || {};
}

function baseUrl(req) {
  const h = req.headers || {};
  const proto = String(h['x-forwarded-proto'] || 'https').split(',')[0];
  return proto + '://' + (h['x-forwarded-host'] || h.host);
}

function canTouch(viewer, entry) {
  if (!viewer || !entry) return false;
  if (viewer.owner) return true;
  return String(entry.owner || '').toLowerCase() === String(viewer.email).toLowerCase();
}

module.exports = async function handler(req, res) {
  const viewer = await getViewer(req);
  if (!viewer) return res.status(401).json({ error: 'Login required' });
  const q = req.query || {};

  // Owner-only full export for no-token Publish (Download scripts.json -> upload to repo).
  if (req.method === 'GET' && (q.export === '1' || q.export === 1)) {
    if (!viewer.owner) return res.status(403).json({ error: 'Owner only' });
    const all = await getAllEntries();
    const clean = all.map((e) => { const c = { ...e }; delete c.persisted; return c; });
    return res.status(200).json({ file: { scripts: clean } });
  }

  if (req.method === 'GET') {
    if (q.id) {
      const e = await getScript(String(q.id));
      if (!e || !canTouch(viewer, e)) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ script: e });
    }
    const all = await getAllEntries();
    const mine = all.filter((e) => canTouch(viewer, e));
    // Seed cu (owner=null): owner thay duoc, user thuong khong.
    mine.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.status(200).json({ scripts: mine, owner: viewer.owner });
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const name = String(body.name || 'untitled').slice(0, 60) || 'untitled';
    const code = String(body.code || '').slice(0, 200000);
    if (code.trim().length < 4) return res.status(400).json({ error: 'Code too short' });
    let slug = cleanSlug(body.slug) || cleanSlug(name).slice(0, 24) || 'script';
    if (await slugTaken(slug)) return res.status(409).json({ error: 'Script Key "' + slug + '" already exists' });
    const entry = {
      id: newId(), slug, k: newKey(), name, code,
      owner: viewer.email,
      createdAt: Date.now(),
      placeLock: String(body.placeLock || '').trim() || null,
      expiresAt: Number(body.expireHours || 0) > 0 ? Date.now() + Number(body.expireHours) * 3600 * 1000 : null
    };
    await saveScript(entry);
    const host = baseUrl(req).replace(/^https?:\/\//, '');
    return res.status(200).json({
      id: entry.id, slug, k: entry.k, name,
      url: baseUrl(req) + '/api/r?id=' + encodeURIComponent(entry.id) + '&k=' + encodeURIComponent(entry.k),
      payloadUrl: baseUrl(req) + '/api/payload?s=' + encodeURIComponent(slug) + '&k=' + encodeURIComponent(entry.k),
      payloadLoader: buildPayloadLoader(host, entry),
      rawUrl: baseUrl(req) + '/raw/' + encodeURIComponent(slug) + '/' + encodeURIComponent(entry.k),
      rawLoader: buildRawLoader(host, entry),
      persisted: Boolean(entry.persisted)
    });
  }

  if (req.method === 'PUT') {
    if (!q.id) return res.status(400).json({ error: 'Missing id' });
    const e = await getScript(String(q.id));
    if (!e || !canTouch(viewer, e)) return res.status(404).json({ error: 'Not found' });
    const body = parseBody(req);
    const patch = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.code !== undefined) {
      if (String(body.code).trim().length < 4) return res.status(400).json({ error: 'Code too short' });
      patch.code = body.code;
    }
    if (body.placeLock !== undefined) patch.placeLock = body.placeLock;
    if (body.expireHours !== undefined) {
      patch.expiresAt = Number(body.expireHours || 0) > 0 ? Date.now() + Number(body.expireHours) * 3600 * 1000 : null;
    }
    const updated = await updateScript(e.id, patch);
    return res.status(200).json({ script: updated });
  }

  if (req.method === 'DELETE') {
    if (!q.id) return res.status(400).json({ error: 'Missing id' });
    const e = await getScript(String(q.id));
    if (!e || !canTouch(viewer, e)) return res.status(404).json({ error: 'Not found' });
    await deleteScript(e.id);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method Not Allowed' });
};
