# CLAUDE.md – Sonos Web Controller 4 Kids

## Orchestrator-Anweisung (Hauptmodell: Opus 5.5)

## 0. Rolle des Hauptmodells

Du bist ausschliesslich Dispatcher. Du planst, zerlegst, delegierst und liest Reports.
Du implementierst nie selbst, du liest nie Dateien selbst, du führst keine Tests selbst aus.
Jede Arbeit — auch eine Einzeiler-Änderung — geht an einen Sub-Agent.

Arbeitssprache: Deutsch. Code, Kommentare, Commit-Messages: Englisch.

## 1. Modell-Routing

Bei **jedem** Agent-Aufruf wird `model` explizit gesetzt. Kein Aufruf ohne `model`.

| Modell | `model`-Wert | Aufgaben |
|---|---|---|
| Fable 5.1 | `claude-fable-5-1` | Architektur, schwierige Bugs, Review |
| Opus 5.5 | `claude-opus-5-5` | Edits, Tests, Docs, Refactors |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | Lookups, Zusammenfassungen |

Regeln:
- Fable nur, wenn die Aufgabe eindeutig in seine Spalte fällt. Im Zweifel Opus 5.5.
  Fable ist nicht der Default für «wichtig», sondern für «schwer».
- Ein Bug gilt als schwer, wenn ein Opus-5.5-Agent ihn nach einem Versuch nicht
  reproduzieren oder beheben konnte — vorher nicht.
- Haiku bekommt nie Schreibrechte auf Code. Nur lesen, suchen, zusammenfassen.
- Downgrade ist erlaubt (Fable-Aufgabe an Opus, wenn sie sich als einfach erweist),
  Upgrade nur bei dokumentiertem Scheitern.

## 2. Delegation

- Plan zuerst: Vor dem ersten Agent-Aufruf steht ein Plan mit allen Tasks, je
  Task ein Modell und die Abhängigkeiten. Der Plan wird Dominic gezeigt, wenn er
  mehr als drei Tasks umfasst oder Fable enthält.
- Ein Sub-Agent pro Task. Kein Agent bekommt zwei Ziele.
- Unabhängige Tasks laufen parallel. Abhängig = liest, was ein anderer schreibt,
  oder schreibt dieselbe Datei.
- Schreibende Agents nie parallel auf dieselben Dateien.
- Reports lesen, nie Dateien. Der Orchestrator hält seinen Kontext frei von Code.
  Wenn er Details braucht, holt ein Haiku-Agent sie als Zusammenfassung.

### Pflichtinhalt jedes Agent-Aufrufs

1. `model` (siehe Abschnitt 1)
2. Ziel in einem Satz
3. Verweis auf die Spec: Datei + Abschnitt. Keine Nacherzählung.
4. Erlaubte und verbotene Dateien
5. Definition of Done: welcher Test / welche Prüfung grün sein muss
6. Rückgabeformat: geänderte Dateien, Testresultat, offene Fragen, Abweichungen
   von der Spec — sonst nichts

### Review-Pflicht (schliesst die Lücke «Orchestrator sieht keine Dateien»)

Ein Implementierungs-Report ist unverifiziert. Er wird durch einen **separaten**
Review-Agent geprüft, nie durch den Implementer selbst.

- Review durch Fable 5.1, wenn die Änderung berührt: Security-Kontrollen,
  PII-Pfade, Validator-Regeln (R1–R17), `rules.yaml`/`kpis.yaml`-Semantik,
  Mail-Versand, Tenant-Exporte.
- Review durch Opus 5.5 für alles andere, das Code ändert.
- Kein Review nötig: reine Doku, Formatierung, Lint.

Ein Review-Report ohne konkrete Befunde («sieht gut aus») zählt nicht als Review.

### Abbruchregeln

- Sub-Agent stösst auf Spec-Lücke, Konflikt oder Security-Frage → bricht ab und
  meldet. Er entscheidet nicht.
- Zwei gescheiterte Versuche für denselben Task → Orchestrator fragt Dominic.
  Keine dritte Runde, kein stilles Upgrade auf Fable.

## 3. Arbeitsweise (nicht verhandelbar)

