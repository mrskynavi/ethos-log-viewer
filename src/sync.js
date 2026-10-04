// Log-Sync: findet den angeschlossenen Ethos-Sender, kopiert neue Logs ins Archiv (ein Ordner pro Modell).
// Reines Node, ohne Electron, damit es sich ohne Oberfläche testen lässt.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { EventEmitter } = require('events');

const NAME_RE = /^(.*?)-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})\.csv$/i;

function modelOf(name) {
  const m = NAME_RE.exec(name);
  return m ? m[1] : 'Ohne Modell';
}

// Modellname als Ordnername, auf Windows und macOS gültig
function safeDir(s) {
  return String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim() || 'Ohne Modell';
}

async function isDir(p) {
  try { return (await fsp.stat(p)).isDirectory(); } catch { return false; }
}

// Windows: Laufwerksbezeichnung über "vol", kurz gecacht
const labelCache = new Map();
function winLabel(letter) {
  const hit = labelCache.get(letter);
  if (hit && Date.now() - hit.t < 30000) return Promise.resolve(hit.label);
  return new Promise(res => {
    execFile('cmd.exe', ['/c', 'vol', letter + ':'], { windowsHide: true, timeout: 3000 }, (err, out) => {
      const m = /(?:is|ist)\s+(.+?)\s*$/im.exec(String(out || '').split(/\r?\n/)[0] || '');
      const label = err || !m ? '' : m[1].trim();
      labelCache.set(letter, { t: Date.now(), label });
      res(label);
    });
  });
}

// Alle eingehängten Laufwerke mit Namen: { root, label }
async function volumes(platform = process.platform) {
  if (platform === 'win32') {
    const out = [];
    for (const L of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
      const root = L + ':\\';
      if (await isDir(root)) out.push({ root, label: await winLabel(L) });
    }
    return out;
  }
  const bases = platform === 'darwin' ? ['/Volumes'] :
    [`/media/${os.userInfo().username}`, `/run/media/${os.userInfo().username}`, '/media', '/mnt'];
  const out = [];
  for (const b of bases) {
    let names = [];
    try { names = await fsp.readdir(b); } catch { continue; }
    for (const n of names) {
      const root = path.join(b, n);
      if (await isDir(root)) out.push({ root, label: n });
    }
  }
  return out;
}

// Wo liegen die Logs? senderPath ist relativ ("Radio/logs") oder absolut ("E:\\logs").
// Relativ wird auf jedem Laufwerk gesucht; ist der erste Teil der Name des Laufwerks
// (Laufwerk "RADIO" mit Ordner "logs"), zählt das auch.
async function findSenderDirs(senderPath, vols) {
  const p = String(senderPath || '').trim();
  if (!p) return [];
  if (path.isAbsolute(p) || /^[a-z]:[\\/]/i.test(p)) return (await isDir(p)) ? [p] : [];
  const parts = p.split(/[\\/]+/).filter(Boolean);
  const found = [];
  for (const v of vols) {
    const cands = [path.join(v.root, ...parts)];
    if (parts.length > 1 && v.label && v.label.toLowerCase() === parts[0].toLowerCase())
      cands.push(path.join(v.root, ...parts.slice(1)));
    for (const c of cands) if (!found.includes(c) && await isDir(c)) found.push(c);
  }
  return found;
}

async function listCsv(dir) {
  let names = [];
  try { names = await fsp.readdir(dir); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!/\.csv$/i.test(name) || name.startsWith('._')) continue;
    try {
      const st = await fsp.stat(path.join(dir, name));
      if (st.isFile()) out.push({ name, size: st.size, mtime: st.mtimeMs });
    } catch {}
  }
  return out;
}

// Ein Log gilt als vorhanden, wenn es im Modell-Ordner mit gleicher Grösse liegt
async function plan(src, archive) {
  const files = await listCsv(src), todo = [];
  let skipped = 0;
  for (const f of files) {
    const dest = path.join(archive, safeDir(modelOf(f.name)), f.name);
    let same = false;
    try { same = (await fsp.stat(dest)).size === f.size; } catch {}
    if (same) skipped++; else todo.push({ ...f, src: path.join(src, f.name), dest });
  }
  return { files, todo, skipped };
}

async function copyOne(f) {
  await fsp.mkdir(path.dirname(f.dest), { recursive: true });
  const tmp = f.dest + '.part';
  await fsp.copyFile(f.src, tmp);
  await fsp.rename(tmp, f.dest);
  const t = new Date(f.mtime);
  try { await fsp.utimes(f.dest, t, t); } catch {}
}

async function syncDir(src, archive, onProgress = () => {}) {
  const { files, todo, skipped } = await plan(src, archive);
  const bytes = todo.reduce((a, f) => a + f.size, 0);
  const res = { source: src, total: files.length, skipped, copied: [], errors: [], bytes };
  let doneBytes = 0;
  onProgress({ state: 'copy', source: src, total: todo.length, done: 0, skipped, bytes, doneBytes });
  for (const f of todo) {
    onProgress({ state: 'copy', source: src, total: todo.length, done: res.copied.length + res.errors.length, skipped, bytes, doneBytes, file: f.name });
    try { await copyOne(f); res.copied.push({ name: f.name, model: modelOf(f.name), path: f.dest }); }
    catch (e) { res.errors.push({ name: f.name, error: e.message }); }
    doneBytes += f.size;
  }
  return res;
}

