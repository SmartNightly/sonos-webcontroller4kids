export interface MediaTrack {
  id: string
  title: string
  appleSongId: string
  trackNumber?: number
  durationMs?: number
}

export interface MediaItem {
  id: string
  title: string
  kind: string // 'album' | 'favorite' | 'other' | ...
  service: string // 'appleMusic' | 'spotify' | ...
  artist?: string
  album?: string
  coverUrl: string
  artistImageUrl?: string // Artist-Bild von Apple Music
  sonosUri?: string
  appleId?: string
  appleArtistId?: string // Apple Music Artist ID
  tracks?: MediaTrack[]
}

export interface AppleSearchResult {
  service: 'appleMusic'
  kind: 'album' | 'song'
  title: string
  artist?: string
  album?: string
  coverUrl: string
  artistImageUrl?: string
  appleAlbumId?: string
  appleSongId?: string
  appleArtistId?: string
}

export interface SonosConfig {
  sonosBaseUrl: string
  rooms: string[]
}
