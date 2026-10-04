const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const S = require('../src/sync');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ethos-')); }
function put(p, txt) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); }

test('Modell aus dem Dateinamen', () => {
  assert.equal(S.modelOf('SB-10-2026-10-02-14-39-06.csv'), 'SB-10');
  assert.equal(S.modelOf('ASW-17-Thermik-2026-09-30-15-55-27.csv'), 'ASW-17-Thermik');
  assert.equal(S.modelOf('irgendwas.csv'), 'Ohne Modell');
  assert.equal(S.safeDir('A:B/C.'), 'A_B_C');
});

test('Sender über relativen Pfad und Laufwerksnamen finden', async () => {
  const root = tmp();
  put(path.join(root, 'USB1', 'Radio', 'logs', 'x.csv'), 'a');      // Ordner Radio/logs
  put(path.join(root, 'RADIO', 'logs', 'y.csv'), 'b');              // Laufwerk "RADIO" mit logs
  put(path.join(root, 'Fremd', 'logs', 'z.csv'), 'c');              // anderes Laufwerk mit logs: nicht nehmen
  const vols = ['USB1', 'RADIO', 'Fremd'].map(n => ({ root: path.join(root, n), label: n }));
  const dirs = await S.findSenderDirs('Radio/logs', vols);
  assert.deepEqual(dirs.sort(), [path.join(root, 'RADIO', 'logs'), path.join(root, 'USB1', 'Radio', 'logs')].sort());
  assert.deepEqual(await S.findSenderDirs(path.join(root, 'Fremd', 'logs'), vols), [path.join(root, 'Fremd', 'logs')]);
});

test('Sync kopiert nur neue Logs, ein Ordner pro Modell', async () => {
  const src = tmp(), arc = tmp();
  put(path.join(src, 'SB-10-2026-10-02-14-39-06.csv'), 'eins');
  put(path.join(src, 'Ka6-2026-08-15-09-30-00.csv'), 'zwei');
  put(path.join(src, 'notiz.txt'), 'x');
  const prog = [];
  let r = await S.syncDir(src, arc, p => prog.push(p));
  assert.equal(r.copied.length, 2);
  assert.ok(fs.existsSync(path.join(arc, 'SB-10', 'SB-10-2026-10-02-14-39-06.csv')));
  assert.ok(fs.existsSync(path.join(arc, 'Ka6', 'Ka6-2026-08-15-09-30-00.csv')));
  assert.ok(prog.some(p => p.file));
  r = await S.syncDir(src, arc);
  assert.equal(r.copied.length, 0); assert.equal(r.skipped, 2);
  put(path.join(src, 'SB-10-2026-10-03-10-00-00.csv'), 'drei');
  r = await S.syncDir(src, arc);
  assert.deepEqual(r.copied.map(c => c.name), ['SB-10-2026-10-03-10-00-00.csv']);
  const list = await S.listArchive(arc);
  assert.equal(list.length, 3);
  assert.ok(!fs.readdirSync(path.join(arc, 'SB-10')).some(n => n.endsWith('.part')));
});

test('Manuell eingelesenes Log ins Archiv', async () => {
  const arc = tmp();
  const a = await S.archiveFile(arc, 'SB-10-2026-10-02-14-39-06.csv', Buffer.from('abc'));
  assert.equal(a.existed, false);
  const b = await S.archiveFile(arc, 'SB-10-2026-10-02-14-39-06.csv', Buffer.from('abc'));
  assert.equal(b.existed, true);
});

test('Watcher synchronisiert einmal pro Anschluss', async () => {
  const root = tmp(), arc = tmp();
  const vol = { root: path.join(root, 'RADIO'), label: 'RADIO' };
  let plugged = false;
  const w = new S.SyncWatcher(() => ({ senderPath: 'Radio/logs', archiveDir: arc, autoSync: true }), { volumes: async () => plugged ? [vol] : [] });
  const states = []; w.on('status', s => states.push(s.state));
  assert.equal((await w.poll()).state, 'idle');
  put(path.join(vol.root, 'logs', 'SB-10-2026-10-02-14-39-06.csv'), 'x'); plugged = true;
  let s = await w.poll();
  assert.equal(s.state, 'done'); assert.equal(s.copied.length, 1);
  await w.poll(); assert.equal(states.filter(x => x === 'done').length, 1, 'kein zweiter Sync, solange angeschlossen');
  plugged = false; s = await w.poll(); assert.equal(s.connected, false);
  put(path.join(vol.root, 'logs', 'SB-10-2026-10-04-08-00-00.csv'), 'y'); plugged = true;
  s = await w.poll(); assert.equal(s.copied.length, 1, 'neuer Anschluss, neues Log');
});
