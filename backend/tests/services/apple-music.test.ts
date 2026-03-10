import { vi, describe, it, expect, beforeEach } from 'vitest'

import { searchApple, fetchAlbumTracks, searchArtist } from '../../src/services/apple-music'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('searchApple', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('throws when iTunes API returns non-ok status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 })
    await expect(searchApple('test', 'album', 0)).rejects.toThrow('iTunes API returned 403')
  })

  it('returns mapped album results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            kind: 'album',
            collectionName: 'Test Album',
            artistName: 'Test Artist',
            artworkUrl100: 'http://example.com/100x100bb',
            collectionId: 12345,
          },
        ],
      }),
    })
    const results = await searchApple('test', 'album', 0)
    expect(results).toHaveLength(1)
    expect(results[0]?.title).toBe('Test Album')
    expect(results[0]?.artist).toBe('Test Artist')
    expect(results[0]?.kind).toBe('album')
    expect(results[0]?.appleAlbumId).toBe('12345')
    expect(results[0]?.coverUrl).toBe('http://example.com/600x600bb')
  })

  it('maps song results with appleSongId', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            kind: 'song',
            trackName: 'Test Song',
            collectionName: 'Some Album',
            artistName: 'Artist',
            artworkUrl100: '',
            trackId: 99999,
            collectionId: 11111,
          },
        ],
      }),
    })
    const results = await searchApple('test', 'musicTrack', 0)
    expect(results[0]?.kind).toBe('song')
    expect(results[0]?.title).toBe('Test Song')
    expect(results[0]?.appleSongId).toBe('99999')
    expect(results[0]?.appleAlbumId).toBe('11111')
  })

  it('returns empty array when results is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    })
    const results = await searchApple('nothing', 'album', 0)
    expect(results).toEqual([])
  })
})

describe('searchArtist', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('throws when iTunes API returns non-ok status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(searchArtist('Globi')).rejects.toThrow('iTunes API returned 500')
  })

  it('returns mapped artist results with profile image from Apple Music page', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              artistId: 123456,
              artistName: 'Globi',
              artistLinkUrl: 'https://music.apple.com/ch/artist/globi/123456?uo=4',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/path/1200x630cw.png">',
      })
    const results = await searchArtist('Globi')
    expect(results).toHaveLength(1)
    expect(results[0]?.artistId).toBe('123456')
    expect(results[0]?.artistName).toBe('Globi')
    expect(results[0]?.artistImageUrl).toBe('https://is1-ssl.mzstatic.com/image/thumb/path/600x600cc.png')
  })

  it('filters out results where Apple Music page has no og:image', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              artistId: 1,
              artistName: 'Artist With Image',
              artistLinkUrl: 'https://music.apple.com/ch/artist/a/1',
            },
            {
              artistId: 2,
              artistName: 'Artist Without Image',
              artistLinkUrl: 'https://music.apple.com/ch/artist/b/2',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<meta property="og:image" content="https://example.com/image/1200x630cw.png">',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<html>no image here</html>',
      })
    const results = await searchArtist('test')
    expect(results).toHaveLength(1)
    expect(results[0]?.artistName).toBe('Artist With Image')
  })

  it('filters out results without artistLinkUrl', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ artistId: 1, artistName: 'No Link Artist' }],
      }),
    })
    const results = await searchArtist('test')
    expect(results).toEqual([])
  })

  it('returns empty array when results is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    })
    const results = await searchArtist('unknown')
    expect(results).toEqual([])
  })

  it('deduplicates results by artistId', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { artistId: 1, artistName: 'Globi', artistLinkUrl: 'https://music.apple.com/ch/artist/globi/1' },
            { artistId: 1, artistName: 'Globi', artistLinkUrl: 'https://music.apple.com/ch/artist/globi/1' },
            { artistId: 2, artistName: 'Pingu', artistLinkUrl: 'https://music.apple.com/ch/artist/pingu/2' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<meta property="og:image" content="https://example.com/a/1200x630cw.png">',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<meta property="og:image" content="https://example.com/c/1200x630cw.png">',
      })
    const results = await searchArtist('test')
    expect(results).toHaveLength(2)
    expect(results[0]?.artistImageUrl).toBe('https://example.com/a/600x600cc.png')
    expect(results[1]?.artistName).toBe('Pingu')
  })
})

describe('fetchAlbumTracks', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('throws when iTunes lookup returns non-ok status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchAlbumTracks('123', 'mediaItem1')).rejects.toThrow(
      'iTunes lookup returned 500',
    )
  })

  it('returns mapped tracks', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 2,
        results: [
          { wrapperType: 'collection', collectionId: 123 },
          {
            wrapperType: 'track',
            trackId: 456,
            trackName: 'Song 1',
            trackNumber: 1,
            trackTimeMillis: 200000,
          },
        ],
      }),
    })
    const tracks = await fetchAlbumTracks('123', 'mediaItem1')
    expect(tracks).toHaveLength(1)
    expect(tracks[0]?.title).toBe('Song 1')
    expect(tracks[0]?.appleSongId).toBe('456')
    expect(tracks[0]?.trackNumber).toBe(1)
    expect(tracks[0]?.durationMs).toBe(200000)
  })

  it('returns empty array when no tracks in results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [{ wrapperType: 'collection', collectionId: 123 }],
      }),
    })
    const tracks = await fetchAlbumTracks('123', 'mediaItem1')
    expect(tracks).toEqual([])
  })
})
