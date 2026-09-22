import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from '../../../templates/colorful/App'
import { createMockFetch } from '../../helpers/fixtures'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(createMockFetch()))
})
afterEach(() => {
  vi.unstubAllGlobals()
})
describe('Colorful Kids', () => {
  it('plays albums and keeps the player on the detail screen', async () => {
    render(<App isAdmin={false} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /The Beatles/ }))
    await user.click(screen.getByRole('button', { name: 'Abbey Road' }))
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/play$/),
      expect.objectContaining({ body: JSON.stringify({ id: 'album-1', room: 'Kinderzimmer' }) }),
    )
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zurück zu den Alben' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })
  it('reports playback failure and keeps the album ready to retry', async () => {
    const mock = createMockFetch()
    vi.mocked(fetch).mockImplementation((url) =>
      String(url).endsWith('/play')
        ? Promise.resolve({ ok: false, json: async () => ({ error: 'offline' }) } as Response)
        : mock(url),
    )
    render(<App isAdmin={false} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /The Beatles/ }))
    await user.click(screen.getByRole('button', { name: 'Abbey Road' }))
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Prüfe die Verbindung')
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })
  it('never falls back to disabled rooms', async () => {
    vi.mocked(fetch).mockImplementation(
      createMockFetch({ config: { rooms: ['Kinderzimmer'], enabledRooms: [] } }),
    )
    render(<App isAdmin={false} />)
    await screen.findByRole('button', { name: /The Beatles/ })
    expect(screen.getByRole('combobox', { name: 'Raum wählen' })).toBeDisabled()
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/sonos/status'))).toBe(
      false,
    )
  })
  it('opens the real parent screen without changing the active theme', async () => {
    render(<App isAdmin />)
    expect(
      await screen.findByRole('heading', { name: 'Musik und Geschichten hinzufügen' }),
    ).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    )
  })
  it('labels filters and offers a way out of an empty category', async () => {
    render(<App isAdmin={false} />)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: /The Beatles/ })
    await user.click(screen.getByRole('button', { name: 'Geschichten' }))
    expect(screen.getByRole('button', { name: 'Geschichten' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Alles anzeigen' }))
    expect(screen.getByRole('button', { name: /The Beatles/ })).toBeInTheDocument()
  })
  it('preserves real artwork and avoids duplicated accessible names', async () => {
    render(<App isAdmin={false} />)
    const card = await screen.findByRole('button', { name: /Michael Jackson/ })
    expect(card).toHaveAccessibleName(/^Michael Jackson\s*1\s*Album$/)
    expect(within(card).getByRole('presentation')).toHaveAttribute(
      'src',
      'https://example.com/mj-artist.jpg',
    )
  })
  it('shows loading feedback while media is pending', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    render(<App isAdmin={false} />)
    await waitFor(() =>
      expect(screen.getByText('Deine Musik und Geschichten werden geladen…')).toBeInTheDocument(),
    )
  })
})
