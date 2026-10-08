const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const M = require('../src/mcp');

const tools = [{ name: 'app_zustand', description: 'Zustand', inputSchema: { type: 'object', properties: {} } }];
const opts = { version: '1.0.0', getTools: async () => tools,
  callTool: async (name, args) => name === 'app_zustand' ? { ok: true, result: { modell: 'SB-10', args } } : { ok: false, error: 'Unbekannt' } };

function post(port, body, headers = {}) {
  return new Promise((ok, ko) => {
    const s = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok({ status: res.statusCode, body: d ? JSON.parse(d) : null })); });
    req.on('error', ko); req.end(s);
  });
}

test('initialize, tools/list und tools/call', async () => {
  const r = await M.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, opts);
  assert.equal(r.result.protocolVersion, '2025-06-18');
  assert.ok(r.result.capabilities.tools);
  const l = await M.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, opts);
  assert.deepEqual(l.result.tools, tools);
  const c = await M.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'app_zustand', arguments: { a: 1 } } }, opts);
  assert.equal(c.result.isError, false);
  assert.deepEqual(JSON.parse(c.result.content[0].text), { modell: 'SB-10', args: { a: 1 } });
  const e = await M.handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'x' } }, opts);
  assert.equal(e.result.isError, true);
  assert.equal(await M.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, opts), null);
  assert.equal((await M.handle({ jsonrpc: '2.0', id: 5, method: 'nope' }, opts)).error.code, -32601);
});

test('unbekannte Protokollversion bekommt die neueste', async () => {
  const r = await M.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, opts);
  assert.equal(r.result.protocolVersion, M.VERSIONS[0]);
});

test('HTTP: nur localhost, kein Browser-Origin', async () => {
  const srv = M.createServer({ ...opts, port: 39171 });
  await srv.listen();
  try {
    const ok = await post(39171, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.equal(ok.status, 200); assert.equal(ok.body.result.tools[0].name, 'app_zustand');
    const note = await post(39171, { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(note.status, 202);
    const web = await post(39171, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Origin: 'https://evil.example' });
    assert.equal(web.status, 403);
    const host = await post(39171, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Host: 'evil.example:39171' });
    assert.equal(host.status, 403);
  } finally { await srv.close(); }
});

test('stdio-Brücke reicht Nachrichten durch und meldet, wenn die App fehlt', async () => {
  const srv = M.createServer({ ...opts, port: 39172 });
  await srv.listen();
  const run = (port, lines) => new Promise(ok => {
    const p = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'mcp-stdio.js'), '--port=' + port]);
    let d = ''; p.stdout.on('data', c => { d += c; if (d.split('\n').filter(Boolean).length >= lines.length) { p.kill(); } });
    p.on('exit', () => ok(d.split('\n').filter(Boolean).map(l => JSON.parse(l))));
    for (const l of lines) p.stdin.write(JSON.stringify(l) + '\n');
  });
  try {
    const r = await run(39172, [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]);
    assert.equal(r[0].result.tools[0].name, 'app_zustand');
  } finally { await srv.close(); }
  const down = await run(39173, [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }]);
  assert.ok(down.find(x => x.id === 1).result.serverInfo);
  assert.match(down.find(x => x.id === 2).error.message, /nicht geöffnet/);
});
