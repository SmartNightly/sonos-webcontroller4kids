import express from 'express'
import type { Request, Response } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import cors from 'cors'

type AppConfig = {
  sonosBaseUrl: string
  rooms: string[]        // alle entdeckten Räume
  enabledRooms: string[] // Räume, die im Frontend auswählbar sind
  defaultRoom?: string | undefined   // persistent gewählter Raum
  showShuffleRepeat?: boolean // Shuffle/Repeat Buttons im Player anzeigen (default: true)
  roomIcons?: Record<string, string> // Emoji/Symbol pro Raum (z.B. { "Büro": "💼", "Kinderzimmer": "🧸" })
  showTracklistAlbums?: boolean // Tracklist bei Alben anzeigen (default: true)
  showTracklistAudiobooks?: boolean // Tracklist bei Hörbüchern anzeigen (default: true)
}

const DEFAULT_SONOS_BASE_URL = 'http://192.168.114.21:5005'

const CONFIG_PATH = path.join(__dirname, '..', '..', 'media-data', 'config.json')

function loadConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    const rooms = parsed.rooms || []
    const enabledRooms = parsed.enabledRooms || rooms

    return {
      sonosBaseUrl: parsed.sonosBaseUrl || DEFAULT_SONOS_BASE_URL,
      rooms,
      enabledRooms,
      defaultRoom: parsed.defaultRoom, // kann undefined sein
      showShuffleRepeat: parsed.showShuffleRepeat !== undefined ? parsed.showShuffleRepeat : true,
      roomIcons: parsed.roomIcons || {},
      showTracklistAlbums: parsed.showTracklistAlbums !== undefined ? parsed.showTracklistAlbums : true,
      showTracklistAudiobooks: parsed.showTracklistAudiobooks !== undefined ? parsed.showTracklistAudiobooks : true,
    }
  } catch {
    return {
      sonosBaseUrl: DEFAULT_SONOS_BASE_URL,
      rooms: [],
      enabledRooms: [],
      defaultRoom: undefined,
      showShuffleRepeat: true,
      roomIcons: {},
      showTracklistAlbums: true,
      showTracklistAudiobooks: true,
    }
  }
}


function saveConfig(config: AppConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

type MediaTrack = {
  id: string              // interne ID, z.B. "album123_track1628586860"
  title: string
  appleSongId: string     // trackId für song:...
  trackNumber?: number
  durationMs?: number
}

type MediaItem = {
  id: string              // interne Album-ID (z.B. "pingu_album_01")
  title: string
  kind: 'album' | 'favorite' | 'other'
  service: 'appleMusic' | 'spotify'
  artist?: string
  album?: string
  coverUrl: string
  sonosUri?: string       // nur für Favoriten nötig
  appleId?: string        // Album-ID (collectionId)
  tracks?: MediaTrack[]   // Child-Songs
}

const MEDIA_PATH = path.join(__dirname, '..', '..', 'media-data', 'media.json')

function loadMedia(): MediaItem[] {
  const fileContent = fs.readFileSync(MEDIA_PATH, 'utf-8')
  return JSON.parse(fileContent) as MediaItem[]
}

function saveMedia(items: MediaItem[]) {
  fs.writeFileSync(MEDIA_PATH, JSON.stringify(items, null, 2), 'utf-8')
}

// Root-Route
app.get('/', (req: Request, res: Response) => {
  res.send('Sonos Kids Backend läuft 🎧')
})

// Healthcheck
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// Medien-Liste (für KidsView & Admin zum Anzeigen)
app.get('/media', (req: Request, res: Response) => {
  try {
    const media = loadMedia()
    res.json(media)
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    res.status(500).json({ error: 'Media file could not be loaded' })
  }
})

// Media-Eintrag hinzufügen (generisch)
// Erlaubt Apple-Music-Einträge nur mit appleId ODER klassische Einträge mit sonosUri
app.post('/media', (req: Request, res: Response) => {
  const payload = req.body as Partial<MediaItem>

  // Apple Music mit appleId → sonosUri ist NICHT nötig
  const needsSonosUri = !(
    payload.service === 'appleMusic' &&
    !!payload.appleId
  )

  if (
    !payload.id ||
    !payload.title ||
    !payload.service ||
    (needsSonosUri && !payload.sonosUri)
  ) {
    return res.status(400).json({
      error:
        'id, title, service und entweder appleId (für Apple Music) oder sonosUri sind erforderlich',
    })
  }

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  if (items.some(i => i.id === payload.id)) {
    return res
      .status(409)
      .json({ error: `Eintrag mit id ${payload.id} existiert bereits` })
  }

  const newItem: MediaItem = {
    id: payload.id,
    title: payload.title,
    kind: (payload.kind as MediaItem['kind']) || 'other',
    service: payload.service as MediaItem['service'],
    coverUrl: payload.coverUrl || '',
    ...(payload.artist !== undefined ? { artist: payload.artist } : {}),
    ...(payload.album !== undefined ? { album: payload.album } : {}),
    ...(payload.sonosUri ? { sonosUri: payload.sonosUri } : {}),
    ...(payload.appleId ? { appleId: payload.appleId } : {}),
    ...(payload.tracks ? { tracks: payload.tracks } : {}),
  }

  items.push(newItem)

  try {
    saveMedia(items)
  } catch (err) {
    console.error('Fehler beim Schreiben von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be saved' })
  }

  res.status(201).json(newItem)
})