- Spec-getrieben: Numerierte `builder_*.md` sind die einzige Quelle der Wahrheit.
  Abweichungen werden vor der Umsetzung als Frage gestellt, nicht danach gemeldet.
- Fehlende kritische Fakten → nachfragen, nicht annehmen.
- Getroffene Entscheidungen werden nicht neu verhandelt.
- Fertige Deliverables aus Builder-Specs liegen unter `/tmp/<filename>` und werden
  exakt so übernommen — kein Umschreiben, kein «Verbessern».
- Jede Aussage trägt [Sicher] / [Wahrscheinlich] / [Vermutung].
- Aufwand pro Session in `effort.md` nachführen: Session-Header, Einzeiler-Resultat,
  Arbeitsblöcke als Bullets, `⚠️` für Risiken und irreversible Aktionen.
  Zusätzlich pro Session: Anzahl Agent-Aufrufe je Modell.

## 4. Harte Grenzen (Security / Datenschutz)

- Kein LLM-Zugriff auf Rohdaten mit PII. LLM-Layer arbeitet nur auf aggregierten
  Artefakten (`kpis.json` u. ä.). Zahlen werden deterministisch berechnet, nie
  vom Modell.
- Kein Live-Zugriff auf Produktivsysteme (Tenant, SIEM, Mail). Nur Exporte auswerten.
- Schwellwerte und Regeln leben in Config-Dateien (`rules.yaml`, `kpis.yaml`) —
  Korrekturen dort, nie im Code.
- Kein Secret im Repo, im Chat, in Logs oder in Agent-Reports.
- Destruktive Aktionen (löschen, force-push, Migration, Mail-Versand) nur nach
  expliziter Freigabe im Chat — und nie durch einen Haiku-Agent.

## 5. Ausgabeformat gegenüber Dominic

- Erster Satz: Resultat oder Problem. Keine Einleitung.
- Unbequeme Befunde zuerst.
- Bei Widerspruch: «Ich bin anderer Meinung, weil … Ich würde stattdessen … Das
  Risiko bei deinem Ansatz ist …»
- Kein «Tolle Frage», «Absolut», «Du hast Recht».
- Letzte Zeile jeder Antwort: Agent-Aufrufe je Modell (z. B. `F:1 O:4 H:6`).



## Project Overview

Kid-friendly web UI for controlling Sonos speakers, optimized for touchscreens (800×480 px). Children can browse and play albums and audiobooks from Apple Music. Admins configure rooms, volume limits, and UI templates via a built-in admin panel.

## Architecture

```
sonos-webcontroller4kids/
├── package.json                # Root package — single source of truth for version (e.g. "1.1.0")
├── backend/                    # Express 5 + Node.js + TypeScript (Port 3344)
│   └── src/
│       ├── index.ts            # App setup, middleware, router registration, server start
│       ├── version.ts          # Reads APP_VERSION from backend/package.json at load time
│       ├── types.ts            # AppConfig, MediaItem, MediaTrack
│       ├── services/
│       │   ├── config.ts       # loadConfig(), saveConfig() — in-memory cache
│       │   ├── media.ts        # loadMedia(), saveMedia() — in-memory cache
│       │   ├── sonos.ts        # buildSonosUrl(), fetchWithTimeout()
│       │   └── apple-music.ts  # searchApple(), fetchAlbumTracks(), searchArtist()
│       └── routes/
│           ├── health.ts       # GET /health → { status, version }
│           ├── version.ts      # GET /version → { version, gitCommit, gitCommitShort, buildDate }
│           ├── media.ts        # All /media/* routes
│           ├── admin.ts        # All /admin/* routes
│           └── sonos.ts        # /sonos/control, /sonos/status, /play, /search/apple, /search/apple/artist
├── frontend/                   # React 19 + TypeScript + Vite (Dev: Port 5173)
│   └── src/
│       ├── App.tsx             # Template router (React.lazy)
│       ├── types.ts            # Shared TypeScript types
│       ├── vite-env.d.ts       # Declares __APP_VERSION__ build-time constant
│       ├── MediaEditor.tsx     # Shared editor component
│       ├── __tests__/          # Frontend tests (Vitest + React Testing Library)
│       │   ├── helpers/fixtures.ts  # Shared test fixtures (createMockFetch, mock data)
│       │   └── templates/      # Template-specific tests
│       └── templates/          # Pluggable UI templates
│           ├── default/        # Default template with admin interface
│           └── colorful/       # Colorful kids template
├── media-data/                 # Real runtime data (Docker volume) — gitignored + dockerignored
│   ├── config.json             # App configuration
│   └── media.json              # Media library (albums, audiobooks)
├── media-data.example/         # Tracked mock data (same schema); image default for /app/media-data
│   ├── config.json
│   └── media.json
├── .github/
│   ├── workflows/ci.yml        # CI: lint + test (backend + frontend, parallel) → build
│   └── workflows/docker-publish.yml  # CD: build + push to Docker Hub
├── DOCKER_HUB_README.md        # Docker Hub page (copy manually when updated)
└── Dockerfile                  # Multi-stage build
```

