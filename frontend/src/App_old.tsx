import { useEffect, useState } from 'react'
import type { MediaItem, AppleSearchResult } from './types'

function App() {
  const params = new URLSearchParams(window.location.search)
  const isAdmin = params.get('admin') === '1'

  return isAdmin ? <AdminView /> : <KidsView />
}

/* ====== Kids-Ansicht (wie bisher, leicht angepasst) ====== */

function KidsView() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nowPlaying, setNowPlaying] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const playItem = async (item: MediaItem) => {
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
          room: 'Büro', // TODO: später auswählbar machen
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

  if (loading) return <div style={styles.screen}>Lade Medien…</div>
  if (error) return <div style={styles.screen}>{error}</div>

  return (
    <div style={styles.screen}>
      <h1 style={styles.title}>Kids Player 🎧</h1>
      {nowPlaying && <div style={styles.nowPlaying}>▶ {nowPlaying}</div>}
      {busy && <div style={styles.busy}>Bitte warten…</div>}
      <div style={styles.grid}>
        {media.map((item) => (
          <button key={item.id} style={styles.card} onClick={() => playItem(item)}>
            <img src={item.coverUrl} alt={item.title} style={styles.cover} />
            <div style={styles.cardTitle}>{item.title}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ====== Admin-Ansicht: Suche + Hinzufügen ====== */

function AdminView() {
  const [query, setQuery] = useState('')
  const [entity, setEntity] = useState<'album' | 'song'>('album')
  const [results, setResults] = useState<AppleSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

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

    // Basis-ID: aus Apple-IDs oder aus Titel generiert
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
        // ➜ komplettes Album inkl. aller Tracks speichern
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
        // ➜ nur Song hinzufügen: Album wird gesucht oder angelegt, Song als Child-Track angehängt
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

  return (
    <div style={styles.screen}>
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
            <button
              style={styles.smallButton}
              onClick={() => addToMedia(r, entity)} // entity = 'album' | 'song' aus deinem Dropdown
            >
              Hinzufügen
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ====== Styles ====== */

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
