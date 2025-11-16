import { useEffect, useState } from 'react'
import type { MediaItem, MediaTrack } from './types'

interface EditModalProps {
  item: MediaItem | null
  track?: MediaTrack | null
  isOpen: boolean
  onClose: () => void
  onSave: (updates: Partial<MediaItem> | Partial<MediaTrack>) => Promise<void>
}

function EditModal({ item, track, isOpen, onClose, onSave }: EditModalProps) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [kind, setKind] = useState('album')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    if (track) {
      setTitle(track.title || '')
      setArtist('')
      setAlbum('')
      setCoverUrl('')
      setKind('album')
    } else if (item) {
      setTitle(item.title || '')
      setArtist(item.artist || '')
      setAlbum(item.album || '')
      setCoverUrl(item.coverUrl || '')
      setKind(item.kind || 'album')
    }
    setError(null)
  }, [isOpen, item, track])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      if (track) {
        await onSave({ title })
      } else if (item) {
        await onSave({ title, artist, album, coverUrl, kind })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Bearbeiten</h2>
          <button
            style={styles.modalClose}
            onClick={onClose}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div style={styles.modalBody}>
          {track ? (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Track-Titel</label>
                <input
                  style={styles.formInput}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Track-Titel"
                />
              </div>
            </>
          ) : (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Titel</label>
                <input
                  style={styles.formInput}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Titel"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Artist</label>
                <input
                  style={styles.formInput}
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                  placeholder="Artist"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Album</label>
                <input
                  style={styles.formInput}
                  value={album}
                  onChange={e => setAlbum(e.target.value)}
                  placeholder="Album"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Cover-URL</label>
                <input
                  style={styles.formInput}
                  value={coverUrl}
                  onChange={e => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Kind</label>
                <select
                  style={styles.formSelect}
                  value={kind}
                  onChange={e => setKind(e.target.value)}
                >
                  <option value="album">Album</option>
                  <option value="audiobook">Audiobook</option>
                  <option value="playlist">Playlist</option>
                </select>
              </div>
            </>
          )}

          {error && <div style={styles.error}>{error}</div>}
        </div>

        <div style={styles.modalFooter}>
          <button
            style={styles.cancelButton}
            onClick={onClose}
            disabled={saving}
          >
            Abbrechen
          </button>
          <button
            style={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteConfirmProps {
  message: string
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}

function DeleteConfirm({ message, isOpen, onCancel, onConfirm }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
      onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Bestätigung</h2>
          <button
            style={styles.modalClose}
            onClick={onCancel}
            disabled={deleting}
          >
            ✕
          </button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.deleteMessage}>{message}</div>
          {error && <div style={styles.error}>{error}</div>}
        </div>

        <div style={styles.modalFooter}>
          <button
            style={styles.cancelButton}
            onClick={onCancel}
            disabled={deleting}
          >
            Abbrechen
          </button>
          <button
            style={styles.deleteButton}
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? 'Lösche…' : 'Löschen'}
          </button>
        </div>
      </div>
    </div>
  )
}

export interface MediaEditorProps {
  onClose?: () => void
}

