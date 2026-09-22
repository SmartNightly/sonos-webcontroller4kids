import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { AppConfig } from '../../src/types'

vi.mock('../../src/services/config', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  DEFAULT_SONOS_BASE_URL: 'http://sonos:5005',
}))
vi.mock('../../src/services/templates', () => ({
  listTemplates: vi.fn(() => ['default', 'colorful']),
}))
import { loadConfig, saveConfig } from '../../src/services/config'
import adminRouter from '../../src/routes/admin'

const app = express()
app.use(express.json())
app.use('/admin', adminRouter)
let config: AppConfig

beforeEach(() => {
  vi.clearAllMocks()
  config = {
    sonosBaseUrl: 'http://sonos:5005',
    rooms: ['Kids', 'Office'],
    enabledRooms: ['Kids'],
    defaultRoom: 'Kids',
    maxVolume: { Kids: 20 },
    activeTemplate: 'colorful',
    roomIcons: { Kids: '🎵' },
    showShuffleRepeat: false,
    showTracklistAlbums: false,
  }
  vi.mocked(loadConfig).mockImplementation(() => structuredClone(config))
  vi.mocked(saveConfig).mockImplementation((value) => {
    config = structuredClone(value)
  })
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => [{ roomName: 'Kids' }, { roomName: 'New' }],
      }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('room discovery and settings', () => {
  it('preserves all settings and the enabled selection during rediscovery', async () => {
    const original = structuredClone(config)
    const res = await request(app).post('/admin/sonos/discover').send({})
    expect(res.status).toBe(200)
    expect(config).toEqual({ ...original, rooms: ['Kids', 'New'] })
  })

  it('preserves an explicitly empty room selection', async () => {
    config.enabledRooms = []
    const res = await request(app).post('/admin/sonos/discover').send({})
    expect(res.body.enabledRooms).toEqual([])
    expect(config.defaultRoom).toBeUndefined()
  })

  it('does not enable replacement rooms if selected rooms disappear', async () => {
    config.enabledRooms = ['Office']
    const res = await request(app).post('/admin/sonos/discover').send({})
    expect(res.body.enabledRooms).toEqual([])
  })

  it('enables discovered rooms on first setup', async () => {
    config.rooms = []
    config.enabledRooms = []
    const res = await request(app).post('/admin/sonos/discover').send({})
    expect(res.body.enabledRooms).toEqual(['Kids', 'New'])
  })

  it('clears a default room when it is disabled', async () => {
    const res = await request(app).post('/admin/sonos/rooms').send({ enabledRooms: [] })
    expect(res.status).toBe(200)
    expect(config.defaultRoom).toBeUndefined()
  })

  it.each([-1, 101, 1.5, '20'])('rejects invalid volume limit %s', async (limit) => {
    const res = await request(app)
      .post('/admin/sonos/settings')
      .send({ maxVolume: { Kids: limit } })
    expect(res.status).toBe(400)
    expect(saveConfig).not.toHaveBeenCalled()
  })
})

describe('template management', () => {
  it('lists packaged templates and preserves the configured active template', async () => {
    const res = await request(app).get('/admin/templates')
    expect(res.body).toEqual({ templates: ['default', 'colorful'], active: 'colorful' })
  })

  it('switches to a packaged template', async () => {
    const res = await request(app).post('/admin/templates/active').send({ template: 'default' })
    expect(res.status).toBe(200)
    expect(config.activeTemplate).toBe('default')
  })

  it.each(['missing', '../', '../../backend'])('rejects unknown template %s', async (template) => {
    const res = await request(app).post('/admin/templates/active').send({ template })
    expect(res.status).toBe(404)
    expect(saveConfig).not.toHaveBeenCalled()
  })
})
