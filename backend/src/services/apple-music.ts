import type { MediaTrack } from '../types'

export type AppleSearchResult = {
  service: 'appleMusic'
  kind: 'song' | 'album'
  title: string
  artist: string
  album: string
  coverUrl: string
  appleAlbumId?: string
  appleSongId?: string
}

export async function searchApple(
  term: string,
  entity: string,
  offset: number,
): Promise<AppleSearchResult[]> {
  const params = new URLSearchParams({
    term,
    media: 'music',
    entity,
    limit: '100',
    offset: offset.toString(),
    country: 'ch',
  })

  const url = `https://itunes.apple.com/search?${params.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`iTunes API returned ${response.status}`)
  }

  const data = await response.json()

  return (data.results || []).map((item: any): AppleSearchResult => {
    const isSong = item.kind === 'song' || item.wrapperType === 'track'
    const result: AppleSearchResult = {
      service: 'appleMusic',
      kind: isSong ? 'song' : 'album',
      title:
        item.trackName ||
        item.collectionName ||
        item.collectionCensoredName ||
        'Unbekannter Titel',
      artist: item.artistName,
      album: item.collectionName,
      coverUrl: item.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
    }
    if (item.collectionId) result.appleAlbumId = String(item.collectionId)
    if (item.trackId) result.appleSongId = String(item.trackId)
    return result
  })
}

export async function fetchAlbumTracks(
  appleAlbumId: string,
  mediaItemId: string,
): Promise<MediaTrack[]> {
  const params = new URLSearchParams({ id: appleAlbumId, entity: 'song' })
  const url = `https://itunes.apple.com/lookup?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`iTunes lookup returned ${response.status}`)
  }

  const data = await response.json()
  console.log(`iTunes API returned ${data.resultCount} results for album ${appleAlbumId}`)

  const tracks: MediaTrack[] = (data.results || [])
    .filter((r: any) => r.wrapperType === 'track' || r.kind === 'song')
    .map((r: any) => ({
      id: `${mediaItemId}_track_${r.trackId}`,
      title: r.trackName,
      appleSongId: String(r.trackId),
      trackNumber: r.trackNumber,
      durationMs: r.trackTimeMillis,
    }))

  return tracks
}
