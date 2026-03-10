# Handoff – Sonos Web Controller 4 Kids

## Session-Zusammenfassung

### Was wurde gemacht

#### 1. CLAUDE.md erstellt
Projektdokumentation für Claude Code: Architektur, Entwicklungs-Commands, Key-Dateien, API-Endpunkte, Template-System.

#### 2. Backend-Refactoring: monolithisches index.ts → modulare Struktur

**Vorher:** `backend/src/index.ts` (~1400 Zeilen, alles in einer Datei)

**Nachher:**
```
backend/src/
├── index.ts                  ← nur App-Setup & Server-Start (~50 Zeilen)
├── types.ts                  ← AppConfig, MediaItem, MediaTrack
├── services/
│   ├── config.ts             ← loadConfig(), saveConfig()
│   ├── media.ts              ← loadMedia(), saveMedia()
│   ├── sonos.ts              ← buildSonosUrl(), fetchWithTimeout()
│   └── apple-music.ts        ← searchApple(), fetchAlbumTracks()
└── routes/
    ├── health.ts             ← GET /health
    ├── media.ts              ← alle /media/* Routen
    ├── admin.ts              ← alle /admin/* Routen
    └── sonos.ts              ← /sonos/control, /sonos/status, /play, /search/apple
```

**Routing-Besonderheit:** `routes/sonos.ts` wird am Root gemountet (`app.use(sonosRouter)`),
weil `/play` und `/search/apple` kein gemeinsames Präfix mit `/sonos/*` teilen.

#### 3. Bug Fix: CORS-Fehler beim Abspielen

**Problem:** `playAlbum()` und `playTrack()` in `frontend/src/templates/default/App.tsx`
riefen `clearqueue` direkt auf der Sonos HTTP-API auf (hardcodierte IP):
```js
// ❌ Vorher – Browser → Sonos direkt (kein CORS-Header → blockiert)
await fetch(`http://192.168.114.21:5005/${room}/clearqueue`)
```

**Fix:** clearqueue läuft jetzt über das Backend:
```js
// ✅ Nachher – Browser → Backend → Sonos
await fetch(`${API_BASE_URL}/sonos/control`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ room, action: 'clearqueue' }),
})
```

Backend: `clearqueue` Action in `/sonos/control` Switch-Statement ergänzt.

#### 4. Verbessertes Logging in /play

`catch`-Block in `routes/sonos.ts` loggt jetzt `url`, `err.message`, `err.cause`, `err.stack`.

---

## Offenes Problem: Apple Music gibt Sonos 500 zurück

### Symptom
`POST /play` mit Album-ID schlägt fehl. Backend-Log zeigt:
```
Spiele Album-URL: http://192.168.114.21:5005/Büro/applemusic/now/album:1483523950
→ Sonos HTTP 500

Fallback auf ersten Track: .../song:1483523952
→ Sonos HTTP 500

message: Sonos API returned 500 (auch mit Track-Fallback)
```

### Ursache
Die Sonos HTTP-API selbst schlägt fehl — kein Backend-Bug. Die `applemusic/now/...`
Endpunkte in der sonos-http-api erfordern, dass Apple Music in der Sonos-App eingeloggt
und die sonos-http-api korrekt konfiguriert ist.

### Nächste Schritte zur Diagnose
1. Direkt testen: `curl http://192.168.114.21:5005/Büro/applemusic/now/album:1483523950`
2. Prüfen ob Apple Music in der Sonos-App aktiv und eingeloggt ist
3. sonos-http-api Logs prüfen (auf dem Gerät, das die API hostet)
4. Alternativ: In der sonos-http-api gibt es oft `/musicsearch/apple/...` Endpunkte

---

## Bekannte Nebeneffekte / Tech Debt

### Exzessives Config-Lesen
`loadConfig()` liest bei **jedem Request** `config.json` von Disk — auch beim 2-Sekunden
Sonos-Status-Polling. Das erzeugt massives Log-Spam und unnötige Disk-I/O.

**Vorschlag:** Config in Memory cachen, nur bei POST-Requests invalidieren:
```ts
// services/config.ts
let cachedConfig: AppConfig | null = null
export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig
  cachedConfig = loadFromDisk()
  return cachedConfig
}
export function saveConfig(config: AppConfig) {
  cachedConfig = config
  saveToFile(config)
}
```

### Legacy-Dateien im Frontend
`frontend/src/App_old.tsx`, `App copy.tsx`, `App copy 2.tsx` — nicht anfassen, können
aber irgendwann gelöscht werden.

---

## Laufende Prozesse

| Prozess | Port | Befehl |
|---------|------|--------|
| Backend (ts-node) | 3344 | `cd backend && npm run dev` |
| Frontend (Vite) | 5173 | `cd frontend && npm run dev` |

## Aktuelle Konfiguration

- Sonos-API: `http://192.168.114.21:5005`
- Räume gesamt: 10 (Lounge, Spielzimmer, Kinderzimmer, Schlafzimmer, Küche, Wohnzimmer, Wintergarten, Bad, Büro, Werkstatt)
- Aktivierte Räume: Büro, Kinderzimmer, Spielzimmer, Wohnzimmer
- Media-Items: 87 Einträge
- Aktives Template: default