// Media-Eintrag aktualisieren (PUT /media/:id)
app.put('/media/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const updates = req.body as Partial<MediaItem>

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const index = items.findIndex(i => i.id === id)
  if (index === -1) {
    return res.status(404).json({ error: `Kein Eintrag mit id ${id} gefunden` })
  }

  const item = items[index]!

  // Nur bestimmte Felder aktualisieren, um id/service zu schützen
  if (updates.title !== undefined) item.title = updates.title
  if (updates.artist !== undefined) item.artist = updates.artist
  if (updates.album !== undefined) item.album = updates.album
  if (updates.coverUrl !== undefined) item.coverUrl = updates.coverUrl
  if (updates.kind !== undefined) item.kind = updates.kind as MediaItem['kind']

  try {
    saveMedia(items)
  } catch (err) {
    console.error('Fehler beim Schreiben von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be saved' })
  }

  res.json(item)
})

// Media-Eintrag löschen (DELETE /media/:id)
app.delete('/media/:id', (req: Request, res: Response) => {
  const { id } = req.params

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const index = items.findIndex(i => i.id === id)
  if (index === -1) {
    return res.status(404).json({ error: `Kein Eintrag mit id ${id} gefunden` })
  }

  items.splice(index, 1)

  try {
    saveMedia(items)
  } catch (err) {
    console.error('Fehler beim Schreiben von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be saved' })
  }

  res.json({ status: 'deleted', id })
})

// Track aus Album löschen (DELETE /media/:albumId/tracks/:trackId)
app.delete('/media/:albumId/tracks/:trackId', (req: Request, res: Response) => {
  const { albumId, trackId } = req.params

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const item = items.find(i => i.id === albumId)
  if (!item) {
    return res.status(404).json({ error: `Kein Album mit id ${albumId} gefunden` })
  }

  if (!item.tracks || item.tracks.length === 0) {
    return res.status(404).json({ error: `Album ${albumId} hat keine Tracks` })
  }

  const trackIndex = item.tracks.findIndex(t => t.id === trackId)
  if (trackIndex === -1) {
    return res.status(404).json({ error: `Kein Track mit id ${trackId} gefunden` })
  }

  item.tracks.splice(trackIndex, 1)

  try {
    saveMedia(items)
  } catch (err) {
    console.error('Fehler beim Schreiben von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be saved' })
  }

  res.json({ status: 'deleted', albumId, trackId })
})

// Track in Album aktualisieren (PUT /media/:albumId/tracks/:trackId)
app.put('/media/:albumId/tracks/:trackId', (req: Request, res: Response) => {
  const { albumId, trackId } = req.params
  const updates = req.body as Partial<MediaTrack>

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const item = items.find(i => i.id === albumId)
  if (!item) {
    return res.status(404).json({ error: `Kein Album mit id ${albumId} gefunden` })
  }

  if (!item.tracks || item.tracks.length === 0) {
    return res.status(404).json({ error: `Album ${albumId} hat keine Tracks` })
  }

  const track = item.tracks.find(t => t.id === trackId)
  if (!track) {
    return res.status(404).json({ error: `Kein Track mit id ${trackId} gefunden` })
  }

  // Nur erlaubte Felder aktualisieren (derzeit Titel, optional Nummer/Dauer)
  if (updates.title !== undefined) track.title = updates.title
  if (updates.trackNumber !== undefined) track.trackNumber = updates.trackNumber
  if (updates.durationMs !== undefined) track.durationMs = updates.durationMs

  try {
    saveMedia(items)
  } catch (err) {
    console.error('Fehler beim Schreiben von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be saved' })
  }

  res.json(track)
})

