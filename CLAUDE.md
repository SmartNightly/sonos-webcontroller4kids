# CLAUDE.md – Sonos Web Controller 4 Kids

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
├── media-data/                 # Persistent data (Docker volume)
│   ├── config.json             # App configuration
│   └── media.json              # Media library (albums, audiobooks)
├── .github/
│   ├── workflows/ci.yml        # CI: lint + test (backend + frontend, parallel) → build
│   └── workflows/docker-publish.yml  # CD: build + push to Docker Hub
├── DOCKER_HUB_README.md        # Docker Hub page (auto-synced by CI)
└── Dockerfile                  # Multi-stage build
```

## Development

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
| `media-data/config.json` | Runtime config (Sonos URL, rooms, templates) |
| `media-data/media.json` | Media library |

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

**`.github/workflows/ci.yml`** — `test` job runs both backend (`cd backend && npm test`) and frontend (`cd frontend && npm test`).

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
