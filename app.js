// ApolloHub SPA router + Auth + Scripts Storage UI
(function () {
  const btns = document.querySelectorAll('.tab-btn[data-tab]');
  const panels = { home: el('panel-home'), link: el('panel-link'), updates: el('panel-updates'), discord: el('panel-discord') };
  let me = null;
  let editingId = null;

  function el(id) { return document.getElementById(id); }

  function show(tab) {
    if (!panels[tab]) tab = 'home';
    btns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    Object.keys(panels).forEach((k) => panels[k].classList.toggle('active', k === tab));
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  window.addEventListener('hashchange', () => show(location.hash.replace('#', '')));
  show((location.hash || '#home').replace('#', ''));
  el('account-chip').addEventListener('click', () => show('link'));

  async function api(path, method, body) {
    const r = await fetch(path, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    let j = {};
    try { j = await r.json(); } catch (e) { /* non-json */ }
    return { ok: r.ok, status: r.status, data: j };
  }

  function copyText(s, doneEl) {
    const done = () => { if (doneEl) { doneEl.textContent = 'Copied'; setTimeout(() => { doneEl.textContent = ''; }, 2000); } };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(s).then(done, () => fallbackCopy(s, done));
    } else fallbackCopy(s, done);
  }
  function fallbackCopy(s, done) {
    const ta = document.createElement('textarea');
    ta.value = s; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    ta.remove();
  }

  document.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', () => {
      const map = { demo: 'code-demo' };
      const t = el(map[b.dataset.copy]);
      if (t) copyText(t.textContent);
    });
  });
  el('btn-copy-dc').addEventListener('click', () => copyText('https://discord.gg/c3xVMnUUBv'));

  // ---------- Auth ----------
  function authMsg(m) { el('auth-status').textContent = m || ''; }
  function createMsg(m) { el('create-status').textContent = m || ''; }

  async function refreshMe() {
    try {
      const r = await api('/api/auth?action=me');
      me = r.ok ? r.data.user : null;
    } catch (e) { me = null; }
    renderAuth();
    if (me) loadManaged();
  }

  function renderAuth() {
    const logged = !!me;
    el('auth-box').style.display = logged ? 'none' : '';
    el('account-bar').style.display = logged ? '' : 'none';
    el('storage').style.display = logged ? '' : 'none';
    el('account-chip').textContent = logged ? me.email.split('@')[0] : 'Login';
    if (logged) {
      el('account-label').textContent = 'SIGNED IN AS ' + me.email.toUpperCase() + (me.owner ? ' · OWNER' : '');
      el('script-list-title').childNodes[0].textContent = me.owner ? 'ALL SCRIPTS ' : 'MY SCRIPTS ';
    }
    if (!logged) { editingId = null; syncCreateBtn(); }
  }

  el('btn-register').addEventListener('click', async () => {
    authMsg('Registering...');
    const r = await api('/api/auth', 'POST', { action: 'register', email: el('a-email').value, password: el('a-pass').value });
    if (!r.ok) { authMsg(r.data.error || 'Register failed'); return; }
    el('a-pass').value = '';
    authMsg(r.data.persisted === false ? 'Registered (temporary — add GITHUB_TOKEN to keep accounts)' : 'Registered. Welcome.');
    refreshMe();
  });

  el('btn-login').addEventListener('click', async () => {
    authMsg('Logging in...');
    const r = await api('/api/auth', 'POST', { action: 'login', email: el('a-email').value, password: el('a-pass').value });
    if (!r.ok) { authMsg(r.data.error || 'Login failed'); return; }
    el('a-pass').value = '';
    authMsg('');
    refreshMe();
  });

  el('btn-logout').addEventListener('click', async () => {
    await api('/api/auth', 'POST', { action: 'logout' });
    me = null;
    renderAuth();
  });

  // ---------- Scripts Storage ----------
  function syncCreateBtn() {
    el('btn-create').textContent = editingId ? 'Save Changes' : 'Create Anti-Raw Link';
    el('btn-cancel-edit').style.display = editingId ? '' : 'none';
    el('f-slug').disabled = !!editingId;
  }

  el('btn-cancel-edit').addEventListener('click', () => {
    editingId = null;
    el('f-name').value = ''; el('f-slug').value = ''; el('f-code').value = '';
    el('f-slug').disabled = false;
    syncCreateBtn(); createMsg('');
  });

  el('btn-create').addEventListener('click', async () => {
    const name = el('f-name').value.trim() || 'apollo_main';
    const slug = el('f-slug').value.trim();
    const code = el('f-code').value;
    const placeLock = el('f-place').value.trim();
    const expireHours = Number(el('f-exp').value || 0);
    if (!code.trim()) { createMsg('Paste your code first'); return; }
    createMsg(editingId ? 'Saving...' : 'Creating...');
    if (editingId) {
      const r = await api('/api/scripts?id=' + encodeURIComponent(editingId), 'PUT', { name, code, placeLock, expireHours });
      if (!r.ok) { createMsg(r.data.error || 'Save failed'); return; }
      createMsg('Saved. Game loads the new source immediately.');
      editingId = null; el('f-slug').disabled = false; syncCreateBtn();
      loadManaged();
      return;
    }
    const r = await api('/api/scripts', 'POST', { name, slug, code, placeLock, expireHours });
    if (!r.ok) { createMsg(r.data.error || 'Create failed'); return; }
    el('r-slug').value = r.data.slug;
    el('r-url').value = r.data.payloadUrl;
    el('r-loader').value = r.data.payloadLoader;
    el('result').classList.add('show');
    createMsg(r.data.persisted ? 'Saved permanently: ' + r.data.slug : 'Saved (temporary — add GITHUB_TOKEN on Vercel to keep it)');
    loadManaged();
  });

  el('btn-copy-url').addEventListener('click', () => copyText(el('r-url').value));
  el('btn-copy-loader').addEventListener('click', () => copyText(el('r-loader').value));
  el('btn-test').addEventListener('click', () => {
    if (el('r-url').value) window.open(el('r-url').value, '_blank');
  });
  el('btn-reload').addEventListener('click', loadManaged);

  function rowButtons(s) {
    const wrap = document.createElement('span');
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'mini'; b.textContent = label;
      b.addEventListener('click', fn);
      wrap.appendChild(b); wrap.appendChild(document.createTextNode(' '));
      return b;
    };
    mk('Edit', () => startEdit(s.id));
    mk('Loader', () => {
      const host = location.host;
      const loader = "-- ApolloHub [" + s.slug + "]\nlocal _s='" + s.slug + "'\nlocal _k=\"" + s.k + "\"\n"
        + "local _h=(typeof(gethwid)==\"function\" and gethwid() or game:GetService(\"RbxAnalyticsService\"):GetClientId())\n"
        + "local _u=(\"https://" + host + "/api/payload?s=\".._s..\"&k=\".._k..\"&hwid=\"..tostring(_h or \"unknown\"):gsub(\"[^%w%-%.:]\",\"\")..\"&place=\"..tostring(game.PlaceId))\n"
        + "loadstring(game:HttpGet(_u))()";
      el('r-slug').value = s.slug;
      el('r-url').value = 'https://' + host + '/api/payload?s=' + encodeURIComponent(s.slug) + '&k=' + encodeURIComponent(s.k);
      el('r-loader').value = loader;
      el('result').classList.add('show');
      el('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    mk('Delete', async () => {
      if (!confirm('Delete [' + s.slug + ']? Loaders using it stop working.')) return;
      const r = await api('/api/scripts?id=' + encodeURIComponent(s.id), 'DELETE');
      if (!r.ok) { alert(r.data.error || 'Delete failed'); return; }
      if (editingId === s.id) el('btn-cancel-edit').click();
      loadManaged();
    });
    return wrap;
  }

  async function startEdit(id) {
    const r = await api('/api/scripts?id=' + encodeURIComponent(id));
    if (!r.ok) { alert(r.data.error || 'Load failed'); return; }
    const s = r.data.script;
    editingId = s.id;
    el('f-name').value = s.name || '';
    el('f-slug').value = s.slug || '';
    el('f-slug').disabled = true;
    el('f-code').value = s.code || '';
    el('f-place').value = s.owner !== undefined && s.placeLock ? s.placeLock : (s.placeLock || '');
    syncCreateBtn(); createMsg('Editing [' + (s.slug || s.id) + '] — slug cannot change.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadManaged() {
    const box = el('script-list');
    if (!me) { box.innerHTML = '<p class="hint">Login to see your scripts.</p>'; return; }
    box.innerHTML = '<p class="hint">Loading...</p>';
    const r = await api('/api/scripts');
    if (!r.ok) { box.innerHTML = '<p class="hint">Could not load. ' + (r.data.error || '') + '</p>'; return; }
    const items = r.data.scripts || [];
    el('link-count').textContent = items.length;
    box.innerHTML = '';
    if (!items.length) {
      box.innerHTML = '<p class="hint">No scripts yet — create your first one in the form above.</p>';
      return;
    }
    items.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'script-row';
      const b = document.createElement('b');
      b.textContent = s.name || '(untitled)';
      const code = document.createElement('code');
      code.textContent = 's=' + (s.slug || '-');
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = (s.owner ? s.owner + ' · ' : '') + new Date(s.createdAt || Date.now()).toLocaleString();
      const sp = document.createElement('span');
      sp.className = 'sp';
      row.appendChild(b); row.appendChild(code); row.appendChild(meta); row.appendChild(sp);
      if (me.owner && s.owner && s.owner !== me.email) {
        const badge = document.createElement('span');
        badge.className = 'badge-owner';
        badge.textContent = 'USER SCRIPT';
        row.appendChild(badge);
      }
      row.appendChild(rowButtons(s));
      box.appendChild(row);
    });
  }

  refreshMe();
})();
