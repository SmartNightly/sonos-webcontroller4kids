import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from '../../../templates/classic/App'
import { createMockFetch, mockConfig } from '../../helpers/fixtures'

const defaultConfig = {
  ...mockConfig,
  showShuffleRepeat: true,
  showTracklistAlbums: true,
  showTracklistAudiobooks: true,
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(createMockFetch({ config: defaultConfig })))
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
  window.history.replaceState({}, '', '/')
})

describe('Classic Template - App (KidsView)', () => {
  it('never sends requests if an unsupported demo is requested', () => {
    window.history.replaceState({}, '', '/?template=classic&demo=1')
    render(<App isAdmin={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('keinen Demo-Modus')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the original artist-to-album navigation and playback', async () => {
    const user = userEvent.setup()
    render(<App isAdmin={false} />)
    await user.click(await screen.findByText('The Beatles'))
    await user.click(await screen.findByText('Abbey Road'))
    await user.click(await screen.findByText('Abspielen'))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/play$/),
        expect.objectContaining({ body: JSON.stringify({ id: 'album-1', room: 'Kinderzimmer' }) }),
      ),
    )
  })

  it('renders without crashing', async () => {
    render(<App isAdmin={false} />)
    expect(await screen.findByText('The Beatles')).toBeInTheDocument()
  })

  it('shows version badge', async () => {
    render(<App isAdmin={false} />)
    expect(screen.getByText('v1.1.0-test')).toBeInTheDocument()
    await screen.findByText('The Beatles')
  })

  it('renders AdminView when isAdmin=true', async () => {
    const user = userEvent.setup()
    render(<App isAdmin={true} />)
    await user.click(await screen.findByRole('button', { name: 'Medien verwalten' }))
    await screen.findByText('Abbey Road')
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

  it('does not restore all rooms when the enabled selection is empty', async () => {
    vi.mocked(fetch).mockImplementation(
      createMockFetch({ config: { ...defaultConfig, enabledRooms: [] } }),
    )
    render(<App isAdmin={false} />)
    await screen.findByText('The Beatles')
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/sonos/status'))).toBe(
      false,
    )
    expect(screen.queryByText('Kinderzimmer')).not.toBeInTheDocument()
  })
})
