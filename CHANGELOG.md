# Changelog

## 1.2.1 – noch nicht veröffentlicht

- Der Knopf „↻ Sync“ ist weg. Neu gibt es „⏏ Auswerfen“, solange der Sender angeschlossen ist: Er wirft den Sender sicher aus (Mac: wie im Finder, Windows: wie „Auswerfen“ im Explorer). Danach steht in der Sync-Zeile „Sender ausgeworfen, Du kannst ihn abziehen“. Klappt es nicht, zum Beispiel weil eine Datei noch offen ist, steht der Grund dort.

## 1.2.0 – 2026-10-04

- Die App gibt es auf Deutsch und Englisch. Standard ist die Sprache des Betriebssystems, unter ⚙ Einstellungen lässt sich die Sprache wählen. Die Sensornamen kommen aus dem Log und bleiben in der Sprache des Senders.
- Die Kacheln unter „Werte am Zeitpunkt“ haben eine feste Grösse. Lange Texte verändern die Höhe nicht mehr.
- macOS: Die Frage nach dem Zugriff auf Wechselmedien kam bei jeder Datei. Wird der Zugriff verweigert oder ist die Frage noch offen, bricht der Sync jetzt sofort ab, lässt den Sender 30 Sekunden in Ruhe und versucht es danach erneut. Die Sync-Zeile zeigt solange „Zugriff auf den Sender erlauben“.
- Wird der Sender während dem Sync getrennt, bricht der Sync ab, statt für jede restliche Datei einen Fehler zu melden. Der Punkt in der Sync-Zeile wird orange, und beim nächsten Anschliessen geht es weiter. Angefangene Dateien bleiben nicht im Archiv liegen.
- Bei Fehlern oder einem abgebrochenen Sync zeigt ein ⓘ in der Sync-Zeile alle Details und die vollständigen Fehlermeldungen.
- Erklärungen in den Tabs Diagramme, Thermik & Steigflüge sowie Karte & Wind stehen nicht mehr dauernd da, sondern hinter einem ⓘ neben der Überschrift.
- Die Zeile mit Dateiname, Zeitraum und Sensoren steht jetzt zuoberst im Tab Übersicht.
- Im Tab Übersicht steht die Zeitpunkt-Leiste direkt unter „Werte am Zeitpunkt“.
- macOS: Die App wird jetzt (ad hoc) signiert, damit macOS sich das „Erlauben“ merken kann.

## 1.1.0 – 2026-10-04

- Kompakte Kopfzeile: Titel, Modell, Log, ◀▶, „Import …“ und ⚙ in einer Zeile, die Tabs stehen weiter oben.
- Erklärung und Archivpfad nur noch auf Klick über das ⓘ.
- „Import …“ öffnet ein Fenster mit „Dateien auswählen“, „Ordner öffnen“ und „Importierte Logs ins Archiv kopieren“. Dateien lassen sich auch ins Fenster ziehen.
- Sync-Zeile direkt unter der Modellzeile, kurz und ohne doppelte Angaben.
- Wechsel des Archivordners lädt die Modellliste neu.
- Archiv lädt schneller: die Liste erscheint sofort, Details werden zwischengespeichert (hilft bei OneDrive-Dateien, die erst geladen werden müssen).
- Die App sucht beim Start und alle 6 Stunden nach einer neuen Version und meldet sie mit Download-Link.

## 1.0.1 – 2026-10-04

- macOS: Die Frage nach dem Zugriff auf Wechselmedien erscheint nur noch einmal statt mehrmals hintereinander.
- Laufwerke werden nur noch aufgelistet, nicht mehr alle einzeln geöffnet.

## 1.0.0 – 2026-10-04

- Erste Desktop-Version für Windows und Mac.
- Automatischer Sync: Sobald der Sender angeschlossen ist, werden neue Logs aus `Radio/logs` ins Archiv kopiert, ein Ordner pro Modell. Fortschritt im Hauptfenster.
- Einstellungen für Log-Ordner auf dem Sender und Archivordner (Vorschlag: Google Drive oder OneDrive).
- Manuell eingelesene Logs lassen sich ins Archiv sichern.
- Alle Auswertungen der Web-Version: Kennzahlen, Diagramme mit Zoom und Zeitpunkt, Thermik und Steigflüge, Karte und Wind, alle Werte.
