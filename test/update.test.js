const test = require('node:test');
const assert = require('node:assert');
const U = require('../src/update');

test('Versionen vergleichen', () => {
  assert.equal(U.newer('1.1.0', '1.0.1'), true);
  assert.equal(U.newer('v1.0.10', '1.0.9'), true);
  assert.equal(U.newer('1.0.1', '1.0.1'), false);
  assert.equal(U.newer('1.0.0', '1.0.1'), false);
});

test('Update-Suche meldet neue Version, Fehler zählen als keine', async () => {
  const u = await U.check('1.0.1', async () => ({ tag_name: 'v1.1.0', html_url: 'https://github.com/mrskynavi/ethos-log-viewer/releases/tag/v1.1.0' }));
  assert.equal(u.newer, true); assert.equal(u.latest, '1.1.0');
  const e = await U.check('1.0.1', async () => { throw new Error('HTTP 404'); });
  assert.equal(e.newer, false);
});
