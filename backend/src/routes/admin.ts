import { Router } from 'express'
import type { Request, Response } from 'express'
import type { AppConfig } from '../types'
import { loadConfig, saveConfig, DEFAULT_SONOS_BASE_URL } from '../services/config'
import { listTemplates } from '../services/templates'

const router = Router()

// GET /admin/sonos
router.get('/sonos', (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    res.json(config)
  } catch (err) {
    console.error('Fehler beim Laden der Sonos-Konfiguration:', err)
    res.status(500).json({ error: 'Sonos-Konfiguration konnte nicht geladen werden' })
  }
})

// GET /admin/sonos/test
router.get('/sonos/test', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    const baseUrl = config.sonosBaseUrl || DEFAULT_SONOS_BASE_URL
    const testUrl = `${baseUrl}/zones`

    console.log('Teste Sonos API Verbindung:', testUrl)

    const response = await fetch(testUrl, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error(`Sonos API returned ${response.status}`)
    const data = await response.json()

    res.json({
      status: 'ok',
      sonosBaseUrl: baseUrl,
      reachable: true,
      zones: data.length || 0,
      message: `Sonos API erreichbar, ${data.length || 0} Zonen gefunden`,
    })
  } catch (err: any) {
    console.error('Sonos API Test fehlgeschlagen:', err)
    const config = loadConfig()
    res.status(502).json({
      status: 'error',
      sonosBaseUrl: config.sonosBaseUrl || DEFAULT_SONOS_BASE_URL,
      reachable: false,
      error: err.message || 'Unbekannter Fehler',
      message: 'Sonos API nicht erreichbar',
    })
  }
})

// POST /admin/sonos/discover
router.post('/sonos/discover', async (req: Request, res: Response) => {
  const { sonosBaseUrl } = req.body as { sonosBaseUrl?: string }

  if (sonosBaseUrl !== undefined && typeof sonosBaseUrl !== 'string') {
    return res.status(400).json({ error: 'sonosBaseUrl muss eine URL sein' })
  }

  const current = loadConfig()
  const baseUrl =
    (sonosBaseUrl && sonosBaseUrl.trim().replace(/\/+$/, '')) ||
    current.sonosBaseUrl ||
    DEFAULT_SONOS_BASE_URL

  try {
    if (!['http:', 'https:'].includes(new URL(baseUrl).protocol)) throw new Error('protocol')
  } catch {
    return res.status(400).json({ error: 'sonosBaseUrl muss eine HTTP(S)-URL sein' })
  }

  async function tryFetchRoomsEndpoint() {
    const url = `${baseUrl}/rooms`
    console.log('Versuche Sonos /rooms:', url)
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) {
      throw new Error(`Sonos /rooms returned ${response.status}`)
    }
    const data = (await response.json()) as any[]
    return (data || [])
      .map((r: any) => r.roomName || r.name)
      .filter((name: any): name is string => typeof name === 'string')
      .filter((name, idx, arr) => arr.indexOf(name) === idx)
  }

  async function tryFetchZonesEndpoint() {
    const url = `${baseUrl}/zones`
    console.log('Versuche Sonos /zones:', url)
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) {
      throw new Error(`Sonos /zones returned ${response.status}`)
    }
    const data = (await response.json()) as any[]
    return (data || [])
      .flatMap((zone: any) => zone.members || [])
      .map((m: any) => m.roomName || m.name)
      .filter((name: any): name is string => typeof name === 'string')
      .filter((name, idx, arr) => arr.indexOf(name) === idx)
  }

  try {
    let rooms: string[] = []

    try {
      rooms = await tryFetchRoomsEndpoint()
      console.log('Sonos-Räume aus /rooms:', rooms)
    } catch (err) {
      console.warn('Konnte /rooms nicht verwenden, versuche /zones:', err)
      rooms = await tryFetchZonesEndpoint()
      console.log('Sonos-Räume aus /zones:', rooms)
    }

    if (!rooms || rooms.length === 0) {
      throw new Error('Keine Sonos-Räume gefunden')
    }

    const oldConfig = loadConfig()

    const enabledRoomsIntersection = oldConfig.enabledRooms?.filter((r) => rooms.includes(r)) || []

    // Only the initial discovery enables all rooms. An existing empty selection
    // means that the administrator deliberately disabled playback everywhere.
    const enabledRooms = oldConfig.rooms.length === 0 ? rooms : enabledRoomsIntersection

    const defaultRoom =
      oldConfig.defaultRoom && enabledRooms.includes(oldConfig.defaultRoom)
        ? oldConfig.defaultRoom
        : undefined

    const newConfig: AppConfig = {
      ...oldConfig,
      sonosBaseUrl: baseUrl,
      rooms,
      enabledRooms,
      defaultRoom,
    }

    saveConfig(newConfig)
    res.json(newConfig)
  } catch (err) {
    console.error('Fehler beim Holen der Sonos-Räume:', err)
    res.status(502).json({
      error: 'Sonos-Räume konnten nicht geladen werden. Details siehe Backend-Log.',
    })
  }
})

