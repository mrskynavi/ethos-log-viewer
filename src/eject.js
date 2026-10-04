// Sender sicher auswerfen, damit er abgezogen werden kann
const path = require('path');
const { execFile } = require('child_process');

// Laufwerk zu einem Ordner: das längste passende Laufwerk, sonst Laufwerksbuchstabe bzw. /Volumes/<Name>
function volumeOf(dir, vols = [], platform = process.platform) {
  const hit = vols.filter(v => dir === v.root || dir.startsWith(v.root.endsWith(path.sep) ? v.root : v.root + path.sep))
    .sort((a, b) => b.root.length - a.root.length)[0];
  if (hit) return hit.root;
  if (platform === 'win32') { const m = /^([a-z]:)/i.exec(dir); return m ? m[1].toUpperCase() + '\\' : null; }
  if (platform === 'darwin') { const m = /^(\/Volumes\/[^/]+)/.exec(dir); return m ? m[1] : null; }
  return null;
}

function ejectCommand(root, platform = process.platform) {
  if (platform === 'darwin') return ['diskutil', ['eject', root]];
  if (platform === 'win32') {
    const d = String(root).slice(0, 2).toUpperCase();
    if (!/^[A-Z]:$/.test(d)) throw new Error('Kein Laufwerksbuchstabe: ' + root);
    // Explorer-Befehl "Auswerfen"; danach prüfen, ob das Laufwerk wirklich weg ist
    const ps = `$i=(New-Object -ComObject Shell.Application).Namespace(17).ParseName('${d}'); if(-not $i){exit 2}; $i.InvokeVerb('Eject'); for($n=0;$n -lt 20;$n++){ Start-Sleep -Milliseconds 250; if(-not (Test-Path '${d}\\')){exit 0} }; exit 1`;
    return ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]];
  }
  return ['gio', ['mount', '-e', root]];
}

function eject(root, { platform = process.platform, run = execFile } = {}) {
  const [cmd, args] = ejectCommand(root, platform);
  return new Promise((res, rej) => run(cmd, args, { windowsHide: true, timeout: 20000 }, (err, out, errOut) => {
    if (!err) return res();
    const msg = String(errOut || out || '').trim();
    rej(new Error(err.code === 1 && platform === 'win32' ? 'Das Laufwerk wird noch verwendet.' : msg || err.message));
  }));
}

module.exports = { volumeOf, ejectCommand, eject };
