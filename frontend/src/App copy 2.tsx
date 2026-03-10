import { useEffect, useState } from 'react'
import type { MediaItem, MediaTrack, AppleSearchResult } from './types'

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
  const [nowPlaying, setNowPlaying] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [selectedAlbum, setSelectedAlbum] = useState<MediaItem | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)

  useEffect(() => {
    const loadMedia = async () => {
      try {
        const res = await fetch('http://localhost:3001/media')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = (await res.json()) as MediaItem[]
        setMedia(data)
      } catch (err) {
        console.error(err)
        setError('Medien konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }

    loadMedia()
  }, [])

  const playAlbum = async (item: MediaItem) => {
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
          room: 'Büro', // TODO: später konfigurierbar machen
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      setNowPlaying(item.title)
    } catch (err) {
      console.error(err)
      setError('Konnte nicht abspielen 😕')
    } finally {
      setBusy(false)
    }
  }

  const playTrack = async (album: MediaItem, track: MediaTrack) => {
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
          room: 'Büro',
          trackAppleSongId: track.appleSongId,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      setNowPlaying(`${album.title} – ${track.title}`)
    } catch (err) {
      console.error(err)
      setError('Konnte Track nicht abspielen 😕')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div style={styles.screen}>Lade Medien…</div>
  if (error) return <div style={styles.screen}>{error}</div>

  // Nur Alben für die Artist-/Album-Ansichten verwenden
  const albums = media.filter((m) => m.kind === 'album')

  // ============= Ebene 3: Album-Detail (Tracks) =============
  if (selectedAlbum) {
    const album = selectedAlbum
    const tracks = album.tracks || []

    return (
      <div style={styles.screen}>
        <h1 style={styles.titleSmall}>Album</h1>
        <button style={styles.backButton} onClick={() => setSelectedAlbum(null)}>
          ← Zurück
        </button>

        <div style={styles.albumHeader}>
          <img src={album.coverUrl} alt={album.title} style={styles.albumCover} />
          <div style={styles.albumMeta}>
            <div style={styles.albumTitle}>{album.title}</div>
            {album.artist && <div style={styles.albumArtist}>{album.artist}</div>}
            <button style={styles.primaryButton} onClick={() => playAlbum(album)} disabled={busy}>
              {busy ? 'Bitte warten…' : 'Album abspielen'}
            </button>
          </div>
        </div>

        <div style={styles.tracksList}>
          {tracks.map((t) => (
            <button
              key={t.id}
              style={styles.trackRow}
              onClick={() => playTrack(album, t)}
              disabled={busy}
            >
              <div style={styles.trackNumber}>{t.trackNumber ?? '•'}</div>
              <div style={styles.trackTitle}>{t.title}</div>
              <div style={styles.trackDuration}>
                {t.durationMs ? formatDuration(t.durationMs) : ''}
              </div>
            </button>
          ))}
        </div>

        {nowPlaying && <div style={styles.nowPlayingBar}>▶ {nowPlaying}</div>}
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
        <h1 style={styles.titleSmall}>Artist</h1>
        <button style={styles.backButton} onClick={() => setSelectedArtist(null)}>
          ← Zurück zu Artists
        </button>

        <div style={{ marginBottom: 4, fontSize: '0.9rem' }}>{selectedArtist}</div>

        {nowPlaying && <div style={styles.nowPlaying}>▶ {nowPlaying}</div>}
        {busy && <div style={styles.busy}>Bitte warten…</div>}

        <div style={styles.grid}>
          {artistAlbums.map((album) => (
            <button key={album.id} style={styles.card} onClick={() => setSelectedAlbum(album)}>
              <img src={album.coverUrl} alt={album.title} style={styles.cover} />
              <div style={styles.cardTitle}>{album.title}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ============= Ebene 1: Artist-Liste (Standardansicht) =============
  // Artists aus Alben ableiten, alphabetisch sortieren
  const artistMap = new Map<string, MediaItem[]>()

  for (const album of albums) {
    const name = album.artist || 'Unbekannt'
    if (!artistMap.has(name)) {
      artistMap.set(name, [])
    }
    artistMap.get(name)!.push(album)
  }

  const artistCards = Array.from(artistMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0])) // nach Artist sortieren
    .map(([artistName, artistAlbums]) => {
      // Repräsentatives Album (erstes) für Cover
      const firstAlbum = artistAlbums[0]
      return {
        artistName,
        coverUrl: firstAlbum.coverUrl,
      }
    })

  return (
    <div style={styles.screen}>
      <h1 style={styles.title}>Kids Player 🎧</h1>
      {nowPlaying && <div style={styles.nowPlaying}>▶ {nowPlaying}</div>}
      {busy && <div style={styles.busy}>Bitte warten…</div>}

      <div style={styles.grid}>
        {artistCards.map((artist) => (
          <button
            key={artist.artistName}
            style={styles.card}
            onClick={() => setSelectedArtist(artist.artistName)}
          >
            <img src={artist.coverUrl} alt={artist.artistName} style={styles.cover} />
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
}

function AdminView() {
  const [query, setQuery] = useState('')
  const [entity, setEntity] = useState<'album' | 'song'>('album')
  const [results, setResults] = useState<AppleSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Sonos-Konfiguration
  // Sonos-Konfiguration
  const [sonosBaseUrl, setSonosBaseUrl] = useState('')
  const [sonosRooms, setSonosRooms] = useState<string[]>([]) // alle
  const [enabledRooms, setEnabledRooms] = useState<string[]>([]) // rechts
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
        `http://localhost:3001/search/apple?q=${encodeURIComponent(query)}&entity=${entity}`,
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

    const id = (entity === 'album' ? `album_${baseId}` : `song_${baseId}`) || `item_${Date.now()}`

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
      <h1 style={styles.title}>Admin: Sonos Raum-Discovery → config.json</h1>

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
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Noch keine aktiven Räume</div>
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
      </div>

      {/* Bestehende Apple-Suche */}
      <h1 style={styles.title}>Admin: Apple-Suche → media.json</h1>

      <div style={{ marginBottom: 8 }}>
        <input
          style={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
        <button style={styles.button} onClick={search} disabled={loading}>
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
            <button style={styles.smallButton} onClick={() => addToMedia(r, entity)}>
              Hinzufügen
            </button>
          </div>
        ))}
      </div>
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
    gridAutoRows: 'minmax(0, 1fr)',
    gap: '8px',
    flex: 1,
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
    flexGrow: 1,
    objectFit: 'cover',
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
