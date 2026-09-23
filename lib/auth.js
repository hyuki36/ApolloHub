// ApolloHub — dang nhap / dang ky, session signed bang HMAC, khong can DB rieng.
// Owner mac dinh: ahba9912@gmail.com (hoac OWNER_EMAILS env) — thay duoc moi scripts/sources.

const crypto = require('crypto');
const { readUsers, writeUsers } = require('./store');

const OWNER_EMAILS = String(process.env.OWNER_EMAILS || 'ahba9912@gmail.com')
  .toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

const SESSION_DAYS = 30;

function getSecret() {
  // Khong co SESSION_SECRET env: sinh secret ngau nhien theo instance.
  // Login van chay, session mat khi restart — set env de giu dang nhap lau dai.
  // (Khong dung secret mac dinh nua: secret cung se lo, ai cung gia mao session duoc.)
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!globalThis.__APOLLO_SECRET__) {
    globalThis.__APOLLO_SECRET__ = crypto.randomBytes(32).toString('hex');
  }
  return globalThis.__APOLLO_SECRET__;
}

function normEmail(e) {
  return String(e || '').trim().toLowerCase().slice(0, 120);
}

function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

async function verifyPassword(pw, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const hash = crypto.scryptSync(String(pw), parts[1], 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(parts[2], 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function publicUser(u) {
  return { id: u.id, email: u.email, owner: Boolean(u.owner), createdAt: u.createdAt };
}

function signSession(uid) {
  const payload = b64url(JSON.stringify({ uid: String(uid), exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1000 }));
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return payload + '.' + sig;
}

function verifySession(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const sig = crypto.createHmac('sha256', getSecret()).update(parts[0]).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(parts[1], 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(unb64url(parts[0]));
    if (!p.uid || !p.exp || Date.now() > p.exp) return null;
    return String(p.uid);
  } catch { return null; }
}

function sessionCookie(token, clear) {
  const base = 'apollo_session=' + (clear ? 'deleted' : token)
    + '; Path=/; HttpOnly; SameSite=Lax'
    + (clear ? '; Max-Age=0' : '; Max-Age=' + SESSION_DAYS * 24 * 3600);
  return process.env.VERCEL ? base + '; Secure' : base;
}

function tokenFromReq(req) {
  const h = req.headers || {};
  const auth = String(h.authorization || h.Authorization || '');
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const cookie = String(h.cookie || h.Cookie || '');
  const m = cookie.match(/(?:^|;\s*)apollo_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function basicFromReq(req) {
  // Authorization: Basic base64(email:password) — stateless, chay moi instance, khong can secret chung.
  try {
    const h = req.headers || {};
    const auth = String(h.authorization || h.Authorization || '');
    if (!auth.toLowerCase().startsWith('basic ')) return null;
    const raw = Buffer.from(auth.slice(6).trim(), 'base64').toString('utf8');
    const i = raw.indexOf(':');
    if (i < 0) return null;
    return { email: raw.slice(0, i), password: raw.slice(i + 1) };
  } catch { return null; }
}

async function getViewer(req) {
  // -> public user | null
  // 1) Session cookie (nhanh, khi cung instance hoac da set SESSION_SECRET).
  const uid = verifySession(tokenFromReq(req));
  if (uid) {
    const users = await readUsers();
    const u = users.find((x) => x && x.id === uid);
    if (u) {
      if (!u.owner && OWNER_EMAILS.includes(String(u.email).toLowerCase())) {
        u.owner = true;
        await writeUsers(users);
      }
      return publicUser(u);
    }
  }
  // 2) Basic credentials moi request (stateless — chet instance nao cung song).
  const cred = basicFromReq(req);
  if (!cred) return null;
  const users = await readUsers();
  const u = users.find((x) => x && String(x.email).toLowerCase() === normEmail(cred.email));
  if (!u || !(await verifyPassword(cred.password, u.pass))) return null;
  if (!u.owner && OWNER_EMAILS.includes(String(u.email).toLowerCase())) {
    u.owner = true;
    await writeUsers(users);
  }
  return publicUser(u);
}

async function register(email, password) {
  email = normEmail(email);
  if (!validEmail(email)) return { error: 'Invalid email', status: 400 };
  if (String(password || '').length < 6) return { error: 'Password must be at least 6 characters', status: 400 };
  const users = await readUsers();
  if (users.some((u) => u && String(u.email).toLowerCase() === email)) {
    return { error: 'Email already registered', status: 409 };
  }
  const user = {
    id: 'user_' + crypto.randomBytes(6).toString('hex'),
    email,
    pass: await hashPassword(password),
    owner: OWNER_EMAILS.includes(email),
    createdAt: Date.now()
  };
  users.push(user);
  const persisted = await writeUsers(users);
  return { user: publicUser(user), token: signSession(user.id), persisted, status: 200 };
}

async function login(email, password) {
  email = normEmail(email);
  const users = await readUsers();
  const u = users.find((x) => x && String(x.email).toLowerCase() === email);
  if (!u || !(await verifyPassword(password, u.pass))) {
    // Tre 1 chut chong do mat khau hang loat.
    await new Promise((r) => setTimeout(r, 600));
    return { error: 'Wrong email or password', status: 401 };
  }
  if (!u.owner && OWNER_EMAILS.includes(String(u.email).toLowerCase())) {
    u.owner = true;
    await writeUsers(users);
  }
  return { user: publicUser(u), token: signSession(u.id), status: 200 };
}

module.exports = { register, login, getViewer, publicUser, sessionCookie, OWNER_EMAILS };
