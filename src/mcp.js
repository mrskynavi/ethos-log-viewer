// MCP-Server (Streamable HTTP, nur JSON-Antworten): macht die App für Claude Desktop, Claude Code
// und andere MCP-Programme erreichbar. Läuft nur auf 127.0.0.1. Die Werkzeuge sind dieselben Aktionen,
// die auch die KI-Auswertung in der App benutzt; sie werden im Fenster ausgeführt (getTools/callTool).
const http = require('http');

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_PORT = 3917;

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });

// Eine JSON-RPC-Nachricht beantworten; null = Benachrichtigung, keine Antwort
async function handle(msg, { getTools, callTool, version }) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg?.id, -32600, 'Invalid Request');
  const { id, method, params } = msg;
  if (id === undefined) return null;
  try {
    switch (method) {
      case 'initialize': {
        const want = params?.protocolVersion;
        return rpcResult(id, {
          protocolVersion: VERSIONS.includes(want) ? want : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'mm-flight-analyzer', title: 'MM Flight Analyzer', version },
          instructions: 'MM Flight Analyzer: Telemetrie-Logs von Ethos- und Jeti-Sendern (Modellflug). Zuerst app_zustand aufrufen, dann daten_lesen für Zahlenreihen. Zeiten sind Flugzeit ab Logbeginn (m:ss). Aktionen ändern die Ansicht in der laufenden App und lassen sich mit rueckgaengig zurücknehmen.',
        });
      }
      case 'ping': return rpcResult(id, {});
      case 'tools/list': return rpcResult(id, { tools: await getTools() });
      case 'tools/call': {
        const name = params?.name;
        if (typeof name !== 'string') return rpcError(id, -32602, 'Werkzeugname fehlt');
        const r = await callTool(name, params.arguments || {});
        const text = r.ok ? JSON.stringify(r.result, null, 1) : String(r.error || 'Fehler');
        return rpcResult(id, { content: [{ type: 'text', text }], isError: !r.ok });
      }
      default: return rpcError(id, -32601, 'Unbekannte Methode: ' + method);
    }
  } catch (e) {
    return rpcError(id, -32603, e.message || String(e));
  }
}

// Nur Aufrufe vom eigenen Rechner: Host muss localhost sein, und Browser (die einen Origin mitschicken) bleiben draussen
function allowedRequest(req, port) {
  const host = String(req.headers.host || '');
  if (![`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host)) return false;
  const origin = req.headers.origin;
  return !origin || origin === 'null';
}

function createServer(opts) {
  const port = opts.port || DEFAULT_PORT;
  const server = http.createServer((req, res) => {
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body));
    };
    if (!allowedRequest(req, port)) return send(403, rpcError(null, -32000, 'Forbidden'));
    if (req.url.split('?')[0] !== '/mcp') return send(404, rpcError(null, -32000, 'Not found'));
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, rpcError(null, -32000, 'Method not allowed')); }
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return send(400, rpcError(null, -32700, 'Parse error')); }
      if (Array.isArray(msg)) {
        const out = (await Promise.all(msg.map(m => handle(m, opts)))).filter(Boolean);
        return out.length ? send(200, out) : send(202, null);
      }
      const out = await handle(msg, opts);
      return out ? send(200, out) : send(202, null);
    });
  });
  return {
    listen: () => new Promise((ok, ko) => {
      server.once('error', ko);
      server.listen(port, '127.0.0.1', () => { server.off('error', ko); ok(port); });
    }),
    close: () => new Promise(ok => server.close(() => ok())),
    port,
  };
}

module.exports = { createServer, handle, allowedRequest, DEFAULT_PORT, VERSIONS };
