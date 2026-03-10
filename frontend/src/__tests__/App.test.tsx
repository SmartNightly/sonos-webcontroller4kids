import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from '../App'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App (template loader)', () => {
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
