# MM Flight Analyzer

Flugauswertung von Mächler Modelle (bis Version 2026.10.0 „Ethos Log Viewer“).

> Nicht mit den Herstellern von Ethos oder Jeti verbunden. Ethos ist eine Marke ihres Inhabers.

Wertet Telemetrie-Logs von Ethos-Sendern (CSV) und Jeti-Sendern (.log) aus und holt neue Logs automatisch vom Sender, sobald er per USB angeschlossen ist.

Download und Handbuch: unter [Releases](https://github.com/mrskynavi/ethos-log-viewer/releases/latest) liegen der Windows-Installer, das Mac-Image und die Bedienanleitung als PDF.

## Log-Sync

- Die App sucht alle paar Sekunden auf allen angeschlossenen Laufwerken nach dem Log-Ordner des Senders. Standard ist `Radio/logs`. Der erste Teil darf auch der Name des Laufwerks sein, also ein Laufwerk `RADIO` mit dem Ordner `logs`. Ein vollständiger Pfad wie `E:\logs` geht auch.
- Neue Logs werden ins Archiv kopiert, in einen Unterordner pro Modell (`Archiv/SB-10/SB-10-2026-10-02-14-39-06.csv`). Logs, die mit gleicher Grösse schon im Archiv liegen, werden übersprungen.
- Pro Anschluss wird einmal synchronisiert. „Jetzt synchronisieren“ startet den Sync von Hand.
- Als Archiv eignet sich ein Ordner in Google Drive für den Desktop oder OneDrive. Die App schlägt beim ersten Start `…/My Drive/Ethos Logs` bzw. den OneDrive-Ordner vor, sonst `Dokumente/Ethos Logs`.
- Manuell eingelesene Logs lassen sich mit „Im Archiv sichern“ ablegen, oder immer automatisch (Einstellung).

Sprache: Deutsch oder Englisch, standardmässig die Sprache des Betriebssystems, wählbar unter ⚙ Einstellungen.

Die Einstellungen liegen in `settings.json` im App-Datenordner.

## Entwicklung

```
npm install
npm test        # Sync-Engine
npm start       # App starten
npm run dist    # Installer für das aktuelle System bauen
npm run build-pwa  # Web-App (PWA) nach site/ bauen
```

`web/index.html` ist dieselbe Seite wie die Web-Version. `npm run prepare-app` kopiert sie nach `app/` und bindet Chart.js lokal ein, damit die App offline läuft.

Das Handbuch entsteht aus `docs/handbuch/handbuch.html`: `npm run handbuch` macht frische Screenshots aus `web/index.html` mit dem Beispiel-Log, setzt Version und Changelog ein und schreibt `dist/MM-Flight-Analyzer-Bedienanleitung.pdf` (braucht Playwright mit Chromium: `npm install --no-save playwright && npx playwright install chromium`). Ändert sich die Bedienung, den Text in der Vorlage nachführen.

## Web-App (PWA)

`npm run build-pwa` baut aus `web/index.html` die installierbare Web-App nach `site/`: Chart.js lokal, Manifest und Icons aus `pwa/`, Service Worker für den Betrieb ohne Netz. Auf iPhone und iPad in Safari „Teilen → Zum Home-Bildschirm“, auf Android in Chrome „App installieren“. Logs kommen über „Import …“ aus der Dateien-App bzw. dem Datei-Dialog; eine Ordner-Auswahl und der Sync vom Sender gibt es dort nicht.

OneDrive: Mit einer Client-ID in `pwa/config.json` (`onedriveClientId`, oder Umgebungsvariable `ONEDRIVE_CLIENT_ID`) bekommt die Web-App im Import-Dialog den Punkt „OneDrive“. Nach der Anmeldung liest sie die Logs aus dem Ordner `Ethos Logs` und seinen Modell-Unterordnern (Ordner unter ⚙ Einstellungen änderbar), aktualisiert die Liste beim Start und wenn die App wieder in den Vordergrund kommt, und behält geöffnete Logs für den Betrieb ohne Netz. Die Client-ID stammt aus einer App-Registrierung bei Microsoft (Typ „Single-Page-Anwendung“, Umleitungs-URI = Adresse der Web-App, Konten: Organisationen und persönliche Microsoft-Konten). Ohne Client-ID fehlt der Punkt.

Die Seite braucht HTTPS. `npm run build-pwa -- --ohne-beispiel` lässt das Beispiel-Log weg (es enthält eine echte GPS-Spur), `--beispiel-verschoben` nimmt es mit an einen anderen Ort verschobener Spur mit. Der Workflow „Web-App (GitHub Pages)“ läuft nur von Hand und veröffentlicht `site/` auf GitHub Pages. Nach einer Änderung holen sich installierte Geräte die neue Version beim nächsten Öffnen mit Netz.

## Android-App

`npm run build-android` baut `site/` mit Beispiel-Log (verschobene GPS-Spur) und kopiert es ins Android-Projekt `android/` (Capacitor). Die APK baut der Workflow „Android“ bei jedem Push, der `android/` oder `capacitor.config.json` ändert, oder von Hand; sie liegt danach als Artefakt beim Lauf unter „Actions“, veröffentlicht wird nichts. Versionsname und -nummer kommen aus `package.json`. Alle APKs sind mit `android/app/ethos-log-viewer.keystore` signiert, darum lässt sich eine neue APK über die alte installieren und die Einstellungen bleiben. Icons und Startbild erzeugt `scripts/android-icons.py` aus `pwa/icons`.

GitHub Actions baut bei jedem Push auf `main` den Windows-Installer (`.exe`) und das Mac-Image (`.dmg`, Intel und Apple Silicon) und legt beide unter „Releases“ als Version `v<version>` ab. Der Release-Text kommt aus dem Abschnitt der Version in `CHANGELOG.md`; vor dem Erhöhen der Version dort einen Abschnitt `## <version> – <datum>` anlegen.

Mac-Testbuild: Vor einem Release die Änderungen auf einem Branch ausprobieren. Jeder Push auf einen Branch ausser `main` startet den Workflow „Mac-Testbuild“; er baut nur das Mac-Image, erstellt kein Release und baut weder Windows, Android noch das Handbuch. Von Hand: Actions → „Mac-Testbuild“ → Run workflow → Branch wählen. Das Image liegt danach unten auf der Seite des Laufs unter „Artifacts“ als ZIP (14 Tage aufbewahrt). Version und Changelog müssen dafür nicht angepasst werden.

Die Mac-App ist nicht signiert. Beim ersten Start blockiert macOS sie: unter Systemeinstellungen → Datenschutz & Sicherheit „Dennoch öffnen“. Beim ersten Anschliessen des Senders fragt macOS einmal nach dem Zugriff auf Wechselmedien; „Erlauben“ wählen.
