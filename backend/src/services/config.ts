import path from 'node:path'
import fs from 'node:fs'
import type { AppConfig } from '../types'
import { writeJsonAtomically } from './json-store'

export const DEFAULT_SONOS_BASE_URL = 'http://192.168.114.21:5005'

export const CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'media-data', 'config.json')

const DEFAULT_CONFIG: AppConfig = {
  sonosBaseUrl: DEFAULT_SONOS_BASE_URL,
  rooms: [],
  enabledRooms: [],
  defaultRoom: undefined,
  showShuffleRepeat: true,
  roomIcons: {},
  showTracklistAlbums: true,
  showTracklistAudiobooks: true,
  maxVolume: {},
  activeTemplate: 'default',
}

function parseConfig(raw: string): AppConfig {
  const parsed = JSON.parse(raw) as Partial<AppConfig>
  const rooms = parsed.rooms || []
  const enabledRooms = parsed.enabledRooms || rooms
  return {
    sonosBaseUrl: parsed.sonosBaseUrl || DEFAULT_SONOS_BASE_URL,
    rooms,
    enabledRooms,
    defaultRoom: parsed.defaultRoom,
    showShuffleRepeat: parsed.showShuffleRepeat !== undefined ? parsed.showShuffleRepeat : true,
    roomIcons: parsed.roomIcons || {},
    showTracklistAlbums:
      parsed.showTracklistAlbums !== undefined ? parsed.showTracklistAlbums : true,
    showTracklistAudiobooks:
      parsed.showTracklistAudiobooks !== undefined ? parsed.showTracklistAudiobooks : true,
    maxVolume: parsed.maxVolume || {},
    activeTemplate: parsed.activeTemplate || 'default',
    enabledTemplates: Array.isArray(parsed.enabledTemplates)
      ? parsed.enabledTemplates.filter((name): name is string => typeof name === 'string')
      : [parsed.activeTemplate || 'default'],
  }
}

function loadFromDisk(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('config.json nicht gefunden, verwende Defaults')
    return { ...DEFAULT_CONFIG }
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
  const config = parseConfig(raw)
  console.log('config.json geladen:', {
    rooms: config.rooms.length,
    enabledRooms: config.enabledRooms.length,
  })
  return config
}

let cache: AppConfig | null = null

export function loadConfig(): AppConfig {
  if (cache) return structuredClone(cache)
  try {
    cache = loadFromDisk()
  } catch (err) {
    console.error('Fehler beim Laden von config.json:', err)
    cache = structuredClone(DEFAULT_CONFIG)
  }
  return structuredClone(cache)
}

export function saveConfig(config: AppConfig): void {
  try {
    writeJsonAtomically(CONFIG_PATH, config)
    cache = structuredClone(config)
    console.log('config.json gespeichert')
  } catch (err) {
    console.error('Fehler beim Speichern von config.json:', err)
    throw err
  }
}
