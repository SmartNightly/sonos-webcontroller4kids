import { act, renderHook, cleanup } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useSonosPolling } from '../hooks/useSonosPolling'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const response = (title: string) =>
  ({ ok: true, json: async () => ({ track: { title } }) }) as Response

describe('Sonos polling lifecycle', () => {
  it('waits for completion before scheduling another request', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const receive = vi.fn()
    renderHook(() => useSonosPolling('Kids', receive))
    await act(() => vi.advanceTimersByTimeAsync(4000))
    expect(fetch).toHaveBeenCalledOnce()
    await act(async () => {
      resolve(response('Song'))
    })
    expect(receive).toHaveBeenCalledOnce()
    await act(() => vi.advanceTimersByTimeAsync(1999))
    expect(fetch).toHaveBeenCalledOnce()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('aborts old rooms and ignores their late responses', async () => {
    let resolveOld!: (value: Response) => void
    let oldSignal: AbortSignal | null | undefined
    vi.mocked(fetch)
      .mockImplementationOnce((_url, options) => {
        oldSignal = options?.signal
        return new Promise((resolve) => {
          resolveOld = resolve
        })
      })
      .mockResolvedValue(response('New room'))
    const receive = vi.fn()
    const { rerender, unmount } = renderHook(({ room }) => useSonosPolling(room, receive), {
      initialProps: { room: 'Old' },
    })
    await act(async () => {
      rerender({ room: 'New' })
    })
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => {
      resolveOld(response('Old room'))
    })
    expect(receive).toHaveBeenCalledTimes(1)
    expect(receive).toHaveBeenCalledWith({ track: { title: 'New room' } })
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(10000))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('aborts a stalled request and retries after the polling delay', async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    renderHook(() => useSonosPolling('Kids', vi.fn()))
    await act(() => vi.advanceTimersByTimeAsync(6999))
    expect(fetch).toHaveBeenCalledOnce()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not poll without an enabled room', () => {
    renderHook(() => useSonosPolling(null, vi.fn()))
    expect(fetch).not.toHaveBeenCalled()
  })
})
