// ApolloHub — phan loai client, anti-raw 3 tang:
// - browser (trinh duyet that: Sec-Fetch-* hoac engine Mozilla/Chrome/Safari/Firefox)
//     -> trang den + tu ve /#home, khong lo gi.
// - roblox (User-Agent chua "Roblox", khong co Sec-Fetch)
//     -> tra SOURCE GOC (can key dung) de loadstring chay trong game.
// - fetcher (bot Discord .get, curl, python, wget, ...): co s+k dung
//     -> tra SOURCE LOADER (doan loadstring gon). Execute trong game van ra source goc.
//   Khong key / sai key / link la -> comment vo hai, khong lo source that.

const BROWSER_ENGINE_TOKENS = [
  'mozilla', 'chrome', 'safari', 'firefox', 'edg/', 'edge', 'opr/', 'opera',
  'electron', 'headless', 'phantom', 'selenium', 'puppeteer', 'playwright'
];

function getUa(req) {
  const h = req.headers || {};
  return String(h['user-agent'] || h['User-Agent'] || '').toLowerCase();
}

function isRobloxUa(req) {
  return getUa(req).includes('roblox');
}

function hasBrowserFetchHeaders(req) {
  const h = req.headers || {};
  // Trinh duyet Chromium/Gecko/Firefox luon gui Sec-Fetch-*. Roblox HttpGet khong gui.
  return Boolean(
    h['sec-fetch-mode'] || h['sec-fetch-site'] ||
    h['Sec-Fetch-Mode'] || h['Sec-Fetch-Site']
  );
}

function clientKind(req) {
  // Sec-Fetch-* chi trinh duyet that gui — uu tien nhat.
  // Ke ca gia User-Agent "Roblox" trong DevTools van bi bat.
  if (hasBrowserFetchHeaders(req)) return 'browser';
  const ua = getUa(req);
  if (BROWSER_ENGINE_TOKENS.some((t) => ua.includes(t))) return 'browser';
  if (ua.includes('roblox')) return 'roblox';
  return 'fetcher';
}

function isBrowser(req) {
  return clientKind(req) === 'browser';
}

function getHost(req) {
  const h = req.headers || {};
  return h['x-forwarded-host'] || h.host || '';
}

// Source loader gon kieu sodium: fetcher nhan cai nay, execute trong game ra source goc.
function buildPayloadLoader(host, entry) {
  const s = String(entry.slug || entry.id).replace(/'/g, '');
  return "-- ApolloHub [" + s + "]\n"
    + "local _s='" + s + "'\n"
    + 'local _k="' + entry.k + '"\n'
    + 'local _h=(typeof(gethwid)=="function" and gethwid() or game:GetService("RbxAnalyticsService"):GetClientId())\n'
    + 'local _u=("https://' + host + '/api/payload?s=".._s.."&k=".._k.."&hwid="..tostring(_h or "unknown"):gsub("[^%w%-%.:]","").."&place="..tostring(game.PlaceId))\n'
    + 'loadstring(game:HttpGet(_u))()';
}

function blankPage() {
  // Trang den, khong chua source, tu day ve #home sau 1.2s.
  // View-source chi thay HTML nay, khong thay Lua.
  return '<!doctype html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>ApolloHub</title>'
    + '<meta http-equiv="refresh" content="1;url=/#home">'
    + '<style>html,body{margin:0;height:100%;background:#000}</style>'
    + '</head><body>'
    + '<script>try{location.replace("/#home")}catch(e){location.href="/#home"}</script>'
    + '</body></html>';
}

function sendBlank(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(blankPage());
}

function sendLua(res, code) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(code);
}

function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

module.exports = { clientKind, isBrowser, isRobloxUa, getHost, buildPayloadLoader, sendBlank, sendLua, safeEqual };