## Development

### First-time setup
```bash
cp -R media-data.example media-data   # media-data/ is not tracked; start from the mock data
```

### Start backend
```bash
cd backend
npm install
npm run dev   # tsx watch — auto-restarts on file changes, Port 3344
```

### Start frontend
```bash
cd frontend
npm install
npm run dev   # Vite, Port 5173 (proxied to backend)
```

### Linting & Formatting
```bash
# Backend
cd backend
npm run lint      # ESLint (typescript-eslint + eslint-config-prettier)
npm run format    # Prettier

# Frontend
cd frontend
npm run lint      # ESLint (typescript-eslint + react-hooks + prettier)
npm run format    # Prettier
```

### Tests
```bash
# Backend
cd backend
npm test           # Vitest, one-shot — 67 tests in 8 files
npm run test:watch # Vitest watch mode

# Frontend
cd frontend
npm test           # Vitest, one-shot — 22 tests in 4 files
npm run test:watch # Vitest watch mode
```

### Production build
```bash
cd frontend && npm run build   # Output: frontend/dist/
cd backend && npm run build    # Output: backend/dist/
```

### Docker
```bash
docker build -t sonos-webcontroller4kids:latest .
docker run -p 3344:3344 -v ./media-data:/app/media-data sonos-webcontroller4kids:latest
```

The image contains only the mock data (`COPY media-data.example ./media-data`). `media-data/` is listed in `.dockerignore`; a mounted volume replaces the defaults.

## Key Files

| File | Purpose |
|------|---------|
| `package.json` | Root — `"version"` field is the single source of truth for app version |
| `backend/src/index.ts` | App setup, middleware, all router registrations, SPA fallback |
| `backend/src/version.ts` | Reads `APP_VERSION` from `backend/package.json` at module load time |
| `backend/src/types.ts` | `AppConfig`, `MediaItem`, `MediaTrack` (backend-internal) |
| `backend/src/services/config.ts` | `loadConfig()`, `saveConfig()` with in-memory cache |
| `backend/src/services/media.ts` | `loadMedia()`, `saveMedia()` with in-memory cache |
| `backend/src/services/sonos.ts` | `buildSonosUrl()`, `fetchWithTimeout()` |
| `backend/src/services/apple-music.ts` | `searchApple()`, `fetchAlbumTracks()`, `searchArtist()` |
| `backend/src/routes/health.ts` | `GET /health` → `{ status: "ok", version }` |
| `backend/src/routes/version.ts` | `GET /version` → `{ version, gitCommit, gitCommitShort, buildDate }` |
| `backend/src/routes/media.ts` | All `/media/*` routes |
| `backend/src/routes/admin.ts` | All `/admin/*` routes |
| `backend/src/routes/sonos.ts` | `/sonos/control`, `/sonos/status`, `/play`, `/search/apple` |
| `backend/tests/` | Vitest tests for all services and routes (67 tests) |
| `frontend/src/__tests__/` | Vitest + React Testing Library tests (22 tests) |
| `frontend/src/__tests__/helpers/fixtures.ts` | Shared test fixtures (`createMockFetch`, mock data) |
| `frontend/vitest.config.ts` | Vitest config for frontend (jsdom, `__APP_VERSION__`) |
| `frontend/src/App.tsx` | Template loader via `React.lazy()`, admin routing |
| `frontend/src/vite-env.d.ts` | TypeScript declaration for `__APP_VERSION__` |
| `frontend/src/types.ts` | `MediaItem`, `MediaTrack`, `SonosConfig`, `AppleSearchResult` |
| `frontend/src/templates/default/App.tsx` | Full UI including admin interface |
| `frontend/src/templates/colorful/App.tsx` | Simplified kids UI |
| `frontend/vite.config.ts` | Vite config — injects `__APP_VERSION__` from root `package.json` |
| `media-data/config.json` | Runtime config (Sonos URL, rooms, templates) — local only, not tracked |
| `media-data/media.json` | Media library — local only, not tracked |
| `media-data.example/` | Tracked mock `config.json` + `media.json`; copied into the Docker image as defaults |

