const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const H = require('../scripts/hilfe.js');

test('Hilfetext in web/index.html entspricht dem Handbuch (sonst npm run hilfe)', () => {
  const html = fs.readFileSync(H.INDEX, 'utf8');
  assert.equal(H.apply(html, H.build()), html);
});

test('Kapitel ohne Changelog, Text ohne HTML', () => {
  const k = H.build();
  assert.ok(k.length > 20);
  assert.ok(!k.some(x => /Änderungen pro Version/.test(x.titel)));
  assert.ok(!k.some(x => /<\w+[ >]|\{\{/.test(x.text)));
  assert.ok(k.find(x => x.nr === 11).text.includes('Verbrauch'));
});
