# Handoff – Sonos Web Controller 4 Kids

Current state of the project. Use this to quickly get oriented after a break.

---

## What Was Built (chronological)

### 1. Backend Refactoring
Monolithic `backend/src/index.ts` (~1400 lines) split into a layered structure:

```
backend/src/
├── index.ts              # App setup, middleware, router registration (~50 lines)
├── version.ts            # Reads APP_VERSION from backend/package.json at startup
├── types.ts              # AppConfig, MediaItem, MediaTrack
├── services/
│   ├── config.ts         # loadConfig(), saveConfig() — in-memory cache
│   ├── media.ts          # loadMedia(), saveMedia() — in-memory cache
│   ├── sonos.ts          # buildSonosUrl(), fetchWithTimeout()
│   └── apple-music.ts    # searchApple(), fetchAlbumTracks()
└── routes/
    ├── health.ts         # GET /health → { status, version }
    ├── version.ts        # GET /version → { version, gitCommit, gitCommitShort, buildDate }
    ├── media.ts          # All /media/* routes
    ├── admin.ts          # All /admin/* routes
    └── sonos.ts          # /sonos/control, /sonos/status, /play, /search/apple
```

`routes/sonos.ts` is mounted at root (`app.use(sonosRouter)`) because `/play` and `/search/apple` share no common prefix with `/sonos/*`.

### 2. Bug Fix: CORS Error on Playback
`playAlbum()` and `playTrack()` were calling `clearqueue` directly on the Sonos HTTP API from the browser (hardcoded IP → no CORS header → blocked). Fixed to route through the backend `/sonos/control` endpoint.

### 3. ESLint + Prettier + Vitest
- ESLint v9 flat config: `backend/eslint.config.mjs` (`.mjs` needed — backend is CJS, no `"type": "module"`), `frontend/eslint.config.js`
- Shared `.prettierrc` at root: `{ "semi": false, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }`
- **54 Vitest tests in 8 files** covering all services and all routes
  - Service tests: `vi.resetModules()` + dynamic `import()` per test to isolate in-memory cache
  - Route tests: `vi.mock(path, factory)` hoisting + Supertest
  - `vitest.config.ts` uses `define: { __dirname: '"."' }` to polyfill CJS globals in ESM test runner

### 4. GitHub Actions CI
`.github/workflows/ci.yml`:
- `lint` + `test` run **in parallel**; `build` runs only after both pass
- Separate from `docker-publish.yml` (CD pipeline — untouched)

### 5. Frontend Template System
- Templates in `frontend/src/templates/[name]/`
- Loaded dynamically via `React.lazy()` in `frontend/src/App.tsx`
- Two templates: `default` (full UI + admin), `colorful` (simplified kids UI)

### 6. Version Visibility
End-to-end version display:

| Layer | Change |
|-------|--------|
| `root/package.json` | Added `"version": "1.0.0"` — single source of truth |
| `backend/src/version.ts` | Reads version from `backend/package.json` at module load time |
| `GET /health` | Now includes `version` field |
| `GET /version` | New endpoint: `{ version, gitCommit, gitCommitShort, buildDate }` |
| `frontend/vite.config.ts` | Reads root `package.json`, injects `__APP_VERSION__` via Vite `define` |
| `frontend/src/vite-env.d.ts` | TypeScript declaration for `__APP_VERSION__` |
| `frontend/…/default/App.tsx` | Version badge (fixed, bottom-right) lifted to `App` component so it's visible in all sub-views; `VersionInfo` in admin settings tab |
| `Dockerfile` | `ARG GIT_COMMIT` + `ARG BUILD_DATE` passed to runtime `ENV` |
| `docker-publish.yml` | Passes `github.sha` + `head_commit.timestamp` as build args |

`VersionInfo` falls back to `__APP_VERSION__` with `gitCommit: "dev"` on fetch failure — never gets stuck on "Loading...".