// Aktuelle Sonos-Konfiguration holen
app.get('/admin/sonos', (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    res.json(config) // sonosBaseUrl, rooms, enabledRooms, defaultRoom
  } catch (err) {
    console.error('Fehler beim Laden der Sonos-Konfiguration:', err)
    res.status(500).json({ error: 'Sonos-Konfiguration konnte nicht geladen werden' })
  }
})



// Sonos-Räume aus sonos-http-api holen und Konfiguration speichern
app.post('/admin/sonos/discover', async (req: Request, res: Response) => {
  const { sonosBaseUrl } = req.body as { sonosBaseUrl?: string }

  const current = loadConfig()
  const baseUrl =
    (sonosBaseUrl && sonosBaseUrl.trim().replace(/\/+$/, '')) || // trailing slash weg
    current.sonosBaseUrl ||
    DEFAULT_SONOS_BASE_URL

  async function tryFetchRoomsEndpoint() {
    const url = `${baseUrl}/rooms`
    console.log('Versuche Sonos /rooms:', url)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Sonos /rooms returned ${response.status}`)
    }
    const data = (await response.json()) as any[]
    const rooms = (data || [])
      .map((r: any) => r.roomName || r.name)
      .filter((name: any): name is string => typeof name === 'string')
      .filter((name, idx, arr) => arr.indexOf(name) === idx)
    return rooms
  }

  async function tryFetchZonesEndpoint() {
    const url = `${baseUrl}/zones`
    console.log('Versuche Sonos /zones:', url)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Sonos /zones returned ${response.status}`)
    }
    const data = (await response.json()) as any[]
    // zones: [{ members: [{ roomName, ... }, ...] }, ...]
    const rooms = (data || [])
      .flatMap((zone: any) => zone.members || [])
      .map((m: any) => m.roomName || m.name)
      .filter((name: any): name is string => typeof name === 'string')
      .filter((name, idx, arr) => arr.indexOf(name) === idx)
    return rooms
  }

  try {
    let rooms: string[] = []

    // 1. Versuch: /rooms
    try {
      rooms = await tryFetchRoomsEndpoint()
      console.log('Sonos-Räume aus /rooms:', rooms)
    } catch (err) {
      console.warn('Konnte /rooms nicht verwenden, versuche /zones:', err)
      // 2. Versuch: /zones
      rooms = await tryFetchZonesEndpoint()
      console.log('Sonos-Räume aus /zones:', rooms)
    }

    if (!rooms || rooms.length === 0) {
      throw new Error('Keine Sonos-Räume gefunden')
    }

    // rooms aus /rooms oder /zones wurden ermittelt
    if (!rooms || rooms.length === 0) {
      throw new Error('Keine Sonos-Räume gefunden')
    }

    const oldConfig = loadConfig()

    const enabledRoomsIntersection =
      oldConfig.enabledRooms?.filter(r => rooms.includes(r)) || []

    const enabledRooms =
      enabledRoomsIntersection.length > 0 ? enabledRoomsIntersection : rooms

    // defaultRoom nur behalten, wenn er noch in enabledRooms existiert
    const defaultRoom =
      oldConfig.defaultRoom && enabledRooms.includes(oldConfig.defaultRoom)
        ? oldConfig.defaultRoom
        : undefined

    const newConfig: AppConfig = {
      sonosBaseUrl: baseUrl,
      rooms,
      enabledRooms,
      defaultRoom,
    }

    saveConfig(newConfig)

    res.json(newConfig)


  } catch (err) {
    console.error('Fehler beim Holen der Sonos-Räume:', err)
    res.status(502).json({
      error: 'Sonos-Räume konnten nicht geladen werden. Details siehe Backend-Log.',
    })
  }
})

app.post('/admin/sonos/rooms', (req: Request, res: Response) => {
  const { enabledRooms } = req.body as { enabledRooms?: string[] }

  if (!Array.isArray(enabledRooms)) {
    return res.status(400).json({ error: 'enabledRooms muss ein Array sein' })
  }

  const config = loadConfig()

  // Nur Räume erlauben, die auch wirklich existieren
  const cleaned = enabledRooms.filter(r => config.rooms.includes(r))

  const newConfig: AppConfig = {
    ...config,
    enabledRooms: cleaned,
  }

  saveConfig(newConfig)

  res.json(newConfig)
})

