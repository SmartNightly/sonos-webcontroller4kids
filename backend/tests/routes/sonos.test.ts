import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../../src/services/config', () => ({
  loadConfig: vi.fn().mockReturnValue({
    sonosBaseUrl: 'http://test-sonos:5005',
    rooms: ['Kitchen'],
    enabledRooms: ['Kitchen'],
    showShuffleRepeat: true,
    roomIcons: {},
    showTracklistAlbums: true,
    showTracklistAudiobooks: true,
    maxVolume: {},
    activeTemplate: 'default',
  }),
  DEFAULT_SONOS_BASE_URL: 'http://192.168.114.21:5005',
}))

vi.mock('../../src/services/media', () => ({
  loadMedia: vi.fn(),
}))

vi.mock('../../src/services/sonos', () => ({
  buildSonosUrl: vi.fn(),
  fetchWithTimeout: vi.fn(),
}))

vi.mock('../../src/services/apple-music', () => ({
  searchApple: vi.fn(),
}))

import { loadMedia } from '../../src/services/media'
import { loadConfig } from '../../src/services/config'
import { buildSonosUrl, fetchWithTimeout } from '../../src/services/sonos'
import { searchApple } from '../../src/services/apple-music'
import sonosRouter from '../../src/routes/sonos'

const app = express()
app.use(express.json())
app.use(sonosRouter)

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('POST /sonos/control', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(loadConfig).mockReturnValue({
      sonosBaseUrl: 'http://test-sonos:5005',
      rooms: ['Kitchen'],
      enabledRooms: ['Kitchen'],
      maxVolume: { Kitchen: 20 },
    })
  })

  it('returns 400 when room or action missing', async () => {
    const res = await request(app).post('/sonos/control').send({ room: 'Kitchen' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown action', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const res = await request(app)
      .post('/sonos/control')
      .send({ room: 'Kitchen', action: 'unknownAction' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('unknownAction')
  })

  it('executes play action', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const res = await request(app).post('/sonos/control').send({ room: 'Kitchen', action: 'play' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', action: 'play', room: 'Kitchen' })
  })

  it('executes clearqueue action', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const res = await request(app)
      .post('/sonos/control')
      .send({ room: 'Kitchen', action: 'clearqueue' })
    expect(res.status).toBe(200)
  })

  it('returns 400 for setVolume without value', async () => {
    const res = await request(app)
      .post('/sonos/control')
      .send({ room: 'Kitchen', action: 'setVolume' })
    expect(res.status).toBe(400)
  })

  it.each([-1, 101, 1.5, '5', null])('rejects invalid volume value %s', async (value) => {
    const res = await request(app)
      .post('/sonos/control')
      .send({ room: 'Kitchen', action: 'volumeUp', value })
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    () => Promise.reject(new Error('offline')),
    () => Promise.resolve({ ok: false }),
    () => Promise.resolve({ ok: true, json: async () => ({}) }),
  ])('does not raise volume if the state cannot be read safely', async (stateResponse) => {
    mockFetch.mockImplementation(stateResponse)
    const res = await request(app)
      .post('/sonos/control')
      .send({ room: 'Kitchen', action: 'volumeUp' })
    expect(res.status).toBe(502)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0]![0]).toMatch(/\/state$/)
  })

  it('serializes concurrent changes and clamps absolute targets', async () => {
    let volume = 12
    const paths: string[] = []
    mockFetch.mockImplementation(async (url: string) => {
      paths.push(url.split('/Kitchen/')[1]!)
      if (url.endsWith('/state')) {
        const snapshot = volume
        await new Promise((resolve) => setTimeout(resolve, 10))
        return { ok: true, json: async () => ({ volume: snapshot }) }
      }
      volume = Number(url.split('/volume/')[1])
      return { ok: true }
    })
    const responses = await Promise.all(
      [1, 2, 3].map(() =>
        request(app).post('/sonos/control').send({ room: 'Kitchen', action: 'volumeUp' }),
      ),
    )
    expect(responses.every((response) => response.status === 200)).toBe(true)
    expect(paths).toEqual(['state', 'volume/17', 'state', 'volume/20', 'state', 'volume/20'])
    expect(volume).toBe(20)
  })

  it('honors a zero volume limit', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      sonosBaseUrl: 'http://test-sonos:5005',
      rooms: ['Kitchen'],
      enabledRooms: ['Kitchen'],
      maxVolume: { Kitchen: 0 },
    })
    mockFetch.mockResolvedValue({ ok: true })
    const res = await request(app)
      .post('/sonos/control')
      .send({ room: 'Kitchen', action: 'setVolume', value: 70 })
    expect(res.status).toBe(200)
    expect(mockFetch.mock.calls[0]![0]).toMatch(/\/volume\/0$/)
  })
})