### 7. Gitignore Fix
`backend/dist/` and `backend/node_modules/` were tracked by git. Removed from tracking, added to `.gitignore`.

### 8. Artist Image Support
Per-item optional artist image for the main overview grid.

**Data model** — `MediaItem` now has an optional field:
```typescript
artistImageUrl?: string  // iTunes artist artwork URL (600×600)
```
Stored in `media.json` alongside existing fields. No migration needed — field is optional.

**Backend**
- `services/apple-music.ts`: New `ArtistSearchResult` type + `searchArtist(query)` function. Queries iTunes with `entity=musicArtist&country=ch`, filters to results that have `artworkUrl100`, upscales to `600x600`.
- `routes/sonos.ts`: New `GET /search/apple/artist?query=…` endpoint.

**Admin panel (`MediaEditor.tsx`)**
- Edit modal has a new "Artist Image" row: URL text input + circular preview thumbnail.
- "Search artist image for …" button calls `/search/apple/artist` using the current artist field value.
- Up to 5 results shown as circular thumbnails; click to select. URL can also be entered manually.
- `artistImageUrl` is saved via the existing `PUT /media/:id` endpoint (empty string is stored as `undefined`).

**Frontend display (both templates)**
- Artist grid: if any album in an artist group has `artistImageUrl` set, that image is shown as a **circle** (`borderRadius: 50%`). Otherwise falls back to the first album's cover art (square).
- The `artistImageUrl` is picked from the first album in the group that has the field; all albums by the same artist can share it.

**Tests** — 4 new tests for `searchArtist` → **58 total** (all passing).

### 9. Real Artist Profile Photos via og:image Scraping

The initial `searchArtist()` implementation used iTunes `entity=album` results filtered by artistId — this returned **album covers**, not actual artist profile photos.

**Fix**: The iTunes `entity=musicArtist` response has no artwork URL at all. Instead, the backend now scrapes the `og:image` meta tag from each artist's Apple Music page:

```
https://music.apple.com/ch/artist/{artistId}
```

`fetchArtistImage(artistId)` in `services/apple-music.ts`:
- 3-second `AbortController` timeout per request
- Handles both attribute orderings (`property="og:image" content="…"` and `content="…" property="og:image"`)
- Resizes the image to 600×600 center-cropped: `url.replace(/\/\d+x\d+[a-z]*\.\w+$/, '/600x600cc.png')`
- Returns `null` if no image found or request times out

`searchArtist()` now:
1. Queries iTunes `entity=musicArtist`, deduplicates by `artistId`
2. Fetches Apple Music pages in parallel (`Promise.all`)
3. Filters out artists where image scraping returned `null`

Tests updated to reflect the two-fetch pattern (iTunes search + HTML page). 14 test cases covering: error handling, attribute-order variants, deduplication, no og:image, no artistId.

### 10. Artist Image Persistence Fix

`PUT /media/:id` was not saving `artistImageUrl` at all — the field was missing from the update block.

Added to `routes/media.ts`:
```typescript
if (updates.artistImageUrl !== undefined) {
  if (updates.artistImageUrl) {
    item.artistImageUrl = updates.artistImageUrl
  } else {
    delete item.artistImageUrl  // clear — required by exactOptionalPropertyTypes
  }
}
```

Note: `exactOptionalPropertyTypes: true` in tsconfig means you cannot assign `undefined` to optional fields. Must use `delete` to unset them.

### 11. Auto-Search Artist Image on Import + Bulk-Apply

**On album import** (`POST /media/apple/album`), the backend now auto-sets `artistImageUrl`:

`resolveArtistImage(artist, items)` in `routes/media.ts`:
1. Checks if any existing media item for the same artist already has `artistImageUrl` → reuses it
2. Otherwise calls `searchArtist(artist)`
3. **Exactly 1 result** → returns the image URL (auto-applied)
4. **0 or 2+ results** → returns `undefined` (frontend shows picker)