app.post('/admin/sonos/default-room', (req: Request, res: Response) => {
  const { defaultRoom } = req.body as { defaultRoom?: string }

  const config = loadConfig()

  if (defaultRoom && !config.enabledRooms.includes(defaultRoom)) {
    return res.status(400).json({
      error: 'defaultRoom muss einer der aktivierten Räume sein',
    })
  }

  const newConfig: AppConfig = {
    ...config,
    defaultRoom: defaultRoom || undefined,
  }

  saveConfig(newConfig)
  res.json(newConfig)
})

app.post('/admin/sonos/settings', (req: Request, res: Response) => {
  const { showShuffleRepeat } = req.body as { showShuffleRepeat?: boolean }

  const config = loadConfig()

  const newConfig: AppConfig = {
    ...config,
    showShuffleRepeat: showShuffleRepeat !== undefined ? showShuffleRepeat : (config.showShuffleRepeat ?? true),
  }

  saveConfig(newConfig)
  res.json(newConfig)
})

app.post('/admin/sonos/room-icons', (req: Request, res: Response) => {
  const { roomIcons } = req.body as { roomIcons?: Record<string, string> }

  const config = loadConfig()

  const newConfig: AppConfig = {
    ...config,
    roomIcons: roomIcons || config.roomIcons || {},
  }

  saveConfig(newConfig)
  res.json(newConfig)
})

app.post('/admin/sonos/tracklist-settings', (req: Request, res: Response) => {
  const { showTracklistAlbums, showTracklistAudiobooks } = req.body as { 
    showTracklistAlbums?: boolean
    showTracklistAudiobooks?: boolean
  }

  const config = loadConfig()

  const newConfig: AppConfig = {
    ...config,
    showTracklistAlbums: showTracklistAlbums !== undefined ? showTracklistAlbums : (config.showTracklistAlbums ?? true),
    showTracklistAudiobooks: showTracklistAudiobooks !== undefined ? showTracklistAudiobooks : (config.showTracklistAudiobooks ?? true),
  }

  saveConfig(newConfig)
  res.json(newConfig)
})


// Generischer Sonos-Control-Endpoint
// Body: { room: string, action: string, value?: number }
app.post('/sonos/control', async (req: Request, res: Response) => {
  const { room, action, value } = req.body as { room?: string; action?: string; value?: number }

  if (!room || !action) {
    return res.status(400).json({ error: 'room und action erforderlich' })
  }

  const config = loadConfig()
  const baseUrl = config.sonosBaseUrl || DEFAULT_SONOS_BASE_URL

  // Map action to sonos-http-api path
  let path = ''
  switch (action) {
    case 'play':
    case 'pause':
    case 'next':
    case 'previous':
      path = action === 'previous' ? 'previous' : action
      break
    case 'volumeUp':
      path = `volume/+${value ?? 5}`
      break
    case 'volumeDown':
      path = `volume/-${value ?? 5}`
      break
    case 'setVolume':
      if (typeof value !== 'number') return res.status(400).json({ error: 'value erforderlich für setVolume' })
      path = `volume/${value}`
      break
    case 'mute':
      path = 'mute'
      break
    case 'unmute':
      path = 'unmute'
      break
    case 'toggleMute':
      path = 'toggleMute'
      break
    case 'shuffleOn':
      path = 'shuffle/on'
      break
    case 'shuffleOff':
      path = 'shuffle/off'
      break
    case 'repeatOff':
      path = 'repeat/off'
      break
    case 'repeatOne':
      path = 'repeat/one'
      break
    case 'repeatAll':
      path = 'repeat/all'
      break
    default:
      return res.status(400).json({ error: `Unbekannte action ${action}` })
  }

  const url = `${baseUrl}/${encodeURIComponent(room)}/${path}`

  try {
    // Viele sonos-http-api Endpunkte erwarten einen einfachen GET-Request.
    // Verwende ein kurzes Timeout, damit der Backend-Request nicht ewig hängt.
    const controller = new AbortController()
    const timeout = 3000
    const id = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return res.status(502).json({ error: `Sonos API returned ${response.status}`, details: text })
      }
      return res.json({ status: 'ok', action, room })
    } finally {
      clearTimeout(id)
    }
  } catch (err: any) {
    if (err && err.name === 'AbortError') {
      console.error('Fehler bei Sonos-Control: request timeout')
      return res.status(504).json({ error: 'Sonos API request timed out' })
    }
    console.error('Fehler bei Sonos-Control:', err)
    return res.status(502).json({ error: 'Fehler bei Sonos-API' })
  }
})


