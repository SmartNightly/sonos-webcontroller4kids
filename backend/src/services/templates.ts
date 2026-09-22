import fs from 'node:fs'
import path from 'node:path'

export function listTemplates(): string[] {
  const frontend = path.join(__dirname, '..', '..', '..', 'frontend')
  const manifest = path.join(frontend, 'dist', 'templates.json')
  if (fs.existsSync(manifest)) {
    const names: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    if (
      !Array.isArray(names) ||
      !names.every((name) => typeof name === 'string' && /^[a-z0-9-]+$/.test(name))
    ) {
      throw new Error('Ungültiges Template-Manifest')
    }
    return names
  }

  // Development has sources, production only needs the generated manifest.
  const source = path.join(frontend, 'src', 'templates')
  return fs
    .readdirSync(source)
    .filter(
      (name) => /^[a-z0-9-]+$/.test(name) && fs.existsSync(path.join(source, name, 'App.tsx')),
    )
    .sort()
}
