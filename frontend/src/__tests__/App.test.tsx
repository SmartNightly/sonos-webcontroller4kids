import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from '../App'
import { createMockFetch } from './helpers/fixtures'
import { THEME_STORAGE_KEY } from '../themeSettings'

vi.mock('../templates/default/App', () => ({
  default: () => <div>Default template</div>,
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('App (template loader)', () => {
  it('loads Classic from the saved template setting', async () => {
    vi.mocked(fetch).mockImplementation(
      createMockFetch({
        config: {
          activeTemplate: 'classic',
          rooms: [],
          enabledRooms: [],
        },
      }),
    )
    render(<App />)
    expect(await screen.findByText('The Beatles')).toBeInTheDocument()
    expect(screen.getByText('v1.1.0-test')).toBeInTheDocument()
    expect(screen.queryByText('Default template')).not.toBeInTheDocument()
  })

  it.each(['hoerinsel', 'wolkenklang'])(
    'opens the isolated %s preview without contacting the backend',
    async (template) => {
      window.history.replaceState({}, '', `/?template=${template}&demo=1`)
      render(<App />)
      expect(
        await screen.findByRole('heading', { name: 'Was möchtest du hören?' }),
      ).toBeInTheDocument()
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it('uses the default template when the configured template is unknown', async () => {
    vi.mocked(fetch).mockImplementation(createMockFetch({ config: { activeTemplate: 'missing' } }))
    render(<App />)
    expect(await screen.findByText('Default')).toBeInTheDocument()
  })

  it('shows loading state while fetching template config', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    render(<App />)
    expect(screen.getByText('Lade Template...')).toBeInTheDocument()
  })

  it('falls back gracefully when fetch fails', async () => {
    // /admin/sonos fails — component catches and sets activeTemplate to 'default'
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    render(<App />)
    // Still shows loading initially
    expect(screen.getByText('Lade Template...')).toBeInTheDocument()
    expect(await screen.findByText('Default')).toBeInTheDocument()
  })

  it('reads admin flag from URL query parameter', () => {
    // When ?admin=1 is present, isAdmin is set to true and passed to the template
    const original = window.location
    Object.defineProperty(window, 'location', {
      value: { ...original, search: '?admin=1' },
      writable: true,
      configurable: true,
    })

    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    render(<App />)
    expect(screen.getByText('Lade Template...')).toBeInTheDocument()

    Object.defineProperty(window, 'location', {
      value: original,
      writable: true,
      configurable: true,
    })
  })
})

describe('kids theme cycle', () => {
  const config = {
    activeTemplate: 'hoerinsel',
    enabledTemplates: ['hoerinsel', 'wolkenklang', 'colorful'],
    rooms: ['Kinderzimmer', 'Spielzimmer'],
    enabledRooms: ['Kinderzimmer', 'Spielzimmer'],
  }

  it('cycles and wraps with clicks and keyboard, preserving room and album navigation without POSTs', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockImplementation(createMockFetch({ config }))
    render(<App />)
    await screen.findByRole('button', { name: /Hörinsel: nächstes Theme/ })
    await screen.findByRole('option', { name: 'Spielzimmer' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Raum wählen' }), 'Spielzimmer')
    await user.click(await screen.findByRole('button', { name: /The Beatles/ }))
    await user.click(screen.getByRole('button', { name: /Hörinsel: nächstes Theme/ }))
    expect(screen.getByRole('button', { name: /Wolkenklang: nächstes Theme/ })).toHaveFocus()
    expect(screen.getByRole('combobox', { name: 'Raum wählen' })).toHaveValue('Spielzimmer')
    expect(screen.getByRole('heading', { name: 'The Beatles' })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /Colorful Kids: nächstes Theme/ })).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: /Hörinsel: nächstes Theme/ })).toBeInTheDocument()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('hoerinsel')
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    )
  })

  it('restores a permitted browser preference', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'wolkenklang')
    vi.mocked(fetch).mockImplementation(createMockFetch({ config }))
    render(<App />)
    expect(
      await screen.findByRole('button', { name: /Wolkenklang: nächstes Theme/ }),
    ).toBeInTheDocument()
  })

  it('still switches from a permitted URL when browser storage is unavailable', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/?template=hoerinsel')
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked')
    })
    try {
      vi.mocked(fetch).mockImplementation(createMockFetch({ config }))
      render(<App />)
      await user.click(await screen.findByRole('button', { name: /Hörinsel: nächstes Theme/ }))
      expect(
        screen.getByRole('button', { name: /Wolkenklang: nächstes Theme/ }),
      ).toBeInTheDocument()
      expect(window.location.search).toBe('')
    } finally {
      storage.mockRestore()
    }
  })

  it('includes Classic in the cycle and restores keyboard focus across its separate layout', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockImplementation(
      createMockFetch({ config: { ...config, enabledTemplates: ['hoerinsel', 'classic'] } }),
    )
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Hörinsel: nächstes Theme/ }))
    expect(await screen.findByRole('button', { name: /Classic: nächstes Theme/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('button', { name: /Hörinsel: nächstes Theme/ })).toHaveFocus()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    )
  })

  it('rejects disallowed URL and saved selections and disables switching for one allowed theme', async () => {
    window.history.replaceState({}, '', '/?template=classic')
    localStorage.setItem(THEME_STORAGE_KEY, 'wolkenklang')
    vi.mocked(fetch).mockImplementation(
      createMockFetch({ config: { ...config, enabledTemplates: ['hoerinsel'] } }),
    )
    render(<App />)
    expect(await screen.findByText('Hörinsel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nächstes Theme/ })).not.toBeInTheDocument()
  })

  it('applies revoked permissions when the window regains focus', async () => {
    vi.mocked(fetch).mockImplementation(createMockFetch({ config }))
    render(<App />)
    await screen.findByRole('button', { name: /Hörinsel: nächstes Theme/ })
    vi.mocked(fetch).mockImplementation(
      createMockFetch({
        config: { ...config, activeTemplate: 'colorful', enabledTemplates: ['colorful'] },
      }),
    )
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(screen.getByText('Colorful Kids')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /nächstes Theme/ })).not.toBeInTheDocument()
  })

  it('cycles demo themes without backend requests or saving a real preference', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/?template=wolkenklang&demo=1')
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Wolkenklang: nächstes Theme/ }))
    expect(screen.getByRole('button', { name: /Default: nächstes Theme/ })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})
