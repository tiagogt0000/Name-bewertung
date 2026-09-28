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
3. Unter **Bereitstellen → Bereitstellungen verwalten** die bestehende Web-App-Bereitstellung bearbeiten und eine **neue Version** bereitstellen. Sie muss weiter als Web-App unter dem bisherigen `/exec`-Link erreichbar sein. Falls Google eine neue URL vergibt, diese in `config.js` ersetzen.
4. `student.html` mit einem Testprojekt und `teacher.html` prüfen.

Die Lehrkraftseite funktioniert bewusst ohne Anmeldung über ihren Link. Das bereits bereitgestellte Script verlangt noch einen API-Wert; `teacher.js` sendet ihn automatisch. Da diese Datei öffentlich lesbar ist, ist der Wert **kein Zugangsschutz**. Jeder mit der Lehrkraftadresse kann Projekte und Bewertungen ansehen, erstellen und löschen. Für echten Zugriff nur durch Lehrkräfte wäre eine Anmeldung nötig.

## Datenformat

Die vorhandenen Spalten bleiben unverändert:

- `Projekte`: Code, Titel, Klasse, Gruppen, Kriterien
- `Bewertungen`: ProjektCode, Schüler, Zeit, Bewertung

Gruppen und Kriterien sind in der Tabelle kommagetrennt. Die Website verhindert deshalb Kommas und doppelte Namen beim Erstellen. Bereits gespeicherte Datensätze bleiben erhalten. Das neue Script verhindert neue doppelte Bewertungen pro Projekt und Name; vorhandene Duplikate werden nicht automatisch gelöscht.

Beim Erstellen und in den Projektdetails zeigt die Lehrkraftseite einen QR-Code und einen Link zur Schülerseite. Der QR-Code wird mit einer lokal eingebundenen Kopie von `qrcodejs` erzeugt (MIT-Lizenz unter `vendor/LICENSE.qrcodejs`).

## Lokal ansehen

Die HTML-Dateien können direkt im Browser geöffnet werden. Für die echte API ist eine Internetverbindung erforderlich. Die API-Adresse steht ausschließlich in `config.js`.
