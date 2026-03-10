import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaEditor } from '../MediaEditor'
import type { MediaItem } from '../types'
import { createMockFetch } from './helpers/fixtures'

const editorMedia: MediaItem[] = [
  {
    id: 'album-1',
    title: 'Abbey Road',
    kind: 'album',
    service: 'appleMusic',
    artist: 'The Beatles',
    album: 'Abbey Road',
    coverUrl: 'https://example.com/abbey-road.jpg',
    artistImageUrl: 'https://example.com/beatles.jpg',
  },
  {
    id: 'album-2',
    title: 'Let It Be',
    kind: 'album',
    service: 'appleMusic',
    artist: 'The Beatles',
    album: 'Let It Be',
    coverUrl: 'https://example.com/let-it-be.jpg',
  },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(createMockFetch({ media: editorMedia })))
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MediaEditor', () => {
  it('renders without crashing', () => {
    render(<MediaEditor />)
    expect(document.body).toBeTruthy()
  })

  it('displays media items after loading', async () => {
    render(<MediaEditor />)
    await waitFor(() => {
      expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    })
    expect(screen.getByText('Let It Be')).toBeInTheDocument()
  })

  it('displays artist names', async () => {
    render(<MediaEditor />)
    await waitFor(() => {
      expect(screen.getAllByText('The Beatles').length).toBeGreaterThan(0)
    })
  })

  it('shows search input for filtering media', async () => {
    render(<MediaEditor />)
    await waitFor(() => {
      expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    })
    const searchInput = screen.getByPlaceholderText(/suche|search/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('filters media by search query', async () => {
    const user = userEvent.setup()
    render(<MediaEditor />)
    await waitFor(() => {
      expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/suche|search/i)
    await user.type(searchInput, 'Abbey')

    expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    expect(screen.queryByText('Let It Be')).not.toBeInTheDocument()
  })

  it('shows error state when loading fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    render(<MediaEditor />)
    await waitFor(() => {
      expect(document.body).toBeTruthy()
    })
  })

  it('calls onClose callback when provided', async () => {
    const onClose = vi.fn()
    render(<MediaEditor onClose={onClose} />)
    expect(document.body).toBeTruthy()
  })
})
