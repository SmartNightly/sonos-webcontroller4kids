import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../templates/hoerinsel/App'
import { createMockFetch, mockMediaDefault } from '../../helpers/fixtures'

vi.mock('../../../templates/default/App', () => ({
  default: () => <p>Gemeinsamer Elternbereich</p>,
}))
const media = [
  {
    ...mockMediaDefault[0],
    tracks: [
      { id: 'one', title: 'Come Together', appleSongId: 'song-1' },
      { id: 'two', title: 'Something', appleSongId: 'song-2' },
    ],
  },
  mockMediaDefault[1],
]
const config = {
  rooms: ['Kinderzimmer', 'Büro'],
  enabledRooms: ['Kinderzimmer', 'Büro'],
  defaultRoom: 'Kinderzimmer',
  maxVolume: { Kinderzimmer: 30 },
  showShuffleRepeat: false,
}
beforeEach(() => {
  window.history.replaceState({}, '', '/')
  vi.stubGlobal('fetch', vi.fn().mockImplementation(createMockFetch({ media, config })))
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})
async function openAlbum() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /The Beatles/ }))
  await user.click(screen.getByRole('button', { name: 'Abbey Road' }))
  return user
}
describe('Hörinsel', () => {
  it('plays the selected album and keeps accessible controls available', async () => {
    render(<App isAdmin={false} />)
    const user = await openAlbum()
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/play$/),
      expect.objectContaining({ body: JSON.stringify({ id: 'album-1', room: 'Kinderzimmer' }) }),
    )
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(await screen.findByRole('button', { name: 'Wiedergabe fortsetzen' })).toBeEnabled()
  })
  it('reports a failed play request without claiming playback started', async () => {
    const mock = createMockFetch({ media, config })
    vi.mocked(fetch).mockImplementation((url) =>
      String(url).endsWith('/play')
        ? Promise.resolve({ ok: false, json: async () => ({ error: 'offline' }) } as Response)
        : mock(url),
    )
    render(<App isAdmin={false} />)
    const user = await openAlbum()
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Prüfe die Verbindung')
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeEnabled()
  })
  it('serializes commands and disables room changes during playback requests', async () => {
    let finish!: (r: Response) => void
    const mock = createMockFetch({ media, config })
    vi.mocked(fetch).mockImplementation((url) =>
      String(url).endsWith('/play')
        ? new Promise((resolve) => {
            finish = resolve
          })
        : mock(url),
    )
    render(<App isAdmin={false} />)
    const user = await openAlbum()
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(screen.getByRole('combobox', { name: 'Raum wählen' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Einen Moment…' })).toBeDisabled()
    await act(async () => finish({ ok: true, json: async () => ({}) } as Response))
    expect(screen.getByRole('combobox')).toBeEnabled()
  })
  it('honors empty enabledRooms and avoids polling or playback', async () => {
    vi.mocked(fetch).mockImplementation(
      createMockFetch({ media, config: { ...config, enabledRooms: [] } }),
    )
    render(<App isAdmin={false} />)
    await openAlbum()
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeDisabled()
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/sonos/status'))).toBe(
      false,
    )
  })
  it('honors the volume limit and switches only the local listening room', async () => {
    vi.mocked(fetch).mockImplementation(
      createMockFetch({
        media,
        config,
        status: { available: true, state: 'paused', volume: 30, track: { title: 'Old room' } },
      }),
    )
    render(<App isAdmin={false} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Leiser' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Lauter' })).toBeDisabled()
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'Büro')
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('room=B%C3%BCro'),
        expect.anything(),
      ),
    )
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    )
  })
  it('supports individual tracks and next-track navigation', async () => {
    render(<App isAdmin={false} />)
    const user = await openAlbum()
    await user.click(screen.getByRole('button', { name: /Come Together/ }))
    await user.click(screen.getByRole('button', { name: 'Nächster Titel' }))
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/play$/),
      expect.objectContaining({
        body: JSON.stringify({ id: 'album-1', room: 'Kinderzimmer', trackAppleSongId: 'song-2' }),
      }),
    )
    expect(screen.getByRole('button', { name: 'Nächster Titel' })).toBeDisabled()
  })
  it('hides tracks and optional controls according to parent settings', async () => {
    vi.mocked(fetch).mockImplementation(
      createMockFetch({ media, config: { ...config, showTracklistAlbums: false } }),
    )
    render(<App isAdmin={false} />)
    await openAlbum()
    expect(screen.queryByRole('list', { name: 'Einzelne Titel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zufall' })).not.toBeInTheDocument()
  })
  it('opens the shared admin without switching the global theme', async () => {
    render(<App isAdmin />)
    expect(await screen.findByText('Gemeinsamer Elternbereich')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps demo playback and room selection completely isolated', async () => {
    window.history.replaceState({}, '', '/?template=hoerinsel&demo=1')
    render(<App isAdmin={false} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Globi/ }))
    await user.click(screen.getByRole('button', { name: 'Globi bei der Feuerwehr' }))
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await user.click(screen.getByRole('button', { name: 'Lauter' }))
    await user.selectOptions(screen.getByRole('combobox'), 'Spielzimmer')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('offers retry when loading fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    render(<App isAdmin={false} />)
    await screen.findByRole('alert')
    vi.mocked(fetch).mockImplementation(createMockFetch({ media, config }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('button', { name: /The Beatles/ })).toBeInTheDocument()
  })
})