// POST /admin/sonos/rooms
router.post('/sonos/rooms', (req: Request, res: Response) => {
  const { enabledRooms } = req.body as { enabledRooms?: string[] }

  if (!Array.isArray(enabledRooms) || !enabledRooms.every((room) => typeof room === 'string')) {
    return res.status(400).json({ error: 'enabledRooms muss ein Array sein' })
  }

  const config = loadConfig()
  const cleaned = [...new Set(enabledRooms.filter((r) => config.rooms.includes(r)))]

  const newConfig: AppConfig = {
    ...config,
    enabledRooms: cleaned,
    defaultRoom:
      config.defaultRoom && cleaned.includes(config.defaultRoom) ? config.defaultRoom : undefined,
  }
  saveConfig(newConfig)
  res.json(newConfig)
})

// POST /admin/sonos/default-room
router.post('/sonos/default-room', (req: Request, res: Response) => {
  const { defaultRoom } = req.body as { defaultRoom?: string }

  const config = loadConfig()

  if (defaultRoom && !config.enabledRooms.includes(defaultRoom)) {
    return res.status(400).json({
      error: 'defaultRoom muss einer der aktivierten Räume sein',
    })
  }

  const newConfig: AppConfig = { ...config, defaultRoom: defaultRoom || undefined }
  saveConfig(newConfig)
  res.json(newConfig)
})

// POST /admin/sonos/settings
router.post('/sonos/settings', (req: Request, res: Response) => {
  const { showShuffleRepeat, maxVolume } = req.body as {
    showShuffleRepeat?: boolean
    maxVolume?: Record<string, number>
  }

  if (showShuffleRepeat !== undefined && typeof showShuffleRepeat !== 'boolean') {
    return res.status(400).json({ error: 'showShuffleRepeat muss ein Boolean sein' })
  }
  if (
    maxVolume !== undefined &&
    (!maxVolume ||
      typeof maxVolume !== 'object' ||
      Array.isArray(maxVolume) ||
      !Object.values(maxVolume).every(
        (value) => Number.isInteger(value) && value >= 0 && value <= 100,
      ))
  ) {
    return res
      .status(400)
      .json({ error: 'Lautstärkegrenzen müssen ganze Zahlen von 0 bis 100 sein' })
  }

  const config = loadConfig()

  const newConfig: AppConfig = {
    ...config,
    showShuffleRepeat:
      showShuffleRepeat !== undefined ? showShuffleRepeat : (config.showShuffleRepeat ?? true),
    maxVolume: maxVolume !== undefined ? maxVolume : config.maxVolume || {},
  }

  saveConfig(newConfig)
  res.json(newConfig)
})

// POST /admin/sonos/room-icons
router.post('/sonos/room-icons', (req: Request, res: Response) => {
  const { roomIcons } = req.body as { roomIcons?: Record<string, string> }

  const config = loadConfig()
  const newConfig: AppConfig = {
    ...config,
    roomIcons: roomIcons || config.roomIcons || {},
  }

  saveConfig(newConfig)
  res.json(newConfig)
})

// POST /admin/sonos/tracklist-settings
router.post('/sonos/tracklist-settings', (req: Request, res: Response) => {
  const { showTracklistAlbums, showTracklistAudiobooks } = req.body as {
    showTracklistAlbums?: boolean
    showTracklistAudiobooks?: boolean
  }

  const config = loadConfig()

  if (showTracklistAlbums !== undefined) config.showTracklistAlbums = showTracklistAlbums
  if (showTracklistAudiobooks !== undefined)
    config.showTracklistAudiobooks = showTracklistAudiobooks

  saveConfig(config)
  res.json(config)
})

// GET /admin/templates
router.get('/templates', (req: Request, res: Response) => {
  try {
    const templates = listTemplates()

    const config = loadConfig()
    res.json({
      templates,
      active: config.activeTemplate || 'default',
      enabled: config.enabledTemplates ?? [config.activeTemplate || 'default'],
    })
  } catch (err) {
    console.error('Fehler beim Laden der Templates:', err)
    res.status(500).json({ error: 'Templates konnten nicht geladen werden' })
  }
})

// POST /admin/templates/active
router.post('/templates/active', (req: Request, res: Response) => {
  const { template } = req.body as { template?: string }

  if (typeof template !== 'string' || !template) {
    return res.status(400).json({ error: 'template ist erforderlich' })
  }

  if (!listTemplates().includes(template)) {
    return res.status(404).json({ error: `Template '${template}' nicht gefunden` })
  }

  const config = loadConfig()
  config.activeTemplate = template
  config.enabledTemplates = [...new Set([...(config.enabledTemplates ?? []), template])]
  saveConfig(config)

  res.json({ success: true, activeTemplate: template })
})

// Saving the allowlist also keeps the installation's default inside that list.
router.post('/templates/enabled', (req: Request, res: Response) => {
  const { enabledTemplates } = req.body ?? {}
  const installed = listTemplates()
  if (
    !Array.isArray(enabledTemplates) ||
    !enabledTemplates.length ||
    enabledTemplates.some((name: unknown) => typeof name !== 'string' || !installed.includes(name))
  ) {
    return res.status(400).json({ error: 'Mindestens ein installiertes Template auswählen' })
  }
  const config = loadConfig()
  config.enabledTemplates = [...new Set<string>(enabledTemplates)]
  if (!config.enabledTemplates.includes(config.activeTemplate || 'default')) {
    config.activeTemplate = config.enabledTemplates[0]!
  }
  saveConfig(config)
  res.json({ success: true, enabled: config.enabledTemplates, active: config.activeTemplate })
})

export default router
