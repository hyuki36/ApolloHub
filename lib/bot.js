// ApolloHub review bot — tu dong duyet scripts.
// Bot (GitHub Actions) goi endpoint bang chinh GITHUB_TOKEN tu dong cua no.
// Server verify token co quyen push repo khong (qua GitHub API) roi moi nha source.
// Khong can setup secret nao o ca 2 dau.

function botRepo() {
  return process.env.GITHUB_REPO || 'hyuki36/ApolloHub';
}

async function verifyGithubPush(token) {
  // Chi token co quyen push repo moi duoc lay export. Khong bao gio throw.
  try {
    token = String(token || '');
    if (!token) return false;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    let r;
    try {
      r = await fetch('https://api.github.com/repos/' + botRepo(), {
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ApolloHub'
        },
        signal: ctrl.signal
      });
    } finally { clearTimeout(t); }
    if (!r.ok) return false;
    const j = await r.json();
    return Boolean(j && j.permissions && j.permissions.push === true);
  } catch { return false; }
}

const BLOCK_PATTERNS = [
  'discord.com/api/webhooks',
  'discordapp.com/api/webhooks',
  'webhook'
];

function scanScript(entry) {
  // Duyet nhanh truoc khi bot dua vao scripts.json vinh vien.
  // -> { ok: true } | { ok: false, reason }
  const code = String((entry && entry.code) || '');
  const slug = String((entry && entry.slug) || '');
  if (code.trim().length < 4) return { ok: false, reason: 'empty' };
  if (code.length > 200000) return { ok: false, reason: 'too-big' };
  if (!/^[a-z0-9_-]{1,40}$/.test(slug)) return { ok: false, reason: 'bad-slug' };
  const low = code.toLowerCase();
  for (const p of BLOCK_PATTERNS) {
    if (low.includes(p)) return { ok: false, reason: 'blocked-pattern:' + p };
  }
  return { ok: true };
}

module.exports = { botRepo, verifyGithubPush, scanScript };
