const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/eject');

test('Laufwerk zum Sender-Ordner finden', () => {
  const vols = [{ root: '/Volumes/RADIO' }, { root: '/Volumes/RADIO2' }];
  assert.equal(E.volumeOf('/Volumes/RADIO/Radio/logs', vols, 'darwin'), '/Volumes/RADIO');
  assert.equal(E.volumeOf('/Volumes/RADIO2/logs', vols, 'darwin'), '/Volumes/RADIO2');
  assert.equal(E.volumeOf('/Volumes/X/logs', [], 'darwin'), '/Volumes/X');
  assert.equal(E.volumeOf('e:\\logs', [], 'win32'), 'E:\\');
});

test('Befehl je System', () => {
  assert.deepEqual(E.ejectCommand('/Volumes/RADIO', 'darwin'), ['diskutil', ['eject', '/Volumes/RADIO']]);
  const [cmd, args] = E.ejectCommand('E:\\', 'win32');
  assert.equal(cmd, 'powershell.exe'); assert.match(args.at(-1), /ParseName\('E:'\).*InvokeVerb\('Eject'\)/);
  assert.throws(() => E.ejectCommand("x'; rm", 'win32'));
});

test('Fehler beim Auswerfen werden gemeldet', async () => {
  const ok = (cmd, args, o, cb) => cb(null, '', '');
  await E.eject('/Volumes/RADIO', { platform: 'darwin', run: ok });
  const busy = (cmd, args, o, cb) => cb(Object.assign(new Error('x'), { code: 1 }), '', 'Volume RADIO failed to eject: in use');
  await assert.rejects(E.eject('/Volumes/RADIO', { platform: 'darwin', run: busy }), /in use/);
  await assert.rejects(E.eject('E:\\', { platform: 'win32', run: busy }), /noch verwendet/);
});
