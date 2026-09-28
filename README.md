# Projektblick

Projektblick ist eine kleine, responsive Bewertungsplattform für Schulprojekte. Sie verwendet die bestehende Google Tabelle **Bewertungsplattform** mit den Blättern `Projekte` und `Bewertungen`.

## Seiten

- `index.html`: Einstieg
- `student.html`: Bewertung per vierstelligem Projektcode
- `teacher.html`: Projekte, Einzelwerte und Präsentation
- `Code.gs`: Google Apps Script als API für die bestehende Tabelle

## Apps Script aktualisieren

1. In der Tabelle **Bewertungsplattform** über **Erweiterungen → Apps Script** das zugehörige Script öffnen.
2. Den Inhalt der vorhandenen `Code.gs` durch die Datei in diesem Repository ersetzen.
3. Unter **Projekteinstellungen → Skripteigenschaften** die Eigenschaft `ADMIN_TOKEN` mit einem zufälligen Geheimnis aus mindestens 20 Zeichen anlegen. Diesen Wert Lehrkräften getrennt mitteilen. Er gehört **nicht** in den Website-Code oder dieses Repository.
4. Unter **Bereitstellen → Bereitstellungen verwalten** die bestehende Web-App-Bereitstellung bearbeiten und eine **neue Version** bereitstellen. Sie muss weiter als Web-App unter dem bisherigen `/exec`-Link erreichbar sein. Falls Google eine neue URL vergibt, diese in `config.js` ersetzen.
5. `student.html` mit einem Testprojekt und `teacher.html` mit dem Lehrkraft-Schlüssel prüfen.

Die neue Website kann mit der bisherigen API geladen werden. Die Schutzprüfung für Lehrkraft-Aktionen ist erst nach Schritt 4 aktiv. Bis dahin ist die bisherige API weiterhin öffentlich erreichbar, einschließlich Löschaktionen.

## Datenformat

Die vorhandenen Spalten bleiben unverändert:

- `Projekte`: Code, Titel, Klasse, Gruppen, Kriterien
- `Bewertungen`: ProjektCode, Schüler, Zeit, Bewertung

Gruppen und Kriterien sind in der Tabelle kommagetrennt. Die Website verhindert deshalb Kommas und doppelte Namen beim Erstellen. Bereits gespeicherte Datensätze bleiben erhalten. Das neue Script verhindert neue doppelte Bewertungen pro Projekt und Name; vorhandene Duplikate werden nicht automatisch gelöscht.

## Lokal ansehen

Die HTML-Dateien können direkt im Browser geöffnet werden. Für die echte API ist eine Internetverbindung erforderlich. Die API-Adresse steht ausschließlich in `config.js`.