describe('GET /sonos/status', () => {
  beforeEach(() => {
    vi.mocked(loadConfig).mockReturnValue({
      sonosBaseUrl: 'http://test-sonos:5005',
      rooms: ['Kitchen'],
      enabledRooms: ['Kitchen'],
    })
    vi.mocked(fetchWithTimeout).mockReset()
  })
  it('returns 400 when room query param missing', async () => {
    const res = await request(app).get('/sonos/status')
    expect(res.status).toBe(400)
  })

  it('returns status with available: false when Sonos unreachable', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue({
      ok: false,
      url: 'http://test-sonos:5005/Kitchen/state',
      error: 'connection refused',
    })
    const res = await request(app).get('/sonos/status?room=Kitchen')
    expect(res.status).toBe(200)
    expect(res.body.available).toBe(false)
    expect(fetchWithTimeout).toHaveBeenCalledOnce()
  })

  it('uses a complete state without querying fallback endpoints', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue({
      ok: true,
      url: 'state',
      json: { playbackState: 'PLAYING', currentTrack: { title: 'Song' } },
    })
    const res = await request(app).get('/sonos/status?room=Kitchen')
    expect(res.body.track.title).toBe('Song')
    expect(fetchWithTimeout).toHaveBeenCalledOnce()
  })

  it('only falls back when metadata is missing', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce({ ok: true, url: 'state', json: { playbackState: 'PLAYING' } })
      .mockResolvedValueOnce({ ok: true, url: 'now', json: { title: 'Song' } })
    const res = await request(app).get('/sonos/status?room=Kitchen')
    expect(res.body.track.title).toBe('Song')
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetchWithTimeout).mock.calls[1]![1]).toBeLessThanOrEqual(3000)
  })
})

describe('disabled rooms', () => {
  it('rejects status, controls and playback even for a known room', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      sonosBaseUrl: 'http://test-sonos:5005',
      rooms: ['Kitchen'],
      enabledRooms: [],
    })
    mockFetch.mockClear()
    expect((await request(app).get('/sonos/status?room=Kitchen')).status).toBe(403)
    expect(
      (await request(app).post('/sonos/control').send({ room: 'Kitchen', action: 'play' })).status,
    ).toBe(403)
    expect((await request(app).post('/play').send({ room: 'Kitchen', id: 'album1' })).status).toBe(
      403,
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('POST /play', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(loadConfig).mockReturnValue({
      sonosBaseUrl: 'http://test-sonos:5005',
      rooms: ['Kitchen'],
      enabledRooms: ['Kitchen'],
    })
  })

  it('returns 400 when id or room missing', async () => {
    const res = await request(app).post('/play').send({ id: 'x' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when media item not found', async () => {
    vi.mocked(loadMedia).mockReturnValue([])
    const res = await request(app).post('/play').send({ id: 'missing', room: 'Kitchen' })
    expect(res.status).toBe(404)
  })

  it('plays a media item successfully', async () => {
    vi.mocked(loadMedia).mockReturnValue([
      {
        id: 'album1',
        title: 'Test Album',
        kind: 'album',
        service: 'appleMusic',
        coverUrl: '',
        appleId: '123',
      },
    ])
    vi.mocked(buildSonosUrl).mockReturnValue(
      'http://test-sonos:5005/Kitchen/applemusic/now/album:123',
    )
    mockFetch.mockResolvedValue({ ok: true })
    const res = await request(app).post('/play').send({ id: 'album1', room: 'Kitchen' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('GET /search/apple', () => {
  it('returns 400 when q param missing', async () => {
    const res = await request(app).get('/search/apple')
    expect(res.status).toBe(400)
  })

  it('returns search results', async () => {
    vi.mocked(searchApple).mockResolvedValue([
      {
        service: 'appleMusic',
        kind: 'album',
        title: 'Found Album',
        artist: 'Artist',
        album: 'Found Album',
        coverUrl: '',
        appleAlbumId: '999',
      },
    ])
    const res = await request(app).get('/search/apple?q=test')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].title).toBe('Found Album')
  })
})