// Status-Synchronisation: Liefert aktuellen Player-Status und Track-Info
// Versucht verschiedene sonos-http-api Endpunkte und aggregiert Ergebnisse.
app.get('/sonos/status', async (req: Request, res: Response) => {
  const room = String(req.query.room || '')

  if (!room) {
    return res.status(400).json({ error: 'Query-Parameter room ist erforderlich' })
  }

  const config = loadConfig()
  const baseUrl = config.sonosBaseUrl || DEFAULT_SONOS_BASE_URL

  // Hilfsfunktion: hole URL und versuche JSON, sonst Text
  async function fetchAny(u: string, timeoutMs = 3000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const r = await fetch(u, { signal: controller.signal })
      const text = await r.text().catch(() => '')
      try {
        return { ok: r.ok, url: u, json: JSON.parse(text) }
      } catch {
        return { ok: r.ok, url: u, text }
      }
    } catch (err: any) {
      // Distinguish abort vs other errors for better debugging
      if (err && err.name === 'AbortError') {
        return { ok: false, url: u, error: `timeout after ${timeoutMs}ms` }
      }
      return { ok: false, url: u, error: String(err) }
    } finally {
      clearTimeout(id)
    }
  }

  const encoded = encodeURIComponent(room)

  const tried: Array<any> = []
  const result: any = { room, available: false }

  // 1) State (playing/paused) — diese Endpoint liefert oft umfangreiche Infos
  const stateUrl = `${baseUrl}/${encoded}/state`
  const stateRes = await fetchAny(stateUrl)
  tried.push(stateRes)
  if (stateRes.ok) {
    result.available = true
    const payload = stateRes.json ?? stateRes.text

    if (typeof payload === 'string') {
      const p = payload.toLowerCase()
      if (p.includes('play')) result.state = 'playing'
      else if (p.includes('pause') || p.includes('paused')) result.state = 'paused'
      else result.state = payload
    } else if (payload && typeof payload === 'object') {
      // Direktes Mapping für das von dir gezeigte /state-Format
      // Playback state
      const pb = payload.playbackState || payload.state || payload.transportState
      if (pb) {
        result.state = typeof pb === 'string' ? pb.toLowerCase() : pb
      }

      // Volume & mute
      if (payload.volume !== undefined) result.volume = Number(payload.volume)
      if (payload.mute !== undefined) result.muted = Boolean(payload.mute)

      // Equalizer (optional)
      if (payload.equalizer) result.equalizer = payload.equalizer

      // Current track
      const ct = payload.currentTrack || payload.current || payload.track || null
      if (ct && typeof ct === 'object') {
        const track: any = {}
        track.title = ct.title || ct.name || ct.track || ct.currentTitle
        track.artist = ct.artist || ct.creator
        track.album = ct.album
        track.uri = ct.uri || ct.trackUri || ct.resource
        // duration in seconds → convert to ms when reasonable
        if (ct.duration !== undefined) {
          const d = Number(ct.duration)
          if (!Number.isNaN(d)) track.durationMs = d > 10000 ? d : d * 1000
        } else if (ct.durationMs !== undefined) {
          track.durationMs = Number(ct.durationMs)
        } else if (ct.trackTimeMillis !== undefined) {
          track.durationMs = Number(ct.trackTimeMillis)
        }

        // album art
        if (ct.absoluteAlbumArtUri) track.albumArt = ct.absoluteAlbumArtUri
        else if (ct.albumArtUri) track.albumArt = ct.albumArtUri

        result.track = { ...(result.track || {}), ...track }
      }

      // Next track
      const nt = payload.nextTrack
      if (nt && typeof nt === 'object') {
        result.nextTrack = {
          title: nt.title || nt.name,
          artist: nt.artist,
          album: nt.album,
          durationMs: nt.duration ? (Number(nt.duration) > 10000 ? Number(nt.duration) : Number(nt.duration) * 1000) : undefined,
          uri: nt.uri || nt.trackUri,
          albumArt: nt.absoluteAlbumArtUri || nt.albumArtUri,
        }
      }

      // Position / elapsed
      if (payload.elapsedTime !== undefined) {
        const e = Number(payload.elapsedTime)
        if (!Number.isNaN(e)) result.track = { ...(result.track || {}), positionMs: e > 10000 ? e : e * 1000 }
      } else if (payload.elapsedTimeMs !== undefined) {
        result.track = { ...(result.track || {}), positionMs: Number(payload.elapsedTimeMs) }
      }

      // Track number
      if (payload.trackNo !== undefined) result.trackNo = Number(payload.trackNo)

      // Play mode (repeat/shuffle)
      if (payload.playMode) {
        result.playMode = payload.playMode
        if (payload.playMode.repeat !== undefined) result.repeat = payload.playMode.repeat
        if (payload.playMode.shuffle !== undefined) result.shuffle = Boolean(payload.playMode.shuffle)
      }
    }
  }

  // 2) Now playing / current track endpoints to extract metadata
  const nowCandidates = [
    `${baseUrl}/${encoded}/now`,
    `${baseUrl}/${encoded}/nowPlaying`,
    `${baseUrl}/${encoded}/currentTrack`,
    `${baseUrl}/${encoded}/player`,
    `${baseUrl}/${encoded}/status`,
    `${baseUrl}/${encoded}/getPositionInfo`,
    `${baseUrl}/${encoded}/position`,
  ]

  for (const u of nowCandidates) {
    const r = await fetchAny(u)
    tried.push(r)
    if (!r.ok) continue
    const payload = r.json ?? r.text
    // Try to extract common fields
    const track: any = result.track || {}

    if (typeof payload === 'string') {
      // Some endpoints return a simple string with title
      if (!track.title) track.title = payload
    } else if (payload && typeof payload === 'object') {
      // Common keys
      if (!track.title) track.title = payload.title || payload.name || payload.track || payload.currentTitle
      if (!track.artist) track.artist = payload.artist || payload.creator || payload.trackArtist
      if (!track.album) track.album = payload.album || payload.collection
      if (!track.uri) track.uri = payload.resource || payload.uri || payload.trackUri
      if (!track.durationMs) {
        const dur = payload.duration || payload.durationMs || payload.trackTimeMillis || payload.length
        if (typeof dur === 'number') track.durationMs = dur
        else if (typeof dur === 'string' && !Number.isNaN(Number(dur))) track.durationMs = Number(dur)
      }
      // position
      if (!track.positionMs) {
        const pos = payload.position || payload.positionMs || payload.elapsed
        if (typeof pos === 'number') track.positionMs = pos
        else if (typeof pos === 'string' && !Number.isNaN(Number(pos))) track.positionMs = Number(pos)
      }
    }

    result.track = track
    // stop at first successful detailed response
    if (result.track && (result.track.title || result.track.uri)) break
  }

  // Volume, mute, shuffle, repeat werden bereits von /state geliefert.
  // Separate Abfragen an /volume, /mute, /shuffle, /repeat können bei manchen
  // Sonos-HTTP-API-Implementierungen Seiteneffekte (toggle/set) verursachen.
  // Daher überspringen wir sie und verlassen uns auf die /state-Antwort.

  // Attach tried endpoints for debugging
  result._tried = tried.map((t: any) => ({ url: t.url, ok: !!t.ok, summary: t.json ? '[json]' : typeof t.text === 'string' ? t.text : t.error }))

  res.json(result)
})



