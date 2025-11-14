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
    }
  } catch {
    return {
      sonosBaseUrl: DEFAULT_SONOS_BASE_URL,
      rooms: [],
      enabledRooms: [],
      defaultRoom: undefined,
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

  // 2) Apple Music – komplettes Album
  if (item.service === 'appleMusic' && item.appleId && item.kind === 'album') {
    const url = `${baseUrl}/${encodeURIComponent(room)}/applemusic/now/album:${item.appleId}`
    console.log('Spiele Album-URL:', url)
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




app.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT}`)
})

app.get('/search/apple', async (req: Request, res: Response) => {
  const term = (req.query.q as string) || ''
  const entity = (req.query.entity as string) || 'album' // 'song' | 'album'

  if (!term.trim()) {
    return res.status(400).json({ error: 'Parameter q (Suchbegriff) ist erforderlich' })
  }

  const params = new URLSearchParams({
    term,
    media: 'music',
    entity,
    limit: '25',
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

  if (items.some(i => i.id === id || i.appleId === appleAlbumId)) {
    return res.status(409).json({ error: 'Album existiert bereits' })
  }

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

    const tracks: MediaTrack[] = (data.results || [])
      .filter((r: any) => r.wrapperType === 'track' || r.kind === 'song')
      .map((r: any) => ({
        id: `${id}_track_${r.trackId}`,
        title: r.trackName,
        appleSongId: String(r.trackId),
        trackNumber: r.trackNumber,
        durationMs: r.trackTimeMillis,
      }))

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

    res.status(201).json(newAlbum)
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

