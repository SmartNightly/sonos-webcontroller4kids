import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { MediaItem, MediaTrack } from '../../src/types'

vi.mock('../../src/services/config', () => ({
  loadConfig: vi.fn().mockReturnValue({
    sonosBaseUrl: 'http://test-sonos:5005',
    rooms: [],
    enabledRooms: [],
    showShuffleRepeat: true,
    roomIcons: {},
    showTracklistAlbums: true,
    showTracklistAudiobooks: true,
    maxVolume: {},
    activeTemplate: 'default',
  }),
  DEFAULT_SONOS_BASE_URL: 'http://192.168.114.21:5005',
}))

import { buildSonosUrl, fetchWithTimeout } from '../../src/services/sonos'

const baseItem: MediaItem = {
  id: 'test-item',
  title: 'Test Album',
  kind: 'album',
  service: 'appleMusic',
  coverUrl: '',
  appleId: '999',
}

describe('buildSonosUrl', () => {
  it('builds Apple Music track URL when track with appleSongId is given', () => {
    const track: MediaTrack = { id: 't1', title: 'Track 1', appleSongId: '456' }
    const url = buildSonosUrl(baseItem, 'Kitchen', track)
    expect(url).toBe('http://test-sonos:5005/Kitchen/applemusic/now/song:456')
  })

  it('builds Apple Music album URL when no track given', () => {
    const url = buildSonosUrl(baseItem, 'Living Room')
    expect(url).toBe('http://test-sonos:5005/Living%20Room/applemusic/now/album:999')
  })

  it('URL-encodes the room name', () => {
    const url = buildSonosUrl(baseItem, 'Büro')
    expect(url).toContain('B%C3%BCro')
  })

  it('falls back to sonosUri when service is not appleMusic', () => {
    const item: MediaItem = {
      ...baseItem,
      service: 'spotify',
      sonosUri: 'spotify/now/playlist:abc',
    }
    const url = buildSonosUrl(item, 'Kitchen')
    expect(url).toBe('http://test-sonos:5005/Kitchen/spotify/now/playlist:abc')
  })

  it('throws when no playback path can be determined', () => {
    const item: MediaItem = {
      id: 'no-path',
      title: 'No Path',
      kind: 'other',
      service: 'spotify',
      coverUrl: '',
    }
    expect(() => buildSonosUrl(item, 'Kitchen')).toThrow(
      'Kein Abspielpfad für MediaItem no-path konfiguriert',
    )
  })
})

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns json result on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '{"status":"ok"}',
      }),
    )
    const result = await fetchWithTimeout('http://example.com/test')
    expect(result.ok).toBe(true)
    expect(result.url).toBe('http://example.com/test')
    if ('json' in result) {
      expect(result.json).toEqual({ status: 'ok' })
    }
  })

  it('returns text result when response is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'plain text response',
      }),
    )
    const result = await fetchWithTimeout('http://example.com/test')
    expect(result.ok).toBe(true)
    if ('text' in result) {
      expect(result.text).toBe('plain text response')
    }
  })

  it('returns error result when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))
    const result = await fetchWithTimeout('http://unreachable')
    expect(result.ok).toBe(false)
    if ('error' in result) {
      expect(result.error).toContain('connection refused')
    }
  })

  it('returns timeout error on abort', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        return Promise.reject(err)
      }),
    )
    const result = await fetchWithTimeout('http://slow', 100)
    expect(result.ok).toBe(false)
    if ('error' in result) {
      expect(result.error).toContain('timeout')
    }
  })
})