function buildSonosUrl(item: MediaItem, room: string, track?: MediaTrack): string {
  const config = loadConfig()
  const baseUrl = config.sonosBaseUrl || DEFAULT_SONOS_BASE_URL

  // 1) Apple Music – einzelner Track
  if (
    item.service === 'appleMusic' &&
    track &&
    track.appleSongId
  ) {
    const url = `${baseUrl}/${encodeURIComponent(room)}/applemusic/now/song:${track.appleSongId}`
    console.log('Spiele Track-URL:', url)
    return url
  }

  // 2) Apple Music – komplettes Album oder Audiobook
  if (item.service === 'appleMusic' && item.appleId) {
    const url = `${baseUrl}/${encodeURIComponent(room)}/applemusic/now/album:${item.appleId}`
    console.log('Spiele Album/Audiobook-URL:', url)
    return url
  }

  // 3) Fallback: Sonos-Favoriten oder andere Dienste
  if (item.sonosUri) {
    const url = `${baseUrl}/${encodeURIComponent(room)}/${item.sonosUri}`
    console.log('Spiele Favoriten-/Fallback-URL:', url)
    return url
  }

  throw new Error(`Kein Abspielpfad für MediaItem ${item.id} konfiguriert`)
}




// Abspielen
app.post('/play', async (req: Request, res: Response) => {
  const { id, room, trackAppleSongId } = req.body as {
    id?: string
    room?: string
    trackAppleSongId?: string
  }

  if (!id || !room) {
    return res.status(400).json({ error: 'id und room sind erforderlich' })
  }

  let media: MediaItem[]
  try {
    media = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const item = media.find(m => m.id === id)
  if (!item) {
    return res.status(404).json({ error: `Kein Medium mit id ${id} gefunden` })
  }

  // Optional: Track suchen, falls trackAppleSongId mitgegeben wurde
  let track: MediaTrack | undefined
  if (trackAppleSongId) {
    if (!item.tracks || item.tracks.length === 0) {
      return res.status(404).json({
        error: `Medium ${id} hat keine Tracks, trackAppleSongId kann nicht verwendet werden`,
      })
    }

    track = item.tracks.find(t => t.appleSongId === trackAppleSongId)

    if (!track) {
      return res.status(404).json({
        error: `Kein Track mit appleSongId ${trackAppleSongId} in Medium ${id} gefunden`,
      })
    }
  }

  let url: string
  try {
    url = buildSonosUrl(item, room, track)
  } catch (err) {
    console.error('Fehler beim Ermitteln der Sonos-URL:', err)
    return res.status(500).json({
      error: 'Kein gültiger Abspielpfad für dieses Medium konfiguriert',
    })
  }

  try {
    console.log('Rufe Sonos-HTTP-API auf mit:', url)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Sonos API returned ${response.status}`)
    }

    res.json({
      status: 'ok',
      message: `Playback gestartet`,
      id,
      room,
      ...(track ? { track: track.title } : {}),
    })
  } catch (err) {
    console.error('Fehler beim Aufruf der Sonos-HTTP-API:', err)
    res
      .status(502)
      .json({ error: 'Sonos-Backend nicht erreichbar oder Fehler beim Abspielen' })
  }
})

app.get('/search/apple', async (req: Request, res: Response) => {
  const term = (req.query.q as string) || ''
  const entity = (req.query.entity as string) || 'album' // 'song' | 'album'
  const offset = parseInt((req.query.offset as string) || '0', 10)

  if (!term.trim()) {
    return res.status(400).json({ error: 'Parameter q (Suchbegriff) ist erforderlich' })
  }

  const params = new URLSearchParams({
    term,
    media: 'music',
    entity,
    limit: '100',
    offset: offset.toString(),
    country: 'ch',
  })

  const url = `https://itunes.apple.com/search?${params.toString()}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`iTunes API returned ${response.status}`)
    }

    const data = await response.json()

    const results = (data.results || []).map((item: any) => {
      const isSong = item.kind === 'song' || item.wrapperType === 'track'

      return {
        service: 'appleMusic' as const,
        kind: isSong ? 'song' : 'album',
        title:
          item.trackName ||
          item.collectionName ||
          item.collectionCensoredName ||
          'Unbekannter Titel',
        artist: item.artistName,
        album: item.collectionName,
        coverUrl: item.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
        appleAlbumId: item.collectionId ? String(item.collectionId) : undefined,
        appleSongId: item.trackId ? String(item.trackId) : undefined,
      }
    })

    res.json(results)
  } catch (err) {
    console.error('Fehler bei Apple-Suche:', err)
    res.status(502).json({ error: 'Fehler bei der Suche in Apple / iTunes' })
  }
})


