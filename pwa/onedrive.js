// OneDrive: Logs direkt aus dem Archiv-Ordner in OneDrive lesen (Microsoft Graph), nur in der Web-App.
// Wird von scripts/build-pwa.js nach dem Hauptskript eingebunden und nutzt dessen globale Funktionen
// (FILES, openLog, openModel, renderLogs, fillInfo, peekGet/peekPut, store, T, EN).
(function(){
  const CFG = window.ETHOS_ONEDRIVE || {};
  if (!CFG.clientId || typeof msal === 'undefined' || window.ethosDesktop) return;

  Object.assign(EN, {
    'Logs aus „{f}“ in OneDrive': 'Logs from “{f}” in OneDrive',
    'Anmelden und Logs aus „{f}“ lesen': 'Sign in and read logs from “{f}”',
    'OneDrive-Ordner': 'OneDrive folder',
    'Ordner mit den Logs, wie ihn die Desktop-App als Archiv anlegt (pro Modell ein Unterordner).': 'Folder with the logs, as the desktop app creates it as archive (one subfolder per model).',
    'Angemeldet als {u}': 'Signed in as {u}',
    'Nicht angemeldet': 'Not signed in',
    'Abmelden': 'Sign out',
    'OneDrive: Ordner „{f}“ nicht gefunden.': 'OneDrive: folder “{f}” not found.',
    'OneDrive: {e}': 'OneDrive: {e}',
    'OneDrive-Anmeldung abgelaufen.': 'OneDrive sign-in expired.',
    'Neu anmelden': 'Sign in again',
    'Lade {n} aus OneDrive …': 'Loading {n} from OneDrive …',
    'Lese OneDrive …': 'Reading OneDrive …',
    'Ohne Netz nicht verfügbar, das Log wurde noch nie geöffnet.': 'Not available offline, this log has never been opened.',
  });

  const SCOPES = ['Files.Read'];
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const LOGCACHE = 'onedrive-logs';
  const NEED_LOGIN = new Error('login');
  const pca = new msal.PublicClientApplication({
    auth: { clientId: CFG.clientId, authority: 'https://login.microsoftonline.com/common',
      redirectUri: location.origin + location.pathname.replace(/index\.html$/, '') },
    cache: { cacheLocation: 'localStorage' },
  });
  const folder = () => (store.get('od.folder') || 'Ethos Logs').replace(/^\/+|\/+$/g, '');
  let account = null, lastList = 0;

  // --- Oberfläche: Knopf im Import-Dialog, Ordner und Abmelden in den Einstellungen
  $('#importDlg .impopts').insertAdjacentHTML('beforeend',
    '<button class="impopt" type="button" id="odPick"><b>OneDrive</b><span id="odPickSub"></span></button>');
  $('#setForm .about').insertAdjacentHTML('beforebegin',
    `<label>${T('OneDrive-Ordner')}<input type="text" id="odFolder" spellcheck="false" placeholder="Ethos Logs">` +
    `<span class="hint">${T('Ordner mit den Logs, wie ihn die Desktop-App als Archiv anlegt (pro Modell ein Unterordner).')}</span>` +
    `<span class="row"><span class="hint" id="odWho"></span><button type="button" class="btn ghost" id="odOut" hidden>${T('Abmelden')}</button></span></label>`);
  function ui(){
    $('#odPickSub').textContent = account ? T('Logs aus „{f}“ in OneDrive', { f: folder() }) : T('Anmelden und Logs aus „{f}“ lesen', { f: folder() });
    $('#odFolder').value = folder();
    $('#odWho').textContent = account ? T('Angemeldet als {u}', { u: account.username }) : T('Nicht angemeldet');
    $('#odOut').hidden = !account;
  }
  $('#odPick').addEventListener('click', async () => {
    if (!account) { await login(); return; }
    $('#importDlg').close(); refresh(true);
  });
  $('#setForm').addEventListener('submit', () => {
    const f = $('#odFolder').value.trim(), changed = (f || 'Ethos Logs') !== folder();
    store.set('od.folder', f);
    if (changed && account) { forget(); refresh(true); }
    ui();
  });
  $('#settingsDlg').addEventListener('close', ui);
  ui();
  $('#odOut').addEventListener('click', async () => {
    forget(); const a = account; account = null; ui();
    FILES = FILES.filter(f => !f.od); CUR = -1; renderLogs();
    $('#fileinfo').innerHTML = `<span class="hint">${T('Öffne ein Ethos-Log (CSV), um es auszuwerten.')}</span>`;
    await pca.logoutRedirect({ account: a, postLogoutRedirectUri: location.href.split('#')[0] }).catch(() => {});
  });
  // Fehler beim Öffnen gehören in die Dateizeile; beim Aktualisieren der Liste stört ein Hinweis
  // neben der Log-Anzahl das offene Log nicht
  $('#logcount').insertAdjacentHTML('afterend', '<span class="hint" id="odNote" hidden></span>');
  function showErr(msg, relogin, quiet){
    const html = `<span class="err">${esc(msg)}</span>` + (relogin ? ` <button type="button" class="btn ghost odRe">${T('Neu anmelden')}</button>` : '');
    const el = quiet ? $('#odNote') : $('#fileinfo');
    el.innerHTML = html; el.hidden = false;
    el.querySelector('.odRe')?.addEventListener('click', login);
  }

  // --- Anmeldung
  function login(){ return pca.loginRedirect({ scopes: SCOPES, prompt: 'select_account' }); }
  async function token(){
    if (!account) throw NEED_LOGIN;
    try { return (await pca.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; }
    catch (e) { console.warn('OneDrive-Token:', e); throw NEED_LOGIN; }
  }
  async function graph(url){
    const r = await fetch(url.startsWith('http') ? url : GRAPH + url, { headers: { Authorization: 'Bearer ' + await token() } });
    if (r.status === 401) throw NEED_LOGIN;
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  async function all(url){ const out = []; while (url) { const j = await graph(url); out.push(...j.value); url = j['@odata.nextLink']; } return out; }

  // --- Liste: CSV direkt im Ordner und in seinen Unterordnern (eine Ebene, wie das Archiv der Desktop-App)
  async function list(){
    const sel = '?$select=id,name,size,eTag,file,folder&$top=999';
    const path = folder().split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const top = await all(path ? `/me/drive/root:/${path}:/children${sel}` : `/me/drive/root/children${sel}`);
    const subs = await Promise.all(top.filter(x => x.folder).map(d => all(`/me/drive/items/${d.id}/children${sel}`)));
    return top.concat(...subs).filter(x => x.file && /\.csv$/i.test(x.name)).map(x => ({ id: x.id, name: x.name, size: x.size, etag: x.eTag }));
  }
  function forget(){ try { localStorage.removeItem('ethoslv.od.list'); } catch (e) {} }

  function apply(items){
    const cache = peekGet(), todo = [];
    const infos = items.map(a => {
      const info = { path: 'onedrive:' + a.id, od: a, name: a.name, ...nameInfo(a.name), size: a.size, dur: null }, k = 'od|' + a.id + '|' + a.size;
      if (cache[k]) Object.assign(info, cache[k]); else todo.push([info, k]);
      return info; });
    const cur = FILES[CUR]?.name, wasExample = !!FILES[CUR] && !FILES[CUR].file && !FILES[CUR].path;
    // OneDrive-Logs ersetzen gleichnamige importierte Logs, das Beispiel-Log fällt weg
    FILES = FILES.filter(f => f.file && !f.od && !infos.some(n => n.name === f.name)).concat(infos);
    FILES.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    CUR = cur ? FILES.findIndex(f => f.name === cur) : -1;
    if ((wasExample || CUR < 0) && FILES.length) { const M = models(), saved = store.get('model'); CUR = -1; openModel(saved && M.has(saved) ? saved : FILES[0].model); }
    else { if (!FILES.length) CUR = -1; renderLogs(); }
    if (navigator.onLine) peekAll(todo);
  }

  async function refresh(loud){
    if (!account) return;
    if (loud) $('#fileinfo').innerHTML = `<span class="hint">${T('Lese OneDrive …')}</span>`;
    const quiet = !loud && CUR >= 0;
    try {
      const items = await list(); lastList = Date.now(); $('#odNote').hidden = true;
      store.set('od.list', JSON.stringify(items));
      apply(items);
    } catch (e) {
      if (e === NEED_LOGIN) showErr(T('OneDrive-Anmeldung abgelaufen.'), true, quiet);
      else if (e.status === 404) showErr(T('OneDrive: Ordner „{f}“ nicht gefunden.', { f: folder() }), false, quiet);
      else showErr(T('OneDrive: {e}', { e: e.message }), false, quiet);
    }
  }

  // --- Dauer, Sensoren usw. aus Anfang und Ende jeder Datei, ohne sie ganz zu laden
  async function url(id){ return (await graph(`/me/drive/items/${id}?$select=id,@microsoft.graph.downloadUrl`))['@microsoft.graph.downloadUrl']; }
  async function range(u, a, b){ const r = await fetch(u, { headers: { Range: `bytes=${a}-${b}` } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }
  let peekRun = 0;
  async function peekAll(todo){
    const run = ++peekRun; let next = 0, changed = 0;
    const worker = async () => { while (next < todo.length && run === peekRun) { const [info, k] = todo[next++];
      try { const u = await url(info.od.id), n = info.size;
        fillInfo(info, await range(u, 0, Math.min(n, 4000) - 1), await range(u, Math.max(0, n - 4000), n - 1));
        peekPut(k, { dur: info.dur, sensors: info.sensors, gps: info.gps, rows: info.rows, date: info.date, time: info.time }); changed++;
      } catch (e) { if (e === NEED_LOGIN) return; } } };
    const tick = setInterval(() => { if (changed && run === peekRun) { changed = 0; renderLogs(); } }, 800);
    await Promise.all([worker(), worker(), worker()]);
    clearInterval(tick); if (run === peekRun) renderLogs();
  }

  // --- Öffnen: ganze Datei laden und auf dem Gerät behalten, damit sie auch ohne Netz aufgeht
  async function download(f){
    const c = await caches.open(LOGCACHE), base = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'onedrive-cache/' + encodeURIComponent(f.od.id);
    const key = base + '?v=' + encodeURIComponent(f.od.etag || f.size);
    let r = await c.match(key);
    if (!r) {
      if (!navigator.onLine) throw new Error(T('Ohne Netz nicht verfügbar, das Log wurde noch nie geöffnet.'));
      const d = await fetch(await url(f.od.id)); if (!d.ok) throw new Error('HTTP ' + d.status);
      for (const old of await c.keys()) if (old.url.startsWith(base + '?')) await c.delete(old);
      await c.put(key, d.clone()); r = d;
    }
    return new File([await r.blob()], f.name, { type: 'text/csv' });
  }
  const baseOpen = openLog;
  openLog = async function(i){
    const f = FILES[i];
    if (f && f.od && !f.file) {
      CUR = i; store.set('model', f.model); renderLogs();
      $('#fileinfo').innerHTML = `<span class="hint">${esc(T('Lade {n} aus OneDrive …', { n: f.name }))}</span>`;
      try { f.file = await download(f); }
      catch (e) { if (e === NEED_LOGIN) showErr(T('OneDrive-Anmeldung abgelaufen.'), true); else showErr(f.name + ': ' + e.message); return; }
    }
    return baseOpen(i);
  };

  // --- Start: Anmeldung abschliessen, letzte Liste sofort zeigen, dann frisch lesen
  (async () => {
    try {
      await pca.initialize();
      const res = await pca.handleRedirectPromise();
      account = res?.account || pca.getAllAccounts()[0] || null;
    } catch (e) { console.warn('OneDrive-Anmeldung:', e); }
    ui();
    if (!account) return;
    await BOOT;
    let cached = null; try { cached = JSON.parse(store.get('od.list') || 'null'); } catch (e) {}
    if (cached?.length) apply(cached);
    if (navigator.onLine) refresh(!cached?.length);
  })();
  // neue Logs holen, wenn die App nach einer Weile wieder in den Vordergrund kommt
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && account && navigator.onLine && Date.now() - lastList > 5 * 60e3) refresh(false);
  });
})();
