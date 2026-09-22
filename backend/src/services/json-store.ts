import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export function writeJsonAtomically(filename: string, value: unknown): void {
  const directory = path.dirname(filename)
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true })
  const temporary = path.join(directory, `.${path.basename(filename)}.${randomUUID()}.tmp`)
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
      encoding: 'utf8',
      flag: 'wx',
      flush: true,
    })
    fs.renameSync(temporary, filename)
  } catch (error) {
    try {
      fs.unlinkSync(temporary)
    } catch {
      /* The temporary file may not exist. */
    }
    throw error
  }
}