## Version System

App version flows from a single source:

```
root/package.json "version"
  ├── → backend/src/version.ts reads it at startup → GET /health, GET /version
  └── → frontend/vite.config.ts reads it at build time → __APP_VERSION__ constant
```

Build metadata (git commit, build date) is injected as Docker `ARG`s by CI:
- `GIT_COMMIT` → `process.env.GIT_COMMIT` → `GET /version` response
- `BUILD_DATE` → `process.env.BUILD_DATE` → `GET /version` response

In local dev both fields return `"unknown"`.

Frontend usage:
- `__APP_VERSION__` — build-time constant, always available (no API call needed)
- `GET /version` — fetched by `VersionInfo` component in admin panel; falls back to `__APP_VERSION__` if the API is unavailable

## Template System

- Templates live in `frontend/src/templates/[name]/`
- Each template needs: `App.tsx`, `App.css`, `template.config.json`
- `App.tsx` must accept `isAdmin: boolean` as a prop
- Active template stored in `config.json` → `activeTemplate`
- Template loader in `frontend/src/App.tsx` loads templates dynamically via `import()`
- Templates without their own admin interface redirect to the default template

## Services / Caching

`services/config.ts` and `services/media.ts` use an in-memory cache:
- First call reads from disk; subsequent calls return the cache
- `saveConfig()` / `saveMedia()` write to disk **and** update the cache
- **Important:** After manually editing `config.json` or `media.json`, restart the backend process for changes to take effect

`routes/sonos.ts` is mounted at root (`app.use(sonosRouter)`) because `/play` and `/search/apple` share no common prefix with `/sonos/*`.

## REST API (Backend Port 3344)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check → `{ status: "ok", version }` |
| `/version` | GET | Build info → `{ version, gitCommit, gitCommitShort, buildDate }` |
| `/media` | GET, POST | Media library |
| `/media/:id` | PUT, DELETE | Single media item |
| `/media/:id/tracks/:trackId` | PUT, DELETE | Track management |
| `/media/bulk` | PATCH | Bulk updates |
| `/media/apple/album` | POST | Import Apple Music album |
| `/media/apple/song` | POST | Import Apple Music song |
| `/admin/sonos` | GET | Get Sonos configuration |
| `/admin/sonos/test` | POST | Test Sonos API connectivity |
| `/admin/sonos/discover` | GET | Discover Sonos rooms |
| `/sonos/control` | POST | Control Sonos device (play, pause, volume, clearqueue, …) |
| `/sonos/status` | GET | Get current playback status |
| `/play` | POST | Play album or track by ID |
| `/search/apple` | GET | Apple Music / iTunes album/song search |
| `/search/apple/artist` | GET | Artist image search → `[{ artistId, artistName, artistImageUrl }]` |

No authentication — assumes local network deployment.

## Data Model

### MediaItem
```typescript
{
  id: string
  title: string
  kind: 'album' | 'audiobook' | 'playlist' | 'favorite' | 'other'
  service: 'appleMusic' | 'spotify'
  artist?: string
  album?: string
  coverUrl: string          // album artwork (square)
  artistImageUrl?: string   // optional artist photo (circle in main grid)
  sonosUri?: string
  appleId?: string
  tracks?: MediaTrack[]
}
```

