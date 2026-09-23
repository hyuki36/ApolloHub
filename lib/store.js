// ApolloHub — storage cho link anti-raw.
// Vercel serverless la stateless: dung global + /tmp de demo,
// gan region sin1 trong vercel.json de giam lech instance.
// Muon tao link vinh vien khong can redeploy: set KV_REST_API_URL + KV_REST_API_TOKEN (Upstash/Vercel KV).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TMP_FILE = '/tmp/apollo-scripts.json';

function seedPath() {
  return path.join(__dirname, '..', 'scripts.json');
}

function readJsonSafe(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet(id) {
  try {
    const r = await fetch(process.env.KV_REST_API_URL + '/get/apollo:' + encodeURIComponent(id), {
      headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN }
    });
    const j = await r.json();
    if (!j || !j.result) return null;
    return JSON.parse(j.result);
  } catch { return null; }
}

async function kvSet(entry) {
  try {
    await fetch(process.env.KV_REST_API_URL + '/set/apollo:' + encodeURIComponent(entry.id), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(entry))
    });
  } catch { /* fallback local */ }
}

function mem() {
  if (!globalThis.__APOLLO_STORE__) globalThis.__APOLLO_STORE__ = new Map();
  return globalThis.__APOLLO_STORE__;
}

function loadLocal() {
  const m = mem();
  if (m.size > 0) return m;
  const tmp = readJsonSafe(TMP_FILE);
  const seed = readJsonSafe(seedPath());
  const arr = (tmp && tmp.scripts) || (seed && seed.scripts) || [];
  for (const s of arr) if (s && s.id && s.k) m.set(s.id, s);
  return m;
}

function persistLocal() {
  try {
    const arr = [...mem().values()];
    fs.writeFileSync(TMP_FILE, JSON.stringify({ scripts: arr }), 'utf8');
  } catch { /* /tmp co the khong ghi duoc, bo qua */ }
}

async function getScript(id) {
  if (!id) return null;
  if (kvConfigured()) {
    const e = await kvGet(id);
    if (e) return e;
  }
  return loadLocal().get(String(id)) || null;
}

async function saveScript(entry) {
  if (kvConfigured()) await kvSet(entry);
  loadLocal().set(entry.id, entry);
  persistLocal();
  return entry;
}

async function listScripts() {
  if (kvConfigured()) {
    try {
      const r = await fetch(process.env.KV_REST_API_URL + '/keys/apollo:*', {
        headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN }
      });
      const j = await r.json();
      const out = [];
      for (const k of (j.result || []).slice(0, 100)) {
        const id = String(k).replace(/^apollo:/, '');
        const e = await kvGet(id);
        if (e) out.push({ id: e.id, name: e.name, createdAt: e.createdAt });
      }
      if (out.length) return out;
    } catch { /* fallback */ }
  }
  return [...loadLocal().values()].map((e) => ({ id: e.id, name: e.name, createdAt: e.createdAt }));
}

function newId() {
  return 'apollo_' + crypto.randomBytes(4).toString('hex');
}

function newKey() {
  return crypto.randomBytes(24).toString('hex') + '.' + Date.now();
}

module.exports = { getScript, saveScript, listScripts, newId, newKey };