// Ein Log ins Archiv legen (manuell eingelesen). Liegt es schon dort, passiert nichts.
async function archiveFile(archive, name, data) {
  const dest = path.join(archive, safeDir(modelOf(name)), path.basename(name));
  try { if ((await fsp.stat(dest)).size === data.length) return { path: dest, existed: true }; } catch {}
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.writeFile(dest + '.part', data);
  await fsp.rename(dest + '.part', dest);
  return { path: dest, existed: false };
}

// Alle Logs im Archiv (Modell-Ordner und lose CSVs in der Wurzel)
async function listArchive(archive) {
  const out = [];
  const add = async dir => { for (const f of await listCsv(dir)) out.push({ ...f, path: path.join(dir, f.name) }); };
  if (!(await isDir(archive))) return out;
  await add(archive);
  for (const d of await fsp.readdir(archive, { withFileTypes: true })) if (d.isDirectory()) await add(path.join(archive, d.name));
  return out;
}

// Cloud-Ordner vorschlagen: Google Drive, dann OneDrive, sonst Dokumente
function defaultArchive(env = process.env, home = os.homedir(), platform = process.platform) {
  const tries = [];
  if (platform === 'win32') {
    for (const L of 'GHIJKLM') tries.push(`${L}:\\My Drive`, `${L}:\\Meine Ablage`);
    tries.push(path.join(home, 'Google Drive', 'My Drive'), path.join(home, 'Google Drive'));
    if (env.OneDrive) tries.push(env.OneDrive);
    if (env.OneDriveConsumer) tries.push(env.OneDriveConsumer);
  } else if (platform === 'darwin') {
    const cs = path.join(home, 'Library', 'CloudStorage');
    let names = [];
    try { names = fs.readdirSync(cs); } catch {}
    for (const n of names.filter(n => n.startsWith('GoogleDrive-'))) tries.push(path.join(cs, n, 'My Drive'), path.join(cs, n, 'Meine Ablage'));
    tries.push(path.join(home, 'Google Drive', 'My Drive'));
    for (const n of names.filter(n => n.startsWith('OneDrive'))) tries.push(path.join(cs, n));
  }
  for (const t of tries) { try { if (fs.statSync(t).isDirectory()) return path.join(t, 'Ethos Logs'); } catch {} }
  return path.join(home, 'Documents', 'Ethos Logs');
}

// Schaut alle paar Sekunden nach dem Sender und synchronisiert einmal pro Anschluss
class SyncWatcher extends EventEmitter {
  constructor(getSettings, opts = {}) {
    super();
    this.getSettings = getSettings;
    this.interval = opts.interval || 3000;
    this.volumes = opts.volumes || volumes;
    this.synced = new Set();
    this.busy = false;
    this.status = { state: 'idle' };
  }
  start() { this.stop(); this.timer = setInterval(() => this.poll(), this.interval); this.poll(); }
  stop() { clearInterval(this.timer); this.timer = null; }
  set(s) { this.status = s; this.emit('status', s); }
  async poll(force = false) {
    if (this.busy) return this.status;
    const st = this.getSettings();
    if (!force && !st.autoSync) { if (this.status.state !== 'off') this.set({ state: 'off' }); return this.status; }
    this.busy = true;
    try {
      const dirs = await findSenderDirs(st.senderPath, await this.volumes());
      for (const d of [...this.synced]) if (!dirs.includes(d)) this.synced.delete(d);
      if (!dirs.length) {
        // Sender abgezogen: das letzte Ergebnis bleibt sichtbar
        if (this.status.state === 'done' && this.status.connected) this.set({ ...this.status, connected: false });
        else if (this.status.state !== 'done' && this.status.state !== 'idle') this.set({ state: 'idle' });
        return this.status;
      }
      const todo = force ? dirs : dirs.filter(d => !this.synced.has(d));
      if (!todo.length) return this.status;
      const all = { state: 'done', connected: true, sources: [], copied: [], errors: [], skipped: 0, total: 0, at: Date.now() };
      for (const d of todo) {
        this.set({ state: 'copy', source: d, total: 0, done: 0 });
        const r = await syncDir(d, st.archiveDir, p => this.set(p));
        this.synced.add(d);
        all.sources.push(d); all.copied.push(...r.copied); all.errors.push(...r.errors);
        all.skipped += r.skipped; all.total += r.total;
      }
      this.set(all);
      return all;
    } catch (e) {
      this.set({ state: 'error', error: e.message });
      return this.status;
    } finally { this.busy = false; }
  }
}

module.exports = { modelOf, safeDir, volumes, findSenderDirs, listCsv, syncDir, archiveFile, listArchive, defaultArchive, SyncWatcher };
