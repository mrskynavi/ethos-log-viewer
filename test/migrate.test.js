const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrate } = require('../src/migrate');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
function oldDir() {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'settings.json'), '{"archiveDir":"/x"}');
  fs.writeFileSync(path.join(d, 'ai-key.bin'), 'geheim');
  fs.mkdirSync(path.join(d, 'Local Storage', 'leveldb'), { recursive: true });
  fs.writeFileSync(path.join(d, 'Local Storage', 'leveldb', '000003.log'), 'ansicht');
  fs.writeFileSync(path.join(d, 'Local Storage', 'leveldb', 'LOCK'), '');
  fs.mkdirSync(path.join(d, 'Cache'));
  return d;
}

test('übernimmt Einstellungen, Ansicht und Schlüssel aus dem alten Ordner', () => {
  const o = oldDir(), n = path.join(tmp(), 'MM Flight Analyzer');
  assert.deepStrictEqual(migrate(o, n), ['settings.json', 'ai-key.bin', 'Local Storage']);
  assert.strictEqual(fs.readFileSync(path.join(n, 'settings.json'), 'utf8'), '{"archiveDir":"/x"}');
  assert.strictEqual(fs.readFileSync(path.join(n, 'Local Storage', 'leveldb', '000003.log'), 'utf8'), 'ansicht');
  assert.ok(!fs.existsSync(path.join(n, 'Local Storage', 'leveldb', 'LOCK')));
  assert.ok(!fs.existsSync(path.join(n, 'Cache')));
  assert.ok(fs.existsSync(path.join(o, 'settings.json')), 'alter Ordner bleibt');
});

test('überschreibt nie einen schon benutzten neuen Ordner', () => {
  const o = oldDir(), n = tmp();
  fs.writeFileSync(path.join(n, 'settings.json'), '{"neu":true}');
  assert.deepStrictEqual(migrate(o, n), []);
  assert.strictEqual(fs.readFileSync(path.join(n, 'settings.json'), 'utf8'), '{"neu":true}');
  assert.ok(!fs.existsSync(path.join(n, 'ai-key.bin')));
});

test('läuft ein zweites Mal nicht nochmals', () => {
  const o = oldDir(), n = tmp();
  assert.strictEqual(migrate(o, n).length, 3);
  fs.writeFileSync(path.join(o, 'settings.json'), '{"spaeter":true}');
  assert.deepStrictEqual(migrate(o, n), []);
});

test('ohne alten Ordner passiert nichts', () => {
  const n = tmp();
  assert.deepStrictEqual(migrate(path.join(n, 'gibt-es-nicht'), path.join(n, 'neu')), []);
  assert.ok(!fs.existsSync(path.join(n, 'neu')));
});
