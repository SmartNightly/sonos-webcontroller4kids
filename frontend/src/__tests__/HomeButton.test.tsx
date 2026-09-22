import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Default from '../templates/default/App'
import Colorful from '../templates/colorful/App'
import Hoerinsel from '../templates/hoerinsel/App'
import Wolkenklang from '../templates/wolkenklang/App'
import Classic from '../templates/classic/App'
import { createMockFetch, mockMediaDefault } from './helpers/fixtures'

const modern = [
  ['Default', Default],
  ['Colorful', Colorful],
  ['Hörinsel', Hoerinsel],
  ['Wolkenklang', Wolkenklang],
] as const
beforeEach(() => {
  window.history.replaceState({}, '', '/')
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      createMockFetch({
        config: {
          rooms: ['Kinderzimmer', 'Spielzimmer'],
          enabledRooms: ['Kinderzimmer', 'Spielzimmer'],
        },
        media: [mockMediaDefault[0], { ...mockMediaDefault[1], kind: 'audiobook' }],
        status: {
          state: 'playing',
          volume: 20,
          track: { title: 'Come Together', artist: 'The Beatles' },
        },
      }),
    ),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('home navigation', () => {
  it.each([...modern, ['Classic', Classic]] as const)(
    '%s goes directly home from albums and details without playback commands',
    async (_, Template) => {
      const user = userEvent.setup()
      render(<Template isAdmin={false} />)
      await user.click(await screen.findByText('The Beatles', { selector: '.hi-card-title, div' }))
      await user.click(screen.getByRole('button', { name: 'Zur Startseite' }))
      expect(screen.getByText('Michael Jackson')).toBeInTheDocument()
      await user.click(screen.getByText('The Beatles', { selector: '.hi-card-title, div' }))
      await user.click(screen.getByRole('button', { name: 'Abbey Road' }))
      expect(screen.getByRole('button', { name: /Abspielen/ })).toBeInTheDocument()
      screen.getByRole('button', { name: 'Zur Startseite' }).focus()
      await user.keyboard('{Enter}')
      expect(screen.getByText('Michael Jackson')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Abspielen/ })).not.toBeInTheDocument()
      expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      )
    },
  )

  it.each(modern)(
    '%s resets the filter, keeps the room, and works while already on the start page',
    async (_, Template) => {
      const user = userEvent.setup()
      const { container } = render(<Template isAdmin={false} />)
      await screen.findByRole('option', { name: 'Spielzimmer' })
      await user.selectOptions(screen.getByRole('combobox', { name: 'Raum wählen' }), 'Spielzimmer')
      await user.click(screen.getByRole('button', { name: 'Musik' }))
      expect(screen.queryByRole('button', { name: /Michael Jackson/ })).not.toBeInTheDocument()
      const main = container.querySelector('main')!
      main.scrollTop = 200
      await user.click(screen.getByRole('button', { name: 'Zur Startseite' }))
      expect(screen.getByRole('button', { name: 'Alles' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /Michael Jackson/ })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Raum wählen' })).toHaveValue('Spielzimmer')
      expect(main.scrollTop).toBe(0)
      expect(screen.getByRole('heading', { name: 'Was möchtest du hören?' })).toHaveFocus()
      await user.click(screen.getByRole('button', { name: 'Zur Startseite' }))
      expect(screen.getByRole('heading', { name: 'Was möchtest du hören?' })).toHaveFocus()
      expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      )
    },
  )
})
