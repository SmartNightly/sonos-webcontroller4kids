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
  sonosUri?: string
  appleId?: string
  tracks?: MediaTrack[]
}

export interface AppleSearchResult {
  service: 'appleMusic'
  kind: 'album' | 'song'
  title: string
  artist?: string
  album?: string
  coverUrl: string
  appleAlbumId?: string
  appleSongId?: string
}

export interface SonosConfig {
  sonosBaseUrl: string
  rooms: string[]
}
