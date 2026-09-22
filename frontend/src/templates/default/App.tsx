import { useEffect, useState } from 'react'
import type { MediaItem, AppleSearchResult } from '../../types'
import { MediaEditor } from '../../MediaEditor'
import KidsView from '../../components/KidsView'
import { API_BASE_URL } from '../../api'
import './App.css'
import { Dialog } from '../../components/Dialog'
import '../../components/admin.css'

function App({ isAdmin }: { isAdmin: boolean }) {
  const demo = new URLSearchParams(window.location.search).get('demo') === '1'
  if (isAdmin && !demo) return <AdminView />
  return <KidsView demo={demo} theme="default" />
}

/* ==================== Template Selector Component ==================== */

function TemplateSelector() {
  const [templates, setTemplates] = useState<string[]>([])
  const [enabledTemplates, setEnabledTemplates] = useState<string[]>([])
  const [activeTemplate, setActiveTemplate] = useState<string>('default')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/templates`)
        if (!res.ok) return
        const data = await res.json()
        setTemplates(data.templates || [])
        setActiveTemplate(data.active || 'default')
        setEnabledTemplates(data.enabled ?? [data.active || 'default'])
      } catch (err) {
        console.error('Konnte Templates nicht laden:', err)
      }
    }
    void loadTemplates()
  }, [])

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
      setEnabledTemplates((current) => [...new Set([...current, template])])
      setMessage({
        type: 'success',
        text: `Standard-Template "${template}" aktiviert und für Kinder freigegeben.`,
      })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Fehler beim Wechseln des Templates' })
    } finally {
      setLoading(false)
    }
  }

  const saveEnabledTemplates = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/templates/enabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabledTemplates: templates.filter((name) => enabledTemplates.includes(name)),
        }),
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      const data = await res.json()
      setEnabledTemplates(data.enabled)
      setActiveTemplate(data.active)
      setMessage({ type: 'success', text: 'Theme-Freigaben gespeichert.' })
    } catch {
      setMessage({ type: 'error', text: 'Theme-Freigaben konnten nicht gespeichert werden.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>Design der Kinderansicht</div>
      <div className="ui-admin-help" style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 12 }}>
        Standard-Theme für neue Browser. Die Kinder wechseln durch Tippen auf den Theme-Namen durch
        die unten freigegebenen Designs. Ihre Auswahl bleibt auf diesem Gerät gespeichert.
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
              backgroundColor: template === activeTemplate ? '#2e7d32' : '#333',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
            onClick={() => !loading && switchTemplate(template)}
            disabled={loading}
          >
            {template === activeTemplate && '✓ '}
            {{
              default: 'Default',
              classic: 'Classic (Original)',
              colorful: 'Colorful Kids',
              hoerinsel: 'Hörinsel',
              wolkenklang: 'Wolkenklang (Pink & Lila)',
            }[template] ?? template}
          </button>
        ))}
      </div>

      <fieldset
        disabled={loading}
        style={{ marginTop: 16, border: '1px solid #777', borderRadius: 8 }}
      >
        <legend>Für Kinder freigegebene Themes</legend>
        <p className="ui-admin-help">
          Mindestens eines auswählen. Wird das Standard-Theme abgewählt, wird das erste freigegebene
          Theme zum Standard.
        </p>
        {templates.map((template) => (
          <label
            key={template}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={enabledTemplates.includes(template)}
              onChange={(event) =>
                setEnabledTemplates((current) =>
                  event.target.checked
                    ? [...current, template]
                    : current.filter((name) => name !== template),
                )
              }
            />
            {{
              default: 'Default',
              classic: 'Classic (Original)',
              colorful: 'Colorful Kids',
              hoerinsel: 'Hörinsel',
              wolkenklang: 'Wolkenklang (Pink & Lila)',
            }[template] ?? template}
          </label>
        ))}
        <button
          type="button"
          disabled={loading || !enabledTemplates.length}
          onClick={() => void saveEnabledTemplates()}
          style={{ minHeight: 44, marginTop: 8 }}
        >
          Theme-Freigaben speichern
        </button>
      </fieldset>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 6,
            backgroundColor: message.type === 'success' ? '#246b38' : '#96301f',
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
    <Dialog title={`Künstlerbild für ${artistName} auswählen`} onClose={onSkip}>
      <div
        style={{
          backgroundColor: '#222',
          borderRadius: 12,
          padding: 20,
          width: '100%',
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
            aria-label="Schließen"
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaa',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
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
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                }}
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
    </Dialog>
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

    const id = entity === 'album' ? `album_${baseId}` : `song_${baseId}`

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
    <div className="ui-admin" style={styles.screen}>
      {/* Tab Navigation */}
      <nav className="ui-admin-tabs" aria-label="Elternbereich">
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
          Medien verwalten
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
      </nav>

      {/* Settings Tab (formerly Sonos) */}
      {tab === 'settings' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h1 style={styles.title}>Einstellungen</h1>

          {/* Sonos-Konfiguration */}
          <div style={{ marginBottom: 10, padding: 6, backgroundColor: '#222', borderRadius: 8 }}>
            <div style={{ fontSize: '0.9rem', marginBottom: 4 }}>Sonos-Konfiguration</div>
            <div className="ui-admin-form" style={{ marginBottom: 4 }}>
              <input
                style={styles.input}
                aria-label="Adresse der Sonos-Steuerung"
                value={sonosBaseUrl}
                onChange={(e) => setSonosBaseUrl(e.target.value)}
                placeholder="http://192.168.114.21:5005"
              />
              <button style={styles.button} onClick={discoverSonosRooms} disabled={sonosLoading}>
                {sonosLoading ? 'Lade…' : 'Räume laden & speichern'}
              </button>
            </div>
            {sonosError && (
              <div style={{ color: '#ffaaaa', fontSize: '0.8rem', marginBottom: 4 }}>
                {sonosError}
              </div>
            )}

            {/* Dual-List: Links alle Räume, rechts aktive Räume */}
            <div className="ui-admin-room-lists" style={{ marginTop: 4 }}>
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
                  Für Kinder freigegebene Räume
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
                  Zufall und Wiederholung im Player anzeigen
                </span>
              </label>
              <div
                className="ui-admin-help"
                style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 4, marginLeft: 24 }}
              >
                Für kleine Kinder kann es verwirrend sein, diese Optionen zu sehen.
              </div>
            </div>

            {/* Tracklist Display Settings */}
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
              <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>Trackliste anzeigen</div>
              <div
                className="ui-admin-help"
                style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 12 }}
              >
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
              <div
                className="ui-admin-help"
                style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 8 }}
              >
                Füge jedem Raum ein Emoji/Symbol hinzu, damit Kinder die Räume leichter erkennen.
              </div>
              {sonosRooms.map((room) => (
                <div
                  key={room}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
                >
                  <input
                    type="text"
                    aria-label={`Symbol für ${room}`}
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
              <div
                className="ui-admin-help"
                style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 8 }}
              >
                Begrenzt die Lautstärke für diesen Raum (0–100). Ein leeres Feld erlaubt die volle
                Lautstärke.
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
                    aria-label={`Maximale Lautstärke für ${room}`}
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
          <h1 style={styles.title}>Musik und Geschichten hinzufügen</h1>

          <div className="ui-admin-form" style={{ marginBottom: 8 }}>
            <input
              style={styles.input}
              aria-label="Titel, Interpret oder Album suchen"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Titel, Interpret, Album…"
            />
            <select
              style={styles.select}
              aria-label="Suchtyp"
              value={entity}
              onChange={(e) => setEntity(e.target.value as 'album' | 'song')}
            >
              <option value="album">Album</option>
              <option value="song">Song</option>
            </select>
            <select
              style={styles.select}
              aria-label="Importieren als"
              value={importKind}
              onChange={(e) => setImportKind(e.target.value as 'album' | 'audiobook')}
            >
              <option value="album">Als Album</option>
              <option value="audiobook">Als Hörbuch</option>
            </select>
            <button style={styles.button} onClick={() => search()} disabled={loading}>
              Suchen
            </button>
          </div>

          {loading && <div>Lade Suchergebnisse…</div>}
          {error && <div style={{ color: '#ffaaaa', marginBottom: 4 }}>{error}</div>}
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
    height: '100dvh',
    margin: 0,
    padding: '8px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  title: {
    fontSize: '1.5rem',
    margin: '0 0 8px 0',
    textAlign: 'center',
    userSelect: 'none',
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
    borderBottom: '2px solid #0a0',
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
