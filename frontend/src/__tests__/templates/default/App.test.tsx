import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from '../../../templates/default/App'
import type { MediaItem } from '../../../types'

const mockMedia: MediaItem[] = [
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

const mockConfig = {
  rooms: ['Kinderzimmer'],
  enabledRooms: ['Kinderzimmer'],
  roomIcons: { Kinderzimmer: '🎸' },
  showShuffleRepeat: true,
  showTracklistAlbums: true,
  showTracklistAudiobooks: true,
}

function mockFetch(url: RequestInfo | URL): Promise<Response> {
  const urlStr = String(url)
  if (urlStr.includes('/media') && !urlStr.includes('/media/')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMedia) } as Response)
  }
  if (urlStr.includes('/admin/sonos')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfig) } as Response)
  }
  if (urlStr.includes('/sonos/status')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ state: 'stopped', volume: 50 }),
    } as Response)
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(mockFetch))
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
  // MediaEditor uses localStorage — provide a mock
  const localStorageMock = (() => {
    const store: Record<string, string> = {}
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k])
      },
    }
  })()
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Default Template - App (KidsView)', () => {
  it('renders without crashing', () => {
    render(<App isAdmin={false} />)
    expect(document.body).toBeTruthy()
  })

  it('shows version badge', () => {
    render(<App isAdmin={false} />)
    expect(screen.getByText('v1.1.0-test')).toBeInTheDocument()
  })

  it('renders AdminView when isAdmin=true', () => {
    render(<App isAdmin={true} />)
    // AdminView renders MediaEditor which starts loading
    expect(document.body).toBeTruthy()
  })

  it('displays media items after loading', async () => {
    render(<App isAdmin={false} />)
    await waitFor(
      () => {
        expect(screen.getByText('The Beatles')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
    expect(screen.getByText('Michael Jackson')).toBeInTheDocument()
  })
})
