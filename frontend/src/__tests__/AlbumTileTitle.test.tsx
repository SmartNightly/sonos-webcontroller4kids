import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Default from '../templates/default/App'
import Colorful from '../templates/colorful/App'
import Hoerinsel from '../templates/hoerinsel/App'
import Wolkenklang from '../templates/wolkenklang/App'
import Classic from '../templates/classic/App'
import { createMockFetch, mockMediaDefault } from './helpers/fixtures'

const titles = [
  'Kurz',
  'Eine Geschichte über Freundschaft',
  'Eine ganz besonders lange Geschichte über Freundschaft und spannende Abenteuer im verwunschenen Zauberwald',
]
const media = titles.map((title, index) => ({
  ...mockMediaDefault[0],
  id: `title-${index}`,
  title,
}))

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  vi.stubGlobal('fetch', vi.fn().mockImplementation(createMockFetch({ media })))
})
afterEach(() => vi.unstubAllGlobals())

describe('album titles across themes', () => {
  it.each([
    ['Default', Default],
    ['Colorful', Colorful],
    ['Hörinsel', Hoerinsel],
    ['Wolkenklang', Wolkenklang],
    ['Classic', Classic],
  ] as const)(
    '%s reserves title space without truncating accessible names or detail titles',
    async (_, Template) => {
      const user = userEvent.setup()
      render(<Template isAdmin={false} />)
      await user.click(await screen.findByText('The Beatles'))
      for (const title of titles) {
        expect(screen.getByRole('button', { name: title })).toBeInTheDocument()
        expect(screen.getByText(title)).toHaveClass('album-tile-title')
        expect(screen.getByText(title)).toHaveAttribute('title', title)
      }
      await user.click(screen.getByRole('button', { name: titles[2] }))
      expect(screen.getByText(titles[2])).not.toHaveClass('album-tile-title')
      expect(screen.getByText(titles[2])).toBeVisible()
    },
  )
})
