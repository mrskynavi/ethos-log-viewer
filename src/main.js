// Desktop-Hülle: zeigt den Ethos Log Viewer und synchronisiert Logs vom Sender ins Archiv
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const S = require('./sync');

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = () => ({ senderPath: 'Radio/logs', archiveDir: S.defaultArchive(), autoSync: true, archiveManual: false });
let settings;
function loadSettings() {
  try { settings = { ...DEFAULTS(), ...JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')) }; }
  catch { settings = DEFAULTS(); }
  return settings;
}
function saveSettings(s) {
  settings = { ...settings, ...s };
  fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2));
  return settings;
}

let win, watcher;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 900, minWidth: 420, title: 'Ethos Log Viewer', backgroundColor: '#0f141a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// Lesen nur im Archiv und auf dem Sender
function allowed(p) {
  const r = path.resolve(p);
  const roots = [settings.archiveDir, ...(watcher?.synced || [])].map(x => path.resolve(x) + path.sep);
  return roots.some(x => r.startsWith(x));
}

ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:set', (_, s) => { const r = saveSettings(s); watcher.synced.clear(); watcher.poll(); return r; });
ipcMain.handle('dialog:folder', async (_, current) => {
  const r = await dialog.showOpenDialog(win, { defaultPath: current || undefined, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('sync:now', () => watcher.poll(true));
ipcMain.handle('sync:status', () => watcher.status);
ipcMain.handle('archive:list', () => S.listArchive(settings.archiveDir));
ipcMain.handle('archive:save', (_, name, bytes) => S.archiveFile(settings.archiveDir, name, Buffer.from(bytes)));
ipcMain.handle('archive:open', () => { fs.mkdirSync(settings.archiveDir, { recursive: true }); return shell.openPath(settings.archiveDir); });
ipcMain.handle('file:read', async (_, p) => { if (!allowed(p)) throw new Error('Kein Zugriff'); return fs.promises.readFile(p, 'utf8'); });
ipcMain.handle('file:peek', async (_, p, n) => {
  if (!allowed(p)) throw new Error('Kein Zugriff');
  const fh = await fs.promises.open(p, 'r');
  try {
    const { size } = await fh.stat(), len = Math.min(n, size);
    const head = Buffer.alloc(len), tail = Buffer.alloc(len);
    await fh.read(head, 0, len, 0); await fh.read(tail, 0, len, Math.max(0, size - len));
    return { head: head.toString('utf8'), tail: tail.toString('utf8'), size };
  } finally { await fh.close(); }
});

app.whenReady().then(() => {
  loadSettings();
  watcher = new S.SyncWatcher(() => settings);
  watcher.on('status', s => win && !win.isDestroyed() && win.webContents.send('sync:status', s));
  createWindow();
  watcher.start();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { watcher?.stop(); app.quit(); });