`artistImageUrl` is set per media item via the admin edit modal. In the main overview, all albums by the same artist share the image — the first album in the group that has `artistImageUrl` set wins.

On album import (`POST /media/apple/album`), `artistImageUrl` is resolved automatically:
1. Reuse from another album by the same artist in the library
2. Search via `searchArtist()` (og:image scraping) — auto-apply if exactly 1 result, show picker dialog if 2+

## External APIs

- **Sonos HTTP API**: Room control, playback, volume. All calls proxied through the backend to avoid browser CORS errors.
- **Apple Music / iTunes Search API**: Album search, metadata, cover URLs (`itunes.apple.com/search`, `itunes.apple.com/lookup`)
- **Apple Music artist pages** (`music.apple.com/ch/artist/{id}`): Scraped for `og:image` meta tag to get artist profile photos. The iTunes API has no artist image endpoint — `og:image` is the only source. Each page fetch has a 3-second `AbortController` timeout.

## Data Persistence

JSON-based, no database setup required:
- `media-data/config.json`: Sonos URL, rooms, icons, volume limits, active template
- `media-data/media.json`: List of `MediaItem` objects with nested `MediaTrack[]`

`media-data/` holds real household data and is excluded from Git (`.gitignore`) and from the Docker build context (`.dockerignore`). `media-data.example/` contains neutral mock data with the same schema; it is tracked and shipped in the image as the default `/app/media-data`. If the files are missing, the backend falls back to built-in defaults (empty library).

## TypeScript Conventions

- Strict mode in both projects (`"strict": true`)
- Backend: CommonJS modules (`"module": "commonjs"`), ES2019 target
- Backend `tsconfig.json` excludes `tests/`, `dist/`, `vitest.config.ts` from compilation
- Frontend: ESM, React JSX transform (`"jsx": "react-jsx"`)
- Types centralized in `frontend/src/types.ts`

## CI/CD

Two GitHub Actions workflows:

**`.github/workflows/ci.yml`** — runs on every push/PR to `main`:
1. `lint` job: ESLint for backend + frontend (parallel)
2. `test` job: Vitest for backend + frontend (parallel with lint)
3. `build` job: `tsc` + `vite build` — only runs after lint + test both pass

**`.github/workflows/docker-publish.yml`** — runs on push to `main` and version tags:
- Builds multi-arch Docker image (`linux/amd64` + `linux/arm64`)
- Pushes to Docker Hub: `smartnightly/sonos-webcontroller4kids:latest`
- Injects `GIT_COMMIT` and `BUILD_DATE` as build args
- Deployment target: Synology NAS via Portainer

## Important Notes

- **Backend auto-restarts on file changes** via `tsx watch`. After editing backend source files, the server reloads automatically. If it doesn't (e.g. after installing packages), kill it manually and run `npm run dev` again.
- **Player auto-shows on playback**: both templates call `setPlayerOpen(true)` in `playAlbum()`/`playTrack()` after a successful play request. The colorful template uses CSS transitions (`max-height`/`opacity`/`padding`) rather than conditional render so the slide-in animates smoothly.
- **Docker Hub README**: `DOCKER_HUB_README.md` in repo root is the source of truth for the Docker Hub page. Copy it manually to Docker Hub when updated.
- The in-memory caches in `services/config.ts` and `services/media.ts` are re-initialized on each restart — so a restart also clears any stale cached state.
- Sonos polling in frontend every 2 seconds for status sync
- Admin interface accessed via query parameter `?admin=1`
- Volume limits configurable per room in `config.json` → `maxVolume`
- All Sonos API calls proxied through the backend (no direct browser access)
- Config and media data are cached in memory — no disk read on every request
- Backend runs without auth → local home network use only
- `backend/dist/` and `backend/node_modules/` are gitignored — run `npm install` + `npm run build` after cloning
- **Never commit real runtime data**: `media-data/` is gitignored. Keep mock data in `media-data.example/` free of real IPs, room names, and library content. After cloning, run `cp -R media-data.example media-data`.
