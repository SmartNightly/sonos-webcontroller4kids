import { useEffect, useState } from 'react'
import type { MediaItem, MediaTrack, AppleSearchResult } from './types'
import { MediaEditor } from './MediaEditor'

function App() {
  const params = new URLSearchParams(window.location.search)
  const isAdmin = params.get('admin') === '1'

  return isAdmin ? <AdminView /> : <KidsView />
}

/* ==================== Kids-Ansicht ==================== */

function KidsView() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // UI state for album player/detail view
  const [showTracks, setShowTracks] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off')
  const [volume, setVolume] = useState<number | null>(null)
  const [currentTrack, setCurrentTrack] = useState<{
    title?: string
    artist?: string
    album?: string
    positionMs?: number
    durationMs?: number
  } | null>(null)

  const [selectedAlbum, setSelectedAlbum] = useState<MediaItem | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)

  // 🔊 Sonos-Raum-Auswahl
  const [rooms, setRooms] = useState<string[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [roomPickerOpen, setRoomPickerOpen] = useState(false)
  const [roomError, setRoomError] = useState<string | null>(null)

  // Status-Polling: synchronisiere Sonos-Status alle 2 Sekunden
  useEffect(() => {
    if (!selectedRoom) return

    const pollInterval = 2000 // 2s
    let timer: number | undefined

    const fetchStatus = async () => {
      try {
        const encoded = encodeURIComponent(selectedRoom)
        const res = await fetch(`http://localhost:3001/sonos/status?room=${encoded}`)
        if (!res.ok) return
        const data = await res.json()

        // Sync playback state
        if (data.state) {
          const s = String(data.state).toLowerCase()
          setPlaying(s === 'playing')
        }

        // Sync volume, mute, shuffle, repeat
        if (data.volume !== undefined) setVolume(data.volume)
        if (data.muted !== undefined) setMuted(data.muted)
        if (data.shuffle !== undefined) setShuffle(data.shuffle)
        if (data.repeat !== undefined) {
          const r = String(data.repeat).toLowerCase()
          setRepeatMode(r === 'all' ? 'all' : r === 'one' ? 'one' : 'off')
        }

        // Sync current track
        if (data.track) {
          setCurrentTrack({
            title: data.track.title,
            artist: data.track.artist,
            album: data.track.album,
            positionMs: data.track.positionMs,
            durationMs: data.track.durationMs,
          })
        } else {
          setCurrentTrack(null)
        }
      } catch (err) {
        console.error('Status-Polling-Fehler:', err)
      }
    }

    // Initial fetch
    fetchStatus()
    // Poll every 2s
    timer = window.setInterval(fetchStatus, pollInterval)

    return () => {
      if (timer !== undefined) clearInterval(timer)
    }
  }, [selectedRoom])

  // Medien laden
useEffect(() => {
  const CACHE_KEY = 'kidsMediaCache'
  const CACHE_TTL_MS = 5 * 60 * 1000 // 5 Minuten – kannst du anpassen

  type MediaCache = {
    updatedAt: number
    items: MediaItem[]
  }

  const loadFromCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return false

      const parsed = JSON.parse(raw) as MediaCache
      // Optional: TTL prüfen
      const age = Date.now() - parsed.updatedAt
      if (age > CACHE_TTL_MS) {
        // Cache zu alt → ignorieren
        return false
      }

      setMedia(parsed.items)
      setLoading(false) // UI sofort befüllen
      return true
    } catch (err) {
      console.warn('Konnte Media-Cache nicht lesen:', err)
      return false
    }
  }

  const fetchFromBackend = async () => {
    try {
      // Nur Loader anzeigen, wenn wir keinen gültigen Cache hatten
      setLoading(prev => prev && true)

      const res = await fetch('http://localhost:3001/media')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as MediaItem[]
      setMedia(data)

      const cache: MediaCache = {
        updatedAt: Date.now(),
        items: data,
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch (err) {
      console.error('Konnte Medien nicht laden:', err)
      // Wenn gar keine Daten vorhanden sind, Loader beenden
    } finally {
      setLoading(false)
    }
  }

  loadFromCache()
  // Egal ob Cache da war oder nicht → im Hintergrund aktualisieren
  fetchFromBackend()
}, [])



  // Sonos-Config (Räume) laden
useEffect(() => {
  const loadSonosConfig = async () => {
    try {
      const res = await fetch('http://localhost:3001/admin/sonos')
      if (!res.ok) return

      const data = (await res.json()) as SonosConfig

      const enabled = data.enabledRooms && data.enabledRooms.length > 0
        ? data.enabledRooms
        : data.rooms || []

      setRooms(enabled)

      let initialRoom: string | null = null

      if (data.defaultRoom && enabled.includes(data.defaultRoom)) {
        initialRoom = data.defaultRoom
      } else if (enabled.length > 0) {
        initialRoom = enabled[0]
      }

      setSelectedRoom(initialRoom)
    } catch (err) {
      console.error('Konnte Sonos-Konfiguration nicht laden:', err)
    }
  }

  loadSonosConfig()
}, [])

  const ensureRoomSelected = (): string | null => {
    if (!selectedRoom) {
      setRoomError('Bitte zuerst einen Raum wählen')
      setTimeout(() => setRoomError(null), 2000)
      return null
    }
    return selectedRoom
  }

  const playAlbum = async (item: MediaItem) => {
    const room = ensureRoomSelected()
    if (!room) return

    try {
      setBusy(true)
      setError(null)

      const res = await fetch('http://localhost:3001/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: item.id,
          room,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
    } catch (err) {
      console.error(err)
      setError('Konnte nicht abspielen 😕')
    } finally {
      setBusy(false)
    }
  }

  const playTrack = async (album: MediaItem, track: MediaTrack) => {
    const room = ensureRoomSelected()
    if (!room) return

    try {
      setBusy(true)
      setError(null)

      const res = await fetch('http://localhost:3001/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: album.id,
          room,
          trackAppleSongId: track.appleSongId,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
    } catch (err) {
      console.error(err)
      setError('Konnte Track nicht abspielen 😕')
    } finally {
      setBusy(false)
    }
  }

  const renderRoomSelector = () => (
    <div style={styles.roomBar}>
      <button
        style={styles.roomButton}
        onClick={() => rooms.length > 0 && setRoomPickerOpen(true)}
        disabled={rooms.length === 0}
      >
        {rooms.length === 0
          ? 'Kein Raum gefunden'
          : `Raum: ${selectedRoom ?? 'Bitte wählen'}`}
      </button>
      {roomError && (
        <div style={styles.roomError}>{roomError}</div>
      )}
    </div>
  )

  const renderRoomOverlay = () => {
    if (!roomPickerOpen) return null
    return (
      <div style={styles.roomOverlay} onClick={() => setRoomPickerOpen(false)}>
        <div
          style={styles.roomOverlayInner}
          onClick={e => e.stopPropagation()}
        >
          <div style={styles.roomOverlayTitle}>Raum wählen</div>
          <div style={styles.roomOverlayList}>
            {rooms.map(room => (
              <button
                key={room}
                style={styles.roomListButton}
                onClick={async () => {
                  setSelectedRoom(room)
                  setRoomPickerOpen(false)

                  try {
                    await fetch('http://localhost:3001/admin/sonos/default-room', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ defaultRoom: room }),
                    })
                  } catch (err) {
                    console.error('Konnte Default-Raum nicht speichern:', err)
                  }
                }}

              >
                {room}
              </button>
            ))}
          </div>
          <button
            style={styles.roomOverlayClose}
            onClick={() => setRoomPickerOpen(false)}
          >
            Schliessen
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <div style={styles.screen}>Lade Medien…</div>
  if (error) return <div style={styles.screen}>{error}</div>

  // Nur Alben für Artist-/Album-Ansicht
  const albums = media.filter(m => m.kind === 'album')

  // ============= Ebene 3: Album-Detail (Tracks) =============
  if (selectedAlbum) {
    const album = selectedAlbum
    const tracks = album.tracks || []

    return (
      <div style={styles.screen}>
        {renderRoomSelector()}
        {renderRoomOverlay()}

        {/* Current Track Info - Live from status polling */}
        {currentTrack && (
          <div style={styles.trackInfo}>
            <div style={styles.trackInfoTitle}>▶ {currentTrack.title || 'Unbekannt'}</div>
            {currentTrack.artist && (
              <div style={styles.trackInfoArtist}>{currentTrack.artist}</div>
            )}
            {currentTrack.positionMs !== undefined && currentTrack.durationMs !== undefined && (
              <div style={styles.trackInfoProgress}>
                {formatDuration(currentTrack.positionMs)} / {formatDuration(currentTrack.durationMs)}
              </div>
            )}
          </div>
        )}

        <h1 style={styles.titleSmall}>Album</h1>
        <button
          style={styles.backButton}
          onClick={() => setSelectedAlbum(null)}
        >
          ← Zurück
        </button>

        <div style={styles.albumHeader}>
          <img
            src={album.coverUrl}
            alt={album.title}
            style={styles.albumCover}
          />
          <div style={styles.albumMeta}>
            <div style={styles.albumTitle}>{album.title}</div>
            {album.artist && (
              <div style={styles.albumArtist}>{album.artist}</div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                style={styles.primaryButton}
                onClick={async () => {
                  await playAlbum(album)
                  setPlaying(true)
                }}
                disabled={busy}
              >
                {busy ? 'Bitte warten…' : 'Album abspielen'}
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => setShowTracks(s => !s)}
              >
                {showTracks ? 'Tracks verbergen' : 'Tracks anzeigen'}
              </button>
            </div>
          </div>
        </div>

        {/* Player Controls */}
        <div style={styles.playerControls}>
          <div style={styles.playerRow}>
            <button
              style={styles.controlButton}
              onClick={async () => {
                const room = ensureRoomSelected()
                if (!room) return
                await fetch('http://localhost:3001/sonos/control', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action: 'previous' }),
                })
              }}
            >◀◀</button>
            <button
              style={styles.controlButton}
              onClick={async () => {
                const room = ensureRoomSelected()
                if (!room) return
                if (playing) {
                  await fetch('http://localhost:3001/sonos/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, action: 'pause' }),
                  })
                  setPlaying(false)
                } else {
                  await fetch('http://localhost:3001/sonos/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, action: 'play' }),
                  })
                  setPlaying(true)
                }
              }}
            >{playing ? '❚❚' : '▶'}</button>
            <button
              style={styles.controlButton}
              onClick={async () => {
                const room = ensureRoomSelected()
                if (!room) return
                await fetch('http://localhost:3001/sonos/control', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action: 'next' }),
                })
              }}
            >▶▶</button>

            <div style={{ width: 12 }} />

            <button
              style={styles.controlButton}
              onClick={async () => {
                const room = ensureRoomSelected()
                if (!room) return
                await fetch('http://localhost:3001/sonos/control', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action: 'volumeDown', value: 5 }),
                })
              }}
            >−</button>
            <button
              style={styles.controlButton}
              onClick={async () => {
                const room = ensureRoomSelected()
                if (!room) return
                await fetch('http://localhost:3001/sonos/control', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action: 'volumeUp', value: 5 }),
                })
              }}
            >＋</button>

            <div style={{ width: 12 }} />

                        <button
              style={styles.controlButton}
              onClick={async () => {
                const room = ensureRoomSelected()
                if (!room) return
                if (muted) {
                  await fetch('http://localhost:3001/sonos/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, action: 'unmute' }),
                  })
                  setMuted(false)
                } else {
                  await fetch('http://localhost:3001/sonos/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, action: 'mute' }),
                  })
                  setMuted(true)
                }
              }}
            >{muted ? 'Unmute' : 'Mute'}</button>

            {volume !== null && (
              <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: 8 }}>
                Vol: {volume}
              </span>
            )}
          </div>

          <div style={styles.playerRow}>
            <button
              style={styles.controlButton}
              onClick={async () => {
                const room = ensureRoomSelected()
                if (!room) return
                if (shuffle) {
                  await fetch('http://localhost:3001/sonos/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, action: 'shuffleOff' }),
                  })
                  setShuffle(false)
                } else {
                  await fetch('http://localhost:3001/sonos/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, action: 'shuffleOn' }),
                  })
                  setShuffle(true)
                }
              }}
            >{shuffle ? 'Shuffle On' : 'Shuffle Off'}</button>

            <div style={{ width: 8 }} />

            <button
              style={styles.controlButton}
              onClick={async () => {
                const room = ensureRoomSelected()
                if (!room) return
                const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'
                const action = nextMode === 'off' ? 'repeatOff' : nextMode === 'all' ? 'repeatAll' : 'repeatOne'
                await fetch('http://localhost:3001/sonos/control', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action }),
                })
                setRepeatMode(nextMode)
              }}
            >Repeat: {repeatMode}</button>
          </div>
        </div>

        {/* Tracks list (collapsible) */}
        {showTracks && (
          <div style={styles.tracksList}>
            {tracks.map(t => (
              <button
                key={t.id}
                style={styles.trackRow}
                onClick={() => playTrack(album, t)}
                disabled={busy}
              >
                <div style={styles.trackNumber}>
                  {t.trackNumber ?? '•'}
                </div>
                <div style={styles.trackTitle}>{t.title}</div>
                <div style={styles.trackDuration}>
                  {t.durationMs ? formatDuration(t.durationMs) : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ============= Ebene 2: Album-Grid für einen Artist =============
  if (selectedArtist) {
    const artistAlbums = albums
      .filter(a => (a.artist || 'Unbekannt') === selectedArtist)
      .sort((a, b) => a.title.localeCompare(b.title))

    return (
      <div style={styles.screen}>
        {renderRoomSelector()}
        {renderRoomOverlay()}

        {/* Current Track Info - Live from status polling */}
        {currentTrack && (
          <div style={styles.trackInfo}>
            <div style={styles.trackInfoTitle}>▶ {currentTrack.title || 'Unbekannt'}</div>
            {currentTrack.artist && (
              <div style={styles.trackInfoArtist}>{currentTrack.artist}</div>
            )}
            {currentTrack.positionMs !== undefined && currentTrack.durationMs !== undefined && (
              <div style={styles.trackInfoProgress}>
                {formatDuration(currentTrack.positionMs)} / {formatDuration(currentTrack.durationMs)}
              </div>
            )}
          </div>
        )}

        <h1 style={styles.titleSmall}>Artist</h1>
        <button
          style={styles.backButton}
          onClick={() => setSelectedArtist(null)}
        >
          ← Zurück zu Artists
        </button>

        <div style={{ marginBottom: 4, fontSize: '0.9rem' }}>
          {selectedArtist}
        </div>

        {busy && <div style={styles.busy}>Bitte warten…</div>}

        <div style={styles.grid}>
          {artistAlbums.map(album => (
            <button
              key={album.id}
              style={styles.card}
              onClick={() => setSelectedAlbum(album)}
            >
              <img
                src={album.coverUrl}
                alt={album.title}
                style={styles.cover}
              />
              <div style={styles.cardTitle}>{album.title}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ============= Ebene 1: Artist-Liste (Standardansicht) =============
  const artistMap = new Map<string, MediaItem[]>()

  for (const album of albums) {
    const name = album.artist || 'Unbekannt'
    if (!artistMap.has(name)) {
      artistMap.set(name, [])
    }
    artistMap.get(name)!.push(album)
  }

  const artistCards = Array.from(artistMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([artistName, artistAlbums]) => {
      const firstAlbum = artistAlbums[0]
      return {
        artistName,
        coverUrl: firstAlbum.coverUrl,
      }
    })

  return (
    <div style={styles.screen}>
      {renderRoomSelector()}
      {renderRoomOverlay()}

      {/* Current Track Info - Live from status polling */}
      {currentTrack && (
        <div style={styles.trackInfo}>
          <div style={styles.trackInfoTitle}>▶ {currentTrack.title || 'Unbekannt'}</div>
          {currentTrack.artist && (
            <div style={styles.trackInfoArtist}>{currentTrack.artist}</div>
          )}
          {currentTrack.positionMs !== undefined && currentTrack.durationMs !== undefined && (
            <div style={styles.trackInfoProgress}>
              {formatDuration(currentTrack.positionMs)} / {formatDuration(currentTrack.durationMs)}
            </div>
          )}
        </div>
      )}

      <h1 style={styles.title}>Kids Player 🎧</h1>

      {busy && <div style={styles.busy}>Bitte warten…</div>}

      <div style={styles.grid}>
        {artistCards.map(artist => (
          <button
            key={artist.artistName}
            style={styles.card}
            onClick={() => setSelectedArtist(artist.artistName)}
          >
            <img
              src={artist.coverUrl}
              alt={artist.artistName}
              style={styles.cover}
            />
            <div style={styles.cardTitle}>{artist.artistName}</div>
          </button>
        ))}
      </div>
    </div>
  )
}



/* Helper für Track-Dauer */

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/* ==================== Admin-Ansicht (wie vorher, nur verkürzt angedeutet) ==================== */

interface SonosConfig {
  sonosBaseUrl: string
  rooms?: string[]
  enabledRooms?: string[]
  defaultRoom?: string
}

function AdminView() {
  const [tab, setTab] = useState<'search' | 'sonos' | 'editor'>('search')
  const [query, setQuery] = useState('')
  const [entity, setEntity] = useState<'album' | 'song'>('album')
  const [results, setResults] = useState<AppleSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)


  // Sonos-Konfiguration
  // Sonos-Konfiguration
  const [sonosBaseUrl, setSonosBaseUrl] = useState('')
  const [sonosRooms, setSonosRooms] = useState<string[]>([])          // alle
  const [enabledRooms, setEnabledRooms] = useState<string[]>([])      // rechts
  const [sonosLoading, setSonosLoading] = useState(false)
  const [sonosError, setSonosError] = useState<string | null>(null)


  useEffect(() => {
    const loadSonosConfig = async () => {
      try {
        const res = await fetch('http://localhost:3001/admin/sonos')
        if (!res.ok) return
        const data = (await res.json()) as SonosConfig
        setSonosBaseUrl(data.sonosBaseUrl)
        setSonosRooms(data.rooms || [])
        setEnabledRooms(data.enabledRooms || data.rooms || [])
      } catch (err) {
        console.error('Konnte Sonos-Konfiguration nicht laden:', err)
      }
    }

    loadSonosConfig()
  }, [])


  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setInfo(null)

    try {
      const res = await fetch(
        `http://localhost:3001/search/apple?q=${encodeURIComponent(
          query,
        )}&entity=${entity}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as AppleSearchResult[]
      setResults(data)
    } catch (err) {
      console.error(err)
      setError('Fehler bei der Suche')
    } finally {
      setLoading(false)
    }
  }

  const addToMedia = async (r: AppleSearchResult, entity: 'album' | 'song') => {
    setError(null)
    setInfo(null)

    const baseId =
      (entity === 'album' ? r.appleAlbumId : r.appleSongId) ||
      r.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

    const id =
      (entity === 'album' ? `album_${baseId}` : `song_${baseId}`) ||
      `item_${Date.now()}`

    try {
      let res: Response

      if (entity === 'album') {
        res = await fetch('http://localhost:3001/media/apple/album', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            appleAlbumId: r.appleAlbumId,
            title: r.album || r.title,
            artist: r.artist,
            album: r.album || r.title,
            coverUrl: r.coverUrl,
          }),
        })
      } else {
        res = await fetch('http://localhost:3001/media/apple/song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            appleSongId: r.appleSongId,
            appleAlbumId: r.appleAlbumId,
            albumTitle: r.album || r.title,
            artist: r.artist,
            coverUrl: r.coverUrl,
            trackTitle: r.title,
          }),
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      setInfo(
        entity === 'album'
          ? `Album "${r.title}" wurde mit Songs in media.json gespeichert`
          : `Song "${r.title}" wurde zum Album in media.json hinzugefügt`,
      )
    } catch (err) {
      console.error(err)
      setError('Konnte Eintrag nicht speichern')
    }
  }

  const discoverSonosRooms = async () => {
    if (!sonosBaseUrl.trim()) {
      setSonosError('Bitte Sonos-API-URL angeben (z.B. http://192.168.114.21:5005)')
      return
    }

    setSonosLoading(true)
    setSonosError(null)
    setInfo(null)

    try {
      const res = await fetch('http://localhost:3001/admin/sonos/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sonosBaseUrl }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      const data = (await res.json()) as SonosConfig
      setSonosBaseUrl(data.sonosBaseUrl)
      setSonosRooms(data.rooms || [])
      setEnabledRooms(data.enabledRooms || data.rooms || [])
      setInfo('Sonos-Räume wurden aktualisiert und gespeichert')
    } catch (err) {
      console.error(err)
      setSonosError('Sonos-Räume konnten nicht geladen werden')
    } finally {
      setSonosLoading(false)
    }
  }

  const availableRooms = sonosRooms.filter(r => !enabledRooms.includes(r))

  const moveRoomRight = (room: string) => {
    setEnabledRooms(prev =>
      prev.includes(room) ? prev : [...prev, room],
    )
  }

  const moveRoomLeft = (room: string) => {
    setEnabledRooms(prev => prev.filter(r => r !== room))
  }

  const moveAllRight = () => {
    setEnabledRooms([...sonosRooms])
  }

  const moveAllLeft = () => {
    setEnabledRooms([])
  }

  const saveEnabledRooms = async () => {
    setSonosError(null)
    setInfo(null)
    try {
      const res = await fetch('http://localhost:3001/admin/sonos/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledRooms }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      const data = (await res.json()) as SonosConfig
      setEnabledRooms(data.enabledRooms || [])
      setInfo('Aktive Räume wurden gespeichert')
    } catch (err) {
      console.error(err)
      setSonosError('Aktive Räume konnten nicht gespeichert werden')
    }
  }

  

  return (
    <div style={styles.screen}>
      {/* Tab-Navigation */}
      <div style={styles.tabNav}>
        <button
          style={{
            ...styles.tabButton,
            ...(tab === 'search' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setTab('search')}
        >
          Apple-Suche
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(tab === 'sonos' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setTab('sonos')}
        >
          Sonos-Räume
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(tab === 'editor' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setTab('editor')}
        >
          Media-Editor
        </button>
      </div>

      {/* Sonos-Tab */}
      {tab === 'sonos' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h1 style={styles.title}>Admin: Sonos Raum-Discovery → config.json</h1>

          {/* Sonos-Konfiguration */}
          <div style={{ marginBottom: 10, padding: 6, backgroundColor: '#222', borderRadius: 8 }}>
            <div style={{ fontSize: '0.9rem', marginBottom: 4 }}>Sonos-Konfiguration</div>
            <div style={{ marginBottom: 4 }}>
              <input
                style={styles.input}
                value={sonosBaseUrl}
                onChange={e => setSonosBaseUrl(e.target.value)}
                placeholder="http://192.168.114.21:5005"
              />
              <button
                style={styles.button}
                onClick={discoverSonosRooms}
                disabled={sonosLoading}
              >
                {sonosLoading ? 'Lade…' : 'Räume laden & speichern'}
              </button>
            </div>
            {sonosError && (
              <div style={{ color: 'red', fontSize: '0.8rem', marginBottom: 4 }}>
                {sonosError}
              </div>
            )}

            {/* Dual-List: Links alle Räume, rechts aktive Räume */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', marginBottom: 2 }}>Alle Räume</div>
                <div style={{ maxHeight: 120, overflowY: 'auto', backgroundColor: '#111', borderRadius: 6, padding: 4 }}>
                  {availableRooms.length === 0 && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Keine weiteren Räume</div>
                  )}
                  {availableRooms.map(room => (
                    <button
                      key={room}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 4px',
                        marginBottom: 2,
                        backgroundColor: '#333',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => moveRoomRight(room)}
                    >
                      ➕ {room}
                    </button>
                  ))}
                </div>
                <button
                  style={{ ...styles.smallButton, marginTop: 4 }}
                  onClick={moveAllRight}
                >
                  Alle hinzufügen
                </button>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', marginBottom: 2 }}>Aktive Räume (für Kids-Frontend)</div>
                <div style={{ maxHeight: 120, overflowY: 'auto', backgroundColor: '#111', borderRadius: 6, padding: 4 }}>
                  {enabledRooms.length === 0 && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Noch keine aktiven Räume</div>
                  )}
                  {enabledRooms.map(room => (
                    <button
                      key={room}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 4px',
                        marginBottom: 2,
                        backgroundColor: '#444',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => moveRoomLeft(room)}
                    >
                      ➖ {room}
                    </button>
                  ))}
                </div>
                <button
                  style={{ ...styles.smallButton, marginTop: 4 }}
                  onClick={moveAllLeft}
                >
                  Alle entfernen
                </button>
              </div>
            </div>

            <button
              style={{ ...styles.button, marginTop: 6 }}
              onClick={saveEnabledRooms}
            >
              Aktive Räume speichern
            </button>

            {sonosRooms.length > 0 && (
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 4 }}>
                Entdeckte Räume: {sonosRooms.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search-Tab */}
      {tab === 'search' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <h1 style={styles.title}>Admin: Apple-Suche → media.json</h1>

          <div style={{ marginBottom: 8 }}>
            <input
              style={styles.input}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Titel, Interpret, Album…"
            />
            <select
              style={styles.select}
              value={entity}
              onChange={e => setEntity(e.target.value as 'album' | 'song')}
            >
              <option value="album">Album</option>
              <option value="song">Song</option>
            </select>
            <button style={styles.button} onClick={search} disabled={loading}>
              Suchen
            </button>
          </div>

          {loading && <div>Lade Suchergebnisse…</div>}
          {error && <div style={{ color: 'red', marginBottom: 4 }}>{error}</div>}
          {info && (
            <div style={{ color: 'lightgreen', marginBottom: 4 }}>{info}</div>
          )}

          <div style={styles.list}>
            {results.map(r => (
              <div
                key={`${r.kind}-${r.appleAlbumId}-${r.appleSongId}-${r.title}`}
                style={styles.resultRow}
              >
                <img
                  src={r.coverUrl}
                  alt={r.title}
                  style={styles.resultCover}
                />
                <div style={styles.resultInfo}>
                  <div>{r.title}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    {r.artist} {r.album ? `– ${r.album}` : ''}
                  </div>
                </div>
                <button
                  style={styles.smallButton}
                  onClick={() => addToMedia(r, entity)}
                >
                  Hinzufügen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor-Tab */}
      {tab === 'editor' && <MediaEditor />}
    </div>
  )
}

/* ==================== Styles ==================== */

const styles: Record<string, React.CSSProperties> = {
  screen: {
    backgroundColor: '#111',
    color: '#fff',
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: '8px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '1.2rem',
    margin: '0 0 8px 0',
    textAlign: 'center',
  },
  titleSmall: {
    fontSize: '1rem',
    margin: '0 0 4px 0',
    textAlign: 'left',
  },
  nowPlaying: {
    fontSize: '0.9rem',
    marginBottom: '4px',
    textAlign: 'center',
  },
  busy: {
    fontSize: '0.8rem',
    marginBottom: '4px',
    textAlign: 'center',
    opacity: 0.8,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    /* Use auto rows so items size to their content instead of stretching to equal height.
       Stretching caused a tall dark area under single album covers. */
    gridAutoRows: 'auto',
    gap: '8px',
    flex: 1,
    alignItems: 'start',
  },
  card: {
    backgroundColor: '#222',
    border: 'none',
    borderRadius: '12px',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  cover: {
    width: '100%',
    borderRadius: '8px',
    objectFit: 'cover',
    // Ensure covers keep a 1:1 aspect ratio so single items don't become non-square
    aspectRatio: '1 / 1',
    height: 'auto',
  },
  cardTitle: {
    marginTop: '4px',
    fontSize: '0.8rem',
    textAlign: 'center',
  },
  cardSubTitle: {
    marginTop: '2px',
    fontSize: '0.7rem',
    textAlign: 'center',
    opacity: 0.8,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    padding: '2px 8px',
    fontSize: '0.8rem',
  },
  albumHeader: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
  },
  albumCover: {
    width: 100,
    height: 100,
    borderRadius: 8,
    objectFit: 'cover',
  },
  albumMeta: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  albumTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  albumArtist: {
    fontSize: '0.8rem',
    opacity: 0.9,
  },
  primaryButton: {
    padding: '4px 8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  tracksList: {
    flex: 1,
    overflowY: 'auto',
    marginTop: 4,
  },
  trackRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    border: 'none',
    backgroundColor: '#222',
    borderRadius: 8,
    padding: '4px 6px',
    marginBottom: 4,
    textAlign: 'left',
    cursor: 'pointer',
  },
  trackNumber: {
    width: 24,
    fontSize: '0.8rem',
    opacity: 0.7,
  },
  trackTitle: {
    flex: 1,
    fontSize: '0.85rem',
  },
  trackDuration: {
    fontSize: '0.75rem',
    opacity: 0.7,
    marginLeft: 4,
  },
  nowPlayingBar: {
    fontSize: '0.8rem',
    paddingTop: 4,
    textAlign: 'center',
  },
  roomBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  roomButton: {
    flex: 1,
    padding: '4px 6px',
    fontSize: '0.8rem',
    borderRadius: 999,
    border: 'none',
    backgroundColor: '#333',
    color: '#fff',
    cursor: 'pointer',
  },
  roomError: {
    fontSize: '0.7rem',
    color: '#ffaaaa',
    whiteSpace: 'nowrap',
  },
  roomOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  roomOverlayInner: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    width: '80vw',
    maxWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  roomOverlayTitle: {
    fontSize: '1rem',
    marginBottom: 4,
    textAlign: 'center',
  },
  roomOverlayList: {
    maxHeight: 200,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  roomListButton: {
    padding: '6px 8px',
    fontSize: '0.9rem',
    borderRadius: 999,
    border: 'none',
    backgroundColor: '#444',
    color: '#fff',
    textAlign: 'center',
    cursor: 'pointer',
  },
  roomOverlayClose: {
    marginTop: 4,
    padding: '4px 8px',
    fontSize: '0.8rem',
    borderRadius: 999,
    border: 'none',
    backgroundColor: '#555',
    color: '#fff',
    cursor: 'pointer',
  },

  // Tab Navigation
  tabNav: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
    borderBottom: '1px solid #333',
  },
  tabButton: {
    padding: '8px 12px',
    fontSize: '0.9rem',
    border: 'none',
    borderBottom: '2px solid transparent',
    backgroundColor: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
  },
  tabButtonActive: {
    borderBottomColor: '#0a0',
    color: '#fff',
  },

  // Admin styles
  input: {
    padding: '4px',
    fontSize: '0.9rem',
    width: '50%',
    marginRight: '4px',
  },
  select: {
    padding: '4px',
    fontSize: '0.9rem',
    marginRight: '4px',
  },
  button: {
    padding: '4px 8px',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  list: {
    marginTop: 8,
    overflowY: 'auto',
    flex: 1,
  },
  resultRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 4,
  },
  resultCover: {
    width: 48,
    height: 48,
    borderRadius: 4,
    objectFit: 'cover',
    marginRight: 8,
  },
  trackInfo: {
    marginTop: 4,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#222',
    borderRadius: 8,
    textAlign: 'center' as const,
  },
  trackInfoTitle: {
    fontSize: '0.95rem',
    fontWeight: 'bold' as const,
  },
  trackInfoArtist: {
    fontSize: '0.8rem',
    opacity: 0.8,
    marginTop: 2,
  },
  trackInfoProgress: {
    fontSize: '0.75rem',
    opacity: 0.7,
    marginTop: 4,
  },
  // Player styles
  playerControls: {
    marginTop: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#111',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    padding: '6px 8px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#222',
    color: '#fff',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '6px 8px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#333',
    color: '#fff',
    cursor: 'pointer',
  },
  resultInfo: {
    flex: 1,
  },
  smallButton: {
    padding: '4px 6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
}

export default App
