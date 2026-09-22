# Hörinsel

Zusätzliches Theme für die Kinderansicht. Die gemeinsame Bedienlogik wird auch von Default und Colorful Kids verwendet. Gespeicherte Konfiguration wird durch die Vorschau nicht verändert. Die Registrierung im Build-Manifest erfolgt automatisch.

## Vorschau

- `/?template=hoerinsel&demo=1`: isolierte Demo mit Beispielcovern. Keine Backend-Anfragen, keine Sonos-Befehle, keine Speicherung. Cover werden von Apples Bildserver geladen.
- `/?template=hoerinsel`: echte Medien und Sonos-Steuerung, nur in diesem Browseraufruf. Das global aktive Theme wird nicht geändert.
- `/?template=hoerinsel&admin=1`: bestehender Elternbereich ohne Theme-Wechsel.
- Dauerhaft aktivieren: im Elternbereich unter Einstellungen das Template `hoerinsel` auswählen.

Im Entwicklungsmodus bleibt die vorhandene API-Basis `http://localhost:3344` bestehen. Die Demo benötigt kein Backend.

## Gestaltung

Figurenporträts sind der Blickfang, Bedienelemente bleiben ruhig. Systemschrift mit abgerundeter Variante, 16 px Grundschrift, 24–34 px Titel, mindestens 44–48 px große Steuerelemente. Kein automatisches dekoratives Bewegen, keine Transparenzabhängigkeit. Native Raumauswahl, fokussierbare Navigation und beschriftete SVG-Symbole.

| Rolle                 | Hell      | Dunkel    |
| --------------------- | --------- | --------- |
| Hintergrund           | `#f3f6fa` | `#161e2b` |
| Fläche                | `#ffffff` | `#202c3e` |
| Text                  | `#172b46` | `#f3f6fc` |
| Sekundärtext          | `#53647a` | `#b3c0d3` |
| Aktion                | `#225bc4` | `#a8c9ff` |
| Zurückhaltende Fläche | `#e4ecf8` | `#2a3a51` |

Kontraste: heller Text auf blauem Button 6,25:1; Sekundärtext auf hellem Hintergrund 5,58:1; dunkler Buttontext auf hellblauem Button 8,48:1. Die Erscheinung folgt `prefers-color-scheme`.

Breit: Kopfzeile → Figurenraster bzw. Cover neben Titeln → dauerhafter Player. Schmal: Cover über Titeln, Playerinformationen über Transport- und Lautstärketasten. Auf 800×480 wird die vertikale Dichte angepasst; Inhalte scrollen unabhängig vom Player.

Raumwahl gilt lokal für die Ansicht und schreibt keinen globalen Standardraum. Raumfreigaben, Lautstärkelimits und optionale Tracklisten/Zufallswiedergabe/Wiederholung werden aus der vorhandenen Konfiguration übernommen. Schreibende Befehle sind gegen Doppeltippen gesperrt; Fehler werden dauerhaft und mit Handlungshinweis angezeigt. Die Lautstärke wird im Echtbetrieb erst durch den nächsten Statusabgleich bestätigt.
