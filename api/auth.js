// Auth API: POST {action:"register"|"login"|"logout", email?, password?} | GET ?action=me
const { register, login, getViewer, sessionCookie } = require('../lib/auth');

function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  return b || {};
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const me = await getViewer(req);
    if (!me) return res.status(401).json({ user: null });
    return res.status(200).json({ user: me });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = parseBody(req);
  const action = String(body.action || '');
  if (action === 'logout') {
    res.setHeader('Set-Cookie', sessionCookie('', true));
    return res.status(200).json({ ok: true });
  }
  if (action === 'register') {
    const r = await register(body.email, body.password);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.setHeader('Set-Cookie', sessionCookie(r.token));
    return res.status(200).json({ user: r.user, token: r.token, persisted: r.persisted });
  }
  if (action === 'login') {
    const r = await login(body.email, body.password);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.setHeader('Set-Cookie', sessionCookie(r.token));
    return res.status(200).json({ user: r.user, token: r.token });
  }
  return res.status(400).json({ error: 'Unknown action' });
};
