import path from 'node:path'
import fs from 'node:fs'
import type { MediaItem } from '../types'

export const MEDIA_PATH = path.join(__dirname, '..', '..', '..', 'media-data', 'media.json')

function loadFromDisk(): MediaItem[] {
  if (!fs.existsSync(MEDIA_PATH)) {
    console.log('media.json nicht gefunden, erstelle leeres Array')
    return []
  }
  const fileContent = fs.readFileSync(MEDIA_PATH, 'utf-8')
  const parsed = JSON.parse(fileContent) as MediaItem[]
  console.log(`media.json geladen: ${parsed.length} Einträge`)
  return parsed
}

let cache: MediaItem[] | null = null

export function loadMedia(): MediaItem[] {
  if (cache) return cache
  try {
    cache = loadFromDisk()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    cache = []
  }
  return cache
}

export function saveMedia(items: MediaItem[]): void {
  try {
    const dir = path.dirname(MEDIA_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(MEDIA_PATH, JSON.stringify(items, null, 2), 'utf-8')
    cache = items
    console.log(`media.json gespeichert: ${items.length} Einträge`)
  } catch (err) {
    console.error('Fehler beim Speichern von media.json:', err)
    throw err
  }
}
