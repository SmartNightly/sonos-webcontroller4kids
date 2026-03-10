import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from '../../../templates/colorful/App'
import type { MediaItem } from '../../../types'

const mockMedia: MediaItem[] = [
  {
    id: 'album-1',
    title: 'Abbey Road',
    kind: 'album',
    service: 'appleMusic',
    artist: 'The Beatles',
    coverUrl: 'https://example.com/abbey-road.jpg',
    // No artistImageUrl — should use square album cover
  },
  {
    id: 'album-2',
    title: 'Thriller',
    kind: 'album',
    service: 'appleMusic',
    artist: 'Michael Jackson',
    coverUrl: 'https://example.com/thriller.jpg',
    artistImageUrl: 'https://example.com/mj-artist.jpg', // circular artist photo
  },
]

const mockConfig = {
  rooms: ['Kinderzimmer'],
  enabledRooms: ['Kinderzimmer'],
  roomIcons: { Kinderzimmer: '🎸' },
}

const mockStatus = { state: 'stopped', volume: 50 }

function mockFetch(url: RequestInfo | URL): Promise<Response> {
  const urlStr = String(url)
  if (urlStr.includes('/media')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMedia) } as Response)
  }
  if (urlStr.includes('/admin/sonos')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfig) } as Response)
  }
  if (urlStr.includes('/sonos/status')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStatus) } as Response)
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(mockFetch))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Colorful Template - App', () => {
  it('shows admin redirect when isAdmin=true', () => {
    render(<App isAdmin={true} />)
    expect(screen.getByText(/Admin-Modus nur im Default-Template/)).toBeInTheDocument()
    expect(screen.getByText(/Zum Admin wechseln/)).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    // Never-resolving fetch → stays in loading state
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    render(<App isAdmin={false} />)
    expect(screen.getByText('Lade Musik...')).toBeInTheDocument()
  })

  it('renders artist grid after data loads', async () => {
    render(<App isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByText('The Beatles')).toBeInTheDocument()
    })
    expect(screen.getByText('Michael Jackson')).toBeInTheDocument()
  })

  it('uses circular image style for artist with artistImageUrl', async () => {
    render(<App isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByText('Michael Jackson')).toBeInTheDocument()
    })

    // Michael Jackson has artistImageUrl — should use the artist photo
    const mjImg = screen.getByAltText('Michael Jackson')
    expect(mjImg).toHaveAttribute('src', 'https://example.com/mj-artist.jpg')
    // coverCircle style has borderRadius: '50%'
    expect(mjImg).toHaveStyle({ borderRadius: '50%' })
  })

  it('falls back to album cover and uses square style when no artistImageUrl', async () => {
    render(<App isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByText('The Beatles')).toBeInTheDocument()
    })

    // Beatles has no artistImageUrl — should use album cover (square)
    const beatlesImg = screen.getByAltText('The Beatles')
    expect(beatlesImg).toHaveAttribute('src', 'https://example.com/abbey-road.jpg')
    // cover style has borderRadius: '16px'
    expect(beatlesImg).toHaveStyle({ borderRadius: '16px' })
  })

  it('navigates to artist albums on artist card click', async () => {
    const user = userEvent.setup()
    render(<App isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByText('The Beatles')).toBeInTheDocument()
    })

    await user.click(screen.getByText('The Beatles'))

    // Should show artist's albums
    await waitFor(() => {
      expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    })
    // Back button should appear
    expect(screen.getByText('← Zurück')).toBeInTheDocument()
  })

  it('navigates back to artist grid from artist albums', async () => {
    const user = userEvent.setup()
    render(<App isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByText('The Beatles')).toBeInTheDocument()
    })

    await user.click(screen.getByText('The Beatles'))
    await waitFor(() => {
      expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    })

    await user.click(screen.getByText('← Zurück'))
    await waitFor(() => {
      expect(screen.getByText('The Beatles')).toBeInTheDocument()
    })
  })

  it('shows albums for the selected artist', async () => {
    render(<App isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByText('The Beatles')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('The Beatles'))
    await waitFor(() => {
      // Artist name appears in the header
      expect(screen.getAllByText('The Beatles').length).toBeGreaterThan(0)
    })

    // Abbey Road album card should be visible
    expect(screen.getByAltText('Abbey Road')).toBeInTheDocument()
  })
})
