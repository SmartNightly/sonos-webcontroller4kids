# Wolkenklang · Pink & Lila

Ein zusätzliches Kindertheme für Musik und Geschichten. Die Figurenporträts sitzen
in abwechselnd pinken und lilafarbenen Bögen – wie kleine Hörnischen. Der Player und
die Navigation bleiben an den vertrauten Stellen. Kein Glitzer, Blinken oder Autoplay.

Vorschau: `/?template=wolkenklang&demo=1` (keine API-Aufrufe oder Sonos-Befehle;
Beispielcover von Apples Bildserver). Dauerhafte Auswahl unter Einstellungen →
„Design der Kinderansicht“. Die Implementierung aktiviert das Theme nicht automatisch.

## Gestaltung

Systemschrift mit `ui-rounded`, 16 px Grundschrift; Titel und Bedienelemente nutzen
die gemeinsame responsive Typografie. Bilder bleiben der Mittelpunkt, Texte werden
nicht auf die Cover gelegt. Keine zusätzlichen Schriften oder Bilddateien nötig.

| Rolle                 | Hell      | Dunkel    |
| --------------------- | --------- | --------- |
| Hintergrund           | `#fff1f7` | `#291932` |
| Oberfläche            | `#fff9fc` | `#382341` |
| Text                  | `#47234f` | `#fff4fb` |
| Sekundärtext          | `#76536e` | `#dbbfd5` |
| Aktion / Fokus        | `#9d246b` | `#ffa4d4` |
| Ruhige Bedienelemente | `#f2d9ec` | `#55314f` |

Berechnete WCAG-Kontraste: heller Sekundärtext auf Hintergrund 5,93:1; weißer
Buttontext auf dunklem Pink 7,25:1; dunkler Buttontext auf hellem Pink 7,10:1;
Sekundärtext auf Bedienelementen im Dunkelmodus 6,41:1. Hell/Dunkel folgt dem System;
erhöhter Kontrast und erzwungene Systemfarben erhalten zusätzliche Konturen.

Breit: Kopfzeile → Cover-Raster → Player. Schmal: Kopfzeile mit umgebrochener
Raumwahl → zweispaltige Auswahl → Playerinfo über Tasten. Kein zusätzliches
Dekor nimmt Platz für die Auswahl weg. Mindestgrößen, Tastaturfokus, reduzierte
Bewegung, freigegebene Räume und Lautstärkelimits kommen aus der gemeinsamen Ansicht.

Die Apple-Design-Grundsätze werden als Web-Konventionen umgesetzt: native Buttons
und Selects, CSS-Medienabfragen und beschriftete SVG-Symbole. Grundlage:
`accessibility.md › Vision/Mobility`, `buttons.md › Best practices`,
`color.md › Inclusive color`, `dark-mode.md › Best practices`.
Die Cover-Bögen und Farbgebung sind gestalterische Entscheidungen, keine HIG-Vorgabe.
