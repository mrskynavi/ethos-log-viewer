// Brücke für Claude Desktop: spricht MCP über stdin/stdout und reicht jede Nachricht an den
// MCP-Server der laufenden App weiter (http://127.0.0.1:<port>/mcp). Läuft mit dem Node der App:
//   "command": ".../MM Flight Analyzer", "args": [".../mcp-stdio.js"], "env": {"ELECTRON_RUN_AS_NODE": "1"}
const http = require('http');
const readline = require('readline');

const arg = process.argv.find(a => a.startsWith('--port='));
const PORT = +(arg ? arg.slice(7) : process.env.ETHOS_MCP_PORT) || 3917;
const DOWN = 'MM Flight Analyzer ist nicht geöffnet, oder der MCP-Server ist in den Einstellungen der App ausgeschaltet.';

function post(body) {
  return new Promise((ok, ko) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/mcp', method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Content-Length': Buffer.byteLength(body) } },
    res => { let d = ''; res.setEncoding('utf8'); res.on('data', c => d += c); res.on('end', () => ok({ status: res.statusCode, body: d })); });
    req.on('error', ko);
    req.setTimeout(120000, () => req.destroy(new Error('Zeitüberschreitung')));
    req.end(body);
  });
}

const out = obj => process.stdout.write(JSON.stringify(obj) + '\n');

readline.createInterface({ input: process.stdin }).on('line', async line => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return out({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  try {
    const r = await post(line);
    if (r.body) process.stdout.write(r.body.trim() + '\n');
  } catch (e) {
    if (msg.id === undefined) return;
    // Ohne App trotzdem verbinden, damit Claude den Server anzeigt; Werkzeuge melden dann, was fehlt
    if (msg.method === 'initialize') return out({ jsonrpc: '2.0', id: msg.id, result: {
      protocolVersion: msg.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} },
      serverInfo: { name: 'mm-flight-analyzer', version: '0' }, instructions: DOWN } });
    if (msg.method === 'ping') return out({ jsonrpc: '2.0', id: msg.id, result: {} });
    out({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: DOWN } });
  }
});
