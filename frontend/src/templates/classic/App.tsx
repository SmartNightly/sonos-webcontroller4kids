// Original Default kids UI from commit 73af340, preserved as Classic.
import { lazy, Suspense, useEffect, useState } from 'react'
import type { MediaItem, MediaTrack } from '../../types'
import { useSonosPolling } from '../../hooks/useSonosPolling'
import { API_BASE_URL } from '../../api'
import { ThemeCycleButton } from '../../components/ThemeCycleButton'
import { AlbumTileTitle } from '../../components/AlbumTileTitle'

const Admin = lazy(() => import('../default/App'))

interface TemplateAppProps {
  isAdmin: boolean
}

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

function App({ isAdmin }: TemplateAppProps) {
  if (new URLSearchParams(window.location.search).get('demo') === '1') {
    return (
      <p role="status">
        Classic ist die unveränderte Originalansicht und bietet keinen Demo-Modus. Ohne demo=1
        verwendet es die echte Mediensammlung und Sonos-Steuerung.
      </p>
    )
  }
  if (isAdmin)
    return (
      <Suspense fallback={<p>Elternbereich wird geladen…</p>}>
        <Admin isAdmin />
      </Suspense>
    )
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

  useSonosPolling(selectedRoom, (data) => {
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
  })

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
        // Loader only shows if no cached data was loaded yet (loading is still true)

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

        const enabled = data.enabledRooms ?? data.rooms ?? []

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

      // Auto-open player so the user can see playback controls immediately
      setPlayerOpen(true)
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

      // Auto-open player so the user can see playback controls immediately
      setPlayerOpen(true)
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
      await fetch(`${API_BASE_URL}/sonos/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, action: 'next' }),
      })
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
      await fetch(`${API_BASE_URL}/sonos/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, action: 'previous' }),
      })
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
        <ThemeCycleButton theme="classic" />
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
                <img src={album.coverUrl} alt="" style={styles.cover} />
                <div style={{ ...styles.cardTitle, alignSelf: 'stretch', minWidth: 0 }}>
                  <AlbumTileTitle title={album.title} />
                </div>
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
    minWidth: 0,
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
