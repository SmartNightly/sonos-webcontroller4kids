import path from 'node:path'
import fs from 'node:fs'
import type { MediaItem } from '../types'
import { writeJsonAtomically } from './json-store'

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
  if (cache) return structuredClone(cache)
  try {
    cache = loadFromDisk()
  } catch (err) {
    console.error('Fehler beim Laden von media.json:', err)
    cache = []
  }
  return structuredClone(cache)
}

export function saveMedia(items: MediaItem[]): void {
  try {
    writeJsonAtomically(MEDIA_PATH, items)
    cache = structuredClone(items)
    console.log(`media.json gespeichert: ${items.length} Einträge`)
  } catch (err) {
    console.error('Fehler beim Speichern von media.json:', err)
    throw err
  }
}
