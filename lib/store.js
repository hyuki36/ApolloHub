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
    // Chi muc slug -> id de tra theo Script Key (s=) ma khong can quet keys.
    if (entry.slug) {
      await fetch(process.env.KV_REST_API_URL + '/set/apollo:slug:' + encodeURIComponent(entry.slug), {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(entry.id))
      });
    }
  } catch { /* fallback local */ }
}

async function kvGetBySlug(slug) {
  try {
    const r = await fetch(process.env.KV_REST_API_URL + '/get/apollo:slug:' + encodeURIComponent(slug), {
      headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN }
    });
    const j = await r.json();
    if (!j || !j.result) return null;
    return await kvGet(JSON.parse(j.result));
  } catch { return null; }
}

// Script Key (s=): chu thuong, [a-z0-9_-], toi da 40 ky tu.
function cleanSlug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

function mem() {
  if (!globalThis.__APOLLO_STORE__) globalThis.__APOLLO_STORE__ = new Map();
  return globalThis.__APOLLO_STORE__;
}

// --- Luu vinh vien qua GitHub (khong can KV) ---
// Can env GITHUB_TOKEN (classic token, scope repo contents:write).
// Moi link tao tren web duoc append vao scripts.json tren repo -> Vercel tu redeploy -> vinh vien.
function githubConfigured() {
  return Boolean(process.env.GITHUB_TOKEN);
}

async function githubCommitScript(entry) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return false;
  const parts = String(process.env.GITHUB_REPO || 'hyuki36/ApolloHub').split('/');
  if (parts.length !== 2) return false;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const api = 'https://api.github.com/repos/' + parts[0] + '/' + parts[1] + '/contents/scripts.json';
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'ApolloHub'
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const c1 = new AbortController();
      const t1 = setTimeout(() => c1.abort(), 8000);
      let cur;
      try {
        cur = await fetch(api + '?ref=' + encodeURIComponent(branch), { headers, signal: c1.signal });
      } finally { clearTimeout(t1); }
      if (!cur.ok) return false;
      const curJson = await cur.json();
      const data = JSON.parse(Buffer.from(curJson.content, 'base64').toString('utf8'));
      data.scripts = data.scripts || [];
      if (data.scripts.some((s) => s && (s.id === entry.id || (entry.slug && s.slug === entry.slug)))) return true;
      const clean = { ...entry };
      delete clean.persisted;
      data.scripts.push(clean);
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), 8000);
      let put;
      try {
        put = await fetch(api, {
          method: 'PUT', headers, signal: c2.signal,
          body: JSON.stringify({
            message: 'ApolloHub: save script [' + (entry.slug || entry.id) + ']',
            content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
            sha: curJson.sha, branch
          })
        });
      } finally { clearTimeout(t2); }
      if (put.status === 409 || put.status === 422) continue; // conflict -> doc lai, thu lai
      return put.ok;
    } catch { return false; }
  }
  return false;
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

async function getScript(key) {
  if (!key) return null;
  key = String(key);
  // 1) Tim thang theo id.
  if (kvConfigured()) {
    const e = await kvGet(key);
    if (e) return e;
    // 2) Tim theo Script Key (slug) qua chi muc.
    const bySlug = await kvGetBySlug(key);
    if (bySlug) return bySlug;
    return null;
  }
  const m = loadLocal();
  if (m.has(key)) return m.get(key);
  // 2) Tim theo slug hoac ten hien thi (khong phan biet hoa thuong).
  const low = key.toLowerCase();
  for (const e of m.values()) {
    if (String(e.slug || '').toLowerCase() === low) return e;
    if (String(e.name || '').toLowerCase() === low) return e;
  }
  return null;
}

async function slugTaken(slug) {
  return Boolean(await getScript(slug));
}

async function saveScript(entry) {
  if (kvConfigured()) await kvSet(entry);
  loadLocal().set(entry.id, entry);
  persistLocal();
  // Vinh vien ngay khi co KV hoac GITHUB_TOKEN (commit vao scripts.json -> Vercel redeploy).
  // Khong co gi thi van chay tam tren instance hien tai.
  entry.persisted = kvConfigured() ? true : await githubCommitScript(entry);
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
        if (e) out.push({ id: e.id, slug: e.slug || null, name: e.name, createdAt: e.createdAt });
      }
      if (out.length) return out;
    } catch { /* fallback */ }
  }
  return [...loadLocal().values()].map((e) => ({ id: e.id, slug: e.slug || null, name: e.name, createdAt: e.createdAt }));
}

function newId() {
  return 'apollo_' + crypto.randomBytes(4).toString('hex');
}

function newKey() {
  return crypto.randomBytes(24).toString('hex') + '.' + Date.now();
}

module.exports = { getScript, saveScript, listScripts, newId, newKey, cleanSlug, slugTaken, githubConfigured };
