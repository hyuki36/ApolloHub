// ApolloHub — browser vs Roblox detection
// game:HttpGet() gui User-Agent chua "Roblox", trinh duyet gui Mozilla + Sec-Fetch-*.
// Tool curl/python/wget bi chan nhu trinh duyet neu khong co key hop le.

const BROWSER_TOKENS = [
  'mozilla', 'chrome', 'safari', 'firefox', 'edg/', 'edge', 'opr/', 'opera',
  'curl', 'wget', 'python', 'postman', 'insomnia', 'axios', 'node',
  'go-http', 'java', 'php', 'powershell', 'httpclient', 'okhttp', 'dart',
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

function isBrowser(req) {
  // Sec-Fetch-* chi trinh duyet that gui — uu tien nhat.
  // Ke ca gia User-Agent "Roblox" trong DevTools van bi bat.
  if (hasBrowserFetchHeaders(req)) return true;
  if (isRobloxUa(req)) return false;
  const ua = getUa(req);
  if (!ua) return false; // khong co UA (mot so executor) -> xu ly nhu client, van doi key
  return BROWSER_TOKENS.some((t) => ua.includes(t));
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

module.exports = { isBrowser, isRobloxUa, sendBlank, sendLua, safeEqual };
