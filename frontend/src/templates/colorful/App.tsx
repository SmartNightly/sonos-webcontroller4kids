import { useEffect, useState } from 'react'
import type { MediaItem } from '../../types'
import './App.css'

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3344' : ''

interface TemplateAppProps {
  isAdmin: boolean
}

function App({ isAdmin }: TemplateAppProps) {
  if (isAdmin) {
    return (
      <div style={styles.adminRedirect}>
        <h2>🎨 Colorful Kids Template</h2>
        <p>Admin-Modus nur im Default-Template verfügbar.</p>
        <a href="?admin=1" onClick={() => {
          fetch(`${API_BASE_URL}/admin/templates/active`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template: 'default' }),
          }).then(() => window.location.reload())
        }}>
          Zum Admin wechseln
        </a>
      </div>
    )
  }
  
  return <KidsView />
}

const colors = [
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
]

function KidsView() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState<number | null>(null)
  const [currentTrack, setCurrentTrack] = useState<{ title?: string; artist?: string } | null>(null)
  
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<MediaItem | null>(null)
  
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [roomIcons, setRoomIcons] = useState<Record<string, string>>({})
  const [playerOpen, setPlayerOpen] = useState(false)

  // Medien laden
  useEffect(() => {
    fetch(`${API_BASE_URL}/media`)
      .then(res => res.json())
      .then(data => {
        setMedia(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Sonos-Config laden
  useEffect(() => {
    fetch(`${API_BASE_URL}/admin/sonos`)
      .then(res => res.json())
      .then(data => {
        const enabled = data.enabledRooms?.length > 0 ? data.enabledRooms : data.rooms || []
        setRoomIcons(data.roomIcons || {})
        if (data.defaultRoom && enabled.includes(data.defaultRoom)) {
          setSelectedRoom(data.defaultRoom)
        } else if (enabled.length > 0) {
          setSelectedRoom(enabled[0])
        }
      })
  }, [])

  // Status-Polling
  useEffect(() => {
    if (!selectedRoom) return
    
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sonos/status?room=${encodeURIComponent(selectedRoom)}`)
        const data = await res.json()
        if (data.state) setPlaying(String(data.state).toLowerCase() === 'playing')
        if (data.volume !== undefined) setVolume(data.volume)
        if (data.track) setCurrentTrack({ title: data.track.title, artist: data.track.artist })
      } catch (err) {
        console.error(err)
      }
    }
    
    poll()
    const timer = setInterval(poll, 2000)
    return () => clearInterval(timer)
  }, [selectedRoom])

  const playAlbum = async (item: MediaItem) => {
    if (!selectedRoom) return
    setBusy(true)
    try {
      await fetch(`${API_BASE_URL}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, room: selectedRoom }),
      })
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  const togglePlayPause = async () => {
    if (!selectedRoom) return
    try {
      await fetch(`${API_BASE_URL}/sonos/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: selectedRoom, action: playing ? 'pause' : 'play' }),
      })
      setPlaying(!playing)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div style={styles.screen}>
        <div style={styles.loading}>
          <div style={styles.spinner}>🎵</div>
          <div style={styles.loadingText}>Lade Musik...</div>
        </div>
      </div>
    )
  }

  // Artist-Detail: Albums anzeigen
  if (selectedArtist) {
    const artistAlbums = media.filter(m => (m.artist || 'Unbekannt') === selectedArtist)
    
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={() => setSelectedArtist(null)}>
            ← Zurück
          </button>
          <div style={styles.headerTitle}>{selectedArtist}</div>
          {selectedRoom && (
            <div style={styles.roomBadge}>
              {roomIcons[selectedRoom]} {selectedRoom}
            </div>
          )}
        </div>
        
        <div style={styles.grid}>
          {artistAlbums.map((album, idx) => (
            <button
              key={album.id}
              style={{ ...styles.card, background: colors[idx % colors.length] }}
              onClick={() => setSelectedAlbum(album)}
            >
              <img src={album.coverUrl} alt={album.title} style={styles.cover} />
              <div style={styles.cardTitle}>{album.title}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Album-Detail: Play-Button
  if (selectedAlbum) {
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={() => setSelectedAlbum(null)}>
            ← Zurück
          </button>
          <div style={styles.headerTitle}>{selectedAlbum.title}</div>
        </div>
        
        <div style={styles.albumDetail}>
          <img src={selectedAlbum.coverUrl} alt={selectedAlbum.title} style={styles.albumCover} />
          
          <div style={styles.albumInfo}>
            <h2 style={styles.albumTitle}>{selectedAlbum.title}</h2>
            {selectedAlbum.artist && <div style={styles.albumArtist}>{selectedAlbum.artist}</div>}
            
            <button
              style={styles.playButtonHuge}
              onClick={async () => {
                await playAlbum(selectedAlbum)
                setSelectedAlbum(null)
              }}
              disabled={busy}
            >
              <div style={{ fontSize: '64px' }}>▶</div>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>ABSPIELEN</div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Artist-Liste (Hauptansicht)
  const artistMap = new Map<string, MediaItem[]>()
  media.forEach(album => {
    const name = album.artist || 'Unbekannt'
    if (!artistMap.has(name)) artistMap.set(name, [])
    artistMap.get(name)!.push(album)
  })

  const artists = Array.from(artistMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, albums]) => ({ 
      name, 
      cover: albums[0].artistImageUrl || albums[0].coverUrl 
    }))

  return (
    <div style={styles.screen}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>🎵 Musik</div>
        
        {currentTrack && (
          <button style={styles.nowPlaying} onClick={() => setPlayerOpen(!playerOpen)}>
            ♫ {currentTrack.title}
          </button>
        )}
        
        {selectedRoom && (
          <div style={styles.roomBadge}>
            {roomIcons[selectedRoom]} {selectedRoom}
          </div>
        )}
      </div>

      {/* Mini-Player */}
      {playerOpen && (
        <div style={styles.miniPlayer}>
          <button style={styles.controlButton} onClick={togglePlayPause}>
            {playing ? '⏸' : '▶'}
          </button>
          <div style={styles.trackInfo}>
            <div style={{ fontWeight: 600 }}>{currentTrack?.title || 'Keine Wiedergabe'}</div>
            <div style={{ fontSize: '14px', opacity: 0.8 }}>{currentTrack?.artist || ''}</div>
          </div>
          <div style={styles.volumeDisplay}>🔊 {volume}</div>
        </div>
      )}

      {/* Artist Grid */}
      <div style={styles.grid}>
        {artists.map((artist, idx) => (
          <button
            key={artist.name}
            style={{ ...styles.card, background: colors[idx % colors.length] }}
            onClick={() => setSelectedArtist(artist.name)}
          >
            <img src={artist.cover} alt={artist.name} style={styles.cover} />
            <div style={styles.cardTitle}>{artist.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
    minHeight: '100vh',
    width: '100vw',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Fredoka, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'white',
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
  },
  headerTitle: {
    flex: 1,
    fontSize: '24px',
    fontWeight: 600,
    color: 'white',
    textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  nowPlaying: {
    flex: 1,
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.25)',
    border: 'none',
    borderRadius: '20px',
    color: 'white',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  roomBadge: {
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '20px',
    color: 'white',
    fontSize: '18px',
    fontWeight: 600,
    textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
    whiteSpace: 'nowrap',
  },
  backButton: {
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.3)',
    border: 'none',
    borderRadius: '25px',
    color: 'white',
    fontSize: '18px',
    fontWeight: 600,
    cursor: 'pointer',
    textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
  },
  miniPlayer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    borderBottom: '2px solid rgba(255, 255, 255, 0.15)',
  },
  controlButton: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  trackInfo: {
    flex: 1,
    color: 'white',
    textAlign: 'left',
  },
  volumeDisplay: {
    color: 'white',
    fontSize: '18px',
    fontWeight: 600,
  },
  grid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '16px',
    padding: '16px',
    overflowY: 'auto',
    alignContent: 'start',
  },
  card: {
    border: 'none',
    borderRadius: '20px',
    padding: '12px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  cover: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: '16px',
    objectFit: 'cover',
    border: '4px solid white',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  cardTitle: {
    color: 'white',
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center',
    textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
  },
  albumDetail: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '40px',
    padding: '20px',
  },
  albumCover: {
    width: '320px',
    height: '320px',
    borderRadius: '24px',
    objectFit: 'cover',
    border: '8px solid white',
    boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
  },
  albumInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    alignItems: 'center',
  },
  albumTitle: {
    color: 'white',
    fontSize: '36px',
    fontWeight: 700,
    textAlign: 'center',
    textShadow: '2px 2px 6px rgba(0,0,0,0.3)',
    margin: 0,
  },
  albumArtist: {
    color: 'white',
    fontSize: '24px',
    fontWeight: 500,
    textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
  },
  playButtonHuge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    border: '8px solid white',
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 8px 30px rgba(67, 233, 123, 0.5)',
    animation: 'pulse 2s ease-in-out infinite',
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
  },
  loading: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
  },
  spinner: {
    fontSize: '80px',
    animation: 'spin 2s linear infinite',
  },
  loadingText: {
    color: 'white',
    fontSize: '28px',
    fontWeight: 600,
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
  },
  adminRedirect: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '40px',
    textAlign: 'center',
  },
}

export default App
