import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

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
})

describe('GET /sonos/status', () => {
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
  })
})

describe('POST /play', () => {
  beforeEach(() => {
    mockFetch.mockReset()
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
