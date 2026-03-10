import type { MediaItem } from '../../types'

export const mockMediaDefault: MediaItem[] = [
  {
    id: 'album-1',
    title: 'Abbey Road',
    kind: 'album',
    service: 'appleMusic',
    artist: 'The Beatles',
    coverUrl: 'https://example.com/abbey-road.jpg',
  },
  {
    id: 'album-2',
    title: 'Thriller',
    kind: 'album',
    service: 'appleMusic',
    artist: 'Michael Jackson',
    coverUrl: 'https://example.com/thriller.jpg',
    artistImageUrl: 'https://example.com/mj-artist.jpg',
  },
]

export const mockConfig = {
  rooms: ['Kinderzimmer'],
  enabledRooms: ['Kinderzimmer'],
  roomIcons: { Kinderzimmer: '🎸' },
}

export const mockStatus = { state: 'stopped', volume: 50 }

/**
 * Creates a mock fetch function that routes by URL pattern.
 * Pass `overrides` to customize the response data per endpoint.
 */
export function createMockFetch(overrides?: {
  media?: unknown
  config?: unknown
  status?: unknown
}) {
  const mediaData = overrides?.media ?? mockMediaDefault
  const configData = overrides?.config ?? mockConfig
  const statusData = overrides?.status ?? mockStatus

  return function mockFetch(url: RequestInfo | URL): Promise<Response> {
    const urlStr = String(url)
    if (urlStr.includes('/media') && !urlStr.includes('/media/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mediaData) } as Response)
    }
    if (urlStr.includes('/admin/sonos')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(configData) } as Response)
    }
    if (urlStr.includes('/sonos/status')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(statusData) } as Response)
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
  }
}
