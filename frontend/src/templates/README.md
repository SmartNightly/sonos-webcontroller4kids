# Frontend Templates

Dieses Projekt unterstützt mehrere Frontend-Templates, um verschiedene Designs für die Kinder-Ansicht auszuprobieren.

## Struktur

```
frontend/src/
├── App.tsx                    # Template-Loader (lädt dynamisch das aktive Template)
├── templates/
│   ├── default/               # Standard-Template
│   │   ├── App.tsx           # Haupt-Komponente des Templates
│   │   ├── App.css           # Template-spezifische Styles
│   │   └── template.config.json  # Template-Metadaten
│   └── [weitere-templates]/
```

## Neues Template erstellen

1. **Ordner erstellen**: Erstelle einen neuen Ordner unter `frontend/src/templates/` mit dem Namen deines Templates (z.B. `minimal`, `colorful`, etc.)

2. **App.tsx erstellen**: Kopiere `templates/default/App.tsx` als Basis oder erstelle eine neue Komponente:
   ```tsx
   interface TemplateAppProps {
     isAdmin: boolean
   }
   
   function App({ isAdmin }: TemplateAppProps) {
     return isAdmin ? <AdminView /> : <KidsView />
   }
   
   export default App
   ```

3. **template.config.json erstellen**: Erstelle eine Konfigurationsdatei für Metadaten:
   ```json
   {
     "name": "Dein Template Name",
     "description": "Beschreibung des Templates",
     "version": "1.0.0",
     "author": "Dein Name"
   }
   ```

4. **Styles anpassen**: Erstelle optionale `App.css` für template-spezifische Styles

## Template aktivieren

Es gibt zwei Wege, ein Template zu aktivieren:

### 1. Admin-Bereich (empfohlen)
- Öffne `http://localhost:3344?admin=1`
- Gehe zum Tab "Einstellungen"
- Scrolle zu "Frontend-Template"
- Klicke auf das gewünschte Template
- Die Seite lädt automatisch neu

### 2. Manuell in config.json
Bearbeite `media-data/config.json`:
```json
{
  "activeTemplate": "default"  // Ändere zu deinem Template-Namen
}
```

## Template-Anforderungen

- **Export**: Template muss `App` als default export haben
- **Props**: Muss `isAdmin` boolean als Prop akzeptieren
- **Types**: Verwende `import type { ... } from '../../types'` für gemeinsame Types
- **API URL**: Verwende `const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3344' : ''`

## Verfügbare Templates

- **default**: Das Original-Template mit großen Buttons und kinderfreundlicher Bedienung

## Entwicklung

Beim Entwickeln eines neuen Templates:
1. Starte den Dev-Server: `npm run dev` (im `frontend/` Ordner)
2. Backend muss laufen: `npm run dev` (im `backend/` Ordner)
3. Aktiviere dein Template im Admin
4. Änderungen werden durch Hot-Reload sofort sichtbar

## Tipps

- **Gemeinsame Komponenten**: Verwende `MediaEditor` aus `../../MediaEditor.tsx`
- **Types**: Alle Types sind in `../../types.ts` definiert
- **API**: Alle Backend-Endpunkte sind unter `/api`, `/media`, `/admin`, `/sonos`
- **Responsive**: Templates sollten für Tablet-Größen (ca. 800x480px) optimiert sein