**On manual edit** (`MediaEditor.tsx → handleSaveEdit`), after saving an `artistImageUrl`, the frontend checks for other albums by the same artist with a different image URL. If found, shows a `window.confirm` dialog and bulk-applies via `PATCH /media/bulk`.

### 12. Artist Image Picker Dialog

When importing an album without a resolvable artist image (0 or 2+ results from `searchArtist`), the frontend (`default/App.tsx → addToMedia`) calls `GET /search/apple/artist?q={artist}` and:

- **1 result** → silently applies via `PUT /media/:id`, then offers bulk-apply confirm
- **2+ results** → opens `ArtistImagePickerModal`

`ArtistImagePickerModal` component in `default/App.tsx`:
- Shows circular thumbnails with artist names
- ✕ button (top-right) and "Überspringen" button to dismiss without selecting
- On select: saves image via `PUT /media/:id`, offers bulk-apply confirm, refreshes media list

State: `artistImagePicker: { item, candidates } | null` in `AdminView`.

### 13. Auto-Show Player on Playback

When playback starts, the player panel now automatically slides into view in both templates.

**Default template** (`frontend/src/templates/default/App.tsx`):
- `playAlbum()` and `playTrack()` call `setPlayerOpen(true)` after a successful `/play` request
- Player panel already had a CSS transition on `max-height` and `opacity` in `styles.playerPanel`

**Colorful template** (`frontend/src/templates/colorful/App.tsx`):
- `playAlbum()` calls `setPlayerOpen(true)` after a successful `/play` request
- Mini-player changed from conditional render (`{playerOpen && <div>}`) to always-rendered with inline CSS transitions:
  ```tsx
  style={{
    ...styles.miniPlayer,
    maxHeight: playerOpen ? '80px' : '0',
    opacity: playerOpen ? 1 : 0,
    overflow: 'hidden',
    padding: playerOpen ? '12px 16px' : '0 16px',
    transition: 'max-height 300ms ease-in-out, opacity 300ms ease-in-out, padding 300ms ease-in-out',
  }}
  ```

### 14. Docker Hub README

`DOCKER_HUB_README.md` (repo root) — synced automatically to Docker Hub on every push to `main` via `peter-evans/dockerhub-description@v4` in `.github/workflows/docker-publish.yml`.

Content: features overview, `docker run` quick start, Docker Compose snippet, configuration reference (config.json, media.json), requirements (node-sonos-http-api, Apple Music), architecture summary.

### 15. Frontend Tests

22 tests across 4 files using **Vitest + React Testing Library + jsdom**.

| File | Tests | Coverage |
|------|-------|----------|
| `src/__tests__/MediaEditor.test.tsx` | 7 | renders, load items, search/filter, error state, onClose |
| `src/__tests__/templates/colorful/App.test.tsx` | 8 | admin redirect, loading, artist grid, circular/square images, navigation |
| `src/__tests__/templates/default/App.test.tsx` | 4 | renders, version badge, admin view, media load |
| `src/__tests__/App.test.tsx` | 3 | loading state, fetch failure, URL param read |

Config: `frontend/vitest.config.ts` — jsdom environment, `__APP_VERSION__` defined as `'1.1.0-test'`, setup file imports `@testing-library/jest-dom`.

Run: `cd frontend && npm test`

### 16. CI and Build Fixes

- **Node.js 22**: All three CI jobs (`lint`, `test`, `build`) updated from Node 20 to 22 (Node 20 is deprecated in GitHub Actions)
- **TypeScript `exactOptionalPropertyTypes` errors**: Fixed 4 errors in `routes/media.ts` introduced by the artist image feature:
  - `item.artistImageUrl = updates.artistImageUrl || undefined` → replaced with `if/else` + `delete`
  - `results[0].artistImageUrl` → `results[0]!.artistImageUrl` (non-null assertion)
  - Direct assignment of `resolveArtistImage()` result → `const resolved = await …; if (resolved) item.field = resolved`
