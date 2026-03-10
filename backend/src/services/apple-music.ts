import type { MediaTrack } from '../types'

export type ArtistSearchResult = {
  artistId: string
  artistName: string
  artistImageUrl: string
}

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
        item.trackName || item.collectionName || item.collectionCensoredName || 'Unbekannter Titel',
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

export async function searchArtist(query: string): Promise<ArtistSearchResult[]> {
  // iTunes musicArtist entity returns artistLinkUrl (Apple Music page) but no artwork.
  // We fetch each artist's Apple Music page to extract the og:image profile photo.
  const params = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'musicArtist',
    limit: '5',
    country: 'ch',
  })

  const url = `https://itunes.apple.com/search?${params.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`iTunes API returned ${response.status}`)
  }

  const data = await response.json()

  // Deduplicate by artistId
  const seen = new Set<string>()
  const uniqueArtists = (data.results || []).filter((item: any) => {
    if (!item.artistId || !item.artistLinkUrl) return false
    const id = String(item.artistId)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  // Fetch artist profile images in parallel from Apple Music pages
  const results = await Promise.all(
    uniqueArtists.map(async (item: any): Promise<ArtistSearchResult | null> => {
      const artistImageUrl = await fetchArtistPageImage(item.artistLinkUrl)
      if (!artistImageUrl) return null
      return {
        artistId: String(item.artistId),
        artistName: item.artistName,
        artistImageUrl,
      }
    }),
  )

  return results.filter((r): r is ArtistSearchResult => r !== null)
}

async function fetchArtistPageImage(artistPageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(artistPageUrl)
    if (!response.ok) return null
    const html = await response.text()
    const match = html.match(/og:image" content="([^"]+)"/)
    if (!match?.[1]) return null
    // Replace the size suffix (e.g. 1200x630cw) with 600x600cc for a square center-crop
    return match[1].replace(/\/\d+x\d+\w+\.(png|jpg)$/, '/600x600cc.png')
  } catch {
    return null
  }
}
