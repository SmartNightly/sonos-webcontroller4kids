import path from 'node:path'
import fs from 'node:fs'
import type { AppConfig } from '../types'

export const DEFAULT_SONOS_BASE_URL = 'http://192.168.114.21:5005'

export const CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'media-data', 'config.json')

export function loadConfig(): AppConfig {
  try {
    console.log('Lade config.json von:', CONFIG_PATH)
    console.log('Datei existiert:', fs.existsSync(CONFIG_PATH))

    if (!fs.existsSync(CONFIG_PATH)) {
      console.log('config.json nicht gefunden, verwende Defaults')
      return {
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
    }

    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    const rooms = parsed.rooms || []
    const enabledRooms = parsed.enabledRooms || rooms

    console.log('config.json geladen:', { rooms: rooms.length, enabledRooms: enabledRooms.length })

    return {
      sonosBaseUrl: parsed.sonosBaseUrl || DEFAULT_SONOS_BASE_URL,
      rooms,
      enabledRooms,
      defaultRoom: parsed.defaultRoom,
      showShuffleRepeat: parsed.showShuffleRepeat !== undefined ? parsed.showShuffleRepeat : true,
      roomIcons: parsed.roomIcons || {},
      showTracklistAlbums: parsed.showTracklistAlbums !== undefined ? parsed.showTracklistAlbums : true,
      showTracklistAudiobooks: parsed.showTracklistAudiobooks !== undefined ? parsed.showTracklistAudiobooks : true,
      maxVolume: parsed.maxVolume || {},
      activeTemplate: parsed.activeTemplate || 'default',
    }
  } catch (err) {
    console.error('Fehler beim Laden von config.json:', err)
    return {
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
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    console.log('Speichere config.json nach:', CONFIG_PATH)

    const dir = path.dirname(CONFIG_PATH)
    if (!fs.existsSync(dir)) {
      console.log('Erstelle Verzeichnis:', dir)
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
    console.log('config.json erfolgreich gespeichert')
  } catch (err) {
    console.error('Fehler beim Speichern von config.json:', err)
    throw err
  }
}
