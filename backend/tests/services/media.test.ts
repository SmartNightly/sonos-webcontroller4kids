import { vi, describe, it, expect, beforeEach } from 'vitest'

const fsMock = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}

vi.mock('node:fs', () => ({ default: fsMock, ...fsMock }))

const sampleItems = [
  {
    id: 'album1',
    title: 'Test Album',
    kind: 'album',
    service: 'appleMusic',
    coverUrl: 'http://example.com/cover.jpg',
    appleId: '12345',
  },
]

describe('services/media', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns empty array when file does not exist', async () => {
    fsMock.existsSync.mockReturnValue(false)
    const { loadMedia } = await import('../../src/services/media')
    const items = loadMedia()
    expect(items).toEqual([])
  })

  it('loads items from disk', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(JSON.stringify(sampleItems))
    const { loadMedia } = await import('../../src/services/media')
    const items = loadMedia()
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('album1')
  })

  it('caches items after first load', async () => {
    fsMock.existsSync.mockReturnValue(false)
    const { loadMedia } = await import('../../src/services/media')
    loadMedia()
    loadMedia()
    expect(fsMock.existsSync).toHaveBeenCalledTimes(1)
  })

  it('returns empty array on parse error', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('invalid json')
    const { loadMedia } = await import('../../src/services/media')
    const items = loadMedia()
    expect(items).toEqual([])
  })

  it('saves items to disk and updates cache', async () => {
    fsMock.existsSync.mockReturnValue(true)
    const { loadMedia, saveMedia } = await import('../../src/services/media')
    saveMedia(sampleItems as any)
    expect(fsMock.writeFileSync).toHaveBeenCalledOnce()
    // Cache updated — should not re-read from disk
    const items = loadMedia()
    expect(items).toHaveLength(1)
    expect(fsMock.existsSync).toHaveBeenCalledTimes(1) // only the dir check in saveMedia
  })
})
