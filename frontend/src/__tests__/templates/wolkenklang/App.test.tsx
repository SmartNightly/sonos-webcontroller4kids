import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../templates/wolkenklang/App'
import { createMockFetch } from '../../helpers/fixtures'

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  vi.stubGlobal('fetch', vi.fn().mockImplementation(createMockFetch()))
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('Wolkenklang', () => {
  it('uses its own theme and plays the selected album', async () => {
    const user = userEvent.setup()
    const { container } = render(<App isAdmin={false} />)
    expect(container.querySelector('.hi-app')).toHaveAttribute('data-theme', 'wolkenklang')
    expect(screen.getByText('Wolkenklang')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /The Beatles/ }))
    await user.click(screen.getByRole('button', { name: 'Abbey Road' }))
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/play$/),
      expect.objectContaining({ body: JSON.stringify({ id: 'album-1', room: 'Kinderzimmer' }) }),
    )
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeEnabled()
  })

  it('allows demo playback and room changes without any backend requests', async () => {
    window.history.replaceState({}, '', '/?template=wolkenklang&demo=1')
    const user = userEvent.setup()
    render(<App isAdmin={false} />)
    await user.click(await screen.findByRole('button', { name: /Globi/ }))
    await user.click(screen.getByRole('button', { name: 'Globi bei der Feuerwehr' }))
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Raum wählen' }), 'Spielzimmer')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('respects room restrictions and the volume limit', async () => {
    vi.mocked(fetch).mockImplementation(
      createMockFetch({
        config: {
          rooms: ['Kinderzimmer', 'Büro'],
          enabledRooms: ['Kinderzimmer'],
          maxVolume: { Kinderzimmer: 20 },
        },
        status: { state: 'stopped', volume: 20 },
      }),
    )
    render(<App isAdmin={false} />)
    await screen.findByRole('button', { name: /The Beatles/ })
    expect(screen.queryByRole('option', { name: /Büro/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lauter' })).toBeDisabled()
  })

  it('offers the new theme in the shared parent settings without activating it', async () => {
    const mock = createMockFetch()
    vi.mocked(fetch).mockImplementation((url) =>
      String(url).endsWith('/admin/templates')
        ? Promise.resolve({
            ok: true,
            json: async () => ({
              templates: ['classic', 'default', 'colorful', 'hoerinsel', 'wolkenklang'],
              active: 'default',
            }),
          } as Response)
        : mock(url),
    )
    const user = userEvent.setup()
    render(<App isAdmin />)
    await user.click(await screen.findByRole('button', { name: 'Einstellungen' }))
    expect(
      await screen.findByRole('button', { name: 'Wolkenklang (Pink & Lila)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Classic (Original)' })).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    )
  })

  it('saves multiple enabled themes and prevents an empty selection', async () => {
    const mock = createMockFetch()
    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url)
      if (path.endsWith('/admin/templates'))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            templates: ['default', 'hoerinsel', 'wolkenklang'],
            active: 'default',
            enabled: ['default'],
          }),
        } as Response)
      if (path.endsWith('/admin/templates/enabled'))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            enabled: ['hoerinsel', 'wolkenklang'],
            active: 'hoerinsel',
          }),
        } as Response)
      return mock(url)
    })
    const user = userEvent.setup()
    render(<App isAdmin />)
    await user.click(await screen.findByRole('button', { name: 'Einstellungen' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Default' }))
    expect(screen.getByRole('button', { name: 'Theme-Freigaben speichern' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Hörinsel' }))
    await user.click(screen.getByRole('checkbox', { name: 'Wolkenklang (Pink & Lila)' }))
    await user.click(screen.getByRole('button', { name: 'Theme-Freigaben speichern' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Theme-Freigaben gespeichert.')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/admin\/templates\/enabled$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ enabledTemplates: ['hoerinsel', 'wolkenklang'] }),
      }),
    )
    expect(screen.getByRole('button', { name: '✓ Hörinsel' })).toBeInTheDocument()
  })
})
