// ApolloHub SPA router + Link generator UI
(function () {
  const btns = document.querySelectorAll('.tab-btn');
  const panels = { home: el('panel-home'), link: el('panel-link'), updates: el('panel-updates'), discord: el('panel-discord') };

  function el(id) { return document.getElementById(id); }

  function show(tab) {
    if (!panels[tab]) tab = 'home';
    btns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    Object.keys(panels).forEach((k) => panels[k].classList.toggle('active', k === tab));
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'link') loadList();
  }

  btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  window.addEventListener('hashchange', () => show(location.hash.replace('#', '')));
  show((location.hash || '#home').replace('#', ''));

  // copy buttons
  document.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', () => {
      const map = { demo: 'code-demo' };
      const t = el(map[b.dataset.copy]);
      if (t) copyText(t.textContent);
    });
  });

  function copyText(s) {
    navigator.clipboard.writeText(s).then(
      () => toast('Copied'),
      () => {
        const ta = document.createElement('textarea');
        ta.value = s; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Copy failed'); }
        ta.remove();
      }
    );
  }

  function toast(msg) {
    const s = el('create-status');
    if (s) { s.textContent = msg; setTimeout(() => { s.textContent = ''; }, 2500); }
  }

  el('btn-copy-dc').addEventListener('click', () => copyText('https://discord.gg/c3xVMnUUBv'));

  // create link
  el('btn-create').addEventListener('click', async () => {
    const name = el('f-name').value.trim() || 'apollo_main';
    const slug = el('f-slug').value.trim();
    const code = el('f-code').value;
    const placeLock = el('f-place').value.trim();
    const expireHours = Number(el('f-exp').value || 0);
    const adminKey = el('f-admin').value;
    if (!code.trim()) { toast('Paste your code first'); return; }
    toast('Creating...');
    try {
      const r = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ name, slug, code, placeLock, expireHours, adminKey })
      });
      const j = await r.json();
      if (!r.ok) { toast(j.error || 'Create failed'); return; }
      el('r-slug').value = j.slug;
      el('r-url').value = j.payloadUrl;
      el('r-loader').value = j.payloadLoader;
      el('result').classList.add('show');
      toast(j.persisted ? 'Saved permanently: ' + (j.slug || j.id) : 'Saved temporarily — add GITHUB_TOKEN on Vercel to keep it forever');
      loadList();
    } catch (e) { toast('Network error'); }
  });

  el('btn-copy-url').addEventListener('click', () => copyText(el('r-url').value));
  el('btn-copy-loader').addEventListener('click', () => copyText(el('r-loader').value));
  el('btn-test').addEventListener('click', () => {
    if (el('r-url').value) window.open(el('r-url').value, '_blank');
  });

  el('btn-reload').addEventListener('click', loadList);

  async function loadList() {
    const box = el('link-list');
    try {
      const r = await fetch('/api/list');
      const j = await r.json();
      const items = j.scripts || [];
      el('link-count').textContent = items.length;
      box.textContent = items.length
        ? items.map((s) => '• ' + s.name + '  [s=' + (s.slug || '-') + ']  |  ' + s.id + '  |  ' + new Date(s.createdAt || Date.now()).toLocaleString()).join('\n')
        : 'No links yet — create your first one in the form above.';
    } catch (e) { box.textContent = 'Could not load the list.'; }
  }
  loadList();
})();
