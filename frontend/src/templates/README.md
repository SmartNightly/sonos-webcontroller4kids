# Themes

Die vier modernen Kinderansichten verwenden `components/KidsView` und `hooks/useKidsPlayer`.
Navigation, Player, Raumfreigaben, Lautstärkelimits und Fehlerbehandlung sind damit
identisch. Die über `data-theme` begrenzten Styles erhalten ihre eigene Gestaltung:

- **Default:** dunkler Hintergrund, ruhige Cover-Karten, kontrastreiche grüne Aktionen.
- **Colorful Kids:** pastellfarbene Karten, violette Aktionen, helle und dunkle Darstellung.
- **Hörinsel:** luftige Figurenübersicht mit blauen Akzenten, hell und dunkel.
- **Wolkenklang (Pink & Lila):** pink-lila Cover-Bögen mit Wolken-Musik-Symbol, hell und dunkel.

Zusätzlich bleibt **Classic (Original)** unter dem Schlüssel `classic` erhalten.
Es übernimmt die ursprüngliche Default-Kinderansicht aus Commit `73af340` mitsamt
Navigation, Player, Styles und Versionsanzeige. Der Elternbereich wird gemeinsam
mit den anderen Themes verwendet. Die unten beschriebenen neuen Layout- und
Bedienmerkmale gelten nicht für die unverändert erhaltene Classic-Kinderansicht.

`/?template=classic` öffnet Classic mit echten Daten und Sonos-Steuerung, ohne das
global aktive Theme umzustellen. Classic bietet keinen isolierten Demo-Modus;
`demo=1` zeigt deshalb nur einen Hinweis und sendet keine Anfragen.

## Sichere lokale Vorschau

`/?template=default&demo=1`, `/?template=colorful&demo=1` oder
`/?template=hoerinsel&demo=1` zeigen Beispieldaten ohne Backend-Anfragen,
Sonos-Befehle oder gespeicherte Änderungen. Cover werden von Apples Bildserver geladen.
Ohne `demo=1` werden echte Daten und Lautsprecher verwendet. Die URL-Auswahl ändert
nicht das global aktive Theme. Dauerhafte Auswahl erfolgt im Elternbereich.

Auch `/?template=wolkenklang&demo=1` unterstützt die isolierte Vorschau.

## Bedienung und Barrierefreiheit

Beschriftete native Buttons, Filter mit Auswahlzustand und native Raumauswahl;
sichtbarer Tastaturfokus, große Touch-Ziele und dauerhaft erreichbarer Player.
Inhalte scrollen getrennt vom Player, auch auf 800×480 und schmalen Smartphones.
Reduzierte Bewegung wird berücksichtigt; dekorative Daueranimationen entfallen.
Raumwechsel bleiben lokal, die freigegebenen Räume und Lautstärkelimits gelten weiter.

Der gemeinsame Elternbereich bietet responsive Formulare und benannte Dialoge mit
Fokusbegrenzung, gesperrtem Hintergrund, Escape-Schließen und Fokus-Rückgabe.
Während einer Speicherung kann Escape den Dialog nicht schließen.

Tests: `npm test`, `npm run lint` und `npm run build` im Ordner `frontend`.

## Weitere Templates erstellen

1. Ordner unter `frontend/src/templates/` anlegen. Namen dürfen Kleinbuchstaben,
   Ziffern und Bindestriche enthalten.
2. `App.tsx` mit einem Default-Export erstellen. Die Komponente erhält `isAdmin: boolean`
   und optional `demo: boolean`. Die vorhandenen kleinen Theme-Wrapper dienen als Vorlage.
3. `template.config.json` mit `name`, `description`, `version` und `author` ergänzen.
4. Styles in `App.css` auf das eigene `data-theme` begrenzen. Gemeinsame Types liegen
   in `../../types`, API-Hilfen in `../../api`. Für neue Kinderansichten bevorzugt
   die bestehende `KidsView` und `useKidsPlayer` erweitern, statt Steuerlogik zu duplizieren.

Der Frontend-Build erzeugt `dist/templates.json` aus den Ordnern mit `App.tsx`.
Das Backend verwendet dieses Manifest zur Auswahl und Validierung im Docker-Image.
Nach dem Hinzufügen eines Themes muss der Produktionsbuild erneuert werden.

Im Entwicklungsmodus: `npm run dev` im Frontend starten und eine der Vorschau-URLs
öffnen. Nur für echte Medien ist zusätzlich das Backend auf Port 3344 nötig.
Änderungen erscheinen durch Hot Reload. Im Elternbereich (`/?admin=1`) lässt sich
unter Einstellungen → „Design der Kinderansicht“ das globale Theme ändern.
Alternativ kann `activeTemplate` in `media-data/config.json` gesetzt werden.
