import { Router } from 'express'
import type { Request, Response } from 'express'
import type { MediaItem, MediaTrack } from '../types'
import { loadMedia, saveMedia } from '../services/media'
import { fetchAlbumTracks, searchArtist } from '../services/apple-music'

const router = Router()

// GET /media
router.get('/', (req: Request, res: Response) => {
  const media = loadMedia()
  res.json(media)
})

// POST /media
router.post('/', (req: Request, res: Response) => {
  const payload = req.body as Partial<MediaItem>

  const needsSonosUri = !(payload.service === 'appleMusic' && !!payload.appleId)

  if (!payload.id || !payload.title || !payload.service || (needsSonosUri && !payload.sonosUri)) {
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

  if (items.some((i) => i.id === payload.id)) {
    return res.status(409).json({ error: `Eintrag mit id ${payload.id} existiert bereits` })
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

// PUT /media/:id
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const updates = req.body as Partial<MediaItem>

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const index = items.findIndex((i) => i.id === id)
  if (index === -1) {
    return res.status(404).json({ error: `Kein Eintrag mit id ${id} gefunden` })
  }

  const item = items[index]!

  if (updates.title !== undefined) item.title = updates.title
  if (updates.artist !== undefined) item.artist = updates.artist
  if (updates.album !== undefined) item.album = updates.album
  if (updates.coverUrl !== undefined) item.coverUrl = updates.coverUrl
  if (updates.kind !== undefined) item.kind = updates.kind as MediaItem['kind']
  if (updates.artistImageUrl !== undefined) item.artistImageUrl = updates.artistImageUrl || undefined

  try {
    saveMedia(items)
  } catch (err) {
    console.error('Fehler beim Schreiben von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be saved' })
  }

  res.json(item)
})

// DELETE /media/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const index = items.findIndex((i) => i.id === id)
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

// DELETE /media/:albumId/tracks/:trackId
router.delete('/:albumId/tracks/:trackId', (req: Request, res: Response) => {
  const { albumId, trackId } = req.params

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const item = items.find((i) => i.id === albumId)
  if (!item) {
    return res.status(404).json({ error: `Kein Album mit id ${albumId} gefunden` })
  }

  if (!item.tracks || item.tracks.length === 0) {
    return res.status(404).json({ error: `Album ${albumId} hat keine Tracks` })
  }

  const trackIndex = item.tracks.findIndex((t) => t.id === trackId)
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

// PATCH /media/bulk
router.patch('/bulk', (req: Request, res: Response) => {
  const { ids, updates } = req.body as {
    ids?: string[]
    updates?: Partial<MediaItem>
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array ist erforderlich' })
  }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates object ist erforderlich' })
  }

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  let updatedCount = 0

  items = items.map((item) => {
    if (ids.includes(item.id)) {
      updatedCount++
      return {
        ...item,
        ...updates,
        id: item.id,
        ...(item.tracks ? { tracks: item.tracks } : {}),
      }
    }
    return item
  })

  if (updatedCount === 0) {
    return res.status(404).json({ error: 'Keine Items mit den angegebenen IDs gefunden' })
  }

  try {
    saveMedia(items)
  } catch (err) {
    console.error('Fehler beim Schreiben von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be saved' })
  }

  res.json({ status: 'ok', updatedCount })
})

// PUT /media/:albumId/tracks/:trackId
router.put('/:albumId/tracks/:trackId', (req: Request, res: Response) => {
  const { albumId, trackId } = req.params
  const updates = req.body as Partial<MediaTrack>

  let items: MediaItem[]
  try {
    items = loadMedia()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return res.status(500).json({ error: 'Media file could not be loaded' })
  }

  const item = items.find((i) => i.id === albumId)
  if (!item) {
    return res.status(404).json({ error: `Kein Album mit id ${albumId} gefunden` })
  }

  if (!item.tracks || item.tracks.length === 0) {
    return res.status(404).json({ error: `Album ${albumId} hat keine Tracks` })
  }

  const track = item.tracks.find((t) => t.id === trackId)
  if (!track) {
    return res.status(404).json({ error: `Kein Track mit id ${trackId} gefunden` })
  }

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

// Returns the artistImageUrl for the given artist: reuses an existing image from the
// media library if one exists, otherwise queries Apple Music for a profile photo.
async function resolveArtistImage(artist: string, items: MediaItem[]): Promise<string | undefined> {
  const existing = items.find(
    (i) => i.artist?.toLowerCase() === artist.toLowerCase() && i.artistImageUrl,
  )
  if (existing?.artistImageUrl) return existing.artistImageUrl

  try {
    const results = await searchArtist(artist)
    // Only auto-apply when there is exactly one unambiguous match.
    // When multiple candidates exist the caller returns nothing and
    // the frontend shows a selection dialog instead.
    if (results.length === 1) return results[0].artistImageUrl
    return undefined
  } catch {
    return undefined
  }
}

// POST /media/apple/album
router.post('/apple/album', async (req: Request, res: Response) => {
  const { id, appleAlbumId, title, artist, album, coverUrl, kind } = req.body as {
    id?: string
    appleAlbumId?: string
    title?: string
    artist?: string
    album?: string
    coverUrl?: string
    kind?: 'album' | 'audiobook'
  }

  if (!id || !appleAlbumId || !title) {
    return res.status(400).json({ error: 'id, appleAlbumId und title sind erforderlich' })
  }

  const items = loadMedia()

  const existingByApple = items.find((i) => i.appleId === appleAlbumId)
  const existingById = items.find((i) => i.id === id)
  const existingAlbum = existingById || existingByApple || null

  try {
    const tracks = await fetchAlbumTracks(appleAlbumId, id)

    if (tracks.length === 0) {
      console.warn(
        `⚠️  Keine Tracks gefunden für Album ${appleAlbumId} (${title}). Möglicherweise regional eingeschränkt.`,
      )
    } else {
      console.log(`✓ ${tracks.length} Tracks gefunden für Album ${title}`)
    }

    if (existingAlbum) {
      existingAlbum.tracks = existingAlbum.tracks || []

      const existingAppleIds = new Set(existingAlbum.tracks.map((t) => String(t.appleSongId)))
      const toAdd = tracks.filter((t) => !existingAppleIds.has(String(t.appleSongId)))

      const newTracks = toAdd.map((t) => ({
        ...t,
        id: `${existingAlbum.id}_track_${t.appleSongId}`,
      }))

      existingAlbum.tracks.push(...newTracks)

      if (title) existingAlbum.title = title
      if (artist) existingAlbum.artist = artist
      if (album) existingAlbum.album = album
      if (coverUrl) existingAlbum.coverUrl = coverUrl
      if (kind) existingAlbum.kind = kind
      existingAlbum.appleId = appleAlbumId

      if (artist && !existingAlbum.artistImageUrl) {
        existingAlbum.artistImageUrl = await resolveArtistImage(artist, items)
      }

      saveMedia(items)
      return res.status(200).json({ ...existingAlbum, trackCount: tracks.length })
    }

    const newAlbum: MediaItem = {
      id,
      title,
      kind: kind || 'album',
      service: 'appleMusic',
      ...(artist ? { artist } : {}),
      album: album || title,
      coverUrl: coverUrl || '',
      appleId: appleAlbumId,
      tracks,
    }

    if (artist) {
      newAlbum.artistImageUrl = await resolveArtistImage(artist, items)
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
router.post('/apple/song', (req: Request, res: Response) => {
  const { id, appleSongId, appleAlbumId, albumTitle, artist, coverUrl, trackTitle } = req.body as {
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

  const items = loadMedia()

  let albumItem = items.find((i) => i.appleId === appleAlbumId)

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

  if (albumItem.tracks.some((t) => t.appleSongId === appleSongId)) {
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

export default router