- **Backend dev script**: Changed from `ts-node src/index.ts` to `tsx watch src/index.ts` for auto-restart on file changes. Added `tsx` to devDependencies.

---

## Current State

- **Version**: `1.1.0` (root + backend `package.json`)
- **67 backend tests pass**: `cd backend && npm test`
- **22 frontend tests pass**: `cd frontend && npm test`
- **Lint clean**: `npm run lint` in both `backend/` and `frontend/`
- **CI active** on GitHub Actions (Node.js 22)
- **Docker auto-publishes** on push to `main` or version tags (`v*`) — also syncs Docker Hub README
- **Backend dev**: `tsx watch` — auto-restarts on file changes

### Running locally

```bash
# Backend (Port 3344) — auto-restarts on file changes via tsx watch
cd backend && npm run dev

# Frontend dev server (Port 5173, proxied to backend)
cd frontend && npm run dev
```

After fresh clone:
```bash
cd backend && npm install
cd frontend && npm install
# backend/dist/ is gitignored — build if needed:
cd backend && npm run build
```

### Current runtime config (media-data/config.json)
- Sonos API: `http://192.168.114.21:5005`
- Rooms enabled: Büro, Kinderzimmer, Spielzimmer, Wohnzimmer
- All rooms: Lounge, Spielzimmer, Kinderzimmer, Schlafzimmer, Küche, Wohnzimmer, Wintergarten, Bad, Büro, Werkstatt
- Media items: 87
- Active template: `default`

---

## Known Issues

### Apple Music playback returns Sonos 500
`POST /play` with Apple Music album IDs fails. Sonos HTTP API returns 500 on `/applemusic/now/album:…` and `/applemusic/now/song:…`. This is not a backend bug — the Sonos HTTP API requires Apple Music to be logged in and configured in the Sonos app.

Diagnosis steps:
1. `curl http://192.168.114.21:5005/Büro/applemusic/now/album:1483523950`
2. Check Apple Music login state in the Sonos app
3. Check sonos-http-api logs on the host device
4. Try `/musicsearch/apple/…` endpoints as alternative

---

## Architecture Decisions

| Decision | Reason |
|----------|--------|
| Root `package.json` as version source | Single place to bump version; Vite reads it at build time, backend reads it at startup |
| `version.ts` reads `backend/package.json` | `__dirname` resolves to correct directory in both `ts-node` (dev) and `dist/` (prod) |
| Version badge in `App` component, not `KidsView` | `KidsView` has multiple early returns (loading, error, detail views); `App` always renders |
| `eslint.config.mjs` for backend | Backend is CJS; `.mjs` extension forces ESM treatment for the ESLint config file |
| `vi.resetModules()` per service test | Services have module-level `let cache = null`; resetting modules isolates cache per test |
| `backend/dist/` gitignored | Build output must not be tracked; CI builds fresh on every run |
| og:image scraping for artist images | iTunes/Apple Music API has no artist photo endpoint; `og:image` on `music.apple.com/ch/artist/{id}` is the only source of real profile photos |
| Auto-apply when exactly 1 search result | Avoids wrong auto-fill for ambiguous names (e.g. "Ed Sheeran" vs edge cases); 2+ results show picker dialog |
| Bulk-apply via `PATCH /media/bulk` | Avoids O(n) individual PUTs; all albums updated in one request + one `saveMedia()` write |

---

## Possible Next Steps

- **Release workflow**: Run `npm run version:minor` (root) + update `backend/package.json` manually to match, then commit and tag `vX.Y.Z` — Docker publish triggers automatically
- **Config hot-reload**: Backend restart required after manual `config.json` edits; a `POST /admin/reload` endpoint could help
- **Auth**: No authentication — fine for local home network, but worth noting if ever exposed publicly
- **Country code**: `country: 'ch'` is hardcoded in iTunes API calls — consider making it configurable
- **Artist image robustness**: Scraping Apple Music HTML may break if Apple changes their page structure; consider caching scraped images locally
