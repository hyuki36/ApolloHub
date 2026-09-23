// GET /api/list — liet ke link (khong tra source).
const { listScripts } = require('../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const items = await listScripts();
  return res.status(200).json({ scripts: items });
};
