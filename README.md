# Ethos Log Viewer

Wertet Telemetrie-Logs (CSV) von FrSky-Ethos-Sendern aus und holt neue Logs automatisch vom Sender, sobald er per USB angeschlossen ist.

## Log-Sync

- Die App sucht alle paar Sekunden auf allen angeschlossenen Laufwerken nach dem Log-Ordner des Senders. Standard ist `Radio/logs`. Der erste Teil darf auch der Name des Laufwerks sein, also ein Laufwerk `RADIO` mit dem Ordner `logs`. Ein vollständiger Pfad wie `E:\logs` geht auch.
- Neue Logs werden ins Archiv kopiert, in einen Unterordner pro Modell (`Archiv/SB-10/SB-10-2026-10-02-14-39-06.csv`). Logs, die mit gleicher Grösse schon im Archiv liegen, werden übersprungen.
- Pro Anschluss wird einmal synchronisiert. „Jetzt synchronisieren“ startet den Sync von Hand.
- Als Archiv eignet sich ein Ordner in Google Drive für den Desktop oder OneDrive. Die App schlägt beim ersten Start `…/My Drive/Ethos Logs` bzw. den OneDrive-Ordner vor, sonst `Dokumente/Ethos Logs`.
- Manuell eingelesene Logs lassen sich mit „Im Archiv sichern“ ablegen, oder immer automatisch (Einstellung).

Die Einstellungen liegen in `settings.json` im App-Datenordner.

## Entwicklung

```
npm install
npm test        # Sync-Engine
npm start       # App starten
npm run dist    # Installer für das aktuelle System bauen
```

`web/index.html` ist dieselbe Seite wie die Web-Version. `npm run prepare-app` kopiert sie nach `app/` und bindet Chart.js lokal ein, damit die App offline läuft.

GitHub Actions baut bei jedem Push den Windows-Installer (`.exe`) und das Mac-Image (`.dmg`, Intel und Apple Silicon) und legt beide unter „Releases“ als Version `v<version>` ab. Der Release-Text kommt aus dem Abschnitt der Version in `CHANGELOG.md`; vor dem Erhöhen der Version dort einen Abschnitt `## <version> – <datum>` anlegen.

Die Mac-App ist nicht signiert. Beim ersten Start blockiert macOS sie: unter Systemeinstellungen → Datenschutz & Sicherheit „Dennoch öffnen“. Beim ersten Anschliessen des Senders fragt macOS einmal nach dem Zugriff auf Wechselmedien; „Erlauben“ wählen.
