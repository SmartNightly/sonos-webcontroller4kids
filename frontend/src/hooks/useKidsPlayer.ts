import { useEffect, useRef, useState } from 'react'
import { requestJson } from '../api'
import type { SonosStatus } from './useSonosPolling'
import type { MediaItem, MediaTrack } from '../types'
import { demoMedia } from '../data/demoMedia'

interface Config {
  rooms?: string[]
  enabledRooms?: string[]
  defaultRoom?: string
  roomIcons?: Record<string, string>
  maxVolume?: Record<string, number>
  showShuffleRepeat?: boolean
  showTracklistAlbums?: boolean
  showTracklistAudiobooks?: boolean
}

const demoConfig: Config = {
  rooms: ['Kinderzimmer', 'Spielzimmer'],
  defaultRoom: 'Kinderzimmer',
  roomIcons: { Kinderzimmer: '🛏️', Spielzimmer: '🧸' },
  maxVolume: { Kinderzimmer: 30, Spielzimmer: 30 },
  showShuffleRepeat: false,
}

export function usePlayer(demo: boolean) {
  const [media, setMedia] = useState<MediaItem[]>(demo ? demoMedia : [])
  const [config, setConfig] = useState<Config>(demo ? demoConfig : {})
  const [room, setRoom] = useState<string | null>(demo ? 'Kinderzimmer' : null)
  const [status, setStatus] = useState<SonosStatus>(
    demo ? { available: true, state: 'stopped', volume: 15 } : {},
  )
  const [loading, setLoading] = useState(!demo)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [trackMode, setTrackMode] = useState<{ album: MediaItem; index: number } | null>(null)
  const [lastAlbum, setLastAlbum] = useState<MediaItem | null>(null)
  const lock = useRef(false)
  const revision = useRef(0)
  const rooms = config.enabledRooms ?? config.rooms ?? []

  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    let disposed = false
    Promise.all([
      requestJson<MediaItem[]>('/media', { signal: controller.signal }),
      requestJson<Config>('/admin/sonos', { signal: controller.signal }),
    ])
      .then(([items, settings]) => {
        if (disposed) return
        setMedia(items)
        setConfig(settings)
        const enabled = settings.enabledRooms ?? settings.rooms ?? []
        setRoom(
          settings.defaultRoom && enabled.includes(settings.defaultRoom)
            ? settings.defaultRoom
            : (enabled[0] ?? null),
        )
        setLoadError(false)
      })
      .catch(() => {
        if (!disposed) setLoadError(true)
      })
      .finally(() => {
        clearTimeout(timeout)
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
      clearTimeout(timeout)
      controller.abort()
    }
  }, [demo, reload])

  useEffect(() => {
    if (demo || !room) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController
    const poll = async () => {
      controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const version = revision.current
      try {
        const next = await requestJson<SonosStatus>(
          `/sonos/status?room=${encodeURIComponent(room)}`,
          { signal: controller.signal },
        )
        if (!disposed && !lock.current && version === revision.current) setStatus(next)
      } catch {
        if (!disposed && !lock.current && version === revision.current)
          setStatus({ available: false })
      } finally {
        clearTimeout(timeout)
        if (!disposed) timer = setTimeout(poll, 2000)
      }
    }
    void poll()
    return () => {
      disposed = true
      clearTimeout(timer)
      controller?.abort()
    }
  }, [room, demo])

  const run = async (operation: () => Promise<void>) => {
    if (lock.current || !room) return
    lock.current = true
    revision.current++
    setBusy(true)
    setError('')
    try {
      await operation()
    } catch {
      setError(
        'Das hat nicht geklappt. Prüfe die Verbindung zum Lautsprecher und versuche es noch einmal.',
      )
    } finally {
      revision.current++
      lock.current = false
      setBusy(false)
    }
  }
  const post = (path: string, body: object) =>
    requestJson(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
  const play = (album: MediaItem, track?: MediaTrack) =>
    run(async () => {
      if (!demo) {
        await post('/sonos/control', { room, action: 'clearqueue' })
        await post('/play', {
          id: album.id,
          room,
          ...(track ? { trackAppleSongId: track.appleSongId } : {}),
        })
      }
      setLastAlbum(album)
      setTrackMode(
        track ? { album, index: album.tracks!.findIndex((t) => t.id === track.id) } : null,
      )
      setStatus((s) => ({
        ...s,
        available: true,
        state: 'playing',
        track: { title: track?.title ?? album.title, artist: album.artist, album: album.title },
      }))
    })
  const control = (action: string) =>
    run(async () => {
      if (!demo) await post('/sonos/control', { room, action })
      setStatus((s) => ({
        ...s,
        ...(action === 'play' || action === 'pause'
          ? { state: action === 'play' ? 'playing' : 'paused' }
          : {}),
        ...(action.startsWith('shuffle') ? { shuffle: action === 'shuffleOn' } : {}),
        ...(action.startsWith('repeat')
          ? { repeat: action === 'repeatOff' ? 'off' : action === 'repeatOne' ? 'one' : 'all' }
          : {}),
        ...(demo && action.startsWith('volume')
          ? {
              volume: Math.max(
                0,
                Math.min(
                  config.maxVolume?.[room!] ?? 100,
                  (s.volume ?? 0) + (action === 'volumeUp' ? 5 : -5),
                ),
              ),
            }
          : {}),
      }))
    })
  const skip = (direction: -1 | 1) => {
    if (trackMode) {
      const index = Math.max(0, trackMode.index + direction)
      const track = trackMode.album.tracks?.[index]
      if (track) void play(trackMode.album, track)
    } else void control(direction === 1 ? 'next' : 'previous')
  }
  const selectRoom = (value: string) => {
    if (lock.current || !rooms.includes(value)) return
    revision.current++
    setRoom(value)
    setStatus(demo ? { available: true, state: 'stopped', volume: 15 } : {})
    setTrackMode(null)
    setLastAlbum(null)
    setError('')
  }
  return {
    media,
    config,
    room,
    rooms,
    status,
    loading,
    loadError,
    error,
    busy,
    lastAlbum,
    play,
    control,
    skip,
    selectRoom,
    clearError: () => setError(''),
    retry: () => {
      setLoading(true)
      setLoadError(false)
      setReload((n) => n + 1)
    },
    atLastTrack: !!trackMode && trackMode.index === (trackMode.album.tracks?.length ?? 0) - 1,
  }
}
