import { Router } from 'express'
import type { Request, Response } from 'express'
import type { MediaItem } from '../types'
import { loadConfig, DEFAULT_SONOS_BASE_URL } from '../services/config'
import { loadMedia } from '../services/media'
import { buildSonosUrl, fetchWithTimeout } from '../services/sonos'
import { searchApple } from '../services/apple-music'

const router = Router()

// POST /sonos/control
router.post('/sonos/control', async (req: Request, res: Response) => {
  const { room, action, value } = req.body as { room?: string; action?: string; value?: number }

  if (!room || !action) {
    return res.status(400).json({ error: 'room und action erforderlich' })
  }

  const config = loadConfig()
  const baseUrl = config.sonosBaseUrl || DEFAULT_SONOS_BASE_URL
  const maxVol = config.maxVolume?.[room] ?? 100

  let sonosPath = ''
  switch (action) {
    case 'play':
    case 'pause':
    case 'next':
    case 'previous':
      sonosPath = action === 'previous' ? 'previous' : action
      break
    case 'volumeUp':
      try {
        const stateRes = await fetch(`${config.sonosBaseUrl}/${encodeURIComponent(room)}/state`)
        const stateData = await stateRes.json()
        const currentVol = stateData.volume ?? 0
        const targetVol = currentVol + (value ?? 5)
        sonosPath = targetVol > maxVol ? `volume/${maxVol}` : `volume/+${value ?? 5}`
      } catch {
        sonosPath = `volume/+${value ?? 5}`
      }
      break
    case 'volumeDown':
      sonosPath = `volume/-${value ?? 5}`
      break
    case 'setVolume':
      if (typeof value !== 'number') {
        return res.status(400).json({ error: 'value erforderlich für setVolume' })
      }
      sonosPath = `volume/${Math.min(value, maxVol)}`
      break
    case 'mute':
      sonosPath = 'mute'
      break
    case 'unmute':
      sonosPath = 'unmute'
      break
    case 'toggleMute':
      sonosPath = 'toggleMute'
      break
    case 'shuffleOn':
      sonosPath = 'shuffle/on'
      break
    case 'shuffleOff':
      sonosPath = 'shuffle/off'
      break
    case 'repeatOff':
      sonosPath = 'repeat/off'
      break
    case 'repeatOne':
      sonosPath = 'repeat/one'
      break
    case 'repeatAll':
      sonosPath = 'repeat/all'
      break
    case 'clearqueue':
      sonosPath = 'clearqueue'
      break
    default:
      return res.status(400).json({ error: `Unbekannte action ${action}` })
  }

  const url = `${baseUrl}/${encodeURIComponent(room)}/${sonosPath}`

  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 3000)
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

// GET /sonos/status
router.get('/sonos/status', async (req: Request, res: Response) => {
  const room = String(req.query.room || '')

  if (!room) {
    return res.status(400).json({ error: 'Query-Parameter room ist erforderlich' })
  }

  const config = loadConfig()
  const baseUrl = config.sonosBaseUrl || DEFAULT_SONOS_BASE_URL
  const encoded = encodeURIComponent(room)

  const tried: any[] = []
  const result: any = { room, available: false }

  // 1) State (playing/paused)
  const stateUrl = `${baseUrl}/${encoded}/state`
  const stateRes = await fetchWithTimeout(stateUrl)
  tried.push(stateRes)

  if (stateRes.ok) {
    result.available = true
    const payload = 'json' in stateRes ? stateRes.json : stateRes.text

    if (typeof payload === 'string') {
      const p = payload.toLowerCase()
      if (p.includes('play')) result.state = 'playing'
      else if (p.includes('pause') || p.includes('paused')) result.state = 'paused'
      else result.state = payload
    } else if (payload && typeof payload === 'object') {
      const pb = (payload as any).playbackState || (payload as any).state || (payload as any).transportState
      if (pb) result.state = typeof pb === 'string' ? pb.toLowerCase() : pb

      if ((payload as any).volume !== undefined) result.volume = Number((payload as any).volume)
      if ((payload as any).mute !== undefined) result.muted = Boolean((payload as any).mute)
      if ((payload as any).equalizer) result.equalizer = (payload as any).equalizer

      const ct = (payload as any).currentTrack || (payload as any).current || (payload as any).track || null
      if (ct && typeof ct === 'object') {
        const track: any = {}
        track.title = ct.title || ct.name || ct.track || ct.currentTitle
        track.artist = ct.artist || ct.creator
        track.album = ct.album
        track.uri = ct.uri || ct.trackUri || ct.resource
        if (ct.duration !== undefined) {
          const d = Number(ct.duration)
          if (!Number.isNaN(d)) track.durationMs = d > 10000 ? d : d * 1000
        } else if (ct.durationMs !== undefined) {
          track.durationMs = Number(ct.durationMs)
        } else if (ct.trackTimeMillis !== undefined) {
          track.durationMs = Number(ct.trackTimeMillis)
        }
        if (ct.absoluteAlbumArtUri) track.albumArt = ct.absoluteAlbumArtUri
        else if (ct.albumArtUri) track.albumArt = ct.albumArtUri
        result.track = { ...(result.track || {}), ...track }
      }

      const nt = (payload as any).nextTrack
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

      if ((payload as any).elapsedTime !== undefined) {
        const e = Number((payload as any).elapsedTime)
        if (!Number.isNaN(e)) result.track = { ...(result.track || {}), positionMs: e > 10000 ? e : e * 1000 }
      } else if ((payload as any).elapsedTimeMs !== undefined) {
        result.track = { ...(result.track || {}), positionMs: Number((payload as any).elapsedTimeMs) }
      }

      if ((payload as any).trackNo !== undefined) result.trackNo = Number((payload as any).trackNo)

      if ((payload as any).playMode) {
        result.playMode = (payload as any).playMode
        if ((payload as any).playMode.repeat !== undefined) result.repeat = (payload as any).playMode.repeat
        if ((payload as any).playMode.shuffle !== undefined) result.shuffle = Boolean((payload as any).playMode.shuffle)
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
    const r = await fetchWithTimeout(u)
    tried.push(r)
    if (!r.ok) continue
    const payload = 'json' in r ? r.json : r.text
    const track: any = result.track || {}

    if (typeof payload === 'string') {
      if (!track.title) track.title = payload
    } else if (payload && typeof payload === 'object') {
      const p = payload as any
      if (!track.title) track.title = p.title || p.name || p.track || p.currentTitle
      if (!track.artist) track.artist = p.artist || p.creator || p.trackArtist
      if (!track.album) track.album = p.album || p.collection
      if (!track.uri) track.uri = p.resource || p.uri || p.trackUri
      if (!track.durationMs) {
        const dur = p.duration || p.durationMs || p.trackTimeMillis || p.length
        if (typeof dur === 'number') track.durationMs = dur
        else if (typeof dur === 'string' && !Number.isNaN(Number(dur))) track.durationMs = Number(dur)
      }
      if (!track.positionMs) {
        const pos = p.position || p.positionMs || p.elapsed
        if (typeof pos === 'number') track.positionMs = pos
        else if (typeof pos === 'string' && !Number.isNaN(Number(pos))) track.positionMs = Number(pos)
      }
    }

    result.track = track
    if (result.track && (result.track.title || result.track.uri)) break
  }

  result._tried = tried.map((t: any) => ({
    url: t.url,
    ok: !!t.ok,
    summary: 'json' in t ? '[json]' : typeof t.text === 'string' ? t.text : t.error,
  }))

  res.json(result)
})

// POST /play
router.post('/play', async (req: Request, res: Response) => {
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

  let track = undefined
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
      await response.json().catch(() => ({}))

      if (
        response.status === 500 &&
        !track &&
        item.service === 'appleMusic' &&
        item.tracks &&
        item.tracks.length > 0
      ) {
        console.log('Album-Abspielen fehlgeschlagen, versuche ersten Track als Fallback...')
        const firstTrack = item.tracks[0]
        if (firstTrack) {
          const fallbackUrl = buildSonosUrl(item, room, firstTrack)
          console.log('Rufe Sonos-HTTP-API mit erstem Track auf:', fallbackUrl)
          const fallbackResponse = await fetch(fallbackUrl)

          if (!fallbackResponse.ok) {
            throw new Error(`Sonos API returned ${fallbackResponse.status} (auch mit Track-Fallback)`)
          }

          return res.json({
            status: 'ok',
            message: 'Playback gestartet (erster Track)',
            id,
            room,
            track: firstTrack.title,
            fallback: true,
          })
        }
      }

      throw new Error(`Sonos API returned ${response.status}`)
    }

    res.json({
      status: 'ok',
      message: 'Playback gestartet',
      id,
      room,
      ...(track ? { track: track.title } : {}),
    })
  } catch (err: any) {
    console.error('Fehler beim Aufruf der Sonos-HTTP-API:', url)
    console.error('  message:', err?.message)
    console.error('  cause:  ', err?.cause)
    console.error('  stack:  ', err?.stack)
    res.status(502).json({ error: 'Sonos-Backend nicht erreichbar oder Fehler beim Abspielen' })
  }
})

// GET /search/apple
router.get('/search/apple', async (req: Request, res: Response) => {
  const term = (req.query.q as string) || ''
  const entity = (req.query.entity as string) || 'album'
  const offset = parseInt((req.query.offset as string) || '0', 10)

  if (!term.trim()) {
    return res.status(400).json({ error: 'Parameter q (Suchbegriff) ist erforderlich' })
  }

  try {
    const results = await searchApple(term, entity, offset)
    res.json(results)
  } catch (err) {
    console.error('Fehler bei Apple-Suche:', err)
    res.status(502).json({ error: 'Fehler bei der Suche in Apple / iTunes' })
  }
})

export default router
