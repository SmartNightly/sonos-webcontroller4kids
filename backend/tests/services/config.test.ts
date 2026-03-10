import { vi, describe, it, expect, beforeEach } from 'vitest'

// Singleton mock — same object reference across vi.resetModules() cycles
const fsMock = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}

vi.mock('node:fs', () => ({ default: fsMock, ...fsMock }))

describe('services/config', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns default config when file does not exist', async () => {
    fsMock.existsSync.mockReturnValue(false)
    const { loadConfig } = await import('../../src/services/config')
    const config = loadConfig()
    expect(config.sonosBaseUrl).toBe('http://192.168.114.21:5005')
    expect(config.rooms).toEqual([])
    expect(config.enabledRooms).toEqual([])
    expect(config.showShuffleRepeat).toBe(true)
    expect(config.activeTemplate).toBe('default')
  })

  it('loads config from disk', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(
      JSON.stringify({
        sonosBaseUrl: 'http://test-sonos:5005',
        rooms: ['Kitchen', 'Living Room'],
        enabledRooms: ['Kitchen'],
      }),
    )
    const { loadConfig } = await import('../../src/services/config')
    const config = loadConfig()
    expect(config.sonosBaseUrl).toBe('http://test-sonos:5005')
    expect(config.rooms).toEqual(['Kitchen', 'Living Room'])
    expect(config.enabledRooms).toEqual(['Kitchen'])
  })

  it('uses rooms as enabledRooms when enabledRooms not in file', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(JSON.stringify({ rooms: ['Bedroom', 'Kitchen'] }))
    const { loadConfig } = await import('../../src/services/config')
    const config = loadConfig()
    expect(config.enabledRooms).toEqual(['Bedroom', 'Kitchen'])
  })

  it('caches config after first load', async () => {
    fsMock.existsSync.mockReturnValue(false)
    const { loadConfig } = await import('../../src/services/config')
    loadConfig()
    loadConfig()
    expect(fsMock.existsSync).toHaveBeenCalledTimes(1)
  })

  it('returns default config on parse error', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('not valid json {{{')
    const { loadConfig } = await import('../../src/services/config')
    const config = loadConfig()
    expect(config.sonosBaseUrl).toBe('http://192.168.114.21:5005')
  })

  it('saves config to disk and updates cache', async () => {
    fsMock.existsSync.mockReturnValue(true)
    const { loadConfig, saveConfig } = await import('../../src/services/config')
    const testConfig = {
      sonosBaseUrl: 'http://saved:5005',
      rooms: [],
      enabledRooms: [],
      showShuffleRepeat: true,
      roomIcons: {},
      showTracklistAlbums: true,
      showTracklistAudiobooks: true,
      maxVolume: {},
      activeTemplate: 'default',
    }
    saveConfig(testConfig)
    expect(fsMock.writeFileSync).toHaveBeenCalledOnce()
    // Cache should be updated — existsSync should not be called again
    const config = loadConfig()
    expect(config.sonosBaseUrl).toBe('http://saved:5005')
    expect(fsMock.existsSync).toHaveBeenCalledTimes(1) // only the dir check in saveConfig
  })
})
