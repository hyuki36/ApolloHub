// ApolloHub SPA router + Auth + Scripts Storage UI
(function () {
  const btns = document.querySelectorAll('.tab-btn[data-tab]');
  const panels = { home: el('panel-home'), link: el('panel-link'), updates: el('panel-updates'), discord: el('panel-discord') };
  let me = null;
  let editingId = null;
  // Credentials gui kem moi request (stateless) — song moi instance, khong phu thuoc cookie.
  let creds = null;
  try {
    const saved = sessionStorage.getItem('apollo_creds');
    if (saved) creds = JSON.parse(saved);
  } catch (e) { /* ignore */ }

  function saveCreds(email, password) {
    creds = { email, password };
    try { sessionStorage.setItem('apollo_creds', JSON.stringify(creds)); } catch (e) { /* ignore */ }
  }
  function clearCreds() {
    creds = null;
    try { sessionStorage.removeItem('apollo_creds'); } catch (e) { /* ignore */ }
  }

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
    const headers = { 'Content-Type': 'application/json' };
    if (creds) headers.Authorization = 'Basic ' + btoa(unescape(encodeURIComponent(creds.email + ':' + creds.password)));
    const r = await fetch(path, {
      method: method || 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    let j = {};
    try { j = await r.json(); } catch (e) { /* non-json */ }
    if (r.status === 401 && creds && !String(path).includes('/api/auth')) {
      // Credentials het han (doi mat khau / reset user) -> ve trang thai logout sach.
      clearCreds();
      me = null;
      renderAuth();
    }
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
      el('script-list-title').textContent = me.owner ? 'ALL SCRIPTS' : 'MY SCRIPTS';
    }
    if (!logged) { editingId = null; syncCreateBtn(); el('stats').style.display = 'none'; }
  }

  el('btn-login').addEventListener('click', async () => {
    authMsg('Logging in...');
    const email = el('a-email').value;
    const password = el('a-pass').value;
    const r = await api('/api/auth', 'POST', { action: 'login', email, password });
    if (!r.ok) { authMsg(r.data.error || 'Login failed'); return; }
    saveCreds(email, password);
    el('a-pass').value = '';
    authMsg('');
    refreshMe();
  });

  el('btn-logout').addEventListener('click', async () => {
    try { await api('/api/auth', 'POST', { action: 'logout' }); } catch (e) { /* ignore */ }
    clearCreds();
    me = null;
    renderAuth();
  });

  // ---------- Dashboard ----------
  let cache = [];

  el('btn-add-new').addEventListener('click', () => {
    editingId = null;
    el('f-name').value = ''; el('f-slug').value = ''; el('f-code').value = '';
    el('f-place').value = ''; el('f-exp').value = '0'; el('f-son').value = '';
    el('f-public').checked = false;
    el('f-slug').disabled = false;
    syncCreateBtn(); createMsg('');
    el('result').classList.remove('show');
    el('editor').style.display = '';
    el('f-name').focus();
    el('editor').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function hideEditor() { el('editor').style.display = 'none'; }

  el('q-search').addEventListener('input', () => renderList(el('q-search').value));

  function renderList(filter) {
    const box = el('script-list');
    const f = String(filter || '').trim().toLowerCase();
    const items = cache.filter((s) => !f
      || String(s.name || '').toLowerCase().includes(f)
      || String(s.slug || '').toLowerCase().includes(f));
    el('link-count').textContent = items.length;
    box.innerHTML = '';
    if (!items.length) {
      box.innerHTML = '<tr><td colspan="5"><p class="hint">' + (cache.length ? 'No match.' : 'Add New Scripts First. . .') + '</p></td></tr>';
      renderStats();
      return;
    }
    items.forEach((s) => {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      const b = document.createElement('b');
      b.textContent = s.name || '(untitled)';
      tdName.appendChild(b);
      if (me.owner && s.owner && s.owner !== me.email) {
        const badge = document.createElement('span');
        badge.className = 'badge-owner';
        badge.textContent = 'USER';
        tdName.appendChild(document.createTextNode(' '));
        tdName.appendChild(badge);
      }
      const tdKey = document.createElement('td');
      const code = document.createElement('code');
      code.textContent = 's=' + (s.slug || '-');
      tdKey.appendChild(code);
      const tdType = document.createElement('td');
      const chips = [];
      if (s.isPublic) chips.push(['PUB', true]);
      if (s.sonSlug) chips.push(['SON', true]);
      if (s.placeLock) chips.push(['LOCK', false]);
      if (s.expiresAt) chips.push(['EXP', false]);
      if (!chips.length) chips.push(['RAW', false]);
      chips.forEach(([label, hot]) => {
        const c = document.createElement('span');
        c.className = 'chip' + (hot ? ' hot' : '');
        c.textContent = label;
        tdType.appendChild(c);
      });
      const tdUpd = document.createElement('td');
      tdUpd.className = 'meta';
      tdUpd.textContent = new Date(s.createdAt || Date.now()).toLocaleDateString();
      const tdActs = document.createElement('td');
      tdActs.className = 'acts';
      tdActs.appendChild(rowButtons(s));
      tr.appendChild(tdName); tr.appendChild(tdKey); tr.appendChild(tdType);
      tr.appendChild(tdUpd); tr.appendChild(tdActs);
      box.appendChild(tr);
    });
    renderStats();
  }

  function renderStats() {
    const box = el('stats');
    box.style.display = '';
    const gated = cache.filter((s) => s.sonSlug).length;
    const locked = cache.filter((s) => s.placeLock).length;
    const exp = cache.filter((s) => s.expiresAt).length;
    const defs = [[cache.length, 'Scripts'], [gated, 'Key-gated'], [locked, 'Place-locked'], [exp, 'Expiring']];
    box.innerHTML = '';
    defs.forEach(([n, label]) => {
      const d = document.createElement('div');
      d.className = 'stat';
      const b = document.createElement('b');
      b.textContent = n;
      const sp = document.createElement('span');
      sp.textContent = label;
      d.appendChild(b); d.appendChild(sp);
      box.appendChild(d);
    });
  }

  function syncCreateBtn() {
    el('btn-create').textContent = editingId ? 'Save Changes' : 'Create Anti-Raw Link';
    el('btn-cancel-edit').style.display = editingId ? '' : 'none';
    el('f-slug').disabled = !!editingId;
  }

  el('btn-cancel-edit').addEventListener('click', () => {
    editingId = null;
    el('f-name').value = ''; el('f-slug').value = ''; el('f-code').value = '';
    el('f-public').checked = false;
    el('f-slug').disabled = false;
    syncCreateBtn(); createMsg('');
    hideEditor();
  });

  el('btn-create').addEventListener('click', async () => {
    const name = el('f-name').value.trim() || 'apollo_main';
    const slug = el('f-slug').value.trim();
    const code = el('f-code').value;
    const placeLock = el('f-place').value.trim();
    const expireHours = Number(el('f-exp').value || 0);
    const sonSlug = el('f-son').value.trim();
    const isPublic = el('f-public').checked;
    if (!code.trim()) { createMsg('Paste your code first'); return; }
    createMsg(editingId ? 'Saving...' : 'Creating...');
    if (editingId) {
      const r = await api('/api/scripts?id=' + encodeURIComponent(editingId), 'PUT', { name, code, placeLock, expireHours, sonSlug, isPublic });
      if (!r.ok) { createMsg(r.data.error || 'Save failed'); return; }
      createMsg('Saved. Game loads the new source immediately.');
      editingId = null; el('f-slug').disabled = false; syncCreateBtn();
      loadManaged();
      return;
    }
    const r = await api('/api/scripts', 'POST', { name, slug, code, placeLock, expireHours, sonSlug, isPublic });
    if (!r.ok) { createMsg(r.data.error || 'Create failed'); return; }
    el('r-slug').value = r.data.slug;
    el('r-url').value = r.data.rawUrl || r.data.payloadUrl;
    el('r-loader').value = r.data.rawLoader || r.data.payloadLoader;
    el('result').classList.add('show');
    createMsg('Saved: ' + r.data.slug + (r.data.persisted
      ? ' (permanent)'
      : ' (TEMPORARY — will NOT load in game. Send the code to owner to seed it permanently)'));
    hideEditor();
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
    mk('Key', async () => {
      if (!confirm('Rotate key for [' + s.slug + ']? Old loaders die immediately.')) return;
      const r = await api('/api/scripts?id=' + encodeURIComponent(s.id), 'PUT', { rotate: 1 });
      if (!r.ok) { alert(r.data.error || 'Rotate failed'); return; }
      el('r-slug').value = r.data.script.slug;
      el('r-url').value = r.data.rawUrl;
      el('r-loader').value = r.data.rawLoader;
      el('result').classList.add('show');
      el('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
      loadManaged();
    });
    mk('Loader', () => {
      const host = location.host;
      const loader = s.sonSlug
        ? 'local _KEY = "PASTE-YOUR-KEY-HERE"\nloadstring(game:HttpGet("https://' + host + '/raw/' + s.slug + '.lua?key=" .. _KEY))()'
        : 'loadstring(game:HttpGet("https://' + host + '/raw/' + s.slug + '.lua"))()';
      el('r-slug').value = s.slug;
      el('r-url').value = 'https://' + host + '/raw/' + encodeURIComponent(s.slug) + '.lua';
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
    el('f-son').value = s.sonSlug || '';
    el('f-public').checked = !!s.isPublic;
    el('f-place').value = s.owner !== undefined && s.placeLock ? s.placeLock : (s.placeLock || '');
    syncCreateBtn(); createMsg('Editing [' + (s.slug || s.id) + '] — slug cannot change.');
    el('editor').style.display = '';
    el('editor').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function loadManaged() {
    const box = el('script-list');
    if (!me) {
      el('stats').style.display = 'none';
      box.innerHTML = '<tr><td colspan="5"><p class="hint">Login to see your scripts.</p></td></tr>';
      return;
    }
    box.innerHTML = '<tr><td colspan="5"><p class="hint">Loading...</p></td></tr>';
    const r = await api('/api/scripts');
    if (!r.ok) { box.innerHTML = '<tr><td colspan="5"><p class="hint">Could not load. ' + (r.data.error || '') + '</p></td></tr>'; return; }
    cache = r.data.scripts || [];
    renderList(el('q-search').value);
  }

  refreshMe();
})();
