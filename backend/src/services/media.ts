import path from 'node:path'
import fs from 'node:fs'
import type { MediaItem } from '../types'

export const MEDIA_PATH = path.join(__dirname, '..', '..', '..', 'media-data', 'media.json')

export function loadMedia(): MediaItem[] {
  try {
    console.log('Lade media.json von:', MEDIA_PATH)
    console.log('Datei existiert:', fs.existsSync(MEDIA_PATH))

    if (!fs.existsSync(MEDIA_PATH)) {
      console.log('media.json nicht gefunden, erstelle leeres Array')
      return []
    }

    const fileContent = fs.readFileSync(MEDIA_PATH, 'utf-8')
    const parsed = JSON.parse(fileContent) as MediaItem[]
    console.log(`media.json geladen: ${parsed.length} Einträge`)
    return parsed
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    return []
  }
}

export function saveMedia(items: MediaItem[]): void {
  try {
    console.log('Speichere media.json nach:', MEDIA_PATH)
    console.log('Anzahl Einträge:', items.length)

    const dir = path.dirname(MEDIA_PATH)
    if (!fs.existsSync(dir)) {
      console.log('Erstelle Verzeichnis:', dir)
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(MEDIA_PATH, JSON.stringify(items, null, 2), 'utf-8')
    console.log('media.json erfolgreich gespeichert')
  } catch (err) {
    console.error('Fehler beim Speichern von media.json:', err)
    throw err
  }
}
