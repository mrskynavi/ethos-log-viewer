// KI-Auswertung in der Desktop-App: Aufrufe an Claude über das Anthropic-SDK, mit dem Schlüssel aus dem
// Schlüsselbund. Die Oberfläche baut die Anfrage (Daten, Frage, Werkzeuge) und führt die Werkzeuge aus;
// hier wird nur gesendet. Fehler kommen als {error:{kind,status,message}} zurück, nicht als Ausnahme.
let SDK = null;
function client(key) {
  SDK = SDK || require('@anthropic-ai/sdk');
  const Anthropic = SDK.Anthropic || SDK.default || SDK;
  return { Anthropic, c: new Anthropic({ apiKey: key, maxRetries: 2, timeout: 5 * 60 * 1000 }) };
}

const keyState = key => key ? { set: true, hint: 'sk-ant-…' + key.slice(-4) } : { set: false };

function errorOf(e, Anthropic) {
  const kind =
    e instanceof Anthropic.AuthenticationError ? 'auth' :
    e instanceof Anthropic.PermissionDeniedError ? 'permission' :
    e instanceof Anthropic.RateLimitError ? 'rate' :
    e instanceof Anthropic.APIConnectionError ? 'offline' :
    e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message) ? 'credit' :
    e instanceof Anthropic.APIError ? 'api' : 'other';
  return { error: { kind, status: e.status ?? null, message: String(e.error?.error?.message || e.message || e) } };
}

async function create(key, body) {
  if (!key) return { error: { kind: 'nokey', status: null, message: 'Kein API-Schlüssel hinterlegt.' } };
  const { Anthropic, c } = client(key);
  try {
    const { betas, ...params } = body;
    const msg = betas?.length ? await c.beta.messages.create({ ...params, betas }) : await c.messages.create(params);
    return { message: JSON.parse(JSON.stringify(msg)) };
  } catch (e) { return errorOf(e, Anthropic); }
}

// Schlüssel prüfen, ohne etwas zu kosten: Liste der Modelle abrufen
async function test(key) {
  if (!key) return { error: { kind: 'nokey', status: null, message: 'Kein API-Schlüssel hinterlegt.' } };
  const { Anthropic, c } = client(key);
  try { await c.models.list({ limit: 1 }); return { ok: true }; }
  catch (e) { return errorOf(e, Anthropic); }
}

module.exports = { create, test, keyState };