export function MediaEditor({ onClose }: MediaEditorProps) {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null)

  const [editModal, setEditModal] = useState<{
    isOpen: boolean
    item: MediaItem | null
    track: MediaTrack | null
  }>({
    isOpen: false,
    item: null,
    track: null,
  })

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    type: 'item' | 'track'
    itemId: string
    trackId?: string
  }>({
    isOpen: false,
    type: 'item',
    itemId: '',
  })

  // Medien laden
  useEffect(() => {
    const loadMedia = async () => {
      try {
        const res = await fetch('http://localhost:3001/media')
        if (!res.ok) throw new Error('Fehler beim Laden')
        const data = (await res.json()) as MediaItem[]
        setMedia(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden')
      } finally {
        setLoading(false)
      }
    }

    loadMedia()
  }, [])

  const handleEditItem = (item: MediaItem) => {
    setEditModal({ isOpen: true, item, track: null })
  }

  const handleEditTrack = (item: MediaItem, track: MediaTrack) => {
    setEditModal({ isOpen: true, item, track })
  }

  const handleSaveEdit = async (updates: Partial<MediaItem> | Partial<MediaTrack>) => {
    const { item, track } = editModal

    if (!item) return

    if (track) {
      // Track aktualisieren (nur title)
      const res = await fetch(`http://localhost:3001/media/${item.id}/tracks/${track.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        let message = 'Fehler beim Speichern'
        try {
          const body = await res.json()
          if (body && typeof body.error === 'string') message = body.error
        } catch {
          try {
            const text = await res.text()
            if (text) message = text
          } catch {
            /* ignore secondary parsing errors */
          }
        }
        throw new Error(message)
      }

      // Update lokales state
      setMedia(prev =>
        prev.map(m =>
          m.id === item.id
            ? {
                ...m,
                tracks: m.tracks?.map(t =>
                  t.id === track.id ? { ...t, ...updates } : t,
                ),
              }
            : m,
        ),
      )
      setInfo('Track wurde aktualisiert')
    } else {
      // Item aktualisieren
      const res = await fetch(`http://localhost:3001/media/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        let message = 'Fehler beim Speichern'
        try {
          const body = await res.json()
          if (body && typeof body.error === 'string') message = body.error
        } catch {
          try {
            const text = await res.text()
            if (text) message = text
          } catch {
            /* ignore secondary parsing errors */
          }
        }
        throw new Error(message)
      }

      // Update lokales state
      setMedia(prev =>
        prev.map(m => (m.id === item.id ? { ...m, ...updates } : m)),
      )
      setInfo('Eintrag wurde aktualisiert')
    }

    setTimeout(() => setInfo(null), 2000)
  }

  const handleDeleteItem = (itemId: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'item',
      itemId,
    })
  }

  const handleDeleteTrack = (itemId: string, trackId: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'track',
      itemId,
      trackId,
    })
  }

  const handleConfirmDelete = async () => {
    const { type, itemId, trackId } = deleteConfirm

    if (type === 'item') {
      const res = await fetch(`http://localhost:3001/media/${itemId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Fehler beim Löschen')
      }

      setMedia(prev => prev.filter(m => m.id !== itemId))
      if (expandedAlbumId === itemId) setExpandedAlbumId(null)
      setInfo('Eintrag wurde gelöscht')
    } else if (type === 'track' && trackId) {
      const res = await fetch(`http://localhost:3001/media/${itemId}/tracks/${trackId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Fehler beim Löschen')
      }

      setMedia(prev =>
        prev.map(m =>
          m.id === itemId
            ? { ...m, tracks: m.tracks?.filter(t => t.id !== trackId) }
            : m,
        ),
      )
      setInfo('Track wurde gelöscht')
    }

    setTimeout(() => setInfo(null), 2000)
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>Lade Medien…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorText}>{error}</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Media-Editor</h1>
        {onClose && (
          <button style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {error && <div style={styles.errorText}>{error}</div>}
      {info && <div style={styles.infoText}>{info}</div>}

      {/* Search Field */}
      <div style={{ marginBottom: '8px' }}>
        <input
          type="text"
          placeholder="Suche nach Titel, Artist, Album..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.list}>
        {media.length === 0 ? (
          <div style={styles.emptyText}>Keine Einträge vorhanden</div>
        ) : (
          [...media]
            .filter(item => {
              if (!searchQuery.trim()) return true
              const query = searchQuery.toLowerCase()
              return (
                item.title.toLowerCase().includes(query) ||
                (item.artist && item.artist.toLowerCase().includes(query)) ||
                (item.album && item.album.toLowerCase().includes(query))
              )
            })
            .sort((a, b) => {
              const artistA = (a.artist || '').toLowerCase()
              const artistB = (b.artist || '').toLowerCase()
              return artistA.localeCompare(artistB)
            })
            .map(item => {
            const isExpanded = expandedAlbumId === item.id && item.tracks && item.tracks.length > 0
            const hasNoTracks = !item.tracks || item.tracks.length === 0
            return (
            <div
              key={item.id}
              style={{
                ...styles.itemContainer,
                ...(isExpanded
                  ? {
                      position: 'relative',
                      zIndex: 1000,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
                    }
                  : {}),
              }}
            >
              <div
                style={styles.itemHeader}
                onClick={() =>
                  setExpandedAlbumId(
                    expandedAlbumId === item.id ? null : item.id,
                  )
                }
              >
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  style={styles.itemCover}
                />
                <div style={styles.itemInfo}>
                  <div style={styles.itemTitle}>{item.title}</div>
                  {item.artist && (
                    <div style={styles.itemArtist}>{item.artist}</div>
                  )}
                  <div style={styles.itemMeta}>
                    {item.kind} • {item.service}
                    {item.tracks && item.tracks.length > 0
                      ? ` • ${item.tracks.length} Tracks`
                      : ''}
                  </div>
                  {hasNoTracks && (
                    <div style={styles.warningText}>
                      ⚠️ Keine Tracks vorhanden (Album ist trotzdem abspielbar)
                    </div>
                  )}
                </div>
                <div style={styles.itemActions}>
                  <button
                    style={styles.actionButton}
                    onClick={e => {
                      e.stopPropagation()
                      handleEditItem(item)
                    }}
                  >
                    ✎ Bearbeiten
                  </button>
                  <button
                    style={styles.deleteActionButton}
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteItem(item.id)
                    }}
                  >
                    🗑 Löschen
                  </button>
                </div>
              </div>

              {/* Tracks expandieren */}
              {isExpanded && (
                <div style={{ ...styles.tracksList, position: 'relative', zIndex: 2000 }}>
                  {(item.tracks ?? []).map(track => (
                    <div key={track.id} style={styles.trackItem}>
                      <div style={styles.trackInfo}>
                        <div style={styles.trackNumber}>
                          {track.trackNumber || '•'}
                        </div>
                        <div style={styles.trackTitle}>{track.title}</div>
                      </div>
                      <div style={styles.trackActions}>
                        <button
                          style={styles.actionButton}
                          onClick={() => handleEditTrack(item, track)}
                        >
                          ✎
                        </button>
                        <button
                          style={styles.deleteActionButton}
                          onClick={() => handleDeleteTrack(item.id, track.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )})
        )}
      </div>

      <EditModal
        item={editModal.item}
        track={editModal.track}
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, item: null, track: null })}
        onSave={handleSaveEdit}
      />

      <DeleteConfirm
        message={
          deleteConfirm.type === 'item'
            ? 'Diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
            : 'Diesen Track wirklich löschen?'
        }
        isOpen={deleteConfirm.isOpen}
        onCancel={() => setDeleteConfirm({ isOpen: false, type: 'item', itemId: '' })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
    color: '#fff',
    padding: '8px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '1.2rem',
    margin: 0,
  },
  warningText: {
    fontSize: '0.75rem',
    color: '#ffa500',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '0.9rem',
    backgroundColor: '#222',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '4px',
    boxSizing: 'border-box',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  itemContainer: {
    backgroundColor: '#222',
    borderRadius: '8px',
    minHeight: '76px',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    cursor: 'pointer',
    userSelect: 'none',
    minHeight: '76px',
    height: '76px',
  },
  itemCover: {
    width: '60px',
    height: '60px',
    borderRadius: '4px',
    objectFit: 'cover',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
  },
  itemArtist: {
    fontSize: '0.8rem',
    opacity: 0.8,
  },
  itemMeta: {
    fontSize: '0.7rem',
    opacity: 0.6,
    marginTop: '2px',
  },
  itemActions: {
    display: 'flex',
    gap: '4px',
  },
  actionButton: {
    padding: '4px 8px',
    fontSize: '0.75rem',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#444',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  deleteActionButton: {
    padding: '4px 8px',
    fontSize: '0.75rem',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#c44',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tracksList: {
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #333',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  trackItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    fontSize: '0.85rem',
    minHeight: '32px',
    height: '32px',
  },
  trackInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
  },
  trackNumber: {
    width: '20px',
    opacity: 0.6,
    textAlign: 'center',
  },
  trackTitle: {
    flex: 1,
  },
  trackActions: {
    display: 'flex',
    gap: '2px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modalContent: {
    backgroundColor: '#222',
    borderRadius: '12px',
    padding: '0',
    width: '90vw',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '80vh',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #333',
  },
  modalTitle: {
    fontSize: '1.1rem',
    margin: 0,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '4px',
  },
  modalBody: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
  },
  formGroup: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    marginBottom: '4px',
    opacity: 0.8,
  },
  formInput: {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #444',
    backgroundColor: '#333',
    color: '#fff',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  },
  formSelect: {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #444',
    backgroundColor: '#333',
    color: '#fff',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  },
  modalFooter: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid #333',
  },
  cancelButton: {
    flex: 1,
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#444',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  saveButton: {
    flex: 1,
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0a0',
    color: '#000',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#c44',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  deleteMessage: {
    fontSize: '0.95rem',
    marginBottom: '12px',
  },
  error: {
    color: '#ff8888',
    fontSize: '0.85rem',
    marginTop: '8px',
  },
  errorText: {
    color: '#ff8888',
    padding: '8px',
    textAlign: 'center',
  },
  infoText: {
    color: '#8f8',
    padding: '8px',
    textAlign: 'center',
    fontSize: '0.9rem',
  },
  loadingText: {
    textAlign: 'center',
    padding: '16px',
  },
  emptyText: {
    textAlign: 'center',
    padding: '16px',
    opacity: 0.6,
  },
}

export default MediaEditor
