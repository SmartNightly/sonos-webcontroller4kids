import { useLayoutEffect, useRef, useState } from 'react'
import type { MediaItem } from '../types'
import { usePlayer } from '../hooks/useKidsPlayer'
import './KidsView.css'

type IconName =
  | 'play'
  | 'pause'
  | 'back'
  | 'next'
  | 'previous'
  | 'sound'
  | 'music'
  | 'book'
  | 'all'
  | 'minus'
  | 'plus'
  | 'cloud'
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    play: 'M8 5l11 7-11 7Z',
    pause: 'M8 5v14M16 5v14',
    back: 'M15 5l-7 7 7 7',
    next: 'M5 5l11 7-11 7ZM19 5v14',
    previous: 'M19 5L8 12l11 7ZM5 5v14',
    sound: 'M11 5L5 9H2v6h3l6 4ZM15 8q5 4 0 8M18 5q8 7 0 14',
    music: 'M9 18V5l11-2v13M9 5l11-2M9 18c0 4-7 4-7 1s7-4 7-1M20 16c0 4-7 4-7 1s7-4 7-1',
    book: 'M12 5v16M12 5Q7 2 2 4v15q5-2 10 2 5-4 10-2V4q-5-2-10 1Z',
    all: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
    minus: 'M5 12h14',
    plus: 'M5 12h14M12 5v14',
    cloud:
      'M7 18H6a4 4 0 0 1-1-7.9A6 6 0 0 1 16.4 7a4.5 4.5 0 0 1 4.1 6.4M15 13v7c0 2-4 2-4 0s4-2 4 0M15 13l4 1',
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
function Artwork({ src, portrait = false }: { src: string; portrait?: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={`hi-artwork ${portrait ? 'hi-portrait' : ''}`}>
      {failed || !src ? (
        <Icon name="music" />
      ) : (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      )}
    </span>
  )
}
export default function KidsView({
  demo,
  theme = 'hoerinsel',
}: {
  demo: boolean
  theme?: 'default' | 'colorful' | 'hoerinsel' | 'wolkenklang'
}) {
  const p = usePlayer(demo)
  const [artist, setArtist] = useState<string | null>(null)
  const [album, setAlbum] = useState<MediaItem | null>(null)
  const [filter, setFilter] = useState('all')
  const heading = useRef<HTMLHeadingElement>(null)
  const content = useRef<HTMLElement>(null)
  const first = useRef(true)
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    heading.current?.focus()
    if (content.current) content.current.scrollTop = 0
  }, [artist, album])

  const items = p.media.filter((item) => filter === 'all' || item.kind === filter)
  const artists = [...new Set(items.map((item) => item.artist || 'Unbekannt'))].sort((a, b) =>
    a.localeCompare(b, 'de'),
  )
  const artistAlbums = items.filter((item) => (item.artist || 'Unbekannt') === artist)
  const playing = p.status.state?.toLowerCase() === 'playing'
  const unavailable = p.status.available === false
  const disabled = p.busy || !p.room || unavailable
  const showTracks =
    album &&
    (album.kind === 'audiobook'
      ? p.config.showTracklistAudiobooks !== false
      : p.config.showTracklistAlbums !== false)
  const currentAlbum = p.media.find((item) => (item.album || item.title) === p.status.track?.album)
  const cover = currentAlbum?.coverUrl ?? p.lastAlbum?.coverUrl
  const volume = p.status.volume
  const maxVolume = p.room ? (p.config.maxVolume?.[p.room] ?? 100) : 100
  const title = album?.title ?? artist ?? 'Was möchtest du hören?'
  const hasTrack = !!p.status.track?.title

  return (
    <div className="hi-app" data-theme={theme}>
      <a className="hi-skip" href="#hi-main">
        Zur Auswahl springen
      </a>
      <header className="hi-header">
        <div className="hi-brand">
          <span className="hi-brand-icon">
            <Icon name={theme === 'wolkenklang' ? 'cloud' : 'sound'} />
          </span>
          {
            {
              default: 'Musik & Geschichten',
              colorful: 'Musik entdecken',
              hoerinsel: 'Hörinsel',
              wolkenklang: 'Wolkenklang',
            }[theme]
          }
          {demo && <span className="hi-demo">Demo</span>}
        </div>
        <label className="hi-room">
          <span>Hören im</span>
          <select
            aria-label="Raum wählen"
            value={p.room ?? ''}
            disabled={!p.rooms.length || p.busy}
            onChange={(e) => p.selectRoom(e.target.value)}
          >
            {!p.rooms.length && <option value="">Kein Raum freigegeben</option>}
            {p.rooms.map((room) => (
              <option key={room} value={room}>
                {p.config.roomIcons?.[room]} {room}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main id="hi-main" ref={content} className="hi-main" tabIndex={-1}>
        <div className="hi-heading-row">
          {(artist || album) && (
            <button
              className="hi-back"
              aria-label={album ? 'Zurück zu den Alben' : 'Zurück zu den Figuren'}
              onClick={() => (album ? setAlbum(null) : setArtist(null))}
            >
              <Icon name="back" />
              <span>Zurück</span>
            </button>
          )}
          <div>
            <h1 ref={heading} tabIndex={-1}>
              {title}
            </h1>
            {!artist && !album && (
              <p className="hi-subtitle">Deine Lieblingsgeschichten und Musik.</p>
            )}
            {artist && !album && <p className="hi-subtitle">Such dir etwas aus.</p>}
          </div>
          {!artist && !album && (
            <div className="hi-filters" role="group" aria-label="Medien filtern">
              {(
                [
                  ['all', 'Alles', 'all'],
                  ['audiobook', 'Geschichten', 'book'],
                  ['album', 'Musik', 'music'],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  <Icon name={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {demo && <p className="hi-demo-note">Vorschau · Die Lautsprecher bleiben still.</p>}
        {p.error && (
          <div className="hi-notice" role="alert">
            <span>{p.error}</span>
            <button onClick={p.clearError}>Schließen</button>
          </div>
        )}
        {!p.loading && !p.loadError && !p.room && (
          <p className="hi-notice" role="status">
            Noch kein Raum freigegeben. Bitte einen Erwachsenen, einen Raum in den Einstellungen
            auszuwählen.
          </p>
        )}
        {p.loading ? (
          <p className="hi-empty" role="status">
            Deine Musik und Geschichten werden geladen…
          </p>
        ) : p.loadError ? (
          <div className="hi-empty" role="alert">
            <h2>Deine Sammlung ist gerade nicht erreichbar.</h2>
            <p>Prüfe die Verbindung und versuche es noch einmal.</p>
            <button className="hi-primary" onClick={p.retry}>
              Erneut versuchen
            </button>
          </div>
        ) : album ? (
          <section className="hi-detail" aria-label="Album">
            <Artwork key={album.coverUrl} src={album.coverUrl} />
            <div className="hi-detail-info">
              <p className="hi-artist-name">{album.artist}</p>
              <button
                className="hi-primary hi-album-play"
                disabled={p.busy || !p.room}
                onClick={() => void p.play(album)}
              >
                <Icon name="play" />
                {p.busy ? 'Einen Moment…' : 'Abspielen'}
              </button>
              <p className="hi-room-hint">
                {p.room ? `Wiedergabe: ${p.room}` : 'Bitte zuerst einen Raum freigeben.'}
              </p>
              {showTracks && !!album.tracks?.length && (
                <ol className="hi-tracks" aria-label="Einzelne Titel">
                  {album.tracks.map((track, index) => (
                    <li key={track.id}>
                      <button
                        disabled={p.busy || !p.room}
                        onClick={() => void p.play(album, track)}
                      >
                        <span className="hi-track-number">{track.trackNumber ?? index + 1}</span>
                        <span>{track.title}</span>
                        <Icon name="play" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        ) : !items.length ? (
          <div className="hi-empty">
            <Icon name="book" />
            <h2>
              {p.media.length
                ? 'Hier ist es noch ganz still.'
                : 'Deine Sammlung wartet auf Geschichten.'}
            </h2>
            <p>
              {p.media.length
                ? 'Wähle „Alles“, um deine anderen Titel zu sehen.'
                : 'Ein Erwachsener kann im Elternbereich Musik und Geschichten hinzufügen.'}
            </p>
            {p.media.length > 0 && <button onClick={() => setFilter('all')}>Alles anzeigen</button>}
          </div>
        ) : (
          <div className={`hi-grid ${artist ? 'hi-albums' : 'hi-artists'}`}>
            {artist
              ? artistAlbums
                  .sort((a, b) => a.title.localeCompare(b.title, 'de'))
                  .map((item) => (
                    <button className="hi-card" key={item.id} onClick={() => setAlbum(item)}>
                      <Artwork src={item.coverUrl} />
                      <span className="hi-card-title">{item.title}</span>
                    </button>
                  ))
              : artists.map((name) => {
                  const group = items.filter((item) => (item.artist || 'Unbekannt') === name)
                  const image =
                    group.find((item) => item.artistImageUrl)?.artistImageUrl ?? group[0].coverUrl
                  return (
                    <button className="hi-card" key={name} onClick={() => setArtist(name)}>
                      <Artwork src={image} portrait />
                      <span className="hi-card-title">{name}</span>
                      <span className="hi-card-caption">
                        {group.length} {group.length === 1 ? 'Album' : 'Alben'}
                      </span>
                    </button>
                  )
                })}
          </div>
        )}
      </main>
      <footer className="hi-player" aria-label="Wiedergabe" aria-busy={p.busy}>
        <div className="hi-now">
          <div className="hi-now-art">
            {cover ? <Artwork key={cover} src={cover} /> : <Icon name="music" />}
          </div>
          <div>
            <span className="hi-playing-label" role="status">
              {unavailable
                ? 'Lautsprecher nicht erreichbar'
                : playing
                  ? 'Jetzt läuft'
                  : hasTrack
                    ? 'Pausiert'
                    : 'Bereit für deine Auswahl'}
            </span>
            <strong>{p.status.track?.title || 'Eine Geschichte wartet auf dich'}</strong>
            <span className="hi-now-artist">
              {p.status.track?.artist || 'Wähle ein Cover und drücke Abspielen.'}
            </span>
          </div>
        </div>
        <div className="hi-transport">
          <button
            aria-label="Vorheriger Titel"
            disabled={disabled || !hasTrack}
            onClick={() => p.skip(-1)}
          >
            <Icon name="previous" />
          </button>
          <button
            className="hi-play-toggle"
            aria-label={playing ? 'Pause' : 'Wiedergabe fortsetzen'}
            disabled={disabled || !hasTrack}
            onClick={() => void p.control(playing ? 'pause' : 'play')}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button
            aria-label="Nächster Titel"
            disabled={disabled || !hasTrack || p.atLastTrack}
            onClick={() => p.skip(1)}
          >
            <Icon name="next" />
          </button>
        </div>
        <div className="hi-volume">
          <button
            aria-label="Leiser"
            disabled={disabled || volume === undefined || volume <= 0}
            onClick={() => void p.control('volumeDown')}
          >
            <Icon name="minus" />
          </button>
          <span aria-label={`Lautstärke ${volume ?? 'unbekannt'} von maximal ${maxVolume}`}>
            <Icon name="sound" />
            <span>{volume ?? '–'}</span>
          </span>
          <button
            aria-label="Lauter"
            disabled={disabled || volume === undefined || volume >= maxVolume}
            onClick={() => void p.control('volumeUp')}
          >
            <Icon name="plus" />
          </button>
        </div>
        {p.config.showShuffleRepeat !== false && (
          <div className="hi-options">
            <button
              disabled={disabled}
              aria-pressed={!!p.status.shuffle}
              onClick={() => void p.control(p.status.shuffle ? 'shuffleOff' : 'shuffleOn')}
            >
              Zufall
            </button>
            <button
              disabled={disabled}
              aria-pressed={p.status.repeat === 'all' || p.status.repeat === 'one'}
              onClick={() =>
                void p.control(
                  p.status.repeat === 'off' || !p.status.repeat
                    ? 'repeatAll'
                    : p.status.repeat === 'all'
                      ? 'repeatOne'
                      : 'repeatOff',
                )
              }
            >
              Wiederholen{p.status.repeat === 'one' ? ': 1 Titel' : ''}
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
