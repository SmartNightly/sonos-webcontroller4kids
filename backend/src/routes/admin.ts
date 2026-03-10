import { Router } from 'express'
import type { Request, Response } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import type { AppConfig } from '../types'
import { loadConfig, saveConfig, DEFAULT_SONOS_BASE_URL } from '../services/config'

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

    const response = await fetch(testUrl)
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

  const current = loadConfig()
  const baseUrl =
    (sonosBaseUrl && sonosBaseUrl.trim().replace(/\/+$/, '')) ||
    current.sonosBaseUrl ||
    DEFAULT_SONOS_BASE_URL

  async function tryFetchRoomsEndpoint() {
    const url = `${baseUrl}/rooms`
    console.log('Versuche Sonos /rooms:', url)
    const response = await fetch(url)
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
    const response = await fetch(url)
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

    const enabledRoomsIntersection =
      oldConfig.enabledRooms?.filter(r => rooms.includes(r)) || []

    const enabledRooms =
      enabledRoomsIntersection.length > 0 ? enabledRoomsIntersection : rooms

    const defaultRoom =
      oldConfig.defaultRoom && enabledRooms.includes(oldConfig.defaultRoom)
        ? oldConfig.defaultRoom
        : undefined

    const newConfig: AppConfig = {
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

  if (!Array.isArray(enabledRooms)) {
    return res.status(400).json({ error: 'enabledRooms muss ein Array sein' })
  }

  const config = loadConfig()
  const cleaned = enabledRooms.filter(r => config.rooms.includes(r))

  const newConfig: AppConfig = { ...config, enabledRooms: cleaned }
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

  const config = loadConfig()

  const newConfig: AppConfig = {
    ...config,
    showShuffleRepeat: showShuffleRepeat !== undefined ? showShuffleRepeat : (config.showShuffleRepeat ?? true),
    maxVolume: maxVolume !== undefined ? maxVolume : (config.maxVolume || {}),
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
  if (showTracklistAudiobooks !== undefined) config.showTracklistAudiobooks = showTracklistAudiobooks

  saveConfig(config)
  res.json(config)
})

// GET /admin/templates
router.get('/templates', (req: Request, res: Response) => {
  const templatesPath = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'templates')

  try {
    if (!fs.existsSync(templatesPath)) {
      return res.json({ templates: ['default'], active: 'default' })
    }

    const templates = fs.readdirSync(templatesPath).filter(name => {
      const templatePath = path.join(templatesPath, name)
      return fs.statSync(templatePath).isDirectory()
    })

    const config = loadConfig()
    res.json({ templates, active: config.activeTemplate || 'default' })
  } catch (err) {
    console.error('Fehler beim Laden der Templates:', err)
    res.status(500).json({ error: 'Templates konnten nicht geladen werden' })
  }
})

// POST /admin/templates/active
router.post('/templates/active', (req: Request, res: Response) => {
  const { template } = req.body as { template?: string }

  if (!template) {
    return res.status(400).json({ error: 'template ist erforderlich' })
  }

  const templatesPath = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'templates', template)

  if (!fs.existsSync(templatesPath)) {
    return res.status(404).json({ error: `Template '${template}' nicht gefunden` })
  }

  const config = loadConfig()
  config.activeTemplate = template
  saveConfig(config)

  res.json({ success: true, activeTemplate: template })
})

export default router
