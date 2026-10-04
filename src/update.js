// Sucht auf GitHub nach einer neueren Version (Releases von mrskynavi/ethos-log-viewer)
const https = require('https');

const API = 'https://api.github.com/repos/mrskynavi/ethos-log-viewer/releases/latest';

// "1.2.10" > "1.2.9"
function newer(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ethos-log-viewer', Accept: 'application/vnd.github+json' }, timeout: 10000 }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error('HTTP ' + res.statusCode)));
    });
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
    req.on('error', reject);
  });
}

// Fehler (offline, privates Repository) zählen als "keine neue Version"
async function check(current, fetchJson = getJson) {
  try {
    const r = await fetchJson(API);
    const latest = String(r.tag_name || '').replace(/^v/, '');
    return { current, latest, newer: newer(latest, current), url: r.html_url };
  } catch (e) {
    return { current, newer: false, error: e.message };
  }
}

module.exports = { newer, check };
