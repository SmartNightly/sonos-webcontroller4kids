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
    if (!item.artistId) return false
    const id = String(item.artistId)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  // Fetch artist profile images in parallel from Apple Music pages
  const results = await Promise.all(
    uniqueArtists.map(async (item: any): Promise<ArtistSearchResult | null> => {
      const artistImageUrl = await fetchArtistImage(item.artistId)
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

async function fetchArtistImage(artistId: number, countryCode = 'ch'): Promise<string | null> {
  try {
    const url = `https://music.apple.com/${countryCode}/artist/${artistId}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    const html = await response.text()

    // Apple Music pages use either attribute order for og:image
    const match =
      html.match(/<meta property="og:image"\s+content="([^"]+)"/) ||
      html.match(/<meta content="([^"]+)"\s+property="og:image"/)

    if (!match?.[1]) return null

    // Resize to 600x600 center-cropped square
    return match[1].replace(/\/\d+x\d+[a-z]*\.\w+$/, '/600x600cc.png')
  } catch {
    return null
  }
}
