import { useEffect, useState } from 'react'
import type { MediaItem, MediaTrack, AppleSearchResult } from '../../types'
import { MediaEditor } from '../../MediaEditor'

// API Base URL - verwendet relative URL in Production, localhost in Development
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3344' : ''

interface TemplateAppProps {
  isAdmin: boolean
}

function App({ isAdmin }: TemplateAppProps) {
  if (isAdmin) return <AdminView />
  return (
    <>
      <KidsView />
      {/* Fixed version badge — always visible in kids view regardless of sub-view */}
      <div
        style={{
          position: 'fixed',
          bottom: 4,
          right: 6,
          fontSize: '0.6rem',
          opacity: 0.3,
          color: '#fff',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        v{__APP_VERSION__}
      </div>
    </>
  )
}

/* ==================== Kids-Ansicht ==================== */

function KidsView() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // UI state for album player/detail view
  const [playing, setPlaying] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off')
  const [volume, setVolume] = useState<number | null>(null)
  const [currentTrack, setCurrentTrack] = useState<{
    title?: string
    artist?: string
    album?: string
    positionMs?: number
    durationMs?: number
    trackNo?: number
  } | null>(null)

  const [selectedAlbum, setSelectedAlbum] = useState<MediaItem | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<'all' | 'album' | 'audiobook'>('all')

  // Detailansicht mit Play-Button (kinderfreundlich)
  const [albumDetailView, setAlbumDetailView] = useState<MediaItem | null>(null)

  // 🔊 Sonos-Raum-Auswahl
  const [rooms, setRooms] = useState<string[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [roomPickerOpen, setRoomPickerOpen] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [showShuffleRepeat, setShowShuffleRepeat] = useState(true)
  const [roomIcons, setRoomIcons] = useState<Record<string, string>>({})
  const [showTracklistAlbums, setShowTracklistAlbums] = useState(true)
  const [showTracklistAudiobooks, setShowTracklistAudiobooks] = useState(true)
  const [maxVolume, setMaxVolume] = useState<Record<string, number>>({})

  // Track-Modus: Ermöglicht Navigation durch Album-Tracks
  const [trackModeAlbum, setTrackModeAlbum] = useState<MediaItem | null>(null)
  const [trackModeCurrentTrack, setTrackModeCurrentTrack] = useState<MediaTrack | null>(null)

  // Status-Polling: synchronisiere Sonos-Status alle 2 Sekunden
  useEffect(() => {
    if (!selectedRoom) return

    const pollInterval = 2000 // 2s
    const fetchStatus = async () => {
      try {
        const encoded = encodeURIComponent(selectedRoom)
        const res = await fetch(`${API_BASE_URL}/sonos/status?room=${encoded}`)
        if (!res.ok) return
        const data = await res.json()

        // Sync playback state
        if (data.state) {
          const s = String(data.state).toLowerCase()
          setPlaying(s === 'playing')
        }

        // Sync volume, mute, shuffle, repeat
        if (data.volume !== undefined) setVolume(data.volume)
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
            trackNo: data.trackNo,
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
    const timer = window.setInterval(fetchStatus, pollInterval)

    return () => {
      clearInterval(timer)
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
        setLoading((prev) => prev && true)

        const res = await fetch(`${API_BASE_URL}/media`)
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
        const res = await fetch(`${API_BASE_URL}/admin/sonos`)
        if (!res.ok) return

        const data = (await res.json()) as SonosConfig

        const enabled =
          data.enabledRooms && data.enabledRooms.length > 0 ? data.enabledRooms : data.rooms || []

        setRooms(enabled)
        setShowShuffleRepeat(data.showShuffleRepeat !== undefined ? data.showShuffleRepeat : true)
        setRoomIcons(data.roomIcons || {})
        setShowTracklistAlbums(
          data.showTracklistAlbums !== undefined ? data.showTracklistAlbums : true,
        )
        setShowTracklistAudiobooks(
          data.showTracklistAudiobooks !== undefined ? data.showTracklistAudiobooks : true,
        )
        setMaxVolume(data.maxVolume || {})

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
      setError('Bitte zuerst einen Raum wählen')
      setTimeout(() => setError(null), 2000)
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

      // Track-Modus deaktivieren (ganzes Album wird gespielt)
      setTrackModeAlbum(null)
      setTrackModeCurrentTrack(null)

      // Clear queue first and wait for it to complete
      await fetch(`${API_BASE_URL}/sonos/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, action: 'clearqueue' }),
      })

      // Delay to ensure clearqueue is fully processed by Sonos
      await new Promise((resolve) => setTimeout(resolve, 300))

      const res = await fetch(`${API_BASE_URL}/play`, {
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

      // Track-Modus aktivieren
      setTrackModeAlbum(album)
      setTrackModeCurrentTrack(track)

      // Clear queue first and wait for it to complete
      await fetch(`${API_BASE_URL}/sonos/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, action: 'clearqueue' }),
      })

      // Delay to ensure clearqueue is fully processed by Sonos
      await new Promise((resolve) => setTimeout(resolve, 300))

      const res = await fetch(`${API_BASE_URL}/play`, {
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

  const playNextTrack = async () => {
    if (!trackModeAlbum || !trackModeCurrentTrack) {
      // Kein Track-Modus -> normales Sonos Next
      const room = ensureRoomSelected()
      if (!room) return
      await fetch(`http://192.168.114.21:5005/${encodeURIComponent(room)}/next`)
      return
    }

    // Track-Modus: Nächsten Track im Album finden
    const tracks = trackModeAlbum.tracks || []
    const currentIndex = tracks.findIndex((t) => t.id === trackModeCurrentTrack.id)

    if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
      const nextTrack = tracks[currentIndex + 1]
      await playTrack(trackModeAlbum, nextTrack)
    }
  }

  const playPreviousTrack = async () => {
    if (!trackModeAlbum || !trackModeCurrentTrack) {
      // Kein Track-Modus -> normales Sonos Previous
      const room = ensureRoomSelected()
      if (!room) return
      await fetch(`http://192.168.114.21:5005/${encodeURIComponent(room)}/previous`)
      return
    }

    // Track-Modus: Vorherigen Track im Album finden
    const tracks = trackModeAlbum.tracks || []
    const currentIndex = tracks.findIndex((t) => t.id === trackModeCurrentTrack.id)

    if (currentIndex > 0) {
      const prevTrack = tracks[currentIndex - 1]
      await playTrack(trackModeAlbum, prevTrack)
    } else if (currentIndex === 0) {
      // Erster Track -> nochmals von vorne starten
      await playTrack(trackModeAlbum, trackModeCurrentTrack)
    }
  }

  const renderTopBar = (showBackButton?: boolean, onBackClick?: () => void, backLabel?: string) => {
    const getFilterIcon = () => {
      if (kindFilter === 'album') return '♪'
      if (kindFilter === 'audiobook') return '📖'
      return '⚪' // all
    }

    const cycleFilter = () => {
      if (kindFilter === 'all') setKindFilter('audiobook')
      else if (kindFilter === 'audiobook') setKindFilter('album')
      else setKindFilter('all')
    }

    return (
      <div style={styles.topBar}>
        {/* Back Button / Title - left side (optional) */}
        {showBackButton ? (
          <button
            style={{
              ...styles.topBarBackButton,
              cursor: onBackClick ? 'pointer' : 'pointer',
              opacity: 1,
              pointerEvents: 'auto',
            }}
            onClick={onBackClick || cycleFilter}
          >
            {onBackClick ? `← ${backLabel || 'Zurück'}` : getFilterIcon()}
          </button>
        ) : (
          <div style={{ ...styles.topBarBackButton, visibility: 'hidden' }} />
        )}

        {/* Track Info - flexible width */}
        <div
          style={{ ...styles.topBarTrackInfo, cursor: 'pointer' }}
          onClick={() => setPlayerOpen(!playerOpen)}
        >
          {currentTrack ? (
            <span
              style={{
                fontSize: '0.85rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                textAlign: 'center',
              }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                {currentTrack.trackNo ? `${currentTrack.trackNo}. ` : ''}
                {currentTrack.title || 'Unbekannt'}
              </span>
              {currentTrack.artist && (
                <span style={{ fontSize: '0.85rem' }}> • {currentTrack.artist}</span>
              )}
              {currentTrack.positionMs !== undefined && currentTrack.durationMs !== undefined && (
                <span style={{ fontSize: '0.85rem' }}>
                  {' '}
                  • {formatDuration(currentTrack.positionMs)} /{' '}
                  {formatDuration(currentTrack.durationMs)}
                </span>
              )}
              {volume !== null && <span style={{ fontSize: '0.85rem' }}> • Vol: {volume}</span>}
            </span>
          ) : (
            <span
              style={{ fontSize: '0.85rem', opacity: 0.5, textAlign: 'center', display: 'block' }}
            >
              Nichts abgespielt
            </span>
          )}
        </div>

        {/* Room Selector - fixed width, aligned right */}
        <div style={styles.topBarRoom}>
          <button
            style={styles.topBarRoomButton}
            onClick={() => rooms.length > 0 && setRoomPickerOpen(!roomPickerOpen)}
            disabled={rooms.length === 0}
          >
            {rooms.length === 0
              ? 'Kein Raum'
              : selectedRoom
                ? roomIcons[selectedRoom]
                  ? `${roomIcons[selectedRoom]} ${selectedRoom}`
                  : selectedRoom
                : 'Raum wählen'}
          </button>
        </div>
      </div>
    )
  }

  const renderRoomOverlay = () => {
    return (
      <div
        style={{
          ...styles.roomPanel,
          maxHeight: roomPickerOpen ? '300px' : '0',
          opacity: roomPickerOpen ? 1 : 0,
        }}
      >
        <div style={styles.roomPanelTitle}>Raum wählen</div>
        <div style={styles.roomPanelList}>
          {rooms.map((room) => (
            <button
              key={room}
              style={{
                ...styles.roomPanelButton,
                backgroundColor: room === selectedRoom ? '#555' : '#333',
                border: room === selectedRoom ? '2px solid #888' : '2px solid transparent',
              }}
              onClick={async () => {
                setSelectedRoom(room)
                setRoomPickerOpen(false)

                try {
                  await fetch(`${API_BASE_URL}/admin/sonos/default-room`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ defaultRoom: room }),
                  })
                } catch (err) {
                  console.error('Konnte Default-Raum nicht speichern:', err)
                }
              }}
            >
              {roomIcons[room] ? `${roomIcons[room]} ${room}` : room}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderPlayerOverlay = () => {
    const room = selectedRoom

    // Cover-URL ermitteln: Primär aus trackModeAlbum, alternativ Album-Name in media suchen
    let coverUrl: string | undefined
    if (trackModeAlbum?.coverUrl) {
      coverUrl = trackModeAlbum.coverUrl
    } else if (currentTrack?.album) {
      const foundAlbum = media.find((m) => m.album === currentTrack.album)
      coverUrl = foundAlbum?.coverUrl
    }

    return (
      <div
        style={{
          ...styles.playerPanel,
          maxHeight: playerOpen ? '300px' : '0',
          opacity: playerOpen ? 1 : 0,
        }}
      >
        {/* Player Controls - Row mit Cover links */}
        <div style={styles.playerControls}>
          {/* Links: Album Cover */}
          {coverUrl && <img src={coverUrl} alt="Cover" style={styles.playerCover} />}

          <div style={styles.playerSingleRow}>
            {/* Left: Shuffle & Repeat (invisible placeholders if disabled) */}
            <button
              style={{
                ...styles.playerCompactButton,
                backgroundColor: shuffle ? '#666' : '#333',
                border: shuffle ? '2px solid #888' : '2px solid transparent',
                visibility: showShuffleRepeat ? 'visible' : 'hidden',
              }}
              onClick={async () => {
                if (!room || !showShuffleRepeat) return
                const action = shuffle ? 'shuffleOff' : 'shuffleOn'
                await fetch(`${API_BASE_URL}/sonos/control`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action }),
                })
                setShuffle(!shuffle)
              }}
              disabled={!showShuffleRepeat}
            >
              🔀
            </button>
            <button
              style={{
                ...styles.playerCompactButton,
                backgroundColor: repeatMode !== 'off' ? '#666' : '#333',
                border: repeatMode !== 'off' ? '2px solid #888' : '2px solid transparent',
                visibility: showShuffleRepeat ? 'visible' : 'hidden',
              }}
              onClick={async () => {
                if (!room || !showShuffleRepeat) return
                let newMode: 'off' | 'all' | 'one'
                let action: string
                if (repeatMode === 'off') {
                  newMode = 'all'
                  action = 'repeatAll'
                } else if (repeatMode === 'all') {
                  newMode = 'one'
                  action = 'repeatOne'
                } else {
                  newMode = 'off'
                  action = 'repeatOff'
                }
                await fetch(`${API_BASE_URL}/sonos/control`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action }),
                })
                setRepeatMode(newMode)
              }}
              disabled={!showShuffleRepeat}
            >
              🔁{repeatMode === 'one' ? '1' : ''}
            </button>

            {/* Center: Prev, Play/Pause, Next */}
            <button style={styles.playerMainButton} onClick={() => playPreviousTrack()}>
              ◀◀
            </button>
            <button
              style={{
                ...styles.playerMainButton,
                fontSize: '2rem',
                minWidth: 100,
              }}
              onClick={async () => {
                if (!room) return
                if (playing) {
                  await fetch(`${API_BASE_URL}/sonos/control`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, action: 'pause' }),
                  })
                  setPlaying(false)
                } else {
                  await fetch(`${API_BASE_URL}/sonos/control`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, action: 'play' }),
                  })
                  setPlaying(true)
                }
              }}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <button style={styles.playerMainButton} onClick={() => playNextTrack()}>
              ▶▶
            </button>

            {/* Right: Volume Controls */}
            <button
              style={styles.playerCompactButton}
              onClick={async () => {
                if (!room) return
                await fetch(`${API_BASE_URL}/sonos/control`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action: 'volumeDown' }),
                })
              }}
            >
              −
            </button>
            <button
              style={{
                ...styles.playerCompactButton,
                // Zeige visuell an, wenn maxVolume erreicht ist
                ...(selectedRoom &&
                volume !== null &&
                maxVolume[selectedRoom] &&
                volume >= maxVolume[selectedRoom]
                  ? { opacity: 0.5, cursor: 'not-allowed' }
                  : {}),
              }}
              onClick={async () => {
                if (!room) return
                // Backend prüft bereits maxVolume und limitiert, aber wir zeigen es visuell
                await fetch(`${API_BASE_URL}/sonos/control`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room, action: 'volumeUp' }),
                })
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div style={styles.screen}>Lade Medien…</div>

  // Bei Fehler: Navigation trotzdem anzeigen
  if (error) {
    const filterIcon = kindFilter === 'album' ? '♪' : kindFilter === 'audiobook' ? '📖' : '⚪'
    return (
      <div style={styles.screen}>
        {renderTopBar(true, undefined, filterIcon)}
        {renderRoomOverlay()}
        {renderPlayerOverlay()}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
          }}
        >
          {error}
        </div>
      </div>
    )
  }

  // Filter Medien nach Kind
  const albums = media.filter((m) => {
    if (kindFilter === 'all') return true
    if (kindFilter === 'album') return m.kind === 'album'
    if (kindFilter === 'audiobook') return m.kind === 'audiobook'
    return true
  })

  // ============= Ebene 3.5: Album-Detailansicht mit Play-Button (kinderfreundlich) =============
  if (albumDetailView) {
    const album = albumDetailView
    const tracks = album.tracks || []

    // Prüfe ob Trackliste angezeigt werden soll basierend auf Album-Typ
    const shouldShowTracks =
      album.kind === 'audiobook' ? showTracklistAudiobooks : showTracklistAlbums

    const hasTracksToShow = tracks.length > 0 && shouldShowTracks

    return (
      <div style={styles.screen}>
        {renderTopBar(true, () => setAlbumDetailView(null))}
        {renderRoomOverlay()}
        {renderPlayerOverlay()}

        <div style={styles.albumDetailContainer}>
          {/* Links: Cover + Info (wie in Tracklist-Ansicht) */}
          <div style={styles.albumDetailLeft}>
            <img src={album.coverUrl} alt={album.title} style={styles.albumDetailCover} />
            <div style={styles.albumDetailInfo}>
              <div style={styles.albumDetailTitle}>
                <span style={{ fontWeight: 'bold' }}>{album.title}</span>
                {album.artist && <span style={{ fontWeight: 'normal' }}> - {album.artist}</span>}
              </div>
            </div>
          </div>

          {/* Rechts: Play-Button oben, dann optional Tracklist */}
          <div style={styles.albumDetailRight}>
            {/* Großer Play Button oben */}
            <button
              style={styles.albumDetailViewPlayButton}
              onClick={async () => {
                await playAlbum(album)
                setPlaying(true)
                setAlbumDetailView(null)
              }}
              disabled={busy}
            >
              <div style={styles.albumDetailViewPlayIcon}>▶</div>
              <div style={styles.albumDetailViewPlayText}>Abspielen</div>
            </button>

            {/* Tracklist unterhalb Play-Button (wenn aktiviert) */}
            {hasTracksToShow && (
              <div style={styles.albumDetailTracks}>
                {tracks.map((t) => (
                  <button
                    key={t.id}
                    style={styles.trackRowCompact}
                    onClick={() => playTrack(album, t)}
                    disabled={busy}
                  >
                    <div style={styles.trackNumberCompact}>{t.trackNumber ?? '•'}</div>
                    <div style={styles.trackTitleCompact}>{t.title}</div>
                    <div style={styles.trackDurationCompact}>
                      {t.durationMs ? formatDuration(t.durationMs) : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============= Ebene 3: Album-Detail (Tracks) =============
  if (selectedAlbum) {
    const album = selectedAlbum
    const tracks = album.tracks || []

    // Prüfe ob Trackliste angezeigt werden soll basierend auf Album-Typ
    const shouldShowTracks =
      album.kind === 'audiobook' ? showTracklistAudiobooks : showTracklistAlbums

    const hasTracksToShow = tracks.length > 0 && shouldShowTracks

    return (
      <div style={styles.screen}>
        {renderTopBar(true, () => setSelectedAlbum(null))}
        {renderRoomOverlay()}
        {renderPlayerOverlay()}

        <div style={styles.albumDetailContainer}>
          {/* Left: Cover + Info */}
          <div style={styles.albumDetailLeft}>
            <img
              src={album.coverUrl}
              alt={album.title}
              style={styles.albumDetailCover}
              onClick={async () => {
                await playAlbum(album)
                setPlaying(true)
              }}
            />
            <div style={styles.albumDetailInfo}>
              <div style={styles.albumDetailTitle}>
                <span style={{ fontWeight: 'bold' }}>{album.title}</span>
                {album.artist && <span style={{ fontWeight: 'normal' }}> - {album.artist}</span>}
              </div>
            </div>
          </div>

          {/* Right: Tracks List (nur wenn Einstellung aktiv) */}
          {hasTracksToShow && (
            <div style={styles.albumDetailTracks}>
              {tracks.map((t) => (
                <button
                  key={t.id}
                  style={styles.trackRowCompact}
                  onClick={() => playTrack(album, t)}
                  disabled={busy}
                >
                  <div style={styles.trackNumberCompact}>{t.trackNumber ?? '•'}</div>
                  <div style={styles.trackTitleCompact}>{t.title}</div>
                  <div style={styles.trackDurationCompact}>
                    {t.durationMs ? formatDuration(t.durationMs) : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============= Ebene 2: Album-Grid für einen Artist =============
  if (selectedArtist) {
    const artistAlbums = albums
      .filter((a) => (a.artist || 'Unbekannt') === selectedArtist)
      .sort((a, b) => a.title.localeCompare(b.title))

    return (
      <div style={styles.screen}>
        {renderTopBar(true, () => setSelectedArtist(null))}
        {renderRoomOverlay()}
        {renderPlayerOverlay()}

        {busy && <div style={styles.busy}>Bitte warten…</div>}

        <div style={styles.grid}>
          {artistAlbums.map((album) => {
            return (
              <button
                key={album.id}
                style={styles.card}
                onClick={() => {
                  // Immer Detailansicht öffnen (kinderfreundlich)
                  setAlbumDetailView(album)
                }}
              >
                <img src={album.coverUrl} alt={album.title} style={styles.cover} />
                <div style={styles.cardTitle}>{album.title}</div>
              </button>
            )
          })}
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
      // Use artistImageUrl from any album in this artist group if available
      const artistImageUrl = artistAlbums.find((a) => a.artistImageUrl)?.artistImageUrl
      return {
        artistName,
        coverUrl: firstAlbum.coverUrl,
        artistImageUrl,
      }
    })

  return (
    <div style={styles.screen}>
      {renderTopBar(true, undefined, 'Kids Player')}
      {renderRoomOverlay()}
      {renderPlayerOverlay()}

      {busy && <div style={styles.busy}>Bitte warten…</div>}

      <div style={styles.grid}>
        {artistCards.map((artist) => (
          <button
            key={artist.artistName}
            style={styles.card}
            onClick={() => setSelectedArtist(artist.artistName)}
          >
            <img
              src={artist.artistImageUrl ?? artist.coverUrl}
              alt={artist.artistName}
              style={artist.artistImageUrl ? styles.coverCircle : styles.cover}
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

/* ==================== Template Selector Component ==================== */

function TemplateSelector() {
  const [templates, setTemplates] = useState<string[]>([])
  const [activeTemplate, setActiveTemplate] = useState<string>('default')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/templates`)
      if (!res.ok) return
      const data = await res.json()
      setTemplates(data.templates || [])
      setActiveTemplate(data.active || 'default')
    } catch (err) {
      console.error('Konnte Templates nicht laden:', err)
    }
  }

  const switchTemplate = async (template: string) => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/templates/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      })

      if (!res.ok) {
        throw new Error('Template konnte nicht gewechselt werden')
      }

      setActiveTemplate(template)
      setMessage({
        type: 'success',
        text: `Template "${template}" aktiviert - Seite neu laden, um Änderungen zu sehen`,
      })

      // Nach 2 Sekunden automatisch neu laden
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Fehler beim Wechseln des Templates' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>Frontend-Template</div>
      <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 12 }}>
        Wähle ein Design-Template für die Kinder-Ansicht. Nach der Auswahl wird die Seite neu
        geladen.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {templates.map((template) => (
          <button
            key={template}
            style={{
              padding: '12px 20px',
              fontSize: '0.9rem',
              borderRadius: 8,
              border: template === activeTemplate ? '2px solid #0a0' : '2px solid #444',
              backgroundColor: template === activeTemplate ? '#2a2' : '#333',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
            onClick={() => !loading && switchTemplate(template)}
            disabled={loading}
          >
            {template === activeTemplate && '✓ '}
            {template}
          </button>
        ))}
      </div>

      {message && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 6,
            backgroundColor: message.type === 'success' ? '#2a4' : '#a42',
            fontSize: '0.85rem',
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}

/* ==================== Version Info Component ==================== */

interface VersionData {
  version: string
  gitCommit: string
  gitCommitShort: string
  buildDate: string
}

function VersionInfo() {
  const [data, setData] = useState<VersionData | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/version`)
      .then((res) => res.json())
      .then((d) => setData(d as VersionData))
      .catch(() => {
        // Fallback to build-time constant when the API is unavailable (e.g. during local dev)
        setData({
          version: __APP_VERSION__,
          gitCommit: 'dev',
          gitCommitShort: 'dev',
          buildDate: 'dev',
        })
      })
  }, [])

  return (
    <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ fontSize: '0.9rem', marginBottom: 4 }}>Version</div>
      {data ? (
        <div style={{ fontSize: '0.75rem', opacity: 0.7, lineHeight: 1.6 }}>
          <div>
            <strong>Version:</strong> {data.version}
          </div>
          <div>
            <strong>Git Commit:</strong> {data.gitCommitShort}
          </div>
          <div>
            <strong>Build Date:</strong> {data.buildDate}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Loading…</div>
      )}
    </div>
  )
}

/* ==================== Admin-Ansicht (wie vorher, nur verkürzt angedeutet) ==================== */

interface SonosConfig {
  sonosBaseUrl: string
  rooms?: string[]
  enabledRooms?: string[]
  defaultRoom?: string
  showShuffleRepeat?: boolean
  roomIcons?: Record<string, string>
  showTracklistAlbums?: boolean
  showTracklistAudiobooks?: boolean
  maxVolume?: Record<string, number>
}

interface ArtistResult {
  artistId: string
  artistName: string
  artistImageUrl: string
}

interface ArtistImagePickerProps {
  isOpen: boolean
  artistName: string
  results: ArtistResult[]
  onSelect: (artistImageUrl: string) => void
  onSkip: () => void
}

function ArtistImagePickerModal({
  isOpen,
  artistName,
  results,
  onSelect,
  onSkip,
}: ArtistImagePickerProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
      }}
    >
      <div
        style={{
          backgroundColor: '#222',
          borderRadius: 12,
          padding: 20,
          width: '90vw',
          maxWidth: 360,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
            Künstlerbild für „{artistName}" auswählen
          </div>
          <button
            onClick={onSkip}
            style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {results.map((r) => (
            <button
              key={r.artistId}
              type="button"
              title={r.artistName}
              onClick={() => onSelect(r.artistImageUrl)}
              style={{
                background: 'none',
                border: '2px solid #555',
                borderRadius: '50%',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <img
                src={r.artistImageUrl}
                alt={r.artistName}
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          ))}
        </div>
        <button
          onClick={onSkip}
          style={{
            width: '100%',
            padding: '8px 0',
            borderRadius: 6,
            border: 'none',
            backgroundColor: '#444',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Überspringen
        </button>
      </div>
    </div>
  )
}

function AdminView() {
  const [tab, setTab] = useState<'search' | 'editor' | 'settings'>('search')
  const [query, setQuery] = useState('')
  const [entity, setEntity] = useState<'album' | 'song'>('album')
  const [importKind, setImportKind] = useState<'album' | 'audiobook'>('album')
  const [results, setResults] = useState<AppleSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [existingMedia, setExistingMedia] = useState<MediaItem[]>([])

  const [artistImagePicker, setArtistImagePicker] = useState<{
    isOpen: boolean
    itemId: string
    artistName: string
    pickerResults: ArtistResult[]
  }>({ isOpen: false, itemId: '', artistName: '', pickerResults: [] })
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  // Sonos-Konfiguration
  // Sonos-Konfiguration
  const [sonosBaseUrl, setSonosBaseUrl] = useState('')
  const [sonosRooms, setSonosRooms] = useState<string[]>([]) // alle
  const [enabledRooms, setEnabledRooms] = useState<string[]>([]) // rechts
  const [sonosLoading, setSonosLoading] = useState(false)
  const [sonosError, setSonosError] = useState<string | null>(null)
  const [showShuffleRepeatSetting, setShowShuffleRepeatSetting] = useState(true)
  const [roomIconsAdmin, setRoomIconsAdmin] = useState<Record<string, string>>({})
  const [showTracklistAlbumsSetting, setShowTracklistAlbumsSetting] = useState(true)
  const [showTracklistAudiobooksSetting, setShowTracklistAudiobooksSetting] = useState(true)
  const [maxVolumeAdmin, setMaxVolumeAdmin] = useState<Record<string, number>>({})

  useEffect(() => {
    const loadSonosConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/sonos`)
        if (!res.ok) return
        const data = (await res.json()) as SonosConfig
        setSonosBaseUrl(data.sonosBaseUrl)
        setSonosRooms(data.rooms || [])
        setEnabledRooms(data.enabledRooms || data.rooms || [])
        setShowShuffleRepeatSetting(
          data.showShuffleRepeat !== undefined ? data.showShuffleRepeat : true,
        )
        setRoomIconsAdmin(data.roomIcons || {})
        setShowTracklistAlbumsSetting(
          data.showTracklistAlbums !== undefined ? data.showTracklistAlbums : true,
        )
        setShowTracklistAudiobooksSetting(
          data.showTracklistAudiobooks !== undefined ? data.showTracklistAudiobooks : true,
        )
        setMaxVolumeAdmin(data.maxVolume || {})
      } catch (err) {
        console.error('Konnte Sonos-Konfiguration nicht laden:', err)
      }
    }

    const loadExistingMedia = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/media`)
        if (!res.ok) return
        const data = (await res.json()) as MediaItem[]
        setExistingMedia(data)
      } catch (err) {
        console.error('Konnte Media-Liste nicht laden:', err)
      }
    }

    loadSonosConfig()
    loadExistingMedia()
  }, [])

  const search = async (loadMore = false) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    if (!loadMore) {
      setInfo(null)
      setOffset(0)
    }

    const currentOffset = loadMore ? offset : 0

    try {
      const res = await fetch(
        `${API_BASE_URL}/search/apple?q=${encodeURIComponent(
          query,
        )}&entity=${entity}&offset=${currentOffset}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as AppleSearchResult[]

      if (loadMore) {
        setResults((prev) => [...prev, ...data])
      } else {
        setResults(data)
      }

      // Wenn genau 100 Resultate, gibt es vermutlich mehr
      setHasMore(data.length === 100)
      setOffset(currentOffset + data.length)
    } catch (err) {
      console.error(err)
      setError('Fehler bei der Suche')
    } finally {
      setLoading(false)
    }
  }

  const isItemExists = (r: AppleSearchResult, entity: 'album' | 'song'): boolean => {
    if (entity === 'album' && r.appleAlbumId) {
      return existingMedia.some((item) => item.id === `album_${r.appleAlbumId}`)
    }
    if (entity === 'song' && r.appleSongId) {
      // Prüfe ob Song in irgendeinem Album bereits existiert
      return existingMedia.some((item) =>
        item.tracks?.some((track) => track.appleSongId === r.appleSongId),
      )
    }
    return false
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

    const id = (entity === 'album' ? `album_${baseId}` : `song_${baseId}`) || `item_${Date.now()}`

    try {
      let res: Response

      if (entity === 'album') {
        res = await fetch(`${API_BASE_URL}/media/apple/album`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            appleAlbumId: r.appleAlbumId,
            title: r.album || r.title,
            artist: r.artist,
            album: r.album || r.title,
            coverUrl: r.coverUrl,
            kind: importKind,
          }),
        })
      } else {
        res = await fetch(`${API_BASE_URL}/media/apple/song`, {
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

      const responseData = await res.json().catch(() => null)
      const trackCount = responseData?.trackCount ?? 0

      // Media-Liste aktualisieren
      const mediaRes = await fetch(`${API_BASE_URL}/media`)
      if (mediaRes.ok) {
        const data = (await mediaRes.json()) as MediaItem[]
        setExistingMedia(data)
      }

      if (entity === 'album') {
        if (trackCount === 0) {
          setInfo(
            `Album "${r.title}" wurde gespeichert ⚠️ Keine Tracks gefunden (Album ist trotzdem abspielbar)`,
          )
        } else {
          setInfo(`Album "${r.title}" wurde mit ${trackCount} Songs in media.json gespeichert`)
        }
      } else {
        setInfo(`Song "${r.title}" wurde zum Album in media.json hinzugefügt`)
      }

      // If the backend did not auto-fill an artist image, search and show a picker
      if (entity === 'album' && r.artist && !responseData?.artistImageUrl) {
        try {
          const artistRes = await fetch(
            `${API_BASE_URL}/search/apple/artist?query=${encodeURIComponent(r.artist)}`,
          )
          if (artistRes.ok) {
            const artistData = (await artistRes.json()) as ArtistResult[]
            if (artistData.length === 1) {
              // Single unambiguous result — auto-apply without dialog
              await fetch(`${API_BASE_URL}/media/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artistImageUrl: artistData[0]!.artistImageUrl }),
              })
            } else if (artistData.length > 1) {
              // Multiple candidates — let the user pick
              setArtistImagePicker({
                isOpen: true,
                itemId: id,
                artistName: r.artist,
                pickerResults: artistData,
              })
            }
          }
        } catch {
          // Artist image search failure is non-critical — ignore
        }
      }
    } catch (err) {
      console.error(err)
      setError('Konnte Eintrag nicht speichern')
    }
  }

  const handleArtistImageSelect = async (artistImageUrl: string) => {
    const { itemId, artistName } = artistImagePicker
    setArtistImagePicker({ isOpen: false, itemId: '', artistName: '', pickerResults: [] })

    await fetch(`${API_BASE_URL}/media/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistImageUrl }),
    })

    // Offer to bulk-apply to other albums by the same artist
    const others = existingMedia.filter(
      (m) =>
        m.id !== itemId &&
        m.artist?.toLowerCase() === artistName.toLowerCase() &&
        m.artistImageUrl !== artistImageUrl,
    )
    if (others.length > 0) {
      const plural = others.length === 1 ? 'Album' : 'Alben'
      const confirmed = window.confirm(
        `Dieses Künstlerbild auch für alle anderen Alben von „${artistName}" übernehmen? (${others.length} ${plural})`,
      )
      if (confirmed) {
        await fetch(`${API_BASE_URL}/media/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: others.map((m) => m.id),
            updates: { artistImageUrl },
          }),
        })
      }
    }

    // Refresh local media list
    const mediaRes = await fetch(`${API_BASE_URL}/media`)
    if (mediaRes.ok) {
      const data = (await mediaRes.json()) as MediaItem[]
      setExistingMedia(data)
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
      const res = await fetch(`${API_BASE_URL}/admin/sonos/discover`, {
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

  const availableRooms = sonosRooms.filter((r) => !enabledRooms.includes(r))

  const moveRoomRight = (room: string) => {
    setEnabledRooms((prev) => (prev.includes(room) ? prev : [...prev, room]))
  }

  const moveRoomLeft = (room: string) => {
    setEnabledRooms((prev) => prev.filter((r) => r !== room))
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
      const res = await fetch(`${API_BASE_URL}/admin/sonos/rooms`, {
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
      {/* Tab Navigation */}
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
            ...(tab === 'editor' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setTab('editor')}
        >
          Media-Editor
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(tab === 'settings' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setTab('settings')}
        >
          Einstellungen
        </button>
      </div>

      {/* Settings Tab (formerly Sonos) */}
      {tab === 'settings' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h1 style={styles.title}>Admin: Einstellungen</h1>

          {/* Sonos-Konfiguration */}
          <div style={{ marginBottom: 10, padding: 6, backgroundColor: '#222', borderRadius: 8 }}>
            <div style={{ fontSize: '0.9rem', marginBottom: 4 }}>Sonos-Konfiguration</div>
            <div style={{ marginBottom: 4 }}>
              <input
                style={styles.input}
                value={sonosBaseUrl}
                onChange={(e) => setSonosBaseUrl(e.target.value)}
                placeholder="http://192.168.114.21:5005"
              />
              <button style={styles.button} onClick={discoverSonosRooms} disabled={sonosLoading}>
                {sonosLoading ? 'Lade…' : 'Räume laden & speichern'}
              </button>
            </div>
            {sonosError && (
              <div style={{ color: 'red', fontSize: '0.8rem', marginBottom: 4 }}>{sonosError}</div>
            )}

            {/* Dual-List: Links alle Räume, rechts aktive Räume */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', marginBottom: 2 }}>Alle Räume</div>
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: 'auto',
                    backgroundColor: '#111',
                    borderRadius: 6,
                    padding: 4,
                  }}
                >
                  {availableRooms.length === 0 && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Keine weiteren Räume</div>
                  )}
                  {availableRooms.map((room) => (
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
                <button style={{ ...styles.smallButton, marginTop: 4 }} onClick={moveAllRight}>
                  Alle hinzufügen
                </button>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', marginBottom: 2 }}>
                  Aktive Räume (für Kids-Frontend)
                </div>
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: 'auto',
                    backgroundColor: '#111',
                    borderRadius: 6,
                    padding: 4,
                  }}
                >
                  {enabledRooms.length === 0 && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      Noch keine aktiven Räume
                    </div>
                  )}
                  {enabledRooms.map((room) => (
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
                <button style={{ ...styles.smallButton, marginTop: 4 }} onClick={moveAllLeft}>
                  Alle entfernen
                </button>
              </div>
            </div>

            <button style={{ ...styles.button, marginTop: 6 }} onClick={saveEnabledRooms}>
              Aktive Räume speichern
            </button>

            {sonosRooms.length > 0 && (
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 4 }}>
                Entdeckte Räume: {sonosRooms.join(', ')}
              </div>
            )}

            {/* Shuffle/Repeat Visibility Toggle */}
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showShuffleRepeatSetting}
                  onChange={async (e) => {
                    const newValue = e.target.checked
                    setShowShuffleRepeatSetting(newValue)
                    try {
                      await fetch(`${API_BASE_URL}/admin/sonos/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ showShuffleRepeat: newValue }),
                      })
                    } catch (err) {
                      console.error('Fehler beim Speichern der Einstellung:', err)
                    }
                  }}
                />
                <span style={{ fontSize: '0.85rem' }}>
                  Shuffle & Repeat Buttons im Player anzeigen
                </span>
              </label>
              <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 4, marginLeft: 24 }}>
                Für kleine Kinder kann es verwirrend sein, diese Optionen zu sehen.
              </div>
            </div>

            {/* Tracklist Display Settings */}
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
              <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>Trackliste anzeigen</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 12 }}>
                Für Kinder, die noch nicht lesen können, kann die Trackliste irritieren. Wenn
                ausgeblendet, verhalten sich Alben wie solche ohne Tracks.
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={showTracklistAlbumsSetting}
                  onChange={async (e) => {
                    const newValue = e.target.checked
                    setShowTracklistAlbumsSetting(newValue)
                    try {
                      await fetch(`${API_BASE_URL}/admin/sonos/tracklist-settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ showTracklistAlbums: newValue }),
                      })
                    } catch (err) {
                      console.error('Fehler beim Speichern:', err)
                    }
                  }}
                />
                <span style={{ fontSize: '0.85rem' }}>Trackliste bei Alben anzeigen</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={showTracklistAudiobooksSetting}
                  onChange={async (e) => {
                    const newValue = e.target.checked
                    setShowTracklistAudiobooksSetting(newValue)
                    try {
                      await fetch(`${API_BASE_URL}/admin/sonos/tracklist-settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ showTracklistAudiobooks: newValue }),
                      })
                    } catch (err) {
                      console.error('Fehler beim Speichern:', err)
                    }
                  }}
                />
                <span style={{ fontSize: '0.85rem' }}>Trackliste bei Hörbüchern anzeigen</span>
              </label>
            </div>

            {/* Room Icons Configuration */}
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
              <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>
                Raumsymbole (Emojis für Kinder)
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 8 }}>
                Füge jedem Raum ein Emoji/Symbol hinzu, damit Kinder die Räume leichter erkennen.
              </div>
              {sonosRooms.map((room) => (
                <div
                  key={room}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
                >
                  <input
                    type="text"
                    value={roomIconsAdmin[room] || ''}
                    onChange={(e) => {
                      const newIcons = { ...roomIconsAdmin, [room]: e.target.value }
                      setRoomIconsAdmin(newIcons)
                    }}
                    placeholder="🏠"
                    style={{
                      width: 50,
                      padding: '4px 8px',
                      fontSize: '1.2rem',
                      textAlign: 'center',
                      backgroundColor: '#111',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: 4,
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', flex: 1 }}>{room}</span>
                </div>
              ))}
              <button
                style={{ ...styles.button, marginTop: 8 }}
                onClick={async () => {
                  try {
                    await fetch(`${API_BASE_URL}/admin/sonos/room-icons`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ roomIcons: roomIconsAdmin }),
                    })
                  } catch (err) {
                    console.error('Fehler beim Speichern der Raumsymbole:', err)
                  }
                }}
              >
                Raumsymbole speichern
              </button>
            </div>

            {/* Max Volume Configuration */}
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
              <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>
                Maximale Lautstärke pro Raum
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 8 }}>
                Schützt Kinderhörgeräte durch Limitierung der maximalen Lautstärke (0-100). Leeres
                Feld = kein Limit (100).
              </div>
              {sonosRooms.map((room) => (
                <div
                  key={room}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
                >
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={maxVolumeAdmin[room] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value)
                      const newMaxVol = { ...maxVolumeAdmin }
                      if (val === undefined) {
                        delete newMaxVol[room]
                      } else {
                        newMaxVol[room] = Math.min(100, Math.max(0, val))
                      }
                      setMaxVolumeAdmin(newMaxVol)
                    }}
                    placeholder="100"
                    style={{
                      width: 60,
                      padding: '4px 8px',
                      fontSize: '0.9rem',
                      textAlign: 'center',
                      backgroundColor: '#111',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: 4,
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', flex: 1 }}>{room}</span>
                </div>
              ))}
              <button
                style={{ ...styles.button, marginTop: 8 }}
                onClick={async () => {
                  try {
                    await fetch(`${API_BASE_URL}/admin/sonos/settings`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ maxVolume: maxVolumeAdmin }),
                    })
                  } catch (err) {
                    console.error('Fehler beim Speichern der max. Lautstärke:', err)
                  }
                }}
              >
                Maximale Lautstärke speichern
              </button>
            </div>

            {/* Template Selection */}
            <TemplateSelector />

            {/* Version Info */}
            <VersionInfo />
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
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Titel, Interpret, Album…"
            />
            <select
              style={styles.select}
              value={entity}
              onChange={(e) => setEntity(e.target.value as 'album' | 'song')}
            >
              <option value="album">Album</option>
              <option value="song">Song</option>
            </select>
            <select
              style={styles.select}
              value={importKind}
              onChange={(e) => setImportKind(e.target.value as 'album' | 'audiobook')}
            >
              <option value="album">Als Album</option>
              <option value="audiobook">Als Audiobook</option>
            </select>
            <button style={styles.button} onClick={() => search()} disabled={loading}>
              Suchen
            </button>
          </div>

          {loading && <div>Lade Suchergebnisse…</div>}
          {error && <div style={{ color: 'red', marginBottom: 4 }}>{error}</div>}
          {info && <div style={{ color: 'lightgreen', marginBottom: 4 }}>{info}</div>}

          <div style={styles.list}>
            {results.map((r) => (
              <div
                key={`${r.kind}-${r.appleAlbumId}-${r.appleSongId}-${r.title}`}
                style={styles.resultRow}
              >
                <img src={r.coverUrl} alt={r.title} style={styles.resultCover} />
                <div style={styles.resultInfo}>
                  <div>{r.title}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    {r.artist} {r.album ? `– ${r.album}` : ''}
                  </div>
                </div>
                {isItemExists(r, entity) ? (
                  <button
                    style={{ ...styles.smallButton, opacity: 0.5, cursor: 'not-allowed' }}
                    disabled
                  >
                    Vorhanden
                  </button>
                ) : (
                  <button style={styles.smallButton} onClick={() => addToMedia(r, entity)}>
                    Hinzufügen
                  </button>
                )}
              </div>
            ))}
            {hasMore && !loading && (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <button style={styles.button} onClick={() => search(true)}>
                  Weitere Resultate laden (100+)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor-Tab */}
      {tab === 'editor' && <MediaEditor />}

      <ArtistImagePickerModal
        isOpen={artistImagePicker.isOpen}
        artistName={artistImagePicker.artistName}
        results={artistImagePicker.pickerResults}
        onSelect={handleArtistImageSelect}
        onSkip={() =>
          setArtistImagePicker({ isOpen: false, itemId: '', artistName: '', pickerResults: [] })
        }
      />
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
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  title: {
    fontSize: '1.2rem',
    margin: '0 0 8px 0',
    textAlign: 'center',
    userSelect: 'none',
  },
  titleSmall: {
    fontSize: '1rem',
    margin: '0 0 4px 0',
    userSelect: 'none',
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
    overflowY: 'auto',
    overflowX: 'hidden',
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
  coverCircle: {
    width: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
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
  // New Album Detail Layout (optimized for 480px height)
  albumDetailContainer: {
    display: 'flex',
    gap: 8,
    flex: 1,
    overflow: 'hidden',
  },
  albumDetailLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  albumDetailCover: {
    width: 280,
    height: 280,
    borderRadius: 8,
    objectFit: 'cover',
    cursor: 'pointer',
  },
  albumDetailInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  albumDetailTitle: {
    fontSize: '1rem',
    fontWeight: 'normal',
  },
  albumDetailArtist: {
    fontSize: '0.85rem',
    opacity: 0.8,
  },
  albumDetailTracks: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  trackRowCompact: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    border: 'none',
    backgroundColor: '#222',
    borderRadius: 6,
    padding: '6px 8px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  trackNumberCompact: {
    width: 20,
    fontSize: '0.75rem',
    opacity: 0.7,
  },
  trackTitleCompact: {
    flex: 1,
    fontSize: '0.8rem',
  },
  trackDurationCompact: {
    fontSize: '0.7rem',
    opacity: 0.7,
    marginLeft: 4,
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
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    width: '100%',
    position: 'sticky',
    top: 0,
    backgroundColor: '#111',
    zIndex: 100,
  },
  topBarBackButton: {
    padding: '10px 16px',
    fontSize: '0.95rem',
    fontWeight: '500',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#333',
    color: '#fff',
    cursor: 'pointer',
    minWidth: 120,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  topBarTrackInfo: {
    flex: '1',
    minWidth: 0,
    padding: '8px 10px',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  topBarRoom: {
    flexShrink: 0,
    marginLeft: 'auto',
  },
  topBarRoomButton: {
    padding: '10px 16px',
    fontSize: '0.95rem',
    fontWeight: '500',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#333',
    color: '#fff',
    cursor: 'pointer',
    minWidth: 120,
    whiteSpace: 'nowrap',
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

  // Room Panel (schiebt von oben ein, wie Player)
  roomPanel: {
    backgroundColor: '#1a1a1a',
    borderBottom: 'none',
    padding: '1px 2px 2px 2px',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease-out, opacity 0.3s ease-out',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flexShrink: 0,
    position: 'sticky',
    top: 56,
    zIndex: 98,
  },
  roomPanelTitle: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 0,
  },
  roomPanelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 200,
    overflowY: 'auto',
  },
  roomPanelButton: {
    padding: '12px 16px',
    fontSize: '1rem',
    fontWeight: '500',
    borderRadius: 10,
    border: '2px solid transparent',
    backgroundColor: '#333',
    color: '#fff',
    textAlign: 'center',
    cursor: 'pointer',
    minHeight: 50,
    touchAction: 'manipulation',
  },

  // Player Panel (schiebt von oben ein)
  playerPanel: {
    backgroundColor: '#1a1a1a',
    borderBottom: 'none',
    padding: '1px 2px 2px 2px',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease-out, opacity 0.3s ease-out',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flexShrink: 0,
    position: 'sticky',
    top: 56,
    zIndex: 99,
  },
  playerTrackInfo: {
    textAlign: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #333',
    marginBottom: 4,
  },
  playerSingleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  playerMainButton: {
    padding: '16px 24px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#333',
    color: '#fff',
    cursor: 'pointer',
    minWidth: 80,
    minHeight: 70,
    touchAction: 'manipulation',
  },
  playerCompactButton: {
    padding: '12px 16px',
    fontSize: '1.3rem',
    borderRadius: 10,
    border: '2px solid transparent',
    backgroundColor: '#333',
    color: '#fff',
    cursor: 'pointer',
    minWidth: 60,
    minHeight: 60,
    touchAction: 'manipulation',
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
    padding: '8px 12px',
    fontSize: '0.9rem',
    width: '50%',
    marginRight: '4px',
    backgroundColor: '#222',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '4px',
    boxSizing: 'border-box',
  },
  select: {
    padding: '4px',
    fontSize: '0.9rem',
    marginRight: '4px',
    backgroundColor: '#222',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '4px',
  },
  button: {
    padding: '4px 8px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    backgroundColor: '#444',
    color: '#fff',
    border: '1px solid #666',
    borderRadius: '4px',
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
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  playerCover: {
    width: '100px',
    height: '100px',
    borderRadius: 8,
    objectFit: 'cover' as const,
    flexShrink: 0,
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

  // Kinderfreundliche Album-Detailansicht (nutzt gleiches Layout wie Tracklist)
  albumDetailRight: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    overflow: 'hidden',
  },
  albumDetailViewPlayButton: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '20px 40px',
    fontSize: '1.3rem',
    fontWeight: 'bold' as const,
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  albumDetailViewPlayIcon: {
    fontSize: '2rem',
    lineHeight: '1',
  },
  albumDetailViewPlayText: {
    fontSize: '1.5rem',
  },
}

export default App
