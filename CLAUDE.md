# CLAUDE.md – Sonos Web Controller 4 Kids

## Projektübersicht

Kinderfreundliche Weboberfläche zum Steuern von Sonos-Lautsprechern, optimiert für Touchscreens (800×480px). Kinder können Alben und Hörbücher aus Apple Music hinzufügen und abspielen. Admins konfigurieren Räume, Lautstärkelimits und Templates über ein integriertes Admin-Panel.

## Architektur

```
sonos-webcontroller4kids/
├── backend/          # Express + Node.js + TypeScript (Port 3344)
│   └── src/index.ts  # Haupt-Server (~1000 Zeilen)
├── frontend/         # React 19 + TypeScript + Vite (Dev: Port 5173)
│   └── src/
│       ├── App.tsx           # Template-Router
│       ├── types.ts          # Gemeinsame TypeScript-Typen
│       ├── MediaEditor.tsx   # Geteilte Komponente
│       └── templates/        # Pluggable UI-Templates
│           ├── default/      # Standard-Template mit Admin
│           └── colorful/     # Buntes Kinder-Template
├── media-data/       # Persistente Daten (Docker Volume)
│   ├── config.json   # App-Konfiguration
│   └── media.json    # Medienbibliothek (Alben, Hörbücher)
├── Dockerfile        # Multi-Stage Build
└── docker-compose.yml
```

## Entwicklung

### Backend starten
```bash
cd backend
npm install
npm run dev   # ts-node, Port 3344
```

### Frontend starten
```bash
cd frontend
npm install
npm run dev   # Vite, Port 5173 (proxied zu Backend)
```

### Build für Produktion
```bash
cd frontend && npm run build   # Output: frontend/dist/
cd backend && npm run build    # Output: backend/dist/
```

### Docker
```bash
docker build -t sonos-webcontroller4kids:latest .
docker run -p 3344:3344 -v ./media-data:/app/media-data sonos-webcontroller4kids:latest
```

## Key-Dateien

| Datei | Zweck |
|-------|-------|
| `backend/src/index.ts` | App-Setup, Middleware, Router-Registrierung, Server-Start |
| `backend/src/types.ts` | `AppConfig`, `MediaItem`, `MediaTrack` (geteilt im Backend) |
| `backend/src/services/config.ts` | `loadConfig()`, `saveConfig()` — mit In-Memory-Cache |
| `backend/src/services/media.ts` | `loadMedia()`, `saveMedia()` — mit In-Memory-Cache |
| `backend/src/services/sonos.ts` | `buildSonosUrl()`, `fetchWithTimeout()` |
| `backend/src/services/apple-music.ts` | `searchApple()`, `fetchAlbumTracks()` |
| `backend/src/routes/health.ts` | `GET /health` |
| `backend/src/routes/media.ts` | Alle `/media/*` Routen |
| `backend/src/routes/admin.ts` | Alle `/admin/*` Routen |
| `backend/src/routes/sonos.ts` | `/sonos/control`, `/sonos/status`, `/play`, `/search/apple` |
| `frontend/src/App.tsx` | Template-Loader via `React.lazy()`, Admin-Routing |
| `frontend/src/types.ts` | `MediaItem`, `MediaTrack`, `SonosConfig`, `AppleSearchResult` |
| `frontend/src/templates/default/App.tsx` | Vollständige UI inkl. Admin-Interface |
| `frontend/src/templates/colorful/App.tsx` | Vereinfachte Kinder-UI |
| `media-data/config.json` | Laufzeit-Konfiguration (Sonos-URL, Räume, Templates) |
| `media-data/media.json` | Medienbibliothek |

## Template-System

- Templates liegen in `frontend/src/templates/[name]/`
- Jedes Template braucht: `App.tsx`, `App.css`, `template.config.json`
- `App.tsx` muss `isAdmin: boolean` als Prop akzeptieren
- Aktives Template wird in `config.json` → `activeTemplate` gespeichert
- Der Template-Loader in `frontend/src/App.tsx` lädt Templates dynamisch per `import()`
- Bei Admin-Zugang ohne eigenes Admin-Interface: zum Default-Template weiterleiten

## Services / Caching

`services/config.ts` und `services/media.ts` nutzen einen In-Memory-Cache:
- Erster Aufruf liest von Disk, alle weiteren geben den Cache zurück
- `saveConfig()` / `saveMedia()` schreiben auf Disk **und** aktualisieren den Cache
- **Wichtig:** Nach einem manuellen Bearbeiten von `config.json` oder `media.json`
  muss der Backend-Prozess neu gestartet werden, damit die Änderungen übernommen werden

`routes/sonos.ts` wird am Root gemountet (`app.use(sonosRouter)`), da `/play` und
`/search/apple` kein gemeinsames Präfix mit `/sonos/*` haben.

## REST-API (Backend Port 3344)

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/health` | GET | Health-Check |
| `/media` | GET, POST | Medienbibliothek |
| `/media/:id` | PUT, DELETE | Einzelnes Medium |
| `/media/:id/tracks/:trackId` | PUT, DELETE | Track-Verwaltung |
| `/media/bulk` | PUT | Bulk-Updates |
| `/admin/sonos` | GET | Sonos-Konfiguration abrufen |
| `/admin/sonos/test` | POST | Sonos-API-Konnektivität testen |
| `/admin/sonos/discover` | GET | Sonos-Räume entdecken |

Keine Authentifizierung – setzt lokales Netzwerk voraus.

## Externe APIs

- **Sonos HTTP API**: Raumsteuerung, Wiedergabe, Lautstärke
- **Apple Music / iTunes Search API**: Albumsuche, Metadaten, Cover-URLs

## Datenpersistenz

JSON-basiert, kein Datenbank-Setup nötig:
- `media-data/config.json`: Sonos-URL, Räume, Icons, Lautstärkelimits, aktives Template
- `media-data/media.json`: Liste von `MediaItem` mit verschachtelten `MediaTrack[]`

## TypeScript-Konventionen

- Strikter Modus in beiden Projekten (`"strict": true`)
- Backend: CommonJS-Module, ES2019-Target
- Frontend: ESM, React JSX Transform (`"jsx": "react-jsx"`)
- Typen in `frontend/src/types.ts` zentralisiert

## CI/CD

- GitHub Actions: `.github/workflows/docker-publish.yml`
- Push auf `main` → Docker-Image wird gebaut und auf Docker Hub gepusht
- Multi-Arch: `linux/amd64` + `linux/arm64`
- Docker Hub: `smartnightly/sonos-webcontroller4kids:latest`
- Deployment-Ziel: Synology NAS via Portainer

## Wichtige Hinweise

- Sonos-Polling im Frontend alle 2 Sekunden für Statusabgleich
- Admin-Interface via Query-Parameter `?admin=1` aufgerufen
- Volume-Limits pro Raum konfigurierbar in `config.json` → `maxVolume`
- Das Projekt enthält Legacy-Dateien (`App_old.tsx`, `App copy.tsx`) – nicht anfassen
- Backend läuft ohne Auth → nur im lokalen Heimnetz einsetzen