app.post('/media/apple/album', async (req: Request, res: Response) => {
  const { id, appleAlbumId, title, artist, album, coverUrl } = req.body as {
    id?: string
    appleAlbumId?: string
    title?: string
    artist?: string
    album?: string
    coverUrl?: string
  }

  if (!id || !appleAlbumId || !title) {
    return res.status(400).json({ error: 'id, appleAlbumId und title sind erforderlich' })
  }

  let items = loadMedia()

  // Falls ein Album mit derselben appleAlbumId oder id bereits existiert,
  // ergänzen wir fehlende Tracks statt einen Fehler zu werfen.
  const existingByApple = items.find(i => i.appleId === appleAlbumId)
  const existingById = items.find(i => i.id === id)
  const existingAlbum = existingById || existingByApple || null

  // Album-Tracks von Apple holen
  const params = new URLSearchParams({
    id: appleAlbumId,
    entity: 'song',
  })
  const url = `https://itunes.apple.com/lookup?${params.toString()}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`iTunes lookup returned ${response.status}`)
    }
    const data = await response.json()

    console.log(`iTunes API returned ${data.resultCount} results for album ${appleAlbumId}`)

    const tracks: MediaTrack[] = (data.results || [])
      .filter((r: any) => r.wrapperType === 'track' || r.kind === 'song')
      .map((r: any) => ({
        id: `${id}_track_${r.trackId}`,
        title: r.trackName,
        appleSongId: String(r.trackId),
        trackNumber: r.trackNumber,
        durationMs: r.trackTimeMillis,
      }))

    if (tracks.length === 0) {
      console.warn(`⚠️  Keine Tracks gefunden für Album ${appleAlbumId} (${title}). Möglicherweise regional eingeschränkt.`)
    } else {
      console.log(`✓ ${tracks.length} Tracks gefunden für Album ${title}`)
    }

    if (existingAlbum) {
      // Merge: füge fehlende Tracks (nach appleSongId) hinzu
      existingAlbum.tracks = existingAlbum.tracks || []

      const existingAppleIds = new Set(
        existingAlbum.tracks.map(t => String(t.appleSongId)),
      )

      const toAdd = tracks.filter(t => !existingAppleIds.has(String(t.appleSongId)))

      // Erzeuge eindeutige IDs basierend auf dem bestehenden Album id
      const newTracks = toAdd.map(t => ({
        ...t,
        id: `${existingAlbum.id}_track_${t.appleSongId}`,
      }))

      existingAlbum.tracks.push(...newTracks)

      // Aktualisiere Metadaten falls übergeben
      if (title) existingAlbum.title = title
      if (artist) existingAlbum.artist = artist
      if (album) existingAlbum.album = album
      if (coverUrl) existingAlbum.coverUrl = coverUrl
      existingAlbum.appleId = appleAlbumId

      saveMedia(items)
      return res.status(200).json({ ...existingAlbum, trackCount: tracks.length })
    }

    const newAlbum: MediaItem = {
      id,
      title,
      kind: 'album',
      service: 'appleMusic',
      ...(artist ? { artist } : {}),
      album: album || title,
      coverUrl: coverUrl || '',
      appleId: appleAlbumId,
      tracks,
    }

    items.push(newAlbum)
    saveMedia(items)

    res.status(201).json({ ...newAlbum, trackCount: tracks.length })
  } catch (err) {
    console.error('Fehler beim Album-Lookup:', err)
    res.status(502).json({ error: 'Album-Tracks konnten nicht geladen werden' })
  }
})

// POST /media/apple/song
// Body: { id, appleSongId, appleAlbumId, albumTitle, artist, coverUrl, trackTitle }

app.post('/media/apple/song', (req: Request, res: Response) => {
  const {
    id,
    appleSongId,
    appleAlbumId,
    albumTitle,
    artist,
    coverUrl,
    trackTitle,
  } = req.body as {
    id?: string
    appleSongId?: string
    appleAlbumId?: string
    albumTitle?: string
    artist?: string
    coverUrl?: string
    trackTitle?: string
  }

  if (!id || !appleSongId || !appleAlbumId || !trackTitle) {
    return res.status(400).json({
      error: 'id, appleSongId, appleAlbumId und trackTitle sind erforderlich',
    })
  }

  let items = loadMedia()

  // Album suchen oder anlegen
  let albumItem = items.find(i => i.appleId === appleAlbumId)

  if (!albumItem) {
    albumItem = {
      id: `album_${appleAlbumId}`,
      title: albumTitle || 'Unbekanntes Album',
      kind: 'album',
      service: 'appleMusic',
      coverUrl: coverUrl || '',
      appleId: appleAlbumId,
      tracks: [],
      ...(artist ? { artist } : {}),
      ...(albumTitle ? { album: albumTitle } : {}),
    }
    items.push(albumItem)
  }

  albumItem.tracks = albumItem.tracks || []

  if (albumItem.tracks.some(t => t.appleSongId === appleSongId)) {
    return res.status(409).json({ error: 'Song existiert im Album bereits' })
  }

  const newTrack: MediaTrack = {
    id,
    title: trackTitle,
    appleSongId,
  }

  albumItem.tracks.push(newTrack)
  saveMedia(items)

  res.status(201).json({ album: albumItem.id, track: newTrack })
})


// Serve static frontend files in production (MUSS AM ENDE kommen!)
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist')
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath))
  
  // SPA fallback - serve index.html for all non-API routes
  app.use((req: Request, res: Response, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/media') && !req.path.startsWith('/admin') && !req.path.startsWith('/sonos') && !req.path.startsWith('/search') && !req.path.startsWith('/play')) {
      res.sendFile(path.join(frontendPath, 'index.html'))
    } else {
      next()
    }
  })
}

app.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT}`)
})