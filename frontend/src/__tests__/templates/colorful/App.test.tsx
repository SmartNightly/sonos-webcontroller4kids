import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from '../../../templates/colorful/App'
import { mockMediaDefault, createMockFetch } from '../../helpers/fixtures'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(createMockFetch()))
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
    expect(beatlesImg).toHaveAttribute('src', mockMediaDefault[0].coverUrl)
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
    const user = userEvent.setup()
    render(<App isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByText('The Beatles')).toBeInTheDocument()
    })

    await user.click(screen.getByText('The Beatles'))
    await waitFor(() => {
      // Artist name appears in the header
      expect(screen.getAllByText('The Beatles').length).toBeGreaterThan(0)
    })

    // Abbey Road album card should be visible
    expect(screen.getByAltText('Abbey Road')).toBeInTheDocument()
  })
})
