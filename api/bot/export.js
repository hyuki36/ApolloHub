// POST /api/bot/export — danh cho review bot (GitHub Actions).
// Auth: Authorization: Bearer <GITHUB_TOKEN tu dong cua Actions>.
// Server verify token co quyen push repo (qua GitHub API) roi tra full scripts + ket qua scan.
// Body tra ve: { scripts: [entry...], skipped: [{slug, reason}...] }

const { verifyGithubPush, scanScript } = require('../../lib/bot');
const { getAllEntries } = require('../../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const h = req.headers || {};
  const auth = String(h.authorization || h.Authorization || '');
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!(await verifyGithubPush(token))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const all = await getAllEntries();
  const scripts = [];
  const skipped = [];
  for (const e of all) {
    if (!e || !e.id || !e.k) continue;
    const clean = { ...e };
    delete clean.persisted;
    const s = scanScript(clean);
    if (s.ok) scripts.push(clean);
    else skipped.push({ slug: clean.slug || clean.id, reason: s.reason });
  }
  return res.status(200).json({ scripts, skipped });
};
