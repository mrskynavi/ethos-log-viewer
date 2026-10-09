// Umbenennung "Ethos Log Viewer" → "MM Flight Analyzer": Der Datenordner der App heisst wie die App.
// Beim ersten Start nach dem Update holt die App Einstellungen, Ansicht (Local Storage) und den
// verschlüsselten KI-Schlüssel aus dem alten Ordner. Der alte Ordner bleibt unverändert liegen.
const fs = require('fs');
const path = require('path');

const OLD_NAME = 'Ethos Log Viewer';
const ITEMS = ['settings.json', 'ai-key.bin', 'Local Storage', 'IndexedDB'];

// Gibt die übernommenen Einträge zurück ([] = nichts zu tun)
function migrate(oldDir, newDir) {
  if (!oldDir || path.resolve(oldDir) === path.resolve(newDir)) return [];
  // Schon eingerichtet (eigene Einstellungen oder Ansicht vorhanden): nie überschreiben
  if (['settings.json', 'Local Storage'].some(n => fs.existsSync(path.join(newDir, n)))) return [];
  const todo = ITEMS.filter(n => fs.existsSync(path.join(oldDir, n)));
  if (!todo.length) return [];
  fs.mkdirSync(newDir, { recursive: true });
  const done = [];
  for (const n of todo) {
    try {
      fs.cpSync(path.join(oldDir, n), path.join(newDir, n), { recursive: true, force: false, errorOnExist: false,
        filter: src => !/(^|[\\/])LOCK$/.test(src) });
      done.push(n);
    } catch (e) { console.error('Übernahme fehlgeschlagen:', n, e.message); }
  }
  return done;
}

module.exports = { migrate, OLD_NAME };
